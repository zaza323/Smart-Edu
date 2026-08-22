/**
 * حلقة المؤقّت الدائرية — العنصر المحوري بواجهة الاختبار.
 *
 * عنصر عرض بحت: يستقبل الوقت المتبقّي والمدّة الكلّية كما يحسبهما ExamPage
 * ولا يملك أي مؤقّت أو منطق خاص به.
 */
import { formatDuration } from './ui';

const RADIUS = 45;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export const TIMER_CAUTION_SECONDS = 300; // 5 دقائق فأقل → كهرماني
export const TIMER_CRITICAL_SECONDS = 120; // دقيقتان فأقل → أحمر مرجاني + نبض

/**
 * لكل حالة لونان منفصلان عمداً:
 *  - `arc`  : القوس نفسه، يُرسم فوق مسار الحلقة الداكن فيبقى بلون الهوية في الوضعين.
 *  - `label`: الرقم داخل الحلقة، يجلس على خلفية الصفحة فيتبع الوضع (أصفر على
 *             الداكن، حبر على الفاتح) — وإلا اختفى الأصفر على الخلفية الفاتحة.
 * التوهّج شفافيته منخفضة ويُرسم على الحاوية الدائرية لا على عنصر SVG.
 */
const TONES = {
  safe: {
    arc: 'rgb(var(--c-timer-safe))', // القوس: لون الهوية فوق مسار داكن
    label: 'rgb(var(--c-timer-label-safe))', // الرقم: يتبع الوضع ليُقرأ على خلفية الصفحة
    glow: 'rgb(var(--c-timer-safe) / calc(0.3 * var(--glow-strength)))',
  },
  caution: {
    arc: 'rgb(var(--c-timer-warn))',
    label: 'rgb(var(--c-timer-label-warn))',
    glow: 'rgb(var(--c-timer-warn) / calc(0.34 * var(--glow-strength)))',
  },
  critical: {
    arc: 'rgb(var(--c-timer-critical))',
    label: 'rgb(var(--c-timer-label-critical))',
    glow: 'rgb(var(--c-timer-critical) / calc(0.38 * var(--glow-strength)))',
  },
};

/** درجة الإلحاح حسب الوقت المتبقّي (بند 3 من وثيقة التصميم) */
export function timerTone(remainingSeconds) {
  if (remainingSeconds <= TIMER_CRITICAL_SECONDS) return 'critical';
  if (remainingSeconds <= TIMER_CAUTION_SECONDS) return 'caution';
  return 'safe';
}

export default function ExamTimerRing({ remaining = 0, totalSeconds = 0 }) {
  const tone = timerTone(remaining);
  const { arc, label: labelColor, glow } = TONES[tone];

  // نسبة الامتلاء تعكس الوقت المتبقّي فعلياً من إجمالي وقت الاختبار
  const ratio = totalSeconds > 0 ? Math.min(1, Math.max(0, remaining / totalSeconds)) : 0;
  const label = formatDuration(remaining);
  const isLong = label.length > 5; // صيغة hh:mm:ss باختبار طويل

  return (
    <div
      className={`exam-ring-shell relative shrink-0 w-[96px] h-[96px] sm:w-[128px] sm:h-[128px] ${
        tone === 'critical' ? 'motion-safe:animate-ringPulse' : ''
      }`}
      /* التوهّج box-shadow على حاوية دائرية لا drop-shadow على عنصر SVG:
         مرشّح الـ SVG له منطقة محدودة تقصّ الظل في مربّع ظاهر الحواف. */
      style={{ borderRadius: '9999px', boxShadow: `0 0 30px -8px ${glow}` }}
      role="timer"
      aria-label={`الوقت المتبقّي ${label}`}
    >
      <svg
        viewBox="0 0 100 100"
        className="w-full h-full -rotate-90 scale-x-[-1]"
        aria-hidden="true"
        focusable="false"
      >
        {/* var() لا تُحلّ داخل خاصية SVG، لذلك تُمرَّر عبر style */}
        <circle
          cx="50"
          cy="50"
          r={RADIUS}
          fill="none"
          strokeWidth="8"
          style={{ stroke: 'rgb(var(--c-ring-track))' }}
        />
        <circle
          cx="50"
          cy="50"
          r={RADIUS}
          fill="none"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - ratio)}
          className="exam-ring-progress"
          style={{ stroke: arc }}
        />
      </svg>

      <div className="absolute inset-0 grid place-items-center pointer-events-none">
        <span
          dir="ltr"
          style={{ color: labelColor }}
          className={`font-black tabular-nums leading-none ${
            isLong ? 'text-[1.15rem] sm:text-2xl' : 'text-2xl sm:text-[2.2rem]'
          }`}
        >
          {label}
        </span>
      </div>
    </div>
  );
}

/**
 * شارة المتتالية 🔥 — عنصر اختياري.
 * توضع بجانب حلقة المؤقّت لتشكّل معها «منطقة نبض» واحدة أعلى الشاشة،
 * ولا تظهر إطلاقاً إن لم تتوفّر بياناتها (الميزة قد تكون غير منفَّذة بعد).
 */
export function ExamStreakBadge({ streak }) {
  const value = Number(streak);
  if (!Number.isFinite(value) || value <= 0) return null;

  return (
    <div
      className="flex flex-col items-center gap-1 shrink-0"
      title={`متتالية ${value} إجابات صحيحة`}
    >
      <div
        className="w-10 h-10 sm:w-11 sm:h-11 rounded-full grid place-items-center text-lg sm:text-xl"
        style={{
          background:
            'linear-gradient(135deg, rgb(var(--c-warn)) 0%, rgb(var(--c-accent-fill)) 100%)',
          boxShadow: '0 0 20px -7px rgb(var(--c-warn) / .8)',
        }}
      >
        <span aria-hidden="true">🔥</span>
      </div>
      <span
        style={{ color: 'rgb(var(--c-warn))' }}
        className="text-[11px] font-extrabold tabular-nums leading-none"
      >
        {value}
      </span>
      <span className="sr-only">متتالية {value} إجابات صحيحة</span>
    </div>
  );
}
