import { forwardRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, BookOpen, Layers, Lightbulb, ListChecks, SlidersHorizontal, Timer, Zap } from 'lucide-react';
import { Alert, Spinner } from '../ui';
import { arCount } from '../landing/common';
import { subjectUnits, unitQuestionCount } from '../../lib/units';
import { Toggle } from './widgets';

export const COUNT_OPTIONS = [10, 15, 20, 25];
export const MODE_PRESETS = { full: 25, quick: 10 };
// مطابق لـ MIN_QUESTIONS_PER_EXAM في Cloud Functions
const MIN_QUESTIONS = 5;
// مطابق لـ MAX_LESSONS_PER_EXAM — حدّ استعلام `in` في Firestore
const MAX_LESSONS = 30;

/**
 * الإعداد الافتراضي لمادة.
 * النطاق لا يُحدَّد تلقائياً على «كل الدروس» بصمت: الطالب يختاره صراحةً،
 * فلا يفاجأ بأسئلة من دروس لم يقصدها.
 */
export function defaultSetup(subject, preset = {}) {
  const mode = preset.mode || 'full';
  const lessons = preset.lessons || [];
  return {
    subjectId: subject?.id || '',
    mode,
    count: MODE_PRESETS[mode] ?? 15,
    scope: lessons.length > 0 || preset.focusLessons ? 'lessons' : '',
    lessons,
    timed: true,
    instant: false,
  };
}

/** القيم المشتقّة من المادة + الإعداد — يتشاركها اللوح المدمج ولوح الهاتف. */
export function deriveScope(subject, setup) {
  const lessons = (subject?.lessons || []).slice().sort((a, b) => Number(a.number) - Number(b.number));
  const units = subjectUnits(subject);
  const hasLessons = lessons.length > 0;
  const scope = hasLessons ? setup.scope : 'all';
  const chosen = setup.lessons || [];

  const allQuestions =
    Number(subject?.questionCount) || lessons.reduce((sum, l) => sum + (Number(l.count) || 0), 0);
  const available =
    scope === 'all'
      ? allQuestions
      : lessons.filter((l) => chosen.includes(l.number)).reduce((sum, l) => sum + (Number(l.count) || 0), 0);

  const everyLesson = hasLessons && lessons.every((l) => chosen.includes(l.number));
  const tooManyLessons = scope !== 'all' && !everyLesson && chosen.length > MAX_LESSONS;
  const effectiveCount = Math.min(setup.count, available);
  const minutesPerQuestion = subject?.minutesPerQuestion || 0.4;
  const minutes = Math.max(1, Math.round(effectiveCount * minutesPerQuestion));

  let blocker = '';
  if (!scope) blocker = 'اختر نطاق الأسئلة أولاً';
  else if (scope !== 'all' && chosen.length === 0) blocker = 'اختر درساً واحداً على الأقل';
  else if (tooManyLessons) blocker = `الحد الأقصى ${MAX_LESSONS} درساً في الجلسة الواحدة`;
  else if (effectiveCount < MIN_QUESTIONS) blocker = `لا تكفي الأسئلة (الحد الأدنى ${MIN_QUESTIONS})`;

  let scopeText = 'كل الدروس';
  if (scope !== 'all' && !everyLesson) {
    scopeText = `تغطية ${arCount(chosen.length, { one: 'درس واحد', two: 'درسين', few: 'دروس', many: 'درساً' })}`;
  }

  return {
    lessons,
    units,
    hasLessons,
    scope,
    available,
    effectiveCount,
    minutes,
    minutesPerQuestion,
    everyLesson,
    canStart: !blocker,
    blocker,
    scopeText,
  };
}

function ScopeButton({ active, icon: Icon, label, hint, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex flex-col items-center gap-1 px-3 py-3 rounded-xl border text-center transition ${
        active
          ? 'bg-brand/15 border-brand/50 text-brandInk'
          : 'bg-base/60 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-100'
      }`}
    >
      <Icon className="w-5 h-5 shrink-0" />
      <span className="text-sm font-semibold leading-tight">{label}</span>
      {hint && <span className="text-[11px] text-zinc-500 leading-tight">{hint}</span>}
    </button>
  );
}

/** اختيار نطاق الأسئلة: الفصل كامل ← وحدة كاملة ← دروس محدّدة. */
function ScopePicker({ setup, onChange, derived }) {
  const { lessons, units, scope, available, everyLesson } = derived;
  const chosen = setup.lessons || [];
  const set = (patch) => onChange({ ...setup, ...patch });

  const unitSelected = (unit) => unit.lessons.every((l) => chosen.includes(l.number));
  const toggleUnit = (unit) => {
    const numbers = unit.lessons.map((l) => l.number);
    set({
      lessons: unitSelected(unit)
        ? chosen.filter((n) => !numbers.includes(n))
        : [...new Set([...chosen, ...numbers])],
    });
  };
  const toggleLesson = (n) =>
    set({ lessons: chosen.includes(n) ? chosen.filter((x) => x !== n) : [...chosen, n] });

  return (
    <div>
      <span className="label">نطاق الأسئلة</span>
      <div className={`grid gap-2 ${units.length > 0 ? 'grid-cols-3' : 'grid-cols-2'}`}>
        <ScopeButton
          active={scope === 'all'}
          icon={BookOpen}
          label="الفصل كامل"
          hint={`${available && scope === 'all' ? available : ''}`.trim() || undefined}
          onClick={() => set({ scope: 'all', lessons: [] })}
        />
        {units.length > 0 && (
          <ScopeButton
            active={scope === 'unit'}
            icon={Layers}
            label="وحدة كاملة"
            hint={`${units.length} وحدات`}
            onClick={() => set({ scope: 'unit' })}
          />
        )}
        <ScopeButton
          active={scope === 'lessons'}
          icon={ListChecks}
          label="دروس محدّدة"
          hint={`${lessons.length} درساً`}
          onClick={() => set({ scope: 'lessons' })}
        />
      </div>

      {scope === 'all' && (
        <p className="mt-3 text-xs text-zinc-500">
          الأسئلة تُسحب عشوائياً من كل دروس المادة ({available} سؤالاً متاحاً).
        </p>
      )}

      {scope === 'unit' && (
        <div className="mt-3 flex flex-col gap-2">
          <p className="text-xs text-zinc-500">اختر وحدة أو أكثر — تُحدَّد كل دروسها دفعة واحدة.</p>
          <div className="grid grid-cols-2 gap-2">
            {units.map((unit) => {
              const on = unitSelected(unit);
              return (
                <button
                  key={unit.id}
                  type="button"
                  onClick={() => toggleUnit(unit)}
                  aria-pressed={on}
                  className={`px-3 py-2.5 rounded-xl border text-right transition ${
                    on ? 'bg-brand/15 border-brand/50 text-brandInk' : 'bg-base/60 border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <span className="block text-sm font-semibold truncate">{unit.title}</span>
                  <span className="block text-[11px] text-zinc-500">
                    {unit.lessons.length} دروس · {unitQuestionCount(unit)} سؤالاً
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {scope === 'lessons' && (
        <div className="mt-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-zinc-500">
              {chosen.length ? `مختار ${chosen.length} من ${lessons.length}` : 'لم تختر أي درس بعد'}
            </span>
            <button
              type="button"
              onClick={() => set({ lessons: everyLesson ? [] : lessons.map((l) => l.number) })}
              className="text-xs text-brandInk hover:underline"
            >
              {everyLesson ? 'إلغاء الكل' : 'تحديد الكل'}
            </button>
          </div>
          <div className="flex flex-col gap-2 max-h-64 overflow-y-auto overscroll-contain">
            {lessons.map((l) => {
              const on = chosen.includes(l.number);
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
      )}
    </div>
  );
}

/** عدد الأسئلة + المؤقّت + الشرح الفوري. */
function SessionOptions({ setup, onChange, derived }) {
  const set = (patch) => onChange({ ...setup, ...patch });
  const { available, minutesPerQuestion, scope } = derived;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <span className="label">عدد الأسئلة</span>
        <div className="grid grid-cols-4 gap-2">
          {COUNT_OPTIONS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() =>
                set({
                  count: n,
                  mode: MODE_PRESETS.full === n ? 'full' : MODE_PRESETS.quick === n ? 'quick' : 'custom',
                })
              }
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
        {scope && available > 0 && available < setup.count && available >= MIN_QUESTIONS && (
          <p className="text-xs text-zinc-500 mt-2">
            المتاح في النطاق المختار {available} سؤالاً — سيُنشأ الاختبار بهذا العدد.
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
  );
}

/** حقول الجلسة كاملة — تُستخدم داخل اللوح المدمج وداخل لوح الهاتف. */
export function ExamSetupFields({ subjects, subject, setup, onChange, derived, error, resumeId }) {
  return (
    <div className="flex flex-col gap-6">
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
        <div className="lg:col-span-7">
          {derived.hasLessons ? (
            <ScopePicker setup={setup} onChange={onChange} derived={derived} />
          ) : (
            <p className="text-sm text-zinc-500">
              أسئلة هذه المادة غير مقسّمة على دروس — يشمل الاختبار المادة كاملة.
            </p>
          )}
        </div>
        <div className="lg:col-span-5">
          <SessionOptions setup={setup} onChange={onChange} derived={derived} />
        </div>
      </div>

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
    </div>
  );
}

/** ملخّص الجلسة + زر البدء — يصلح أسفل اللوح أو مثبّتاً في تذييل لوح الهاتف. */
export function ExamStartBar({ setup, derived, onStart, busy }) {
  const { canStart, blocker, effectiveCount, minutes, scopeText } = derived;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
      <p className="flex items-center gap-1.5 text-sm text-zinc-400 text-center sm:text-right">
        <Zap className="w-4 h-4 shrink-0 text-accent" />
        {canStart ? (
          <span>
            {effectiveCount} سؤالاً ·{' '}
            {setup.timed
              ? `مؤقّت ${arCount(minutes, { one: 'دقيقة واحدة', two: 'دقيقتان', few: 'دقائق', many: 'دقيقة' })}`
              : 'بلا مؤقّت'}{' '}
            · {scopeText}
            {setup.instant && ' · شرح فوري'}
          </span>
        ) : (
          <span>{blocker}</span>
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
  );
}

/**
 * لوح «تخصيص جلسة الاختبار» المدمج في الصفحة (الشاشات المتوسطة فأعلى).
 * الحالة كلها في الأب (SubjectsPage) حتى تفتحها أزرار بطاقات المواد بإعداد مسبق.
 */
const ExamCustomizer = forwardRef(function ExamCustomizer(
  { subjects, setup, onChange, onStart, busy, error, resumeId, highlight },
  ref
) {
  const subject = subjects.find((s) => s.id === setup.subjectId) || subjects[0];
  const derived = deriveScope(subject, setup);

  return (
    <section ref={ref} id="customizer" className="scroll-mt-24">
      <h2 className="flex items-center gap-2 text-lg font-bold mb-3">
        <span className="w-3 h-3 rounded-full bg-brand" />
        تخصيص جلسة الاختبار
      </h2>

      <div
        className={`card p-5 sm:p-7 flex flex-col gap-6 transition-shadow duration-500 ${
          highlight ? 'ring-4 ring-accent/50' : ''
        }`}
      >
        <div className="flex items-center gap-3 min-w-0 pb-5 border-b border-zinc-800">
          <div className="w-10 h-10 shrink-0 rounded-xl grid place-items-center bg-brand/20 border border-brand/30 text-brandInk">
            <SlidersHorizontal className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-lg truncate">{subject?.name} — جلسة جديدة</h3>
        </div>

        <ExamSetupFields
          subjects={subjects}
          subject={subject}
          setup={setup}
          onChange={onChange}
          derived={derived}
          error={error}
          resumeId={resumeId}
        />

        <ExamStartBar setup={setup} derived={derived} onStart={onStart} busy={busy} />
      </div>
    </section>
  );
});

export default ExamCustomizer;
