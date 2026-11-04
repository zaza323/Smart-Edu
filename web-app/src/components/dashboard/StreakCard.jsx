import { Link } from 'react-router-dom';
import { ArrowLeft, Flame, Gift } from 'lucide-react';
import { DAILY_GOAL, REWARD_POINTS, STREAK_TARGET, streakView } from '../../lib/streak';
import { arCount } from '../landing/common';

/** شعلة واحدة من شريط الحماسات السبع. */
function Spark({ filled, isNext }) {
  return (
    <span
      className={`flex-1 h-2 rounded-full transition-all duration-500 ${
        filled
          ? 'bg-gradient-to-l from-amber-400 to-orange-500'
          : isNext
            ? 'bg-zinc-700 ring-1 ring-amber-500/40'
            : 'bg-zinc-800'
      }`}
    />
  );
}

/**
 * بطاقة الحماسات اليومية في لوحة الطالب.
 * كل الأرقام من مستند `streaks/{uid}` الذي يكتبه الخادم — لا حساب هنا.
 */
export default function StreakCard({ streak }) {
  const v = streakView(streak);

  const headline = v.earnedToday
    ? 'حماسة اليوم محفوظة — أحسنت!'
    : v.answeredToday > 0
      ? `بقي ${arCount(v.remainingToday, { one: 'سؤال واحد', two: 'سؤالان', few: 'أسئلة', many: 'سؤالاً' })} لحماسة اليوم`
      : `حلّ ${DAILY_GOAL} أسئلة اليوم لتكسب حماسة`;

  return (
    <section className="card p-4 sm:p-5 bg-gradient-to-l from-surface via-surface to-orange-500/[0.06] border-orange-500/20">
      <div className="flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-6">
        {/* الشعلة والعدّاد */}
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <div
            className={`relative w-12 h-12 sm:w-14 sm:h-14 shrink-0 rounded-2xl grid place-items-center border ${
              v.current > 0
                ? 'bg-orange-500/15 border-orange-500/40 text-orange-400'
                : 'bg-zinc-800 border-zinc-700 text-zinc-500'
            }`}
          >
            <Flame className={`w-6 h-6 sm:w-7 sm:h-7 ${v.earnedToday ? 'animate-pulse' : ''}`} />
            {v.earnedToday && (
              <span className="absolute -top-1 -left-1 flex w-3.5 h-3.5">
                <span className="absolute inset-0 rounded-full bg-amber-400 opacity-75 animate-ping" />
                <span className="relative w-3.5 h-3.5 rounded-full bg-amber-500" />
              </span>
            )}
          </div>

          <div className="min-w-0">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-extrabold tabular-nums text-orange-400">
                {v.current}
              </span>
              <span className="text-sm text-zinc-500">/ {STREAK_TARGET} حماسات</span>
            </div>
            <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">{headline}</p>
          </div>
        </div>

        {/* شريط الحماسات السبع */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5" role="img" aria-label={`${v.current} من ${STREAK_TARGET} حماسات`}>
            {Array.from({ length: STREAK_TARGET }, (_, i) => (
              <Spark key={i} filled={i < v.current} isNext={i === v.current} />
            ))}
          </div>

          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs">
            <span className="text-zinc-500">
              أسئلة اليوم:{' '}
              <strong className={`tabular-nums ${v.earnedToday ? 'text-emerald-300' : 'text-zinc-200'}`}>
                {v.answeredToday}/{DAILY_GOAL}
              </strong>
            </span>
            <span className="flex items-center gap-1 text-amber-300">
              <Gift className="w-3.5 h-3.5 shrink-0" />
              {v.toReward === 0
                ? `مكافأتك جاهزة: ${REWARD_POINTS} نقطة`
                : `${arCount(v.toReward, { one: 'حماسة واحدة', two: 'حماستان', few: 'حماسات', many: 'حماسة' })} على ${REWARD_POINTS} نقطة`}
            </span>
          </div>
        </div>

        <Link
          to="/app/achievements"
          className="shrink-0 flex items-center gap-1 text-sm font-semibold text-brandInk hover:underline"
        >
          إنجازاتي
          <ArrowLeft className="w-4 h-4" />
        </Link>
      </div>

      {v.broken && (
        <p className="mt-3 pt-3 border-t border-zinc-800 text-xs text-zinc-400">
          انقطعت سلسلتك — ابدأ من جديد اليوم، وأطول سلسلة لك ({v.longest}) تبقى محفوظة.
        </p>
      )}
    </section>
  );
}
