import { collection, doc, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from './firebase';

/**
 * قراءة الحماسات اليومية في الواجهة. الحساب كله خادمي — هنا عرض فقط.
 * الأرقام مطابقة لـ STREAK_RULES في functions/lib/streak.js، والخادم هو الحكم
 * في كل حال: تغييرها هنا يغيّر ما يُعرض لا ما يُمنح.
 */
export const DAILY_GOAL = 5;
export const STREAK_TARGET = 7;
export const REWARD_POINTS = 30;

// نفس منطقة الخادم الرسمية، حتى يتفق «اليوم» في الطرفين مهما كانت ساعة الجهاز
const ammanFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Amman',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
export const ammanDay = (at = new Date()) => ammanFormatter.format(at);

function previousDay(day) {
  const [y, m, d] = String(day).split('-').map(Number);
  const prev = new Date(Date.UTC(y, m - 1, d));
  prev.setUTCDate(prev.getUTCDate() - 1);
  return prev.toISOString().slice(0, 10);
}

/** متابعة لحظية لحماسات الطالب — تتحدّث البطاقة فور منح الحماسة بلا تحديث صفحة. */
export function subscribeStreak(uid, onChange) {
  return onSnapshot(
    doc(db, 'streaks', uid),
    (snap) => onChange(snap.exists() ? snap.data() : null),
    () => onChange(null)
  );
}

/** آخر مكافآت الطالب — الاستعلام مقيّد بـ uid كما تفرض قواعد الأمان. */
export function subscribeRewards(uid, onChange, max = 20) {
  return onSnapshot(
    query(
      collection(db, 'rewards'),
      where('uid', '==', uid),
      orderBy('createdAt', 'desc'),
      limit(max)
    ),
    (snap) => onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    () => onChange([])
  );
}

/**
 * ملخّص جاهز للعرض.
 * تقدّم اليوم يُقرأ فقط إذا كان دلو المستند لليوم نفسه — وإلا فاليوم لم يبدأ بعد.
 */
export function streakView(streak, day = ammanDay()) {
  const current = Number(streak?.current) || 0;
  const lastDay = streak?.lastStreakDay || '';
  const sameDay = streak?.today?.day === day;
  const earnedToday = Boolean(sameDay && streak?.today?.earned);
  const answeredToday = earnedToday ? DAILY_GOAL : sameDay ? Number(streak?.today?.count) || 0 : 0;

  return {
    current,
    longest: Number(streak?.longest) || 0,
    totalEarned: Number(streak?.totalEarned) || 0,
    rewardsCount: Number(streak?.rewardsCount) || 0,
    rewardPoints: Number(streak?.rewardPoints) || 0,
    answeredToday,
    remainingToday: Math.max(0, DAILY_GOAL - answeredToday),
    earnedToday,
    toReward: Math.max(0, STREAK_TARGET - current),
    // منقطعة: نال حماسة سابقاً، وآخر يوم ليس اليوم ولا أمس
    broken: current > 0 && Boolean(lastDay) && lastDay !== day && lastDay !== previousDay(day),
  };
}
