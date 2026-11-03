import { Award, CircleCheck, Flame, TrendingUp } from 'lucide-react';
import { ProgressRing } from './widgets';

function Tile({ label, icon, children }) {
  return (
    <div className="card !shadow-md p-4 sm:p-5 flex flex-col justify-between gap-3 hover:border-zinc-700 transition">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs sm:text-sm text-zinc-400">{label}</span>
        {icon}
      </div>
      {children}
    </div>
  );
}

/** أربعة أرقام من محاولات الطالب الفعلية (lib/studentStats.js). */
export default function StatsStrip({ stats }) {
  const { totalAnswered, todayAnswered, accuracy, streak, best } = stats;

  return (
    <section className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
      <Tile label="أسئلة تم حلها" icon={<CircleCheck className="w-5 h-5 text-brandInk" />}>
        <div>
          <div className="text-2xl font-extrabold tabular-nums">{totalAnswered}</div>
          <div
            className={`mt-1 flex items-center gap-1 text-xs ${todayAnswered ? 'text-emerald-300' : 'text-zinc-500'}`}
          >
            {todayAnswered ? (
              <>
                <TrendingUp className="w-3.5 h-3.5" />+{todayAnswered} اليوم
              </>
            ) : (
              'لا أسئلة اليوم بعد'
            )}
          </div>
        </div>
      </Tile>

      {/* النسبة مكتوبة داخل الحلقة فقط — لا تتكرّر بجانبها */}
      <Tile label="معدل الإجابات الصحيحة" icon={null}>
        <ProgressRing value={accuracy ?? 0} className="w-16 h-16" stroke={3.5}>
          <span className="text-sm font-extrabold tabular-nums" dir="ltr">
            {accuracy === null ? '—' : `${accuracy}%`}
          </span>
        </ProgressRing>
      </Tile>

      <Tile
        label="أيام متتالية"
        icon={
          streak.activeToday ? (
            <span className="badge !px-2 !py-0.5 !text-[10px] bg-accent/15 border border-accent/30 text-accent">
              نشط 🔥
            </span>
          ) : (
            <Flame className="w-5 h-5 text-zinc-500" />
          )
        }
      >
        <div>
          <div className="text-2xl font-extrabold tabular-nums">{streak.days}</div>
          <div className={`mt-1 text-xs ${streak.activeToday ? 'text-accent' : 'text-zinc-500'}`}>
            {streak.activeToday
              ? 'حافظ على شعلتك للغد!'
              : streak.days > 0
                ? 'حلّ اختباراً اليوم لتحافظ عليها'
                : 'ابدأ سلسلتك اليوم'}
          </div>
        </div>
      </Tile>

      <Tile label="أفضل نتيجة" icon={<Award className="w-5 h-5 text-accent" />}>
        <div>
          <div className="text-2xl font-extrabold tabular-nums" dir="ltr">
            {best ? `${Math.round(best.percentage)}%` : '—'}
          </div>
          <div className="mt-1 text-xs text-zinc-500 truncate">
            {best ? best.subject : 'لا اختبارات مكتملة بعد'}
          </div>
        </div>
      </Tile>
    </section>
  );
}
