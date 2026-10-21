import { Link } from 'react-router-dom';
import { ArrowDown, ArrowLeft, Check, Clock, Lock } from 'lucide-react';

const TRUST_POINTS = ['تصحيح فوري مع الشرح', 'مؤقّت يحاكي الامتحان', 'يعمل على الهاتف والكمبيوتر'];

const MOCK_OPTIONS = [
  { letter: 'أ', text: 'جائز ومشروع بشروطه', correct: true },
  { letter: 'ب', text: 'محرّم قطعاً للغرر' },
  { letter: 'ج', text: 'مكروه كراهة تنزيه' },
  { letter: 'د', text: 'موقوف على إذن القاضي' },
];

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

/** معاينة شاشة الاختبار داخل إطار متصفح — زخرفة بصرية لا تفاعل فيها. */
function ExamMockup() {
  return (
    <div aria-hidden="true" className="relative mt-14 sm:mt-20 w-full max-w-5xl px-4 sm:px-6 select-none">
      {/* بطاقة عائمة: المؤقّت */}
      <div className="absolute -top-6 right-8 sm:right-16 z-20 flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-lp-card/95 backdrop-blur-md border border-lp-glow/40 shadow-xl animate-floatSlow">
        <span className="relative flex w-3 h-3">
          <span className="absolute inset-0 rounded-full bg-lp-glow opacity-75 animate-ping" />
          <span className="relative w-3 h-3 rounded-full bg-lp-glow" />
        </span>
        <span className="text-xs text-lp-muted">الوقت المتبقي:</span>
        <span className="text-sm font-bold tabular-nums" dir="ltr">
          24:30
        </span>
      </div>

      {/* بطاقة عائمة: إجابة صحيحة */}
      <div className="absolute bottom-16 sm:bottom-24 -left-2 sm:left-6 z-20 flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-lp-card/95 backdrop-blur-md border border-emerald-500/50 shadow-xl animate-float">
        <span className="w-6 h-6 rounded-full bg-emerald-500 text-white grid place-items-center">
          <Check className="w-4 h-4" strokeWidth={3} />
        </span>
        <span className="text-right">
          <span className="block text-xs font-bold text-emerald-300">إجابة صحيحة</span>
          <span className="block text-[10px] text-lp-muted">مع شرح الإجابة بعد التسليم</span>
        </span>
      </div>

      {/* بطاقة عائمة: النتيجة */}
      <div className="hidden md:flex absolute top-1/3 -right-4 z-20 items-center gap-3 px-4 py-3 rounded-2xl bg-lp-card/95 backdrop-blur-md border border-lp-line shadow-xl animate-floatSlow">
        <span className="w-10 h-10 rounded-full border-2 border-lp-glow grid place-items-center text-xs font-bold text-lp-primaryInk">
          87%
        </span>
        <span className="text-right">
          <span className="block text-xs font-bold">نتيجتك</span>
          <span className="block text-[10px] text-lp-muted">تقرير مفصّل لكل اختبار</span>
        </span>
      </div>

      {/* إطار الجهاز */}
      <div className="relative mx-auto rounded-2xl sm:rounded-3xl p-2 sm:p-3.5 bg-gradient-to-b from-lp-line/80 via-lp-raised/40 to-transparent border border-lp-line shadow-2xl shadow-lp-shadow/20">
        <div className="rounded-xl sm:rounded-2xl overflow-hidden bg-lp-card border border-lp-line text-right">
          {/* شريط المتصفح */}
          <div className="h-10 sm:h-12 px-4 bg-lp-raised border-b border-lp-line flex items-center justify-between gap-3">
            <div className="flex items-center gap-2" dir="ltr">
              <span className="w-3 h-3 rounded-full bg-red-400" />
              <span className="w-3 h-3 rounded-full bg-yellow-400" />
              <span className="w-3 h-3 rounded-full bg-emerald-400" />
            </div>
            <div className="hidden sm:flex items-center gap-1.5 px-6 py-1 rounded-full bg-lp-bg border border-lp-line text-[11px] text-lp-muted">
              <Lock className="w-3 h-3 text-emerald-300" />
              بنك الأسئلة — وضع الاختبار
            </div>
            <div className="text-xs text-lp-muted">
              السؤال <strong className="text-lp-ink">14</strong> من <strong className="text-lp-ink">50</strong>
            </div>
          </div>

          <div className="p-5 sm:p-8 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-lp-line">
              <span className="lp-pill !rounded-lg">التربية الإسلامية — فقه المعاملات</span>
              <span className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-lp-raised border border-lp-line">
                <Clock className="w-4 h-4 text-lp-primaryInk animate-pulse" />
                <span className="text-xs font-bold text-lp-primaryInk tabular-nums" dir="ltr">
                  24:18
                </span>
              </span>
            </div>

            <div className="w-full h-1.5 rounded-full overflow-hidden bg-lp-raised">
              <div className="h-full w-[28%] rounded-full bg-lp-glow" />
            </div>

            <div>
              <span className="block mb-1 text-xs font-bold text-lp-muted">السؤال رقم 14:</span>
              <h3 className="text-[1rem] sm:text-xl font-bold leading-relaxed">
                حكم عقد الإجارة المنتهي بالتمليك إذا توافرت فيه الشروط والضوابط الشرعية هو:
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {MOCK_OPTIONS.map((opt) =>
                opt.correct ? (
                  <div
                    key={opt.letter}
                    className="p-4 rounded-xl border border-emerald-500/50 bg-emerald-500/10 flex items-center justify-between gap-3"
                  >
                    <span className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-lg bg-emerald-500 text-white font-extrabold grid place-items-center text-sm">
                        {opt.letter}
                      </span>
                      <span className="font-semibold text-sm sm:text-[1rem] text-emerald-300">{opt.text}</span>
                    </span>
                    <Check className="w-5 h-5 text-emerald-300" strokeWidth={3} />
                  </div>
                ) : (
                  <div
                    key={opt.letter}
                    className="p-4 rounded-xl border border-lp-line bg-lp-raised/50 flex items-center gap-3"
                  >
                    <span className="w-8 h-8 rounded-lg bg-lp-raised font-bold grid place-items-center text-sm">
                      {opt.letter}
                    </span>
                    <span className="font-medium text-sm sm:text-[1rem] text-lp-muted">{opt.text}</span>
                  </div>
                )
              )}
            </div>

            <div className="p-4 rounded-xl bg-lp-raised/60 border border-lp-line text-xs sm:text-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <span className="flex items-start gap-2">
                <span className="shrink-0 px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold text-xs">
                  الشرح:
                </span>
                <span className="text-lp-muted leading-relaxed">
                  لأنه يتضمّن عقدين منفصلين لا تعارض بينهما، ويحقّق مصلحة مشروعة للطرفين.
                </span>
              </span>
              <span className="self-end sm:self-auto shrink-0 px-4 py-1.5 rounded-lg bg-lp-glow/20 text-lp-primaryInk text-xs font-bold">
                السؤال التالي ←
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
