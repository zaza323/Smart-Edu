/**
 * إحصائيات لوحة الطالب — تُحسب في المتصفح من محاولاته نفسها (مقروءة له وحده
 * بقواعد الأمان)، فلا يوجد مخزن إحصائيات منفصل يحتاج مزامنة.
 * كل محاولة مسلَّمة تحمل `review`: نتيجة كل سؤال ودرسه.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
// مطابق لثوابت Cloud Functions: بعدها تُعدّ المحاولة الجارية متروكة
const SUBMIT_GRACE_SECONDS = 90;
const UNTIMED_MAX_SECONDS = 6 * 60 * 60;
// لا يُحكم على درس بأنه «الأضعف» قبل هذا العدد من الإجابات فيه
const MIN_LESSON_ANSWERS = 3;

const millis = (ts) => (ts?.toMillis ? ts.toMillis() : 0);

/** مفتاح اليوم بالتوقيت المحلي للطالب (لا UTC) — أساس عدّاد الأيام المتتالية. */
function dayKey(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** محاولة جارية لم ينقضِ وقتها بعد (قابلة للاستئناف). */
export function isResumable(attempt, now = Date.now()) {
  if (attempt.status !== 'in_progress') return false;
  const limit =
    attempt.timed === false ? UNTIMED_MAX_SECONDS : (attempt.durationSeconds || 0) + SUBMIT_GRACE_SECONDS;
  return now < millis(attempt.startedAt) + limit * 1000;
}

function streakOf(days, now) {
  let cursor = now;
  // اليوم بلا تمرين لا يكسر السلسلة بعد — ما زال أمام الطالب وقت
  if (!days.has(dayKey(cursor))) cursor -= DAY_MS;
  let count = 0;
  while (days.has(dayKey(cursor))) {
    count += 1;
    cursor -= DAY_MS;
  }
  return { days: count, activeToday: days.has(dayKey(now)) };
}

/**
 * @param attempts محاولات الطالب (أي ترتيب)
 * @param subjects مستندات المواد (لعدد الأسئلة وعناوين الدروس)
 */
export function computeStudentStats(attempts, subjects, now = Date.now()) {
  const submitted = attempts
    .filter((a) => a.status === 'submitted')
    .sort((a, b) => millis(a.submittedAt) - millis(b.submittedAt)); // الأقدم أولاً

  const subjectsById = new Map(subjects.map((s) => [s.id, s]));
  // المراجعات القديمة تحمل عنوان الدرس فقط — نوحّدها على رقمه من مستند المادة
  const lessonNumberOf = (subjectId, r) =>
    r.lessonNumber ?? subjectsById.get(subjectId)?.lessons?.find((x) => x.title === r.lesson)?.number ?? null;

  const todayKey = dayKey(now);
  const days = new Set();
  let totalAnswered = 0;
  let todayAnswered = 0;
  let totalScore = 0;
  let totalQuestions = 0;
  let best = null;
  const perSubject = {};

  for (const a of submitted) {
    const when = millis(a.submittedAt) || millis(a.startedAt);
    const answered = a.answeredCount ?? (a.review || []).filter((r) => r.selectedIndex !== null).length;
    days.add(dayKey(when));
    totalAnswered += answered;
    if (dayKey(when) === todayKey) todayAnswered += answered;
    totalScore += a.score || 0;
    totalQuestions += a.totalQuestions || 0;
    if (!best || (a.percentage || 0) > best.percentage) {
      best = { percentage: a.percentage || 0, subject: a.subject || '' };
    }

    const s = (perSubject[a.subjectId] ||= {
      attempts: 0,
      lastPct: null,
      bestPct: null,
      latest: new Map(), // questionId → صحيح في آخر ظهور؟
      correctEver: new Set(),
      lessons: new Map(), // مفتاح الدرس → { number, title, correct, total }
    });
    s.attempts += 1;
    s.lastPct = a.percentage ?? null; // الترتيب تصاعدي، فالأخيرة تبقى
    s.bestPct = Math.max(s.bestPct ?? 0, a.percentage ?? 0);

    for (const r of a.review || []) {
      s.latest.set(r.questionId, Boolean(r.isCorrect));
      if (r.isCorrect) s.correctEver.add(r.questionId);
      const number = lessonNumberOf(a.subjectId, r);
      const key = number ?? r.lesson ?? '';
      if (key === '') continue;
      const l = s.lessons.get(key) || { number, title: r.lesson || '', correct: 0, total: 0 };
      l.total += 1;
      if (r.isCorrect) l.correct += 1;
      s.lessons.set(key, l);
    }
  }

  const subjectStats = {};
  for (const [subjectId, s] of Object.entries(perSubject)) {
    const subject = subjectsById.get(subjectId);
    const lessonList = subject?.lessons || [];

    // الأضعف: أقل نسبة صحيحة بين الدروس التي أُجيب فيها عدد كافٍ
    let weakest = null;
    for (const l of s.lessons.values()) {
      if (l.total < MIN_LESSON_ANSWERS) continue;
      const accuracy = l.correct / l.total;
      if (!weakest || accuracy < weakest.accuracy) {
        const title = lessonList.find((x) => x.number === l.number)?.title || l.title || `الدرس ${l.number}`;
        weakest = { number: l.number, title, accuracy };
      }
    }

    const questionCount = Number(subject?.questionCount) || 0;
    subjectStats[subjectId] = {
      attempts: s.attempts,
      lastPct: s.lastPct,
      bestPct: s.bestPct,
      // الإتقان = أسئلة مختلفة أجاب عنها صحيحاً مرة على الأقل ÷ كل أسئلة المادة
      mastery: questionCount ? Math.min(100, Math.round((s.correctEver.size / questionCount) * 100)) : 0,
      weakest: weakest && weakest.accuracy < 1 ? weakest : null,
      // نفس منطق مراجعة الأخطاء في الخادم: الخاطئة في آخر ظهور لها
      mistakes: [...s.latest.values()].filter((ok) => !ok).length,
    };
  }

  const inProgress = attempts
    .filter((a) => isResumable(a, now))
    .sort((a, b) => millis(b.startedAt) - millis(a.startedAt))[0] || null;

  return {
    totalAnswered,
    todayAnswered,
    accuracy: totalQuestions ? Math.round((totalScore / totalQuestions) * 100) : null,
    streak: streakOf(days, now),
    best,
    examsCount: submitted.length,
    subjectStats,
    inProgress,
  };
}
