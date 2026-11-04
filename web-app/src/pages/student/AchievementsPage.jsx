import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Award, Coins, Flame, Gift, Trophy } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { EmptyState, formatDate } from '../../components/ui';
import {
  DAILY_GOAL,
  REWARD_POINTS,
  STREAK_TARGET,
  streakView,
  subscribeRewards,
  subscribeStreak,
} from '../../lib/streak';
import { arCount } from '../../components/landing/common';

// الأوسمة تُشتق من الأرقام نفسها — لا مخزن إضافي ولا حالة تحتاج مزامنة
const BADGES = [
  { id: 'first', label: 'أول حماسة', hint: 'أكملت يومك الأول', reached: (v) => v.totalEarned >= 1 },
  { id: 'week', label: 'أسبوع كامل', hint: `${STREAK_TARGET} حماسات متتالية`, reached: (v) => v.longest >= STREAK_TARGET },
  { id: 'rewarded', label: 'أول مكافأة', hint: `${REWARD_POINTS} نقطة`, reached: (v) => v.rewardsCount >= 1 },
  { id: 'ten', label: 'عشر حماسات', hint: 'مجموع ما كسبته', reached: (v) => v.totalEarned >= 10 },
  { id: 'thirty', label: 'ثلاثون حماسة', hint: 'التزام طويل', reached: (v) => v.totalEarned >= 30 },
  { id: 'rewards3', label: 'ثلاث مكافآت', hint: `${REWARD_POINTS * 3} نقطة`, reached: (v) => v.rewardsCount >= 3 },
];

function Tile({ icon: Icon, label, value, hint, tone = 'text-zinc-100' }) {
  return (
    <div className="card !shadow-md p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-zinc-400">{label}</span>
        <Icon className="w-4 h-4 text-zinc-500 shrink-0" />
      </div>
      <div className={`text-2xl font-extrabold tabular-nums ${tone}`}>{value}</div>
      {hint && <div className="text-xs text-zinc-500">{hint}</div>}
    </div>
  );
}

/** إنجازاتي (/app/achievements): الحماسات والمكافآت وسجلّها — كلها من قاعدة البيانات. */
export default function AchievementsPage() {
  const { user } = useAuth();
  const [streak, setStreak] = useState(null);
  const [rewards, setRewards] = useState([]);

  useEffect(() => (user ? subscribeStreak(user.uid, setStreak) : undefined), [user]);
  useEffect(() => (user ? subscribeRewards(user.uid, setRewards) : undefined), [user]);

  const v = streakView(streak);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold flex items-center gap-2">
          <Trophy className="w-6 h-6 text-accent" />
          إنجازاتي
        </h1>
        <p className="text-zinc-400 mt-1 text-sm">
          حلّ {DAILY_GOAL} أسئلة كل يوم لتكسب حماسة، وعند {STREAK_TARGET} حماسات متتالية تحصل على{' '}
          {REWARD_POINTS} نقطة.
        </p>
      </div>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Tile
          icon={Flame}
          label="الحماسات الحالية"
          value={`${v.current}/${STREAK_TARGET}`}
          hint={v.earnedToday ? 'حماسة اليوم محفوظة' : `بقي ${v.remainingToday} من أسئلة اليوم`}
          tone="text-orange-400"
        />
        <Tile
          icon={Award}
          label="أطول سلسلة"
          value={v.longest}
          hint={v.longest ? arCount(v.longest, { one: 'يوم متتالٍ', two: 'يومان متتاليان', few: 'أيام متتالية', many: 'يوماً متتالياً' }) : 'لم تبدأ بعد'}
        />
        <Tile icon={Flame} label="إجمالي الحماسات" value={v.totalEarned} hint="منذ انضمامك" />
        <Tile
          icon={Coins}
          label="نقاط المكافآت"
          value={v.rewardPoints}
          hint={`من ${arCount(v.rewardsCount, { one: 'مكافأة واحدة', two: 'مكافأتين', few: 'مكافآت', many: 'مكافأة' })}`}
          tone="text-amber-300"
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">الأوسمة</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {BADGES.map((b) => {
            const earned = b.reached(v);
            return (
              <div
                key={b.id}
                className={`rounded-xl border p-3 flex items-center gap-3 transition ${
                  earned
                    ? 'border-amber-500/40 bg-amber-500/10'
                    : 'border-zinc-800 bg-surface/60 opacity-60'
                }`}
              >
                <div
                  className={`w-9 h-9 shrink-0 rounded-full grid place-items-center ${
                    earned ? 'bg-amber-500/20 text-amber-300' : 'bg-zinc-800 text-zinc-600'
                  }`}
                >
                  <Award className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className={`text-sm font-bold truncate ${earned ? 'text-amber-200' : 'text-zinc-400'}`}>
                    {b.label}
                  </p>
                  <p className="text-[11px] text-zinc-500 truncate">{b.hint}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">سجل المكافآت</h2>
        {rewards.length === 0 ? (
          <EmptyState
            icon={Gift}
            title="لا مكافآت بعد"
            description={`أكمل ${STREAK_TARGET} حماسات متتالية لتحصل على أول ${REWARD_POINTS} نقطة.`}
            action={
              <Link to="/app" className="btn-primary">
                ابدأ اختباراً
              </Link>
            }
          />
        ) : (
          <div className="space-y-2">
            {rewards.map((r) => (
              <div
                key={r.id}
                className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-surface px-4 py-3"
              >
                <div className="w-10 h-10 shrink-0 rounded-xl grid place-items-center bg-amber-500/15 border border-amber-500/30 text-amber-300">
                  <Gift className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-sm truncate">{r.reason || 'مكافأة التزام'}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">{formatDate(r.createdAt)}</p>
                </div>
                <div className="shrink-0 text-left">
                  <p className="text-lg font-extrabold text-amber-300 tabular-nums">+{r.points}</p>
                  <p className="text-[10px] text-zinc-500">نقطة</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
