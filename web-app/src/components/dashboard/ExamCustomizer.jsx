import { forwardRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Lightbulb, SlidersHorizontal, Timer, Zap } from 'lucide-react';
import { Alert, Spinner } from '../ui';
import { arCount } from '../landing/common';
import { Toggle } from './widgets';

export const COUNT_OPTIONS = [10, 15, 20, 25];
export const MODE_PRESETS = { full: 25, quick: 10 };
// مطابق لـ MIN_QUESTIONS_PER_EXAM في Cloud Functions
const MIN_QUESTIONS = 5;

const MODES = [
  { key: 'full', label: `امتحان كامل (${MODE_PRESETS.full})` },
  { key: 'quick', label: `سريع (${MODE_PRESETS.quick})` },
  { key: 'custom', label: 'مخصّص' },
];

/** الإعداد الافتراضي لمادة: امتحان كامل على كل الدروس بمؤقّت ودون شرح فوري. */
export function defaultSetup(subject, preset = {}) {
  const allLessons = (subject?.lessons || []).map((l) => l.number);
  const mode = preset.mode || 'full';
  return {
    subjectId: subject?.id || '',
    mode,
    count: MODE_PRESETS[mode] ?? 15,
    lessons: preset.lessons || allLessons,
    timed: true,
    instant: false,
  };
}

/**
 * لوحة «تخصيص جلسة الاختبار»: المادة، النمط، العدد، الدروس، المؤقّت والشرح الفوري.
 * الحالة كلها في الأب (SubjectsPage) حتى تفتحها أزرار بطاقات المواد بإعداد مسبق.
 */
const ExamCustomizer = forwardRef(function ExamCustomizer(
  { subjects, setup, onChange, onStart, busy, error, resumeId, highlight },
  ref
) {
  const subject = subjects.find((s) => s.id === setup.subjectId) || subjects[0];
  const lessons = (subject?.lessons || []).slice().sort((a, b) => a.number - b.number);
  const hasLessons = lessons.length > 0;
  const allSelected = hasLessons && lessons.every((l) => setup.lessons.includes(l.number));

  // المتاح في النطاق المختار — الخادم يعطي العدد المتاح إن كان أقل من المطلوب
  const available = hasLessons
    ? lessons.filter((l) => setup.lessons.includes(l.number)).reduce((sum, l) => sum + (l.count || 0), 0)
    : Number(subject?.questionCount) || 0;
  const effectiveCount = Math.min(setup.count, available);
  const minutesPerQuestion = subject?.minutesPerQuestion || 0.4;
  const minutes = Math.max(1, Math.round(effectiveCount * minutesPerQuestion));
  const canStart = effectiveCount >= MIN_QUESTIONS && (!hasLessons || setup.lessons.length > 0);

  const set = (patch) => onChange({ ...setup, ...patch });
  const pickMode = (mode) =>
    set(
      mode === 'custom'
        ? { mode }
        : { mode, count: MODE_PRESETS[mode], lessons: lessons.map((l) => l.number) }
    );
  const toggleLesson = (n) =>
    set({
      mode: 'custom',
      lessons: setup.lessons.includes(n) ? setup.lessons.filter((x) => x !== n) : [...setup.lessons, n],
    });

  const selectedCount = setup.lessons.length;
  const scopeText = !hasLessons || allSelected
    ? 'كل الدروس'
    : `تغطية ${arCount(selectedCount, { one: 'درس واحد', two: 'درسين', few: 'دروس', many: 'درساً' })}`;

  return (
    <section ref={ref} id="customizer" className="scroll-mt-24">
      <div className="flex items-center justify-between mb-3">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <span className="w-3 h-3 rounded-full bg-brand" />
          تخصيص جلسة الاختبار
        </h2>
        <span className="text-xs text-zinc-500">إعدادات سريعة قبل البدء</span>
      </div>

      <div
        className={`card p-5 sm:p-7 flex flex-col gap-6 transition-shadow duration-500 ${
          highlight ? 'ring-4 ring-accent/50' : ''
        }`}
      >
        {/* الرأس: المادة + النمط */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-zinc-800">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 shrink-0 rounded-xl grid place-items-center bg-brand/20 border border-brand/30 text-brandInk">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-lg">{subject?.name} — جلسة جديدة</h3>
              <p className="text-sm text-zinc-500">حدّد النمط والدروس وزمن التحدّي</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center p-1 rounded-full bg-base border border-zinc-800 text-sm self-start lg:self-auto">
            {MODES.map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => pickMode(m.key)}
                aria-pressed={setup.mode === m.key}
                className={`px-3.5 py-1.5 rounded-full transition ${
                  setup.mode === m.key ? 'bg-brandFill text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-100'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {subjects.length > 1 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-zinc-400">المادة:</span>
            {subjects.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => onChange(defaultSetup(s, { mode: setup.mode === 'quick' ? 'quick' : 'full' }))}
                aria-pressed={s.id === subject?.id}
                className={`px-3 py-1.5 rounded-full text-sm border transition ${
                  s.id === subject?.id
                    ? 'bg-brand/15 border-brand/40 text-brandInk font-semibold'
                    : 'border-zinc-700 text-zinc-400 hover:text-zinc-100'
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* العدد + المؤقّت + الشرح */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            <div>
              <span className="label">عدد الأسئلة</span>
              <div className="grid grid-cols-4 gap-2">
                {COUNT_OPTIONS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => set({ count: n, mode: MODE_PRESETS.full === n ? 'full' : MODE_PRESETS.quick === n ? 'quick' : 'custom' })}
                    aria-pressed={setup.count === n}
                    className={`py-2.5 rounded-xl font-bold border transition ${
                      setup.count === n
                        ? 'bg-brandFill text-white border-brandFill shadow-md'
                        : 'bg-zinc-800/80 border-zinc-700/60 hover:bg-zinc-700'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              {available < setup.count && available >= MIN_QUESTIONS && (
                <p className="text-xs text-zinc-500 mt-2">
                  المتاح في الدروس المختارة {available} سؤالاً — سيُنشأ الاختبار بهذا العدد.
                </p>
              )}
            </div>

            <div className="rounded-xl bg-base/60 border border-zinc-800 p-3.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Timer className="w-5 h-5 shrink-0 text-brandInk" />
                <div>
                  <div className="font-semibold text-sm">مؤقّت الامتحان الوزاري</div>
                  <div className="text-xs text-zinc-500">
                    {setup.timed
                      ? `${Math.round(minutesPerQuestion * 20 * 10) / 10} دقائق لكل 20 سؤالاً`
                      : 'بلا مؤقّت — خذ وقتك'}
                  </div>
                </div>
              </div>
              <Toggle checked={setup.timed} onChange={(v) => set({ timed: v })} label="مؤقّت الامتحان" />
            </div>

            <div className="rounded-xl bg-base/60 border border-zinc-800 p-3.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Lightbulb className="w-5 h-5 shrink-0 text-accent" />
                <div>
                  <div className="font-semibold text-sm">شرح فوري بعد كل إجابة</div>
                  <div className="text-xs text-zinc-500">تُثبَّت إجابتك ويظهر التصحيح مباشرة</div>
                </div>
              </div>
              <Toggle checked={setup.instant} onChange={(v) => set({ instant: v })} label="الشرح الفوري" />
            </div>
          </div>

          {/* الدروس */}
          <div className="lg:col-span-7 flex flex-col justify-between gap-5">
            {hasLessons ? (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="label !mb-0">الدروس المشمولة</span>
                  <button
                    type="button"
                    onClick={() => set({ mode: 'custom', lessons: allSelected ? [] : lessons.map((l) => l.number) })}
                    className="text-xs text-brandInk hover:underline"
                  >
                    {allSelected ? 'إلغاء الكل' : 'تحديد الكل'}
                  </button>
                </div>
                <div className="flex flex-col gap-2 max-h-72 overflow-y-auto">
                  {lessons.map((l) => {
                    const on = setup.lessons.includes(l.number);
                    return (
                      <label
                        key={l.number}
                        className={`flex items-center justify-between gap-3 p-3 rounded-xl bg-base/60 border cursor-pointer transition ${
                          on ? 'border-brand/40' : 'border-zinc-800 hover:border-zinc-700'
                        }`}
                      >
                        <span className="flex items-center gap-3 min-w-0">
                          <input
                            type="checkbox"
                            checked={on}
                            onChange={() => toggleLesson(l.number)}
                            className="w-4 h-4 shrink-0 accent-[rgb(var(--c-brand-fill))]"
                          />
                          <span className="text-sm font-medium truncate">
                            الدرس {l.number}
                            {l.title ? `: ${l.title}` : ''}
                          </span>
                        </span>
                        <span className="shrink-0 text-xs text-zinc-400 px-2 py-0.5 rounded-full bg-zinc-800 border border-zinc-700/60">
                          {arCount(l.count || 0, { one: 'سؤال واحد', two: 'سؤالان', few: 'أسئلة', many: 'سؤالاً' })}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ) : (
              <p className="text-sm text-zinc-500">أسئلة هذه المادة غير مقسّمة على دروس — يشمل الاختبار المادة كاملة.</p>
            )}

            {error && (
              <Alert type="error">
                {error}
                {resumeId && (
                  <div className="mt-3">
                    <Link to={`/exam/${resumeId}`} className="btn-primary btn-sm">
                      متابعة الاختبار الجاري
                    </Link>
                  </div>
                )}
              </Alert>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <p className="flex items-center gap-1.5 text-sm text-zinc-400">
                <Zap className="w-4 h-4 shrink-0 text-accent" />
                {canStart ? (
                  <span>
                    {effectiveCount} سؤالاً · {setup.timed
                      ? `مؤقّت ${arCount(minutes, { one: 'دقيقة واحدة', two: 'دقيقتان', few: 'دقائق', many: 'دقيقة' })}`
                      : 'بلا مؤقّت'} · {scopeText}
                    {setup.instant && ' · شرح فوري'}
                  </span>
                ) : (
                  <span>{hasLessons && !selectedCount ? 'اختر درساً واحداً على الأقل' : `لا تكفي الأسئلة (الحد الأدنى ${MIN_QUESTIONS})`}</span>
                )}
              </p>
              <button
                type="button"
                onClick={() => onStart(effectiveCount)}
                disabled={!canStart || busy}
                className="btn-primary w-full sm:w-auto px-8 py-3 text-lg"
              >
                {busy ? <Spinner className="w-5 h-5 on-accent" /> : null}
                ابدأ الامتحان الآن
                <ArrowLeft className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
});

export default ExamCustomizer;
