/**
 * ============================================================================
 *  Smart Edu Pro — بنك الأسئلة | Cloud Functions (طبقة المنطق الخادمي)
 * ----------------------------------------------------------------------------
 *  كل ما يمكن للطالب التلاعب به من المتصفح يُنفَّذ هنا بدلاً من ذلك:
 *   - startExam        : يتحقق من الاشتراك ثم يعيد الأسئلة *بدون* الإجابة الصحيحة
 *   - checkAnswer      : وضع «الشرح الفوري»: يثبّت إجابة سؤال واحد ثم يكشف تصحيحه
 *   - submitExam       : يصحّح من طرف الخادم ويحفظ المحاولة ويعيد المراجعة
 *   - approvePayment   : تفعيل اشتراك الطالب بعد مراجعة إثبات الدفع (أدمن)
 *   - rejectPayment    : رفض الطلب مع سبب (أدمن)
 *   - setSubscription  : تعديل يدوي لحالة اشتراك (أدمن)
 *   - adminOverview    : أرقام لوحة التحكم (أدمن)
 * ============================================================================
 */

const { setGlobalOptions } = require('firebase-functions/v2');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const { examAccessDecision } = require('./lib/examAccess');
const { applyAnswers, previousDay } = require('./lib/streak');
const logger = require('firebase-functions/logger');

initializeApp();
const db = getFirestore();

// أوروبا الغربية = أقرب منطقة زمن استجابة للأردن ضمن مناطق Firebase الشائعة
setGlobalOptions({ region: 'europe-west1', maxInstances: 20 });

// ---------------------------------------------------------------------------
//  ثوابت
// ---------------------------------------------------------------------------
// السقف مفروض بحد حجم مستند Firestore (1MB): مستند المحاولة يخزّن مصفوفة `review`
// التي تحوي نص كل سؤال وخياراته. القياس على بيانات حقيقية: 576 بايت للسؤال وسطياً
// و1106 بايت لأكبر سؤال — أي ~948 سؤالاً نظرياً. 500 تترك هامش أمان مضاعف يستوعب
// إضافة حقل الشرح (explanation) للأسئلة مستقبلاً.
const MAX_QUESTIONS_PER_EXAM = 500;
const MIN_QUESTIONS_PER_EXAM = 5;
// 8 دقائق لكل 20 سؤالاً = 0.4 دقيقة للسؤال الواحد
const DEFAULT_MINUTES_PER_QUESTION = 0.4;
const SUBMIT_GRACE_SECONDS = 90; // سماحية للشبكة عند التسليم التلقائي

// حدود الإيقاف المؤقّت (تُفرض خادمياً — العميل يعرضها فقط)
const MAX_PAUSES = 2;
const MAX_PAUSE_SECONDS = 5 * 60;

// الاختبار بلا مؤقّت يبقى «جارياً» حتى هذا الحد ثم يُعدّ متروكاً
// (مطابق لعمر النسخة المحلية في lib/examSession.js)
const UNTIMED_MAX_SECONDS = 6 * 60 * 60;
// حد استعلام `in` في Firestore
const MAX_LESSONS_PER_EXAM = 30;
// مراجعة الأخطاء: كم محاولة سابقة تُقرأ لاستخراج الأسئلة الخاطئة
const MISTAKES_SCAN_ATTEMPTS = 100;

// المعاينة المجانية: أي طالب مسجَّل يجرّب الدرس الأول من أي مادة دون اشتراك.
// السقف يبقى صغيراً حتى تظل تجربة تذوّق لا بديلاً عن الاشتراك.
const FREE_PREVIEW_MAX_QUESTIONS = 10;

// ---------------------------------------------------------------------------
//  أدوات مساعدة
// ---------------------------------------------------------------------------
function requireAuth(request) {
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول أولاً.');
  }
  return request.auth.uid;
}

function requireAdmin(request) {
  const uid = requireAuth(request);
  if (request.auth.token.admin !== true) {
    throw new HttpsError('permission-denied', 'هذه العملية متاحة للإدارة فقط.');
  }
  return uid;
}

function shuffle(array) {
  const a = [...array];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------------------------------------------------------------------------
//  الحماسات اليومية
// ---------------------------------------------------------------------------
// اليوم الرسمي للنظام بتوقيت عمّان، من ساعة الخادم وحدها: ساعة جهاز الطالب
// ومنطقته الزمنية لا تدخلان الحساب إطلاقاً. `en-CA` تعطي الصيغة YYYY-MM-DD.
const ammanDayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Amman',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const ammanDay = (at = new Date()) => ammanDayFormatter.format(at);

/**
 * يسجّل أسئلة أجاب عنها الطالب فعلياً، ويمنح الحماسة والمكافأة إن استحقّهما.
 *
 * كل شيء داخل معاملة واحدة: قراءة الحالة، وكتابتها، وسجلّ المكافأة، وزيادة
 * رصيد النقاط. الطلبات المتزامنة (جهازان، أو نقرتان سريعتان) تُعاد تلقائياً
 * على الحالة الأحدث، فلا تُمنح حماسة مرتين ولا تُحتسب إجابة مرتين.
 *
 * معرّف مستند المكافأة حتمي (`uid_day`) كحماية ثانية: إعادة تنفيذ المعاملة
 * لا تنشئ سجلّين لليوم نفسه.
 */
async function recordStreakActivity(uid, questionIds) {
  const unique = [...new Set((questionIds || []).filter((id) => typeof id === 'string' && id))];
  if (unique.length === 0) return null;

  const day = ammanDay();
  const streakRef = db.doc(`streaks/${uid}`);

  try {
    return await db.runTransaction(async (tx) => {
      const snap = await tx.get(streakRef);
      const { state, changed, events } = applyAnswers(snap.exists ? snap.data() : null, day, unique);
      if (!changed) return { state, events };

      tx.set(streakRef, { ...state, uid, updatedAt: FieldValue.serverTimestamp() }, { merge: true });

      if (events.reward) {
        tx.set(db.doc(`rewards/${uid}_${day}`), {
          uid,
          type: 'streak_bonus',
          points: events.reward.points,
          streak: events.reward.streak,
          reason: `إكمال ${events.reward.streak} حماسات متتالية`,
          day,
          createdAt: FieldValue.serverTimestamp(),
        });
        // النقاط تُضاف إلى مستند لوحة الأبطال نفسه في حقل مستقل عن
        // `subjectScores`، فلا تختلط مكافأة الالتزام بترتيب المادة
        tx.set(
          db.doc(`leaderboard/${uid}`),
          { bonusPoints: FieldValue.increment(events.reward.points) },
          { merge: true }
        );
      }
      return { state, events };
    });
  } catch (err) {
    // الحماسات ميزة تحفيزية: فشلها يجب ألا يُسقط تسليم اختبار أو كشف إجابة
    logger.error('recordStreakActivity failed', { uid, error: err.message });
    return null;
  }
}

/** ما يُعاد للمتصفح من نتيجة الحماسات — بلا معرّفات الأسئلة. */
function streakPayload(result) {
  if (!result) return null;
  const { state, events } = result;
  return {
    current: state.current,
    longest: state.longest,
    totalEarned: state.totalEarned,
    todayCount: state.today.count,
    todayEarned: state.today.earned,
    events,
  };
}

/**
 * يحسم صلاحية الطالب لبدء هذا الاختبار تحديداً، ويعيد `{ preview }`.
 * القرار نفسه في lib/examAccess.js (دالة خالصة مختبَرة)؛ هنا القراءة من
 * Firestore وتعليم الاشتراك المنتهي والرفض.
 */
async function resolveExamAccess(uid, subjectId, { mode, lessonNumbers, subjectData }) {
  const userSnap = await db.doc(`users/${uid}`).get();
  if (!userSnap.exists) {
    throw new HttpsError('not-found', 'لم يتم العثور على حساب الطالب.');
  }

  const decision = examAccessDecision({
    user: userSnap.data(),
    subjectId,
    mode,
    lessonNumbers,
    subjectData,
  });

  if (decision.expired) {
    await db.doc(`users/${uid}`).update({
      [`subscriptions.${subjectId}.status`]: 'expired',
    });
  }
  if (decision.access === 'full') return { preview: false };
  if (decision.access === 'preview') return { preview: true };

  throw new HttpsError(
    'permission-denied',
    decision.expired
      ? 'انتهت صلاحية اشتراكك في هذه المادة.'
      : 'هذه المادة غير مفعّلة لك — جرّب الدرس الأول مجاناً، أو اشترك للوصول لبقية الدروس.',
    { previewLesson: decision.previewLesson }
  );
}

/**
 * سحب عيّنة عشوائية من الأسئلة دون تحميل بنك الأسئلة كاملاً.
 * يعتمد على الحقل `random` (رقم 0..1 يُكتب لكل سؤال عند الاستيراد):
 * نستعلم من نقطة عشوائية للأمام، ثم نلتف للبداية إن لم يكتمل العدد.
 * `lessonNumbers`: null = كل الدروس، وإلا مصفوفة أرقام دروس (درس واحد أو أكثر).
 */
async function sampleQuestions({ subjectId, lessonNumbers, count }) {
  const base = () => {
    let q = db.collection('questions').where('subjectId', '==', subjectId);
    if (lessonNumbers && lessonNumbers.length === 1) {
      q = q.where('lessonNumber', '==', lessonNumbers[0]);
    } else if (lessonNumbers && lessonNumbers.length > 1) {
      q = q.where('lessonNumber', 'in', lessonNumbers);
    }
    return q;
  };

  const pivot = Math.random();
  const collected = new Map();

  const forward = await base().where('random', '>=', pivot).orderBy('random').limit(count).get();
  forward.forEach((d) => collected.set(d.id, d));

  if (collected.size < count) {
    const wrap = await base()
      .where('random', '<', pivot)
      .orderBy('random')
      .limit(count - collected.size)
      .get();
    wrap.forEach((d) => collected.set(d.id, d));
  }

  return shuffle([...collected.values()]);
}

/**
 * أسئلة المادة التي أخطأ فيها الطالب في آخر مرة ظهرت له (أو تركها بلا إجابة).
 * سؤال أُجيب عنه صحيحاً لاحقاً يخرج من القائمة. تُقرأ من مراجعات المحاولات
 * المسلَّمة نفسها — لا مخزن إضافي يحتاج مزامنة.
 */
async function latestWrongQuestionIds(uid, subjectId) {
  const snap = await db
    .collection('attempts')
    .where('uid', '==', uid)
    .where('subjectId', '==', subjectId)
    .where('status', '==', 'submitted')
    .limit(MISTAKES_SCAN_ATTEMPTS)
    .get();

  const attempts = snap.docs
    .map((d) => d.data())
    .sort((a, b) => (a.submittedAt?.toMillis?.() || 0) - (b.submittedAt?.toMillis?.() || 0));

  const latest = new Map(); // questionId → isCorrect في آخر ظهور
  for (const a of attempts) {
    for (const r of a.review || []) latest.set(r.questionId, Boolean(r.isCorrect));
  }
  return [...latest.entries()].filter(([, ok]) => !ok).map(([id]) => id);
}

/** هل انقضى وقت محاولة جارية (مع سماحية الشبكة)؟ */
function attemptExpired(attempt) {
  const startedAt = attempt.startedAt ? attempt.startedAt.toMillis() : 0;
  const limitSeconds =
    attempt.timed === false ? UNTIMED_MAX_SECONDS : attempt.durationSeconds + SUBMIT_GRACE_SECONDS;
  return Date.now() > startedAt + limitSeconds * 1000;
}

/** نسخة السؤال الآمنة للمتصفح — بلا correctAnswerIndex وبلا explanation (قسم 9/3) */
function safeQuestion(id, q) {
  return {
    id,
    questionNumber: q.questionNumber === undefined ? null : q.questionNumber,
    questionText: q.questionText,
    optionsText: q.optionsText,
    lesson: q.lesson || '',
    lessonNumber: q.lessonNumber === undefined ? null : q.lessonNumber,
  };
}

// ---------------------------------------------------------------------------
//  1) بدء اختبار
// ---------------------------------------------------------------------------
exports.startExam = onCall(async (request) => {
  const uid = requireAuth(request);
  const {
    subjectId,
    lessonNumber = null, // صيغة قديمة: درس واحد
    lessonNumbers: rawLessonNumbers = null,
    count = 20,
    mode = 'normal', // 'normal' | 'mistakes' | 'saved'
    timed = true,
    instantFeedback = false,
  } = request.data || {};

  if (typeof subjectId !== 'string' || !subjectId) {
    throw new HttpsError('invalid-argument', 'يجب تحديد المادة.');
  }
  if (!['normal', 'mistakes', 'saved'].includes(mode)) {
    throw new HttpsError('invalid-argument', 'نوع الاختبار غير معروف.');
  }

  // توحيد نطاق الدروس: null = كل الدروس
  let lessonNumbers = null;
  if (Array.isArray(rawLessonNumbers) && rawLessonNumbers.length > 0) {
    lessonNumbers = [...new Set(rawLessonNumbers.map(Number).filter(Number.isFinite))];
    if (lessonNumbers.length === 0 || lessonNumbers.length > MAX_LESSONS_PER_EXAM) {
      throw new HttpsError('invalid-argument', 'نطاق الدروس غير صحيح.');
    }
  } else if (lessonNumber !== null && lessonNumber !== undefined && Number.isFinite(Number(lessonNumber))) {
    lessonNumbers = [Number(lessonNumber)];
  }
  // المادة تُقرأ قبل فحص الصلاحية: رقم أول درس جزء من شرط المعاينة المجانية
  const subjectSnap = await db.doc(`subjects/${subjectId}`).get();
  const subjectData = subjectSnap.exists ? subjectSnap.data() : null;

  const { preview } = await resolveExamAccess(uid, subjectId, {
    mode,
    lessonNumbers,
    subjectData,
  });

  // count === 'all' → كل الأسئلة المتاحة في النطاق (بحد أقصى المسموح لهذه الجلسة)
  const ceiling = preview ? FREE_PREVIEW_MAX_QUESTIONS : MAX_QUESTIONS_PER_EXAM;
  const requested =
    count === 'all'
      ? ceiling
      : Math.min(ceiling, Math.max(MIN_QUESTIONS_PER_EXAM, parseInt(count, 10) || 20));

  // منع فتح أكثر من اختبار جارٍ في نفس الوقت
  const running = await db
    .collection('attempts')
    .where('uid', '==', uid)
    .where('status', '==', 'in_progress')
    .limit(1)
    .get();
  if (!running.empty) {
    const doc = running.docs[0];
    if (!attemptExpired(doc.data())) {
      throw new HttpsError('failed-precondition', 'لديك اختبار جارٍ لم يُسلَّم بعد.', {
        attemptId: doc.id,
      });
    }
    // انتهى وقته ولم يُسلَّم (أُغلق المتصفح مثلاً) → أغلقه
    await doc.ref.update({ status: 'abandoned', closedAt: FieldValue.serverTimestamp() });
  }

  let picked;
  if (mode === 'mistakes' || mode === 'saved') {
    let ids;
    if (mode === 'mistakes') {
      ids = await latestWrongQuestionIds(uid, subjectId);
      if (ids.length === 0) {
        throw new HttpsError('not-found', 'لا توجد أخطاء سابقة لمراجعتها في هذه المادة — أحسنت!');
      }
    } else {
      const savedSnap = await db
        .collection(`users/${uid}/saved`)
        .where('subjectId', '==', subjectId)
        .get();
      ids = savedSnap.docs.map((d) => d.id);
      if (ids.length === 0) {
        throw new HttpsError('not-found', 'لم تحفظ أي سؤال في هذه المادة بعد.');
      }
    }
    ids = shuffle(ids).slice(0, requested);
    const snaps = await db.getAll(...ids.map((id) => db.doc(`questions/${id}`)));
    // سؤال حُذف من البنك أو نُقل لمادة أخرى يُستبعد
    picked = snaps.filter((d) => d.exists && d.data().subjectId === subjectId);
  } else {
    picked = await sampleQuestions({ subjectId, lessonNumbers, count: requested });
  }
  if (picked.length === 0) {
    throw new HttpsError('not-found', 'لا توجد أسئلة متاحة بهذه المواصفات حالياً.');
  }

  const minutesPerQuestion = subjectData?.minutesPerQuestion
    ? Number(subjectData.minutesPerQuestion)
    : DEFAULT_MINUTES_PER_QUESTION;
  const durationSeconds = Math.round(picked.length * minutesPerQuestion * 60);

  const safeQuestions = picked.map((doc) => safeQuestion(doc.id, doc.data()));

  let lessonLabel;
  if (mode === 'mistakes') lessonLabel = 'مراجعة الأخطاء';
  else if (mode === 'saved') lessonLabel = 'الأسئلة المحفوظة';
  else if (!lessonNumbers) lessonLabel = 'اختبار شامل';
  else if (lessonNumbers.length === 1) {
    lessonLabel = picked[0].data().lesson || `الدرس ${lessonNumbers[0]}`;
  } else {
    lessonLabel = `الدروس ${[...lessonNumbers].sort((a, b) => a - b).join('، ')}`;
  }
  if (preview) lessonLabel = `معاينة مجانية — ${lessonLabel}`;

  const attemptRef = db.collection('attempts').doc();
  await attemptRef.set({
    uid,
    subjectId,
    subject: subjectData?.name || subjectId,
    mode,
    // يميّز محاولات المعاينة: لا تُحتسب نقاطها في لوحة الأبطال
    preview,
    // lessonNumber يبقى للتوافق مع المحاولات القديمة وصفحة السجل
    lessonNumber: lessonNumbers && lessonNumbers.length === 1 ? lessonNumbers[0] : null,
    lessonNumbers,
    lessonLabel,
    questionIds: safeQuestions.map((q) => q.id),
    totalQuestions: safeQuestions.length,
    durationSeconds,
    timed: Boolean(timed),
    instantFeedback: Boolean(instantFeedback),
    status: 'in_progress',
    startedAt: FieldValue.serverTimestamp(),
  });

  logger.info('startExam', {
    uid,
    subjectId,
    mode,
    preview,
    n: safeQuestions.length,
    attemptId: attemptRef.id,
  });

  return {
    attemptId: attemptRef.id,
    durationSeconds,
    timed: Boolean(timed),
    instantFeedback: Boolean(instantFeedback),
    lessonLabel,
    preview,
    questions: safeQuestions,
  };
});

// ---------------------------------------------------------------------------
//  1.b) استئناف اختبار جارٍ (إغلاق المتصفح / انقطاع الاتصال)
// ---------------------------------------------------------------------------
exports.resumeExam = onCall(async (request) => {
  const uid = requireAuth(request);
  const { attemptId } = request.data || {};

  if (typeof attemptId !== 'string' || !attemptId) {
    throw new HttpsError('invalid-argument', 'معرّف المحاولة مفقود.');
  }

  const attemptSnap = await db.doc(`attempts/${attemptId}`).get();
  if (!attemptSnap.exists) throw new HttpsError('not-found', 'المحاولة غير موجودة.');

  const attempt = attemptSnap.data();
  if (attempt.uid !== uid) throw new HttpsError('permission-denied', 'هذه المحاولة ليست لك.');
  if (attempt.status !== 'in_progress') {
    throw new HttpsError('failed-precondition', 'هذا الاختبار غير قابل للاستئناف.');
  }

  const ids = attempt.questionIds || [];
  const docs = [];
  for (let i = 0; i < ids.length; i += 300) {
    const chunk = ids.slice(i, i + 300).map((id) => db.doc(`questions/${id}`));
    docs.push(...(await db.getAll(...chunk)));
  }
  const byId = new Map(docs.filter((d) => d.exists).map((d) => [d.id, d.data()]));

  // نفس التعقيم: بلا إجابة صحيحة وبلا شرح
  const questions = ids.filter((id) => byId.has(id)).map((id) => safeQuestion(id, byId.get(id)));

  // أسئلة «الشرح الفوري» التي كُشف تصحيحها سابقاً تعود مكشوفة كما كانت
  const checked = {};
  for (const [qid, selectedIndex] of Object.entries(attempt.checkedAnswers || {})) {
    const q = byId.get(qid);
    if (!q) continue;
    checked[qid] = {
      selectedIndex,
      correctAnswerIndex: q.correctAnswerIndex,
      isCorrect: selectedIndex === q.correctAnswerIndex,
      explanation: q.explanation || '',
    };
  }

  const startedMs = attempt.startedAt ? attempt.startedAt.toMillis() : Date.now();
  const elapsed = Math.round((Date.now() - startedMs) / 1000);
  const remainingSeconds = Math.max(0, attempt.durationSeconds - elapsed);

  return {
    attemptId,
    durationSeconds: attempt.durationSeconds,
    remainingSeconds,
    elapsedSeconds: elapsed,
    timed: attempt.timed !== false,
    instantFeedback: Boolean(attempt.instantFeedback),
    subjectId: attempt.subjectId,
    subject: attempt.subject,
    lessonLabel: attempt.lessonLabel,
    questions,
    checked,
  };
});

// ---------------------------------------------------------------------------
//  1.c) وضع «الشرح الفوري»: تثبيت إجابة سؤال واحد وكشف تصحيحه
// ---------------------------------------------------------------------------
// الإجابة تُثبَّت في المحاولة قبل كشف الصحيحة، ولا تُغيَّر بعدها — فمعرفة
// الإجابة الصحيحة لا تفيد في تعديل ذلك السؤال عند التسليم.
exports.checkAnswer = onCall(async (request) => {
  const uid = requireAuth(request);
  const { attemptId, questionId, selectedIndex } = request.data || {};
  const idx = Number(selectedIndex);

  if (typeof attemptId !== 'string' || !attemptId || typeof questionId !== 'string' || !questionId) {
    throw new HttpsError('invalid-argument', 'بيانات ناقصة.');
  }
  if (!Number.isInteger(idx) || idx < 0 || idx > 3) {
    throw new HttpsError('invalid-argument', 'الخيار غير صحيح.');
  }

  const attemptRef = db.doc(`attempts/${attemptId}`);
  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(attemptRef);
    if (!snap.exists) throw new HttpsError('not-found', 'المحاولة غير موجودة.');
    const attempt = snap.data();
    if (attempt.uid !== uid) throw new HttpsError('permission-denied', 'هذه المحاولة ليست لك.');
    if (!attempt.instantFeedback) {
      throw new HttpsError('failed-precondition', 'الشرح الفوري غير مفعّل لهذا الاختبار.');
    }
    if (attempt.status !== 'in_progress' || attemptExpired(attempt)) {
      throw new HttpsError('failed-precondition', 'انتهى هذا الاختبار.');
    }
    if (!(attempt.questionIds || []).includes(questionId)) {
      throw new HttpsError('invalid-argument', 'السؤال ليس ضمن هذا الاختبار.');
    }

    const qSnap = await tx.get(db.doc(`questions/${questionId}`));
    if (!qSnap.exists) throw new HttpsError('not-found', 'السؤال غير موجود.');
    const q = qSnap.data();

    // إجابة مثبّتة سابقاً تبقى كما هي (طلب مكرر بعد انقطاع الشبكة مثلاً)
    const locked = (attempt.checkedAnswers || {})[questionId];
    const finalIndex = locked === undefined ? idx : locked;
    if (locked === undefined) {
      tx.update(attemptRef, { [`checkedAnswers.${questionId}`]: idx });
    }
    return {
      questionId,
      selectedIndex: finalIndex,
      correctAnswerIndex: q.correctAnswerIndex,
      isCorrect: finalIndex === q.correctAnswerIndex,
      explanation: q.explanation || '',
    };
  });

  // الإجابة ثُبّتت فعلاً، فتُحتسب في نشاط اليوم. التكرار يُرشَّح داخل المعاملة.
  const streak = await recordStreakActivity(uid, [questionId]);
  return { ...result, streak: streakPayload(streak) };
});

// ---------------------------------------------------------------------------
//  2) تسليم الاختبار والتصحيح (من طرف الخادم حصراً)
// ---------------------------------------------------------------------------
exports.submitExam = onCall(async (request) => {
  const uid = requireAuth(request);
  const {
    attemptId,
    answers = [],
    autoSubmitted = false,
    pausedSeconds = 0,
    pauseCount = 0,
  } = request.data || {};

  if (typeof attemptId !== 'string' || !attemptId) {
    throw new HttpsError('invalid-argument', 'معرّف المحاولة مفقود.');
  }
  if (!Array.isArray(answers)) {
    throw new HttpsError('invalid-argument', 'صيغة الإجابات غير صحيحة.');
  }

  const attemptRef = db.doc(`attempts/${attemptId}`);
  const attemptSnap = await attemptRef.get();
  if (!attemptSnap.exists) throw new HttpsError('not-found', 'المحاولة غير موجودة.');

  const attempt = attemptSnap.data();
  if (attempt.uid !== uid) throw new HttpsError('permission-denied', 'هذه المحاولة ليست لك.');
  if (attempt.status === 'submitted') {
    throw new HttpsError('failed-precondition', 'تم تسليم هذا الاختبار مسبقاً.', { attemptId });
  }

  // خريطة إجابات الطالب (نتجاهل أي سؤال ليس ضمن المحاولة الأصلية)
  const allowed = new Set(attempt.questionIds || []);
  const answerMap = new Map();
  for (const a of answers) {
    if (!a || typeof a.questionId !== 'string' || !allowed.has(a.questionId)) continue;
    const idx = Number(a.selectedIndex);
    if (!Number.isInteger(idx) || idx < 0 || idx > 3) continue;
    answerMap.set(a.questionId, idx);
  }
  // إجابات «الشرح الفوري» المثبّتة تتغلّب على ما يرسله المتصفح: كُشف تصحيحها فلا تُبدَّل
  for (const [qid, idx] of Object.entries(attempt.checkedAnswers || {})) {
    if (allowed.has(qid)) answerMap.set(qid, idx);
  }

  // جلب الأسئلة الأصلية بإجاباتها الصحيحة (Admin SDK — لا يمر عبر قواعد الأمان)
  const ids = attempt.questionIds || [];
  const docs = [];
  for (let i = 0; i < ids.length; i += 300) {
    const chunk = ids.slice(i, i + 300).map((id) => db.doc(`questions/${id}`));
    docs.push(...(await db.getAll(...chunk)));
  }
  const byId = new Map(docs.filter((d) => d.exists).map((d) => [d.id, d.data()]));

  let score = 0;
  const review = ids.map((qid) => {
    const q = byId.get(qid);
    const selectedIndex = answerMap.has(qid) ? answerMap.get(qid) : null;
    const correctAnswerIndex = q ? q.correctAnswerIndex : null;
    const isCorrect =
      q !== undefined && selectedIndex !== null && selectedIndex === correctAnswerIndex;
    if (isCorrect) score += 1;
    return {
      questionId: qid,
      questionText: q ? q.questionText : '(سؤال محذوف)',
      optionsText: q ? q.optionsText : [],
      lesson: q ? q.lesson || '' : '',
      lessonNumber: q && q.lessonNumber !== undefined ? q.lessonNumber : null,
      selectedIndex,
      correctAnswerIndex,
      isCorrect,
      explanation: q && q.explanation ? q.explanation : '',
    };
  });

  // ---- الإيقاف المؤقّت: الحدود تُفرض هنا لا في المتصفح ----
  // العميل يرسل ما استهلكه من إيقاف، لكن القيم تُقصّ على السقف المسموح، وإلا
  // لأمكن ادّعاء إيقاف طويل للحصول على وقت إضافي.
  const usedPauseCount = Math.min(MAX_PAUSES, Math.max(0, parseInt(pauseCount, 10) || 0));
  const usedPausedSeconds = Math.min(
    MAX_PAUSE_SECONDS,
    Math.max(0, Math.round(Number(pausedSeconds) || 0))
  );

  const startedMs = attempt.startedAt ? attempt.startedAt.toMillis() : Date.now();
  const wallClockSeconds = Math.max(0, Math.round((Date.now() - startedMs) / 1000));
  // الوقت المحتسب على الطالب = الزمن الفعلي ناقص فترات الإيقاف المسموح بها
  const timeTakenSeconds = Math.max(0, wallClockSeconds - usedPausedSeconds);
  const total = ids.length;
  const percentage = total ? Math.round((score / total) * 1000) / 10 : 0;

  await attemptRef.update({
    status: 'submitted',
    autoSubmitted:
      attempt.timed === false
        ? false
        : Boolean(autoSubmitted) || timeTakenSeconds > attempt.durationSeconds,
    studentAnswers: [...answerMap.entries()].map(([questionId, selectedIndex]) => ({
      questionId,
      selectedIndex,
    })),
    answeredCount: answerMap.size,
    pauseCount: usedPauseCount,
    pausedSeconds: usedPausedSeconds,
    score,
    totalQuestions: total,
    percentage,
    timeTakenSeconds,
    review,
    submittedAt: FieldValue.serverTimestamp(),
  });

  // ---- لوحة الأبطال: تراكم النقاط بنفس العملية (لا استعلام حي على attempts) ----
  // تُخزَّن في مجموعة `leaderboard` المستقلة لا في `users`، لأن عرض اللوحة يتطلب
  // أن يقرأ كل طالب مستندات الطلاب الآخرين — وفتح `users` للقراءة العامة كان
  // سيكشف بريد وهاتف كل طالب. هذه المجموعة تحمل الاسم والصف والنقاط فقط.
  const profileSnap = await db.doc(`users/${uid}`).get();
  const profile = profileSnap.exists ? profileSnap.data() : {};

  const batch = db.batch();

  // حسابات الإدارة مستثناة: اختباراتها تجريبية ولا يصحّ أن تتصدّر لوحة الطلاب.
  // ومحاولات المعاينة المجانية كذلك: درس واحد قابل للإعادة بلا حد، فاحتساب
  // نقاطه كان سيفتح باباً لتسلّق اللوحة دون اشتراك.
  if (profile.role !== 'admin' && attempt.preview !== true) {
    batch.set(
      db.doc(`leaderboard/${uid}`),
      {
        fullName: profile.fullName || '',
        grade: profile.grade || '',
        // صيغة الكائن المتداخل ضرورية: المسارات المنقوطة لا تعمل مع set/merge
        subjectScores: { [attempt.subjectId]: FieldValue.increment(score) },
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }

  for (const r of review) {
    if (!byId.has(r.questionId)) continue;
    batch.set(
      db.doc(`questionStats/${r.questionId}`),
      {
        subjectId: attempt.subjectId,
        timesShown: FieldValue.increment(1),
        timesCorrect: FieldValue.increment(r.isCorrect ? 1 : 0),
        timesWrong: FieldValue.increment(r.isCorrect ? 0 : 1),
        questionText: r.questionText,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }
  await batch.commit();

  // الأسئلة التي أجاب عنها فعلاً (لا المتروكة) هي وحدها نشاط اليوم
  const streak = await recordStreakActivity(uid, [...answerMap.keys()]);

  return {
    attemptId,
    score,
    totalQuestions: total,
    percentage,
    timeTakenSeconds,
    review,
    streak: streakPayload(streak),
  };
});

// ---------------------------------------------------------------------------
//  3) قبول طلب دفع → تفعيل الاشتراك
// ---------------------------------------------------------------------------
exports.approvePayment = onCall(async (request) => {
  const adminUid = requireAdmin(request);
  const { requestId, durationDays = null } = request.data || {};

  if (typeof requestId !== 'string' || !requestId) {
    throw new HttpsError('invalid-argument', 'معرّف الطلب مفقود.');
  }

  const reqRef = db.doc(`paymentRequests/${requestId}`);

  const result = await db.runTransaction(async (tx) => {
    const reqSnap = await tx.get(reqRef);
    if (!reqSnap.exists) throw new HttpsError('not-found', 'الطلب غير موجود.');
    const pr = reqSnap.data();
    if (pr.status !== 'pending') {
      throw new HttpsError('failed-precondition', 'تمت مراجعة هذا الطلب مسبقاً.');
    }

    const userRef = db.doc(`users/${pr.uid}`);
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists) throw new HttpsError('not-found', 'حساب الطالب غير موجود.');

    // المواد التي يفعّلها الطلب: مادة واحدة، أو كل مواد الباقة كما هي محفوظة
    // في مستند الباقة لحظة القبول (لا كما أرسلها الطالب).
    let grants;
    if (pr.bundleId) {
      const bundleSnap = await tx.get(db.doc(`bundles/${pr.bundleId}`));
      if (!bundleSnap.exists) throw new HttpsError('not-found', 'الباقة غير موجودة.');
      const subjectIds = (bundleSnap.data().subjectIds || []).filter(
        (id) => typeof id === 'string' && id
      );
      if (subjectIds.length === 0) {
        throw new HttpsError('failed-precondition', 'الباقة لا تحتوي أي مادة.');
      }
      const subjectSnaps = await tx.getAll(...subjectIds.map((id) => db.doc(`subjects/${id}`)));
      grants = subjectSnaps.map((s, i) => ({
        subjectId: subjectIds[i],
        subjectName: (s.exists && s.data().name) || subjectIds[i],
      }));
    } else {
      grants = [{ subjectId: pr.subjectId, subjectName: pr.subject || pr.subjectId }];
    }

    const expiresAt =
      durationDays && Number(durationDays) > 0
        ? Timestamp.fromMillis(Date.now() + Number(durationDays) * 86400000)
        : null;

    const subscriptionUpdates = {};
    for (const { subjectId, subjectName } of grants) {
      subscriptionUpdates[`subscriptions.${subjectId}`] = {
        status: 'active',
        subjectName,
        activatedAt: Timestamp.now(),
        activatedBy: adminUid,
        expiresAt,
        paymentRequestId: requestId,
        // مبلغ الطلب كاملاً؛ في الباقة يتكرّر على موادها لكنه يُحسب بالإيراد مرة واحدة
        amount: pr.amount === undefined ? null : pr.amount,
        bundleId: pr.bundleId || null,
      };
    }
    tx.update(userRef, subscriptionUpdates);

    tx.update(reqRef, {
      status: 'approved',
      reviewedAt: FieldValue.serverTimestamp(),
      reviewedBy: adminUid,
    });

    return { uid: pr.uid, subjectIds: grants.map((g) => g.subjectId), bundleId: pr.bundleId || null };
  });

  logger.info('approvePayment', { adminUid, requestId, ...result });
  return { ok: true, ...result };
});

// ---------------------------------------------------------------------------
//  4) رفض طلب دفع
// ---------------------------------------------------------------------------
exports.rejectPayment = onCall(async (request) => {
  const adminUid = requireAdmin(request);
  const { requestId, reason = '' } = request.data || {};

  if (typeof requestId !== 'string' || !requestId) {
    throw new HttpsError('invalid-argument', 'معرّف الطلب مفقود.');
  }

  const reqRef = db.doc(`paymentRequests/${requestId}`);
  const snap = await reqRef.get();
  if (!snap.exists) throw new HttpsError('not-found', 'الطلب غير موجود.');
  if (snap.data().status !== 'pending') {
    throw new HttpsError('failed-precondition', 'تمت مراجعة هذا الطلب مسبقاً.');
  }

  await reqRef.update({
    status: 'rejected',
    rejectionReason: String(reason || '').slice(0, 500),
    reviewedAt: FieldValue.serverTimestamp(),
    reviewedBy: adminUid,
  });

  return { ok: true };
});

// ---------------------------------------------------------------------------
//  5) تعديل اشتراك يدوياً (أدمن)
// ---------------------------------------------------------------------------
exports.setSubscription = onCall(async (request) => {
  const adminUid = requireAdmin(request);
  const { uid, subjectId, status, durationDays = null } = request.data || {};

  const allowedStatus = ['active', 'pending', 'expired', 'none'];
  if (!uid || !subjectId || !allowedStatus.includes(status)) {
    throw new HttpsError('invalid-argument', 'بيانات غير صحيحة.');
  }

  const expiresAt =
    status === 'active' && durationDays && Number(durationDays) > 0
      ? Timestamp.fromMillis(Date.now() + Number(durationDays) * 86400000)
      : null;

  await db.doc(`users/${uid}`).update({
    [`subscriptions.${subjectId}`]: {
      status,
      activatedAt: status === 'active' ? Timestamp.now() : null,
      activatedBy: adminUid,
      expiresAt,
    },
  });

  return { ok: true };
});

// ---------------------------------------------------------------------------
//  5.b) إدارة حسابات الطلاب (أدمن): إنشاء، تعديل، حذف
// ---------------------------------------------------------------------------
// حسابات تنشئها الإدارة يُدخل بها الطالب برقم هاتفه — مطابق لـ web-app/src/lib/phoneLogin.js
const PHONE_EMAIL_DOMAIN = 'phone.smart-edu-bank.netlify.app';
const phoneLoginEmail = (phone) => `${phone}@${PHONE_EMAIL_DOMAIN}`;

function normalizeJordanPhone(input) {
  let d = String(input || '').replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x0660)).replace(/\D/g, '');
  if (d.startsWith('00962')) d = d.slice(5);
  else if (d.startsWith('962')) d = d.slice(3);
  if (d.length === 9 && d.startsWith('7')) d = `0${d}`;
  return /^07[789]\d{7}$/.test(d) ? d : null;
}

function cleanName(value) {
  const name = String(value || '').replace(/\s+/g, ' ').trim();
  if (name.length < 2 || name.length > 80) {
    throw new HttpsError('invalid-argument', 'اسم الطالب مطلوب (حرفان على الأقل).');
  }
  return name;
}

function checkPassword(value) {
  const password = String(value || '');
  if (password.length < 6 || password.length > 64) {
    throw new HttpsError('invalid-argument', 'كلمة المرور يجب أن تكون 6 أحرف على الأقل.');
  }
  return password;
}

function activeSubscription(adminUid, durationDays) {
  return {
    status: 'active',
    activatedAt: Timestamp.now(),
    activatedBy: adminUid,
    expiresAt:
      durationDays && Number(durationDays) > 0
        ? Timestamp.fromMillis(Date.now() + Number(durationDays) * 86400000)
        : null,
  };
}

exports.adminCreateStudent = onCall(async (request) => {
  const adminUid = requireAdmin(request);
  const { fullName, phone, password, grade = '', subjectIds = [], durationDays = null } = request.data || {};

  const name = cleanName(fullName);
  const normalized = normalizeJordanPhone(phone);
  if (!normalized) throw new HttpsError('invalid-argument', 'رقم الهاتف غير صحيح (مثال: 0791234567).');
  const pass = checkPassword(password);

  const subjectsToActivate = Array.isArray(subjectIds) ? [...new Set(subjectIds.map(String))] : [];
  if (subjectsToActivate.length) {
    const snaps = await db.getAll(...subjectsToActivate.map((id) => db.doc(`subjects/${id}`)));
    const missing = snaps.filter((d) => !d.exists).map((d) => d.id);
    if (missing.length) throw new HttpsError('invalid-argument', `مادة غير موجودة: ${missing.join('، ')}`);
  }

  let user;
  try {
    user = await getAuth().createUser({ email: phoneLoginEmail(normalized), password: pass, displayName: name });
  } catch (err) {
    if (err.code === 'auth/email-already-exists') {
      throw new HttpsError('already-exists', 'يوجد حساب مسجَّل بهذا الرقم مسبقاً.');
    }
    throw err;
  }

  const subscriptions = {};
  for (const id of subjectsToActivate) subscriptions[id] = activeSubscription(adminUid, durationDays);

  try {
    await db.doc(`users/${user.uid}`).set({
      fullName: name,
      phone: normalized,
      email: phoneLoginEmail(normalized),
      grade: String(grade || '').trim(),
      role: 'student',
      subscriptions,
      createdAt: FieldValue.serverTimestamp(),
      createdBy: adminUid,
    });
  } catch (err) {
    // لا نترك حساب دخول بلا مستند طالب
    await getAuth().deleteUser(user.uid).catch(() => {});
    throw err;
  }

  logger.info('adminCreateStudent', { adminUid, uid: user.uid, subjects: subjectsToActivate.length });
  return { uid: user.uid, phone: normalized };
});

exports.adminUpdateStudent = onCall(async (request) => {
  requireAdmin(request);
  const { uid, fullName, phone, grade, password } = request.data || {};
  if (typeof uid !== 'string' || !uid) throw new HttpsError('invalid-argument', 'الطالب غير محدد.');

  const ref = db.doc(`users/${uid}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'الطالب غير موجود.');
  const current = snap.data();

  const update = { updatedAt: FieldValue.serverTimestamp() };
  const authUpdate = {};
  if (fullName !== undefined) {
    update.fullName = cleanName(fullName);
    authUpdate.displayName = update.fullName;
  }
  if (grade !== undefined) update.grade = String(grade || '').trim();
  if (phone !== undefined) {
    const isPhoneAccount = String(current.email || '').endsWith(`@${PHONE_EMAIL_DOMAIN}`);
    if (isPhoneAccount) {
      // في حسابات الهاتف الرقم هو اسم الدخول، فيتغيّر معه بريد الدخول الداخلي
      const normalized = normalizeJordanPhone(phone);
      if (!normalized) throw new HttpsError('invalid-argument', 'رقم الهاتف غير صحيح (مثال: 0791234567).');
      update.phone = normalized;
      if (normalized !== current.phone) {
        update.email = phoneLoginEmail(normalized);
        authUpdate.email = update.email;
      }
    } else {
      update.phone = String(phone || '').trim();
    }
  }
  if (password) authUpdate.password = checkPassword(password);

  if (Object.keys(authUpdate).length) {
    try {
      await getAuth().updateUser(uid, authUpdate);
    } catch (err) {
      if (err.code === 'auth/email-already-exists') {
        throw new HttpsError('already-exists', 'يوجد حساب آخر مسجَّل بهذا الرقم.');
      }
      if (err.code !== 'auth/user-not-found') throw err;
    }
  }
  await ref.update(update);
  // مزامنة الاسم والصف مع لوحة الأبطال إن وُجد للطالب مستند فيها
  if (update.fullName || update.grade !== undefined) {
    const board = {};
    if (update.fullName) board.fullName = update.fullName;
    if (update.grade !== undefined) board.grade = update.grade;
    await db.doc(`leaderboard/${uid}`).update(board).catch(() => {});
  }
  return { ok: true, phone: update.phone ?? current.phone };
});

exports.adminDeleteStudent = onCall(async (request) => {
  const adminUid = requireAdmin(request);
  const { uid } = request.data || {};
  if (typeof uid !== 'string' || !uid) throw new HttpsError('invalid-argument', 'الطالب غير محدد.');
  if (uid === adminUid) throw new HttpsError('failed-precondition', 'لا يمكنك حذف حسابك.');

  const ref = db.doc(`users/${uid}`);
  const snap = await ref.get();
  if (snap.exists && snap.data().role !== 'student') {
    throw new HttpsError('failed-precondition', 'هذا الحساب ليس حساب طالب.');
  }

  await getAuth().deleteUser(uid).catch((err) => {
    if (err.code !== 'auth/user-not-found') throw err;
  });
  // المستند ومجموعاته الفرعية (الأسئلة المحفوظة)، ولوحة الأبطال، ومحاولات الاختبار.
  // طلبات الدفع تبقى سجلاً مالياً.
  const attempts = await db.collection('attempts').where('uid', '==', uid).get();
  const writer = db.bulkWriter();
  attempts.docs.forEach((d) => writer.delete(d.ref));
  writer.delete(db.doc(`leaderboard/${uid}`));
  await writer.close();
  await db.recursiveDelete(ref);

  logger.info('adminDeleteStudent', { adminUid, uid, attempts: attempts.size });
  return { ok: true };
});

// ---------------------------------------------------------------------------
//  6) أرقام لوحة تحكم الإدارة
// ---------------------------------------------------------------------------
exports.adminOverview = onCall(async (request) => {
  requireAdmin(request);

  const [studentsAgg, questionsAgg, pendingAgg, approvedSnap, attemptsAgg] = await Promise.all([
    db.collection('users').where('role', '==', 'student').count().get(),
    db.collection('questions').count().get(),
    db.collection('paymentRequests').where('status', '==', 'pending').count().get(),
    db.collection('paymentRequests').where('status', '==', 'approved').get(),
    db.collection('attempts').where('status', '==', 'submitted').count().get(),
  ]);

  const totalRevenue = approvedSnap.docs.reduce(
    (sum, d) => sum + (Number(d.data().amount) || 0),
    0
  );

  return {
    students: studentsAgg.data().count,
    questions: questionsAgg.data().count,
    pendingPayments: pendingAgg.data().count,
    approvedPayments: approvedSnap.size,
    submittedAttempts: attemptsAgg.data().count,
    totalRevenue,
    streaks: await streakOverview(),
  };
});

/**
 * أرقام الحماسات للوحة الإدارة.
 * مجموعة `streaks` فيها مستند لكل طالب بدأ فعلاً، فقراءتها كاملة مقبولة بحجم
 * المنصة؛ وإن كبرت لاحقاً فالبديل عدّادات تراكمية تُحدَّث مع كل منح.
 */
async function streakOverview() {
  const today = ammanDay();
  const yesterday = previousDay(today);

  const [streaksSnap, rewardsSnap] = await Promise.all([
    db.collection('streaks').get(),
    db.collection('rewards').where('day', '==', today).get(),
  ]);

  let earnedToday = 0;
  let activeStreaks = 0;
  let brokenStreaks = 0;
  let workingToday = 0; // بدأ الحل اليوم ولو لم يبلغ الهدف
  let totalRewardPoints = 0;
  let totalStreaksEarned = 0;

  streaksSnap.forEach((doc) => {
    const s = doc.data();
    const last = s.lastStreakDay || '';
    const current = Number(s.current) || 0;
    totalRewardPoints += Number(s.rewardPoints) || 0;
    totalStreaksEarned += Number(s.totalEarned) || 0;

    if (s.today?.day === today) {
      if (s.today.earned) earnedToday += 1;
      else if ((Number(s.today.count) || 0) > 0) workingToday += 1;
    }
    if (current > 0) {
      if (last === today || last === yesterday) activeStreaks += 1;
      else brokenStreaks += 1;
    }
  });

  const rewardPointsToday = rewardsSnap.docs.reduce((sum, d) => sum + (Number(d.data().points) || 0), 0);

  return {
    day: today,
    studentsWithStreakToday: earnedToday,
    studentsWorkingToday: workingToday,
    rewardsToday: rewardsSnap.size,
    rewardPointsToday,
    activeStreaks,
    brokenStreaks,
    totalStreaksEarned,
    totalRewardPoints,
    trackedStudents: streaksSnap.size,
  };
}

// ---------------------------------------------------------------------------
//  7) مشغّل استيراد ملفات Word (منطقة us-central1 — انظر importTrigger.js)
// ---------------------------------------------------------------------------
exports.processQuestionImport = require('./importTrigger').processQuestionImport;
