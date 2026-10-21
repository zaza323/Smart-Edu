import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check, RotateCcw, Timer, X } from 'lucide-react';
import { SectionHeading, useInView } from './common';

const TOTAL_SECONDS = 20;

const QUESTION = {
  subject: 'تاريخ الأردن',
  unit: 'الاستقلال والتأسيس',
  text: 'عُقد المؤتمر الوطني الأردني الأول عام 1928م برئاسة:',
  options: ['رشيد طليع', 'حسين باشا الطراونة', 'توفيق أبو الهدى', 'مظهر رسلان'],
  correct: 1,
  explanation:
    'عُقد المؤتمر الوطني الأردني الأول في عمّان يوم 25 تموز 1928م برئاسة حسين باشا الطراونة، وصدر عنه الميثاق الوطني الأردني الذي رفض المعاهدة الأردنية البريطانية لعام 1928م.',
};

const LETTERS = ['أ', 'ب', 'ج', 'د'];

/** سؤال تجريبي حقيقي يحلّه الزائر دون تسجيل — يبدأ المؤقّت عند ظهوره على الشاشة. */
export default function DemoQuestion({ user }) {
  const cardRef = useRef(null);
  const visible = useInView(cardRef, { threshold: 0.4 });
  const [secondsLeft, setSecondsLeft] = useState(TOTAL_SECONDS);
  const [selected, setSelected] = useState(null); // رقم الخيار، أو -1 عند انتهاء الوقت
  const [round, setRound] = useState(0);

  const answered = selected !== null;

  useEffect(() => {
    if (!visible || answered) return undefined;
    if (secondsLeft === 0) {
      setSelected(-1);
      return undefined;
    }
    const id = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [visible, answered, secondsLeft, round]);

  const reset = () => {
    setSelected(null);
    setSecondsLeft(TOTAL_SECONDS);
    setRound((r) => r + 1);
  };

  const elapsedPct = ((TOTAL_SECONDS - secondsLeft) / TOTAL_SECONDS) * 100;
  const isCorrect = selected === QUESTION.correct;
  const timedOut = selected === -1;

  const optionClass = (i) => {
    if (!answered) return 'border-lp-line bg-lp-raised/50 hover:bg-lp-raised hover:border-lp-glow/50';
    if (i === QUESTION.correct) return 'border-emerald-500 bg-emerald-500/15 text-emerald-300';
    if (i === selected) return 'border-red-500 bg-red-500/15 text-red-300';
    return 'border-lp-line bg-lp-raised/30 opacity-50';
  };

  return (
    <section id="demo" className="scroll-mt-20 py-24 sm:py-32 relative overflow-hidden bg-lp-bg">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <span className="inline-block mb-3 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs font-bold">
            تجربة فورية بدون تسجيل
          </span>
          <SectionHeading
            title="جرّب بنفسك الآن"
            text="اختر إجابتك قبل انتهاء الوقت، وشاهد كيف يظهر التصحيح والشرح."
          />
        </div>

        <div
          ref={cardRef}
          className="relative rounded-3xl bg-lp-card border border-lp-glow/30 p-6 sm:p-10 shadow-2xl shadow-lp-shadow/15"
        >
          <div className="flex items-center justify-between gap-4 pb-5 mb-6 border-b border-lp-line">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 rounded-lg bg-lp-primary text-lp-onPrimary font-extrabold text-xs">
                {QUESTION.subject}
              </span>
              <span className="text-xs text-lp-muted">{QUESTION.unit}</span>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <div className="relative w-11 h-11 grid place-items-center">
                <svg className="absolute inset-0 w-11 h-11" viewBox="0 0 36 36" aria-hidden="true">
                  <circle cx="18" cy="18" r="15.9155" fill="none" strokeWidth="3" className="stroke-lp-raised" />
                  <circle
                    cx="18"
                    cy="18"
                    r="15.9155"
                    fill="none"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray="100 100"
                    strokeDashoffset={elapsedPct}
                    className={`lp-ring ${secondsLeft <= 5 ? 'stroke-red-500' : 'stroke-lp-glow'}`}
                  />
                </svg>
                <span className="relative text-xs font-bold tabular-nums" aria-live="off">
                  {secondsLeft}
                </span>
              </div>
              <span className="hidden sm:inline text-xs text-lp-muted">ثانية متبقية</span>
            </div>
          </div>

          <div className="mb-8">
            <span className="text-xs font-bold text-lp-primaryInk">السؤال التجريبي:</span>
            <h3 className="mt-1 text-lg sm:text-2xl font-bold leading-relaxed">{QUESTION.text}</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5" role="group" aria-label="خيارات السؤال">
            {QUESTION.options.map((option, i) => (
              <button
                key={option}
                type="button"
                disabled={answered}
                onClick={() => setSelected(i)}
                className={`lp-focus p-4 rounded-xl border text-right flex items-center gap-3 transition-all duration-200 ${optionClass(i)}`}
              >
                <span className="w-8 h-8 shrink-0 rounded-lg bg-lp-raised text-lp-ink font-bold grid place-items-center text-sm">
                  {LETTERS[i]}
                </span>
                <span className="flex-1 text-sm sm:text-[1rem] font-semibold">{option}</span>
                {answered && i === QUESTION.correct && <Check className="w-5 h-5" strokeWidth={3} />}
                {answered && i === selected && !isCorrect && <X className="w-5 h-5" strokeWidth={3} />}
              </button>
            ))}
          </div>

          {answered && (
            <div className="mt-6 p-5 rounded-2xl bg-lp-raised/50 border border-lp-line space-y-3 animate-fadeIn" aria-live="polite">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span
                  className={`flex items-center gap-2 font-bold ${
                    isCorrect ? 'text-emerald-300' : timedOut ? 'text-amber-300' : 'text-red-300'
                  }`}
                >
                  {isCorrect ? (
                    <>
                      <Check className="w-5 h-5" strokeWidth={3} /> أحسنت! إجابة صحيحة
                    </>
                  ) : timedOut ? (
                    <>
                      <Timer className="w-5 h-5" /> انتهى الوقت المحدّد للسؤال
                    </>
                  ) : (
                    <>
                      <X className="w-5 h-5" strokeWidth={3} /> إجابة غير صحيحة
                    </>
                  )}
                </span>
                <button
                  type="button"
                  onClick={reset}
                  className="lp-focus flex items-center gap-1.5 rounded text-xs text-lp-muted hover:text-lp-ink underline underline-offset-4"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  أعد المحاولة
                </button>
              </div>
              <p className="text-sm text-lp-muted leading-relaxed">
                {!isCorrect && (
                  <strong className="text-lp-ink">
                    الإجابة الصحيحة: ({LETTERS[QUESTION.correct]}) {QUESTION.options[QUESTION.correct]}.{' '}
                  </strong>
                )}
                {QUESTION.explanation}
              </p>
              <div className="pt-3 border-t border-lp-line flex flex-col sm:flex-row items-center justify-between gap-4">
                <span className="text-xs font-medium text-lp-muted">أعجبك أسلوب التصحيح والشرح؟</span>
                <Link to={user ? '/app' : '/register'} className="lp-btn-primary px-5 py-2 text-xs sm:text-sm">
                  افتح البنك كاملاً لكل الدروس
                  <ArrowLeft className="w-4 h-4" />
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
