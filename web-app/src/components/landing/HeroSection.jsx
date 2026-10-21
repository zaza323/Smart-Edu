import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowLeft, Check, ChevronLeft, ChevronRight, Clock, Lock } from 'lucide-react';
import { usePrefersReducedMotion } from './common';
import { HERO_QUESTIONS, pickRandom } from './heroQuestions';

const TRUST_POINTS = ['تصحيح فوري مع الشرح', 'مؤقّت يحاكي الامتحان', 'يعمل على الهاتف والكمبيوتر'];

const LETTERS = ['أ', 'ب', 'ج', 'د'];
const SAMPLE_COUNT = 3;
const SWIPE_PX = 40;

/** الواجهة الأولى: عنوان، أزرار البدء، ومعاينة لشاشة اختبار مرسومة بالكود. */
export default function HeroSection({ user }) {
  return (
    <section
      id="top"
      className="relative overflow-hidden pt-32 sm:pt-44 pb-20 sm:pb-32 flex flex-col items-center text-center bg-gradient-to-b from-lp-tint/60 via-lp-bg to-lp-alt"
    >
      {/* توهّج خلفي */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] sm:w-[650px] lg:w-[850px] h-[340px] sm:h-[650px] rounded-full blur-[110px] bg-gradient-to-tr from-lp-glow/20 via-lp-soft/15 to-transparent animate-pulseGlow"
      />

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center">
        <div className="inline-flex items-center gap-2 mb-6 sm:mb-8 px-4 py-1.5 rounded-full border border-lp-line bg-lp-card/60 backdrop-blur-md text-xs sm:text-sm font-semibold text-lp-primaryInk">
          <span className="relative flex w-2 h-2">
            <span className="absolute inset-0 rounded-full bg-lp-glow animate-ping" />
            <span className="relative w-2 h-2 rounded-full bg-lp-glow" />
          </span>
          مبني لطلاب التوجيهي على نمط أسئلة الوزارة
        </div>

        <h1 className="text-4xl sm:text-6xl lg:text-7xl xl:text-8xl font-black leading-[1.4] max-w-4xl">
          بنك الأسئلة <span className="lp-shimmer">التفاعلي</span>
        </h1>

        <p className="mt-10 sm:mt-14 text-lg sm:text-2xl text-lp-muted max-w-2xl leading-relaxed">
          تدرّب على أسئلة الوزارة، حاكِ ضغط الامتحان الحقيقي، واكتشف نقاط ضعفك فوراً.
        </p>

        <div className="mt-9 flex flex-col sm:flex-row items-center gap-4 sm:gap-6 w-full sm:w-auto">
          <Link
            to={user ? '/app' : '/register'}
            className="lp-btn-primary w-full sm:w-auto px-9 py-4 min-h-[52px] text-lg shadow-xl"
          >
            {user ? 'انتقل إلى لوحتي' : 'أنشئ حسابك مجاناً'}
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <a href="#subjects" className="lp-btn-secondary group w-full sm:w-auto px-7 py-4 min-h-[52px] font-bold">
            المواد والأسعار
            <ArrowDown className="w-4 h-4 text-lp-primaryInk transition-transform group-hover:translate-y-0.5" />
          </a>
        </div>

        <ul className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs sm:text-sm text-lp-muted">
          {TRUST_POINTS.map((point) => (
            <li key={point} className="flex items-center gap-1.5">
              <Check className="w-4 h-4 text-emerald-300" strokeWidth={3} />
              {point}
            </li>
          ))}
        </ul>
      </div>

      <ExamMockup />
    </section>
  );
}

/**
 * معاينة شاشة الاختبار داخل إطار متصفح: تتنقّل بين 3 أسئلة مختارة عشوائياً.
 * تتقدّم تلقائياً (يتوقّف التقدّم عند مرور المؤشّر فوقها)، ويتوقّف التلقائي نهائياً
 * بمجرّد أن يتنقّل الزائر بنفسه — بالأزرار أو النقاط أو السحب على الهاتف.
 */
function ExamMockup() {
  const [questions] = useState(() => pickRandom(HERO_QUESTIONS, SAMPLE_COUNT));
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(null); // 'next' | 'prev' — يحدّد جهة دخول السؤال
  const [autoPlay, setAutoPlay] = useState(true);
  const [hovering, setHovering] = useState(false);
  const reducedMotion = usePrefersReducedMotion();
  const touchStartX = useRef(null);

  const autoPlaying = autoPlay && !reducedMotion;
  const q = questions[index];

  const go = (target, dir) => {
    setDirection(dir);
    setIndex((target + questions.length) % questions.length);
  };
  const userGo = (target, dir) => {
    setAutoPlay(false);
    go(target, dir);
  };
  const next = () => userGo(index + 1, 'next');
  const prev = () => userGo(index - 1, 'prev');

  // في الواجهة العربية: سحب الإصبع نحو اليمين يكشف التالي، ونحو اليسار يعيد السابق
  const onTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (dx > SWIPE_PX) next();
    else if (dx < -SWIPE_PX) prev();
  };

  const slideClass =
    direction === 'next' ? 'animate-slideFromLeft' : direction === 'prev' ? 'animate-slideFromRight' : '';

  return (
    <div className="relative mt-14 sm:mt-20 md:mt-56 mb-10 w-full max-w-5xl px-4 sm:px-6 select-none">
      {/* بطاقة عائمة: المؤقّت */}
      <div
        aria-hidden="true"
        className="absolute -top-6 right-8 sm:right-16 z-20 flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-lp-card/95 backdrop-blur-md border border-lp-glow/40 shadow-xl animate-floatSlow"
      >
        <span className="relative flex w-3 h-3">
          <span className="absolute inset-0 rounded-full bg-lp-glow opacity-75 animate-ping" />
          <span className="relative w-3 h-3 rounded-full bg-lp-glow" />
        </span>
        <span className="text-xs text-lp-muted">الوقت المتبقي:</span>
        <span className="text-sm font-bold tabular-nums" dir="ltr">
          24:30
        </span>
      </div>

      {/* بطاقة عائمة: النتيجة — فوق الإطار لا فوق محتواه، وتلامس حافته فقط */}
      <div
        aria-hidden="true"
        className="hidden md:flex absolute left-10 bottom-[calc(100%-0.75rem)] z-20 items-center gap-6 px-8 py-6 rounded-3xl bg-lp-card/95 backdrop-blur-md border border-lp-line shadow-2xl animate-floatSlow"
      >
        <span className="relative w-28 h-28 shrink-0 grid place-items-center">
          <svg className="absolute inset-0 w-28 h-28" viewBox="0 0 36 36">
            <circle cx="18" cy="18" r="15.9155" fill="none" strokeWidth="2.5" className="stroke-lp-raised" />
            <circle
              cx="18"
              cy="18"
              r="15.9155"
              fill="none"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray="100 100"
              strokeDashoffset="13"
              className="lp-ring stroke-lp-glow"
            />
          </svg>
          <span className="relative text-3xl font-black text-lp-primaryInk tabular-nums">87%</span>
        </span>
        <span className="text-right">
          <span className="block text-3xl font-black">نتيجتك</span>
          <span className="block mt-1 text-lg text-lp-muted">تقرير مفصّل لكل اختبار</span>
        </span>
      </div>

      {/* بطاقة عائمة: إجابة صحيحة — أسفل الإطار، تلامس حافته فقط */}
      <div
        aria-hidden="true"
        className="absolute right-8 sm:right-16 top-[calc(100%-0.75rem)] z-20 flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-lp-card/95 backdrop-blur-md border border-emerald-500/50 shadow-xl animate-float"
      >
        <span className="w-6 h-6 rounded-full bg-emerald-500 text-white grid place-items-center">
          <Check className="w-4 h-4" strokeWidth={3} />
        </span>
        <span className="text-right">
          <span className="block text-xs font-bold text-emerald-300">إجابة صحيحة</span>
          <span className="block text-[10px] text-lp-muted">مع شرح الإجابة بعد التسليم</span>
        </span>
      </div>

      {/* إطار الجهاز */}
      <div
        role="region"
        aria-roledescription="عرض متتابع"
        aria-label="أمثلة من أسئلة البنك"
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        className="relative mx-auto rounded-2xl sm:rounded-3xl p-2 sm:p-3.5 bg-gradient-to-b from-lp-line/80 via-lp-raised/40 to-transparent border border-lp-line shadow-2xl shadow-lp-shadow/20"
      >
        <div className="rounded-xl sm:rounded-2xl overflow-hidden bg-lp-card border border-lp-line text-right">
          {/* شريط المتصفح */}
          <div className="h-10 sm:h-12 px-4 bg-lp-raised border-b border-lp-line flex items-center justify-between gap-3">
            <div className="flex items-center gap-2" dir="ltr" aria-hidden="true">
              <span className="w-3 h-3 rounded-full bg-red-400" />
              <span className="w-3 h-3 rounded-full bg-yellow-400" />
              <span className="w-3 h-3 rounded-full bg-emerald-400" />
            </div>
            <div className="hidden sm:flex items-center gap-1.5 px-6 py-1 rounded-full bg-lp-bg border border-lp-line text-[11px] text-lp-muted">
              <Lock className="w-3 h-3 text-emerald-300" />
              بنك الأسئلة — وضع الاختبار
            </div>
            <div className="text-xs text-lp-muted">
              السؤال <strong className="text-lp-ink">{index + 1}</strong> من{' '}
              <strong className="text-lp-ink">{questions.length}</strong>
            </div>
          </div>

          <div className="p-5 sm:p-8 space-y-6 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-lp-line">
              <span key={`tag-${index}`} className={`lp-pill !rounded-lg ${slideClass}`}>
                {q.subject} — {q.topic}
              </span>
              <span className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-lp-raised border border-lp-line">
                <Clock className="w-4 h-4 text-lp-primaryInk animate-pulse" />
                <span className="text-xs font-bold text-lp-primaryInk tabular-nums" dir="ltr">
                  24:18
                </span>
              </span>
            </div>

            <div className="w-full h-1.5 rounded-full overflow-hidden bg-lp-raised">
              <div
                className="h-full rounded-full bg-lp-glow transition-all duration-500"
                style={{ width: `${((index + 1) / questions.length) * 100}%` }}
              />
            </div>

            {/* السؤال الحالي — يُعاد رسمه مع كل تبديل ليدخل بحركة انزلاق */}
            <div key={index} className={`space-y-6 ${slideClass}`}>
              <div>
                <span className="block mb-1 text-xs font-bold text-lp-muted">السؤال رقم {index + 1}:</span>
                <h3 className="min-h-[5rem] sm:min-h-[4rem] text-[1rem] sm:text-xl font-bold leading-relaxed">
                  {q.text}
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {q.options.map((option, i) =>
                  i === q.correct ? (
                    <div
                      key={option}
                      className="p-4 rounded-xl border border-emerald-500/50 bg-emerald-500/10 flex items-center justify-between gap-3"
                    >
                      <span className="flex items-center gap-3">
                        <span className="w-8 h-8 shrink-0 rounded-lg bg-emerald-500 text-white font-extrabold grid place-items-center text-sm">
                          {LETTERS[i]}
                        </span>
                        <span className="font-semibold text-sm sm:text-[1rem] text-emerald-300">{option}</span>
                      </span>
                      <Check className="w-5 h-5 shrink-0 text-emerald-300" strokeWidth={3} />
                    </div>
                  ) : (
                    <div
                      key={option}
                      className="p-4 rounded-xl border border-lp-line bg-lp-raised/50 flex items-center gap-3"
                    >
                      <span className="w-8 h-8 shrink-0 rounded-lg bg-lp-raised font-bold grid place-items-center text-sm">
                        {LETTERS[i]}
                      </span>
                      <span className="font-medium text-sm sm:text-[1rem] text-lp-muted">{option}</span>
                    </div>
                  )
                )}
              </div>

              <div className="min-h-[5.5rem] sm:min-h-[4.5rem] p-4 rounded-xl bg-lp-raised/60 border border-lp-line text-xs sm:text-sm flex items-start gap-2">
                <span className="shrink-0 px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold text-xs">
                  الشرح:
                </span>
                <span className="text-lp-muted leading-relaxed">{q.explanation}</span>
              </div>
            </div>

            {/* التنقّل بين الأسئلة */}
            <div className="flex items-center justify-between gap-4 pt-1">
              <button
                type="button"
                onClick={prev}
                aria-label="السؤال السابق"
                className="lp-focus w-10 h-10 shrink-0 rounded-full grid place-items-center border border-lp-line bg-lp-raised/60 text-lp-muted hover:text-lp-primaryInk hover:border-lp-glow/50 transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-2.5">
                {questions.map((item, i) => {
                  const active = i === index;
                  return (
                    <button
                      key={item.text}
                      type="button"
                      onClick={() => i !== index && userGo(i, i > index ? 'next' : 'prev')}
                      aria-label={`السؤال ${i + 1}`}
                      aria-current={active ? 'true' : undefined}
                      className={`lp-focus relative h-2.5 rounded-full overflow-hidden transition-all duration-300 ${
                        active ? 'w-12 bg-lp-glow/25' : 'w-2.5 bg-lp-line hover:bg-lp-muted'
                      }`}
                    >
                      {active &&
                        (autoPlaying ? (
                          // شريط يمتلئ خلال مدّة العرض، وانتهاؤه هو ما ينقل للسؤال التالي
                          <span
                            key={index}
                            className="absolute inset-y-0 right-0 rounded-full bg-lp-glow animate-fillBar"
                            style={{ animationPlayState: hovering ? 'paused' : 'running' }}
                            onAnimationEnd={() => go(index + 1, 'next')}
                          />
                        ) : (
                          <span className="absolute inset-0 rounded-full bg-lp-glow" />
                        ))}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={next}
                className="lp-focus shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-lg bg-lp-glow/20 text-lp-primaryInk text-xs sm:text-sm font-bold hover:bg-lp-glow/30 transition-colors"
              >
                السؤال التالي
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
