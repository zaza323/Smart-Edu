import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Flame, Gift, X } from 'lucide-react';
import { REWARD_POINTS, STREAK_TARGET } from '../lib/streak';

const VISIBLE_MS = 6000;

/**
 * نصّ الإشعار من أحداث الخادم وحدها.
 * الأحداث تصل في ردّ الطلب لا في الحالة المخزّنة، فإعادة تحميل الصفحة لا تعيدها.
 */
export function streakMessage(streak) {
  const events = streak?.events;
  if (!events) return null;

  if (events.reward) {
    return {
      tone: 'reward',
      title: `مبروك! حصلت على ${REWARD_POINTS} نقطة`,
      body: `أكملت ${STREAK_TARGET} حماسات متتالية — ويبدأ العدّاد من جديد.`,
    };
  }
  if (!events.streakEarned) return null;

  const left = Math.max(0, STREAK_TARGET - (Number(streak.current) || 0));
  const body =
    left === 1
      ? `حماسة واحدة تفصلك عن ${REWARD_POINTS} نقطة!`
      : left === 2
        ? 'بقيت حماستان على مكافأتك!'
        : `أنت على بُعد ${left} حماسات من المكافأة.`;

  return {
    tone: 'streak',
    title: 'حصلت على حماسة جديدة!',
    body: events.broken ? `${body} (بدأت سلسلة جديدة بعد انقطاع)` : body,
  };
}

/** إشعار عائم يختفي وحده — يُعرض مرة واحدة لكل حدث. */
export default function StreakToast({ streak, onDone }) {
  const message = streakMessage(streak);
  const key = message ? `${message.title}|${message.body}` : '';
  const [closing, setClosing] = useState(false);

  // `closing` يُعاد ضبطه مع كل رسالة جديدة، وإلا بقي الإشعار الأول هو الأخير
  useEffect(() => {
    if (!key) return undefined;
    setClosing(false);
    const timer = setTimeout(() => {
      setClosing(true);
      onDone?.();
    }, VISIBLE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!message || closing) return null;
  const isReward = message.tone === 'reward';

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 bottom-4 z-[70] flex justify-center px-4 pointer-events-none"
    >
      <div
        className={`pointer-events-auto flex items-center gap-3 max-w-md w-full rounded-2xl border px-4 py-3 shadow-2xl animate-fadeIn ${
          isReward
            ? 'bg-amber-500/15 border-amber-500/50 backdrop-blur'
            : 'bg-orange-500/15 border-orange-500/40 backdrop-blur'
        }`}
      >
        <div
          className={`relative w-11 h-11 shrink-0 rounded-xl grid place-items-center ${
            isReward ? 'bg-amber-500/25 text-amber-200' : 'bg-orange-500/25 text-orange-300'
          }`}
        >
          {isReward ? <Gift className="w-6 h-6" /> : <Flame className="w-6 h-6" />}
          <span className="absolute inset-0 rounded-xl ring-2 ring-current opacity-40 animate-ping" />
        </div>

        <div className="min-w-0 flex-1">
          <p className={`font-bold text-sm ${isReward ? 'text-amber-100' : 'text-orange-100'}`}>
            {message.title}
          </p>
          <p className="text-xs text-zinc-300 mt-0.5">{message.body}</p>
        </div>

        {isReward && (
          <span className="shrink-0 text-lg font-extrabold text-amber-300 tabular-nums">
            +{REWARD_POINTS}
          </span>
        )}

        <button
          type="button"
          onClick={() => {
            setClosing(true);
            onDone?.();
          }}
          aria-label="إغلاق"
          className="shrink-0 w-7 h-7 rounded-full grid place-items-center text-zinc-400 hover:text-zinc-100"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>,
    document.body
  );
}
