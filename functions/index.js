/**
 * ============================================================================
 *  Smart Edu Pro — بنك الأسئلة | Cloud Functions (طبقة المنطق الخادمي)
 * ----------------------------------------------------------------------------
 *  كل ما يمكن للطالب التلاعب به من المتصفح يُنفَّذ هنا بدلاً من ذلك:
 *   - startExam        : يتحقق من الاشتراك ثم يعيد الأسئلة *بدون* الإجابة الصحيحة
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

/** يتحقق أن الطالب مشترك فعلياً بالمادة، ويعيد بيانات الاشتراك. */
async function assertActiveSubscription(uid, subjectId) {
  const userSnap = await db.doc(`users/${uid}`).get();
  if (!userSnap.exists) {
    throw new HttpsError('not-found', 'لم يتم العثور على حساب الطالب.');
  }
  const user = userSnap.data();
  if (user.role === 'admin') return { status: 'active', admin: true };

  const sub = (user.subscriptions || {})[subjectId];
  if (!sub || sub.status !== 'active') {
    throw new HttpsError(
      'permission-denied',
      'اشتراكك في هذه المادة غير مفعّل. يرجى رفع إثبات الدفع وانتظار موافقة الإدارة.'
    );
  }
  if (sub.expiresAt && sub.expiresAt.toMillis() < Date.now()) {
    await db.doc(`users/${uid}`).update({
      [`subscriptions.${subjectId}.status`]: 'expired',
    });
    throw new HttpsError('permission-denied', 'انتهت صلاحية اشتراكك في هذه المادة.');
  }
  return sub;
}

/**
 * سحب عيّنة عشوائية من الأسئلة دون تحميل بنك الأسئلة كاملاً.
 * يعتمد على الحقل `random` (رقم 0..1 يُكتب لكل سؤال عند الاستيراد):
 * نستعلم من نقطة عشوائية للأمام، ثم نلتف للبداية إن لم يكتمل العدد.
 */
async function sampleQuestions({ subjectId, lessonNumber, count }) {
  const base = () => {
    let q = db.collection('questions').where('subjectId', '==', subjectId);
    if (lessonNumber !== null && lessonNumber !== undefined) {
      q = q.where('lessonNumber', '==', lessonNumber);
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

// ---------------------------------------------------------------------------
//  1) بدء اختبار
// ---------------------------------------------------------------------------
exports.startExam = onCall(async (request) => {
  const uid = requireAuth(request);
  const { subjectId, lessonNumber = null, count = 20 } = request.data || {};

  if (typeof subjectId !== 'string' || !subjectId) {
    throw new HttpsError('invalid-argument', 'يجب تحديد المادة.');
  }
  // count === 'all' → كل الأسئلة المتاحة في النطاق (بحد أقصى MAX_QUESTIONS_PER_EXAM)
  const requested =
    count === 'all'
      ? MAX_QUESTIONS_PER_EXAM
      : Math.min(
          MAX_QUESTIONS_PER_EXAM,
          Math.max(MIN_QUESTIONS_PER_EXAM, parseInt(count, 10) || 20)
        );

  await assertActiveSubscription(uid, subjectId);

  // منع فتح أكثر من اختبار جارٍ في نفس الوقت
  const running = await db
    .collection('attempts')
    .where('uid', '==', uid)
    .where('status', '==', 'in_progress')
    .limit(1)
    .get();
  if (!running.empty) {
    const doc = running.docs[0];
    const startedAt = doc.data().startedAt ? doc.data().startedAt.toMillis() : 0;
    const deadline = startedAt + doc.data().durationSeconds * 1000 + SUBMIT_GRACE_SECONDS * 1000;
    if (Date.now() < deadline) {
      throw new HttpsError('failed-precondition', 'لديك اختبار جارٍ لم يُسلَّم بعد.', {
        attemptId: doc.id,
      });
    }
    // انتهى وقته ولم يُسلَّم (أُغلق المتصفح مثلاً) → أغلقه
    await doc.ref.update({ status: 'abandoned', closedAt: FieldValue.serverTimestamp() });
  }

  const picked = await sampleQuestions({ subjectId, lessonNumber, count: requested });
  if (picked.length === 0) {
    throw new HttpsError('not-found', 'لا توجد أسئلة متاحة بهذه المواصفات حالياً.');
  }

  const subjectSnap = await db.doc(`subjects/${subjectId}`).get();
  const minutesPerQuestion =
    subjectSnap.exists && subjectSnap.data().minutesPerQuestion
      ? Number(subjectSnap.data().minutesPerQuestion)
      : DEFAULT_MINUTES_PER_QUESTION;
  const durationSeconds = Math.round(picked.length * minutesPerQuestion * 60);

  // الأسئلة كما تُرسَل للمتصفح — بلا correctAnswerIndex وبلا explanation (قسم 9/3)
  const safeQuestions = picked.map((doc) => {
    const q = doc.data();
    return {
      id: doc.id,
      questionNumber: q.questionNumber === undefined ? null : q.questionNumber,
      questionText: q.questionText,
      optionsText: q.optionsText,
      lesson: q.lesson || '',
      lessonNumber: q.lessonNumber === undefined ? null : q.lessonNumber,
    };
  });

  const attemptRef = db.collection('attempts').doc();
  await attemptRef.set({
    uid,
    subjectId,
    subject: subjectSnap.exists ? subjectSnap.data().name : subjectId,
    lessonNumber,
    lessonLabel:
      lessonNumber === null ? 'اختبار شامل' : picked[0].data().lesson || `الدرس ${lessonNumber}`,
    questionIds: safeQuestions.map((q) => q.id),
    totalQuestions: safeQuestions.length,
    durationSeconds,
    status: 'in_progress',
    startedAt: FieldValue.serverTimestamp(),
  });

  logger.info('startExam', { uid, subjectId, n: safeQuestions.length, attemptId: attemptRef.id });

  return {
    attemptId: attemptRef.id,
    durationSeconds,
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
  const questions = ids
    .filter((id) => byId.has(id))
    .map((id) => {
      const q = byId.get(id);
      return {
        id,
        questionNumber: q.questionNumber === undefined ? null : q.questionNumber,
        questionText: q.questionText,
        optionsText: q.optionsText,
        lesson: q.lesson || '',
        lessonNumber: q.lessonNumber === undefined ? null : q.lessonNumber,
      };
    });

  const startedMs = attempt.startedAt ? attempt.startedAt.toMillis() : Date.now();
  const elapsed = Math.round((Date.now() - startedMs) / 1000);
  const remainingSeconds = Math.max(0, attempt.durationSeconds - elapsed);

  return {
    attemptId,
    durationSeconds: attempt.durationSeconds,
    remainingSeconds,
    subjectId: attempt.subjectId,
    subject: attempt.subject,
    lessonLabel: attempt.lessonLabel,
    questions,
  };
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
    autoSubmitted: Boolean(autoSubmitted) || timeTakenSeconds > attempt.durationSeconds,
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

  // حسابات الإدارة مستثناة: اختباراتها تجريبية ولا يصحّ أن تتصدّر لوحة الطلاب
  if (profile.role !== 'admin') {
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

  return { attemptId, score, totalQuestions: total, percentage, timeTakenSeconds, review };
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

    const expiresAt =
      durationDays && Number(durationDays) > 0
        ? Timestamp.fromMillis(Date.now() + Number(durationDays) * 86400000)
        : null;

    tx.update(userRef, {
      [`subscriptions.${pr.subjectId}`]: {
        status: 'active',
        subjectName: pr.subject || pr.subjectId,
        activatedAt: Timestamp.now(),
        activatedBy: adminUid,
        expiresAt,
        paymentRequestId: requestId,
        amount: pr.amount === undefined ? null : pr.amount,
      },
    });

    tx.update(reqRef, {
      status: 'approved',
      reviewedAt: FieldValue.serverTimestamp(),
      reviewedBy: adminUid,
    });

    return { uid: pr.uid, subjectId: pr.subjectId };
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
  };
});

// ---------------------------------------------------------------------------
//  7) مشغّل استيراد ملفات Word (منطقة us-central1 — انظر importTrigger.js)
// ---------------------------------------------------------------------------
exports.processQuestionImport = require('./importTrigger').processQuestionImport;
