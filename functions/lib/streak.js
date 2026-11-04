/**
 * منطق الحماسات اليومية — دالة خالصة بلا Firestore ولا ساعة نظام، حتى تُختبر
 * وحدها (tests/streak.test.js). القراءة والكتابة والمعاملة الذرّية في index.js.
 *
 * القواعد:
 *  - 5 أسئلة مختلفة في اليوم ⇒ حماسة واحدة (الصواب غير مشترط).
 *  - السؤال نفسه لا يُحتسب مرتين في اليوم، والحماسة لا تُمنح مرتين في اليوم.
 *  - 7 حماسات متتالية ⇒ 30 نقطة، ثم يعود العدّاد إلى الصفر.
 *  - يوم واحد دون استيفاء الشرط يقطع السلسلة، والعودة تبدأ من حماسة واحدة.
 *
 * اليوم يُحسب بتوقيت Asia/Amman في الخادم (ammanDay في index.js)، فلا تؤثّر
 * ساعة جهاز الطالب ولا منطقته الزمنية.
 */

const DAILY_GOAL = 5;
const STREAK_TARGET = 7;
const REWARD_POINTS = 30;

/** اليوم السابق لمفتاح 'YYYY-MM-DD' — حساب تقويمي بحت بلا منطقة زمنية. */
function previousDay(day) {
  const [y, m, d] = String(day).split('-').map(Number);
  const prev = new Date(Date.UTC(y, m - 1, d));
  prev.setUTCDate(prev.getUTCDate() - 1);
  return prev.toISOString().slice(0, 10);
}

/** الحالة الافتراضية لطالب لم يبدأ بعد. */
function emptyStreak() {
  return {
    current: 0,
    longest: 0,
    totalEarned: 0,
    lastStreakDay: '',
    rewardsCount: 0,
    rewardPoints: 0,
    today: { day: '', ids: [], count: 0, earned: false },
  };
}

function normalize(state) {
  if (!state) return emptyStreak();
  return {
    current: Number(state.current) || 0,
    longest: Number(state.longest) || 0,
    totalEarned: Number(state.totalEarned) || 0,
    lastStreakDay: state.lastStreakDay || '',
    rewardsCount: Number(state.rewardsCount) || 0,
    rewardPoints: Number(state.rewardPoints) || 0,
    today: {
      day: state.today?.day || '',
      ids: Array.isArray(state.today?.ids) ? [...state.today.ids] : [],
      count: Number(state.today?.count) || 0,
      earned: Boolean(state.today?.earned),
    },
  };
}

/**
 * هل انقطعت السلسلة قبل اليوم؟ للعرض فقط — لا تُكتب الحالة حتى يستحق الطالب
 * حماسة جديدة، فتسجيل «منقطع» قبل أن يحلّ أي سؤال لا معنى له.
 */
function isBroken(state, day) {
  const s = normalize(state);
  if (s.current === 0 || !s.lastStreakDay) return false;
  return s.lastStreakDay !== day && s.lastStreakDay !== previousDay(day);
}

/**
 * يطبّق إجابات طلب واحد على حالة الطالب.
 *
 * @param {object|null} state الحالة المخزّنة
 * @param {string} day مفتاح اليوم بتوقيت عمّان 'YYYY-MM-DD'
 * @param {string[]} questionIds معرّفات الأسئلة المُجابة في هذا الطلب
 * @returns {{ state: object, changed: boolean, events: object }}
 *   events: { streakEarned, broken, reward: { points, streak }|null }
 */
function applyAnswers(state, day, questionIds = []) {
  const s = normalize(state);
  const events = { streakEarned: false, broken: false, reward: null };

  // يوم جديد ⇒ دلو جديد. دلو الأمس لا يُحتفظ به: الحماسة تُمنح يومها أو لا تُمنح.
  if (s.today.day !== day) s.today = { day, ids: [], count: 0, earned: false };

  // أُنجز هدف اليوم: لا عدّ ولا تخزين إضافي — هذا ما يبقي المستند صغيراً
  if (s.today.earned) return { state: s, changed: false, events };

  const before = s.today.count;
  const seen = new Set(s.today.ids);
  for (const id of questionIds) {
    if (typeof id !== 'string' || !id || seen.has(id)) continue;
    seen.add(id);
    s.today.ids.push(id);
    s.today.count += 1;
    if (s.today.count >= DAILY_GOAL) break; // ما بعد الهدف لا يغيّر شيئاً
  }
  if (s.today.count === before) return { state: s, changed: false, events };
  if (s.today.count < DAILY_GOAL) return { state: s, changed: true, events };

  // ---- استُوفي شرط اليوم: تُمنح حماسة واحدة ----
  s.today.earned = true;
  s.today.ids = []; // لم تعد لازمة بعد منح اليوم، ولا داعي لتضخيم المستند

  const continues = s.lastStreakDay === previousDay(day);
  events.broken = !continues && s.current > 0;
  s.current = continues ? s.current + 1 : 1;
  s.lastStreakDay = day;
  s.totalEarned += 1;
  s.longest = Math.max(s.longest, s.current);
  events.streakEarned = true;

  if (s.current >= STREAK_TARGET) {
    events.reward = { points: REWARD_POINTS, streak: STREAK_TARGET };
    s.rewardsCount += 1;
    s.rewardPoints += REWARD_POINTS;
    s.current = 0; // يبدأ العدّاد من جديد بعد المكافأة
  }

  return { state: s, changed: true, events };
}

module.exports = {
  applyAnswers,
  emptyStreak,
  isBroken,
  previousDay,
  STREAK_RULES: { DAILY_GOAL, STREAK_TARGET, REWARD_POINTS },
};
