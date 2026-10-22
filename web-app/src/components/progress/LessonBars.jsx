import { Link } from 'react-router-dom';
import { ArrowDownRight, ArrowUpRight, Flag, Minus, PlayCircle } from 'lucide-react';

/**
 * نسبة الصحيح في كل درس — أعمدة أفقية بلون واحد (مقدار، لا هوية).
 * القيمة مكتوبة نصاً بجانب كل عمود، والاتجاه أيقونة + كلمة لا لون فقط.
 */
export default function LessonBars({ subjectId, lessons, weakestNumber }) {
  return (
    <ul className="space-y-3">
      {lessons.map((l) => {
        const tested = l.accuracy !== null;
        return (
          <li key={l.number} className="rounded-xl border border-zinc-800 bg-base/40 p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 mb-2.5">
              <span className="flex items-center gap-2 min-w-0 text-sm font-semibold">
                <span className="truncate">
                  الدرس {l.number}: {l.title}
                </span>
                {l.number === weakestNumber && (
                  <span className="badge !px-2 !py-0.5 shrink-0 bg-accent/10 border border-accent/30 text-accent">
                    <Flag className="w-3 h-3" /> الأضعف
                  </span>
                )}
              </span>
              <Link
                to={`/app?start=${encodeURIComponent(subjectId)}&lessons=${l.number}`}
                className="flex items-center gap-1 text-xs font-semibold text-brandInk hover:underline"
              >
                <PlayCircle className="w-3.5 h-3.5" />
                تدرّب على هذا الدرس
              </Link>
            </div>

            {tested ? (
              <div className="flex items-center gap-3">
                {/* العمود ينمو من خط البداية (يميناً في العربية)، وطرفه مدوّر 4px */}
                <div className="relative h-3 flex-1 rounded-full bg-zinc-800" title={`${l.correct} صحيحة من ${l.total}`}>
                  <div
                    className="absolute inset-y-0 right-0 rounded-l bg-chart transition-[width] duration-700"
                    style={{ width: `${Math.max(l.accuracy, 1)}%` }}
                  />
                </div>
                <span className="w-11 shrink-0 text-sm font-bold tabular-nums text-left" dir="ltr">
                  {l.accuracy}%
                </span>
              </div>
            ) : (
              <p className="text-xs text-zinc-500">لم تُختبر في هذا الدرس بعد.</p>
            )}

            {tested && (
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500">
                <span className="tabular-nums">
                  {l.correct} صحيحة من {l.total}
                </span>
                {l.trend !== null && <Trend value={l.trend} />}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function Trend({ value }) {
  if (Math.abs(value) < 5) {
    return (
      <span className="flex items-center gap-1 text-zinc-400">
        <Minus className="w-3.5 h-3.5" /> مستقر
      </span>
    );
  }
  const up = value > 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`flex items-center gap-1 font-semibold ${up ? 'text-emerald-300' : 'text-red-300'}`}>
      <Icon className="w-3.5 h-3.5" />
      {up ? 'تحسّن' : 'تراجع'} <span dir="ltr" className="tabular-nums">{up ? '+' : '−'}{Math.abs(value)}</span> نقطة
    </span>
  );
}
