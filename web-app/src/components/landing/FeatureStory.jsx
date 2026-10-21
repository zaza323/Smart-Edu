import { useEffect, useState } from 'react';
import { BookOpenCheck, Check, History, Lightbulb, ListChecks, Trophy } from 'lucide-react';
import { SectionHeading, usePrefersReducedMotion } from './common';

const AUTO_ADVANCE_MS = 7000;

const CHAPTERS = [
  {
    title: 'محاكاة امتحان الوزارة الحقيقي',
    short: 'محاكاة الامتحان',
    text: 'مؤقّت تنازلي، شريط تقدّم يعكس ما أنجزته، ووقت محسوب حسب عدد الأسئلة — لتتعوّد على ضغط وقت قاعة الامتحان قبل دخولها.',
    Preview: ExamPreview,
  },
  {
    title: 'تصحيح فوري ومراجعة تفصيلية',
    short: 'التصحيح والمراجعة',
    text: 'نتيجتك تظهر لحظة التسليم، مع مراجعة لكل سؤال: إجابتك، والإجابة الصحيحة، وشرحها حين يتوفّر.',
    Preview: ReviewPreview,
  },
  {
    title: 'تتبّع تطوّرك ونافس زملاءك',
    short: 'سجل المحاولات',
    text: 'سجل كامل لكل محاولاتك السابقة لتعرف أين تحسّنت وأين تحتاج مراجعة، ولوحة أبطال تنافس فيها على المراكز الأولى.',
    Preview: HistoryPreview,
  },
  {
    title: 'أسئلة موثوقة ومصنّفة حسب الدروس',
    short: 'أسئلة مصنّفة',
    text: 'بنك مبني على نماذج الوزارة وأسئلة الأجيال السابقة، مقسّم درساً درساً لتختبر نفسك في درس واحد أو في المادة كاملة.',
    Preview: LessonsPreview,
  },
];

/** أربعة محاور: الضغط على أي محور يبدّل المعاينة بجانبه، وتتقدّم تلقائياً حتى يتدخّل الزائر. */
export default function FeatureStory() {
  const [active, setActive] = useState(0);
  const [autoPlay, setAutoPlay] = useState(true);
  const [hovering, setHovering] = useState(false);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (!autoPlay || hovering || reducedMotion) return undefined;
    const id = setTimeout(() => setActive((i) => (i + 1) % CHAPTERS.length), AUTO_ADVANCE_MS);
    return () => clearTimeout(id);
  }, [active, autoPlay, hovering, reducedMotion]);

  const choose = (index) => {
    setActive(index);
    setAutoPlay(false);
  };

  const { Preview } = CHAPTERS[active];

  return (
    <section id="features" className="scroll-mt-20 relative py-24 sm:py-36 border-t border-lp-line bg-lp-alt">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="تجربة تحاكي الامتحان خطوة بخطوة"
          title="كل ما يلزمك لتجاوز امتحان التوجيهي بتفوّق"
          text="لا مزيد من الأوراق المشتّتة أو التصحيح اليدوي. عش تجربة امتحان الوزارة قبل دخول القاعة."
          className="mb-16 sm:mb-24"
        />

        <div
          className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-start"
          onMouseEnter={() => setHovering(true)}
          onMouseLeave={() => setHovering(false)}
        >
          <div className="space-y-4">
            {CHAPTERS.map((chapter, i) => {
              const selected = i === active;
              return (
                <button
                  key={chapter.title}
                  type="button"
                  onClick={() => choose(i)}
                  aria-pressed={selected}
                  className={`lp-focus group relative w-full text-right p-6 sm:p-8 rounded-2xl border transition-all duration-300 ${
                    selected
                      ? 'border-lp-glow/60 bg-lp-glow/[0.08] shadow-sm'
                      : 'border-lp-line hover:border-lp-glow/40 bg-lp-bg/40'
                  }`}
                >
                  {selected && (
                    <span className="absolute -right-1.5 top-8 w-3 h-10 rounded-full bg-lp-glow" />
                  )}
                  <span className="flex items-center gap-3 mb-2">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-bold tabular-nums ${
                        selected ? 'lp-pill !py-0.5' : 'bg-lp-raised text-lp-muted'
                      }`}
                    >
                      0{i + 1}
                    </span>
                    <span className="text-xl sm:text-2xl font-bold group-hover:text-lp-primaryInk transition-colors">
                      {chapter.title}
                    </span>
                  </span>
                  <span className="block text-sm sm:text-[1rem] text-lp-muted leading-relaxed">{chapter.text}</span>
                </button>
              );
            })}
          </div>

          <div className="relative lg:sticky lg:top-28">
            <div className="rounded-3xl p-4 bg-gradient-to-tr from-lp-glow/15 via-lp-raised/30 to-transparent border border-lp-line shadow-2xl shadow-lp-shadow/10">
              <div className="rounded-2xl bg-lp-card border border-lp-line p-6 sm:p-8 min-h-[380px] flex flex-col justify-between">
                <div key={active} className="animate-fadeIn" aria-live="polite">
                  <Preview />
                </div>
                <div className="pt-6 mt-6 border-t border-lp-line flex items-center justify-between text-xs text-lp-muted">
                  <span>
                    المحور {active + 1} من {CHAPTERS.length}: {CHAPTERS[active].short}
                  </span>
                  <span className="flex gap-1.5" aria-hidden="true">
                    {CHAPTERS.map((c, i) => (
                      <span
                        key={c.title}
                        className={`h-1.5 rounded-full transition-all ${
                          i === active ? 'w-5 bg-lp-glow' : 'w-1.5 bg-lp-line'
                        }`}
                      />
                    ))}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- معاينات المحاور (أمثلة توضيحية للواجهة) ---------- */

const PREVIEW_OPTIONS = ['15 هـ', '18 هـ', '21 هـ', '25 هـ'];

function ExamPreview() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-lp-line">
        <span className="text-xs text-lp-muted">اختبار تجريبي: التربية الإسلامية</span>
        <span className="lp-pill !rounded-md tabular-nums animate-pulse" dir="ltr">
          29:50
        </span>
      </div>
      <div className="w-full h-2 rounded-full overflow-hidden bg-lp-raised">
        <div className="h-full w-[45%] rounded-full bg-lp-glow" />
      </div>
      <div className="p-4 rounded-xl bg-lp-raised/60 border border-lp-line">
        <span className="text-xs font-bold text-lp-primaryInk">السؤال 23:</span>
        <p className="mt-1 text-sm font-semibold leading-relaxed">
          توفّي الصحابي الجليل أبو عبيدة عامر بن الجرّاح رضي الله عنه في طاعون عمواس سنة:
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        {PREVIEW_OPTIONS.map((opt, i) => (
          <div key={opt} className="p-2.5 rounded-lg bg-lp-raised/60 border border-lp-line text-lp-muted">
            {'أبجد'[i]}) {opt}
          </div>
        ))}
      </div>
    </div>
  );
}

function ReviewPreview() {
  return (
    <div className="space-y-4">
      <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/40">
        <span className="flex items-center gap-1.5 mb-1 text-xs font-bold text-emerald-300">
          <Check className="w-4 h-4" strokeWidth={3} />
          إجابتك صحيحة
        </span>
        <p className="text-sm font-bold">الخيار (ب): سنة 18 للهجرة</p>
      </div>
      <div className="p-4 rounded-xl bg-lp-raised/60 border border-lp-line space-y-2">
        <span className="flex items-center gap-1.5 text-xs font-bold text-lp-primaryInk">
          <Lightbulb className="w-4 h-4" />
          الشرح:
        </span>
        <p className="text-xs text-lp-muted leading-relaxed">
          توفّي أمين هذه الأمة في غور الأردن إثر طاعون عمواس سنة 18 هـ، في خلافة عمر بن الخطاب رضي الله عنه.
        </p>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          ['صحيحة', '42', 'text-emerald-300'],
          ['خاطئة', '6', 'text-red-300'],
          ['لم تُجب', '2', 'text-lp-muted'],
        ].map(([label, value, tone]) => (
          <div key={label} className="p-2.5 rounded-lg bg-lp-raised/60 border border-lp-line">
            <span className={`block text-lg font-black ${tone}`}>{value}</span>
            <span className="text-[11px] text-lp-muted">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const PREVIEW_ATTEMPTS = [
  ['الدرس 3: فقه المعاملات', 92, 'bg-emerald-400'],
  ['الدرس 2: السيرة النبوية', 78, 'bg-yellow-400'],
  ['الدرس 1: علوم القرآن', 61, 'bg-orange-400'],
];

function HistoryPreview() {
  return (
    <div className="space-y-4">
      <span className="flex items-center gap-2 text-sm font-bold">
        <History className="w-4 h-4 text-lp-primaryInk" />
        محاولاتك السابقة
      </span>
      <div className="space-y-3 text-xs">
        {PREVIEW_ATTEMPTS.map(([label, pct, bar]) => (
          <div key={label}>
            <div className="flex justify-between mb-1 text-lp-muted">
              <span>{label}</span>
              <span className="font-bold text-lp-ink">{pct}%</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-lp-raised">
              <div className={`h-1.5 rounded-full ${bar}`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        ))}
      </div>
      <div className="p-3 rounded-xl lp-pill !flex !rounded-xl !text-sm">
        <Trophy className="w-4 h-4 shrink-0" />
        ترتيبك على لوحة الأبطال يتحدّث مع كل اختبار
      </div>
    </div>
  );
}

function LessonsPreview() {
  return (
    <div className="space-y-3">
      {[
        [BookOpenCheck, 'نماذج الوزارة وأسئلة الأجيال السابقة', 'مصدر', 'bg-emerald-500/15 text-emerald-300'],
        [ListChecks, 'مقسّمة حسب دروس الكتاب المدرسي', 'مصنّف', 'bg-lp-glow/20 text-lp-primaryInk'],
        [History, 'اختر درساً واحداً أو اختبر المادة كاملة', 'مرن', 'bg-sky-500/15 text-sky-300'],
      ].map(([Icon, text, tag, tone]) => (
        <div key={text} className="flex items-center gap-3 p-3 rounded-xl bg-lp-raised/60 border border-lp-line">
          <Icon className="w-4 h-4 shrink-0 text-lp-muted" />
          <span className="flex-1 text-xs sm:text-sm font-bold">{text}</span>
          <span className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-bold ${tone}`}>{tag}</span>
        </div>
      ))}
    </div>
  );
}
