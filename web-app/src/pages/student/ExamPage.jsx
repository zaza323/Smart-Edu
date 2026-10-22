import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flag,
  Grid3x3,
  Lightbulb,
  Pause,
  Play,
  Send,
  X,
} from 'lucide-react';
import { callFn } from '../../lib/firebase';
import {
  clearExamSession,
  loadExamSession,
  pruneExamSessions,
  saveExamSession,
} from '../../lib/examSession';
import { Alert, FullPageLoader, Spinner, formatDuration } from '../../components/ui';
import ExamTimerRing, { ExamStreakBadge } from '../../components/ExamTimerRing';
import ThemeToggle from '../../components/ThemeToggle';

const ARABIC_LETTERS = ['أ', 'ب', 'ج', 'د'];

// مطابقة لثوابت Cloud Functions — الخادم هو من يفرضها فعلياً عند التسليم
const MAX_PAUSES = 2;
const MAX_PAUSE_SECONDS = 5 * 60;

export default function ExamPage() {
  const { attemptId } = useParams();
  const navigate = useNavigate();

  const [state, setState] = useState(null); // { questions, subject, timed, instantFeedback, ... }
  const [answers, setAnswers] = useState({}); // { [questionId]: index }
  // وضع «الشرح الفوري»: نتيجة كل سؤال كُشف تصحيحه { [questionId]: { selectedIndex, correctAnswerIndex, isCorrect, explanation } }
  const [checked, setChecked] = useState({});
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState('');
  const [flagged, setFlagged] = useState([]);
  const [current, setCurrent] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [elapsed, setElapsed] = useState(0); // للاختبار بلا مؤقّت
  const [loadError, setLoadError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);

  // ---- الإيقاف المؤقّت ----
  // الحدود معروضة هنا للواجهة فقط؛ الخادم يقصّ القيم عند التسليم فلا يفيد التلاعب.
  const [paused, setPaused] = useState(false);
  const [pauseCount, setPauseCount] = useState(0);
  const [pausedSeconds, setPausedSeconds] = useState(0);
  const pauseStartedRef = useRef(0);

  const deadlineRef = useRef(0);
  const submittedRef = useRef(false);
  const answersRef = useRef(answers);
  answersRef.current = answers;

  // مرجع حيّ لبيانات الإيقاف — `submit` دالة مثبّتة بـ useCallback فلا ترى الحالة
  const pausedRef = useRef({ seconds: 0, count: 0 });
  pausedRef.current = { seconds: pausedSeconds, count: pauseCount };

  // ---------------- تحميل الاختبار ----------------
  useEffect(() => {
    let cancelled = false;
    pruneExamSessions();

    (async () => {
      const cached = loadExamSession(attemptId);
      if (cached?.questions?.length) {
        if (cancelled) return;
        setState(cached);
        setAnswers(cached.answers || {});
        setChecked(cached.checked || {});
        setFlagged(cached.flagged || []);
        setCurrent(Math.min(cached.current || 0, cached.questions.length - 1));
        setPauseCount(cached.pauseCount || 0);
        setPausedSeconds(cached.pausedSeconds || 0);
        // المدة المتبقية تُحسب من لحظة البدء المخزّنة محلياً، ثم يصححها الخادم عند التسليم
        const elapsed = Math.floor((Date.now() - (cached.startedAtLocal || cached.savedAt)) / 1000);
        // فترات الإيقاف السابقة تُعاد للطالب، وإلا خسر رصيده عند إعادة تحميل الصفحة
        const left = Math.max(
          0,
          (cached.durationSeconds || 0) - elapsed + (cached.pausedSeconds || 0)
        );
        deadlineRef.current = Date.now() + left * 1000;
        setRemaining(left);
        return;
      }

      // لا توجد نسخة محلية (جهاز آخر / مسح المتصفح) → استئناف من الخادم
      try {
        const res = await callFn('resumeExam', { attemptId });
        if (cancelled) return;
        const checkedFromServer = res.checked || {};
        const fresh = {
          questions: res.questions,
          durationSeconds: res.durationSeconds,
          timed: res.timed !== false,
          instantFeedback: Boolean(res.instantFeedback),
          subjectId: res.subjectId,
          subject: res.subject,
          lessonLabel: res.lessonLabel,
          startedAtLocal: Date.now() - (res.elapsedSeconds ?? res.durationSeconds - res.remainingSeconds) * 1000,
          // الإجابات المثبّتة بالشرح الفوري محفوظة بالخادم، فتعود حتى من جهاز آخر
          answers: Object.fromEntries(
            Object.entries(checkedFromServer).map(([qid, c]) => [qid, c.selectedIndex])
          ),
          checked: checkedFromServer,
          flagged: [],
        };
        setState(fresh);
        setAnswers(fresh.answers);
        setChecked(checkedFromServer);
        deadlineRef.current = Date.now() + res.remainingSeconds * 1000;
        setRemaining(res.remainingSeconds);
        saveExamSession(attemptId, fresh);
      } catch (err) {
        if (!cancelled) setLoadError(err.message);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [attemptId]);

  // ---------------- الحفظ التدريجي محلياً ----------------
  useEffect(() => {
    if (!state) return;
    saveExamSession(attemptId, {
      ...state,
      startedAtLocal: state.startedAtLocal || Date.now(),
      answers,
      checked,
      flagged,
      current, // ليعود الطالب لنفس السؤال، وتعرض اللوحة «كمّل من حيث وقفت»
      pauseCount,
      pausedSeconds,
    });
  }, [answers, checked, flagged, current, state, attemptId, pauseCount, pausedSeconds]);

  // ---------------- التسليم ----------------
  const submit = useCallback(
    async (auto = false) => {
      if (submittedRef.current) return;
      submittedRef.current = true;
      setSubmitting(true);
      setSubmitError('');
      try {
        const payload = Object.entries(answersRef.current).map(([questionId, selectedIndex]) => ({
          questionId,
          selectedIndex,
        }));
        await callFn('submitExam', {
          attemptId,
          answers: payload,
          autoSubmitted: auto,
          pausedSeconds: pausedRef.current.seconds,
          pauseCount: pausedRef.current.count,
        });
        clearExamSession(attemptId);
        navigate(`/app/result/${attemptId}`, { replace: true });
      } catch (err) {
        if (err.code === 'functions/failed-precondition') {
          clearExamSession(attemptId);
          navigate(`/app/result/${attemptId}`, { replace: true });
          return;
        }
        submittedRef.current = false;
        setSubmitError(`${err.message} — إجاباتك محفوظة، حاول التسليم مرة أخرى.`);
        setSubmitting(false);
      }
    },
    [attemptId, navigate]
  );

  const timed = state?.timed !== false;

  // ---------------- الوقت المنقضي (اختبار بلا مؤقّت) ----------------
  useEffect(() => {
    if (!state || timed) return undefined;
    const tick = () =>
      setElapsed(Math.max(0, Math.round((Date.now() - (state.startedAtLocal || Date.now())) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [state, timed]);

  // ---------------- المؤقّت التنازلي ----------------
  useEffect(() => {
    if (!state || !timed || paused) return undefined; // أثناء الإيقاف لا يتحرّك العدّاد
    const tick = () => {
      const left = Math.max(0, Math.round((deadlineRef.current - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) submit(true);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [state, timed, submit, paused]);

  // ---------------- الإيقاف المؤقّت ----------------
  const pauseLimitReached = pauseCount >= MAX_PAUSES || pausedSeconds >= MAX_PAUSE_SECONDS;

  function togglePause() {
    if (paused) {
      // استئناف: نمدّد الموعد النهائي بمقدار فترة التوقّف الفعلية
      const elapsed = Math.round((Date.now() - pauseStartedRef.current) / 1000);
      const allowed = Math.max(0, Math.min(elapsed, MAX_PAUSE_SECONDS - pausedSeconds));
      deadlineRef.current += allowed * 1000;
      setPausedSeconds((s) => s + allowed);
      setPaused(false);
      return;
    }
    if (pauseLimitReached) return;
    pauseStartedRef.current = Date.now();
    setPauseCount((c) => c + 1);
    setPaused(true);
  }

  // استئناف قسري عند بلوغ سقف المدة أثناء التوقّف
  useEffect(() => {
    if (!paused) return undefined;
    const id = setInterval(() => {
      const elapsed = Math.round((Date.now() - pauseStartedRef.current) / 1000);
      if (pausedSeconds + elapsed >= MAX_PAUSE_SECONDS) {
        const allowed = Math.max(0, MAX_PAUSE_SECONDS - pausedSeconds);
        deadlineRef.current += allowed * 1000;
        setPausedSeconds(MAX_PAUSE_SECONDS);
        setPaused(false);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [paused, pausedSeconds]);

  // ---------------- طبقة الحماية السطحية (قسم 5.6) ----------------
  useEffect(() => {
    const blockContext = (e) => e.preventDefault();
    const blockKeys = (e) => {
      const k = (e.key || '').toLowerCase();
      if (e.key === 'F12') e.preventDefault();
      if ((e.ctrlKey || e.metaKey) && ['c', 'p', 's', 'u'].includes(k)) e.preventDefault();
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && ['i', 'j', 'c'].includes(k)) e.preventDefault();
    };
    document.addEventListener('contextmenu', blockContext);
    document.addEventListener('keydown', blockKeys);
    return () => {
      document.removeEventListener('contextmenu', blockContext);
      document.removeEventListener('keydown', blockKeys);
    };
  }, []);

  // تحذير عند محاولة إغلاق الصفحة أثناء الاختبار
  useEffect(() => {
    const handler = (e) => {
      if (submittedRef.current) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  const questions = state?.questions || [];
  const total = questions.length;
  const answeredCount = useMemo(() => Object.keys(answers).length, [answers]);
  const progress = total ? Math.round((answeredCount / total) * 100) : 0;
  const q = questions[current];

  if (loadError) {
    return (
      <div className="min-h-screen grid place-items-center px-4">
        <div className="max-w-md w-full space-y-4">
          <Alert type="error">{loadError}</Alert>
          <button onClick={() => navigate('/app')} className="btn-primary w-full">
            العودة للوحة
          </button>
        </div>
      </div>
    );
  }

  if (!state) return <FullPageLoader text="جارٍ تجهيز أسئلتك..." />;

  const instant = Boolean(state.instantFeedback);
  const result = instant ? checked[q.id] : undefined;

  async function choose(index) {
    if (!instant) {
      setAnswers((prev) => ({ ...prev, [q.id]: index }));
      return;
    }
    // الشرح الفوري: الخادم يثبّت الإجابة أولاً ثم يكشف تصحيحها — لا تراجع بعدها
    if (result || checking) return;
    const questionId = q.id;
    setChecking(true);
    setCheckError('');
    setAnswers((prev) => ({ ...prev, [questionId]: index }));
    try {
      const res = await callFn('checkAnswer', { attemptId, questionId, selectedIndex: index });
      setChecked((prev) => ({ ...prev, [questionId]: res }));
      setAnswers((prev) => ({ ...prev, [questionId]: res.selectedIndex }));
    } catch (err) {
      setAnswers((prev) => {
        const next = { ...prev };
        delete next[questionId];
        return next;
      });
      setCheckError(err.message);
    } finally {
      setChecking(false);
    }
  }

  function toggleFlag() {
    setFlagged((prev) => (prev.includes(q.id) ? prev.filter((x) => x !== q.id) : [...prev, q.id]));
  }

  return (
    /* التوسيط العمودي على الشاشات الكبيرة فقط؛ الموبايل يبقى بتدفّقه الطبيعي */
    <div className="exam-bg min-h-screen bg-base flex flex-col md:justify-center no-copy">
      {/* ------- الشريط العلوي: المؤقّت + التقدّم ------- */}
      <header className="sticky top-0 z-30 bg-base/95 backdrop-blur border-b border-zinc-800 md:static md:bg-transparent md:backdrop-blur-none md:border-none">
        <div className="max-w-3xl mx-auto px-4 py-3 md:pt-0 space-y-3">
          {/* صف الرأس: كل عناصره على نفس المحاذاة الرأسية */}
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xl sm:text-3xl font-extrabold text-accent truncate leading-tight">
                {state.subject}
              </p>
              <p className="text-xs sm:text-sm text-inkMuted truncate mt-0.5">
                {state.lessonLabel || ''}
              </p>
            </div>

            {/* منطقة النبض: التبديل + الإيقاف + المتتالية + حلقة المؤقّت */}
            <div className="flex items-center gap-2 sm:gap-3.5 shrink-0">
              <div className="flex flex-col items-center gap-1.5">
                <ThemeToggle />
                {timed && (
                <button
                  onClick={togglePause}
                  disabled={!paused && pauseLimitReached}
                  title={
                    paused
                      ? 'استئناف الاختبار'
                      : pauseLimitReached
                        ? 'استنفدت رصيد الإيقاف المؤقّت'
                        : `إيقاف مؤقّت (${MAX_PAUSES - pauseCount} متبقية)`
                  }
                  className="btn btn-ghost btn-sm !px-2.5"
                >
                  {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                </button>
                )}
              </div>
              <ExamStreakBadge streak={state.streak} />
              {timed ? (
                <ExamTimerRing remaining={remaining} totalSeconds={state.durationSeconds} />
              ) : (
                <div className="text-center" title="اختبار بلا مؤقّت — خذ وقتك">
                  <div className="flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-surface px-3 py-2">
                    <Clock className="w-4 h-4 text-brandInk" />
                    <span dir="ltr" className="font-extrabold tabular-nums text-ink">
                      {formatDuration(elapsed)}
                    </span>
                  </div>
                  <p className="text-[11px] text-inkMuted mt-1">بلا مؤقّت</p>
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-bold text-ink">
                تم حل <span className="text-accent tabular-nums">{answeredCount}</span> من أصل{' '}
                <span className="tabular-nums">{total}</span> سؤال
              </span>
              <span className="font-extrabold text-accent tabular-nums">{progress}%</span>
            </div>
            <div className="exam-progress-track">
              <div className="exam-progress-fill" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>
      </header>

      {/* ------- السؤال ------- */}
      <main className="flex-1 md:flex-none max-w-3xl w-full mx-auto px-4 py-6">
        {submitError && (
          <div className="mb-4">
            <Alert type="error">{submitError}</Alert>
          </div>
        )}

        {/* شاشة الإيقاف: يُستبدل بها محتوى السؤال بالكامل، لا يُعتَّم فقط */}
        {paused ? (
          <div className="exam-card p-8 sm:p-12 text-center animate-fadeIn">
            <div className="w-16 h-16 rounded-2xl bg-accent/10 text-accent grid place-items-center mx-auto mb-5">
              <Pause className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-extrabold text-ink">الاختبار متوقّف مؤقتاً</h2>
            <p className="text-inkMuted mt-3 leading-relaxed">
              المؤقّت متوقّف والأسئلة مخفية. اضغط «استئناف» للمتابعة.
            </p>
            <p className="text-xs text-zinc-500 mt-4">
              استخدمت {pauseCount} من {MAX_PAUSES} إيقاف · تبقّى{' '}
              <span dir="ltr" className="tabular-nums">
                {formatDuration(Math.max(0, MAX_PAUSE_SECONDS - pausedSeconds))}
              </span>{' '}
              من رصيد الإيقاف
            </p>
            <button onClick={togglePause} className="btn-primary mt-7 px-10 text-lg py-4">
              <Play className="w-6 h-6" />
              استئناف
            </button>
          </div>
        ) : (
        <div className="exam-card p-5 sm:p-7 animate-fadeIn" key={q.id}>
          <div className="flex items-start justify-between gap-3 mb-5">
            <span className="badge bg-accent/10 text-accent border border-accent/25">
              السؤال {current + 1} / {total}
            </span>
            <button
              onClick={toggleFlag}
              className={`btn btn-sm ${
                flagged.includes(q.id)
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'btn-ghost'
              }`}
            >
              <Flag className="w-4 h-4" />
              {flagged.includes(q.id) ? 'مُعلَّم للمراجعة' : 'مراجعة لاحقاً'}
            </button>
          </div>

          <p className="text-xl sm:text-2xl font-bold text-ink leading-relaxed mb-6">
            {q.questionText}
          </p>

          <div className="space-y-3">
            {q.optionsText.map((opt, i) => {
              const selected = answers[q.id] === i;
              // بعد كشف التصحيح: الصحيح أخضر، واختيار الطالب الخاطئ أحمر، والباقي باهت
              let tone = selected ? 'exam-option-selected' : '';
              if (result) {
                if (i === result.correctAnswerIndex) tone = '!border-emerald-500 !bg-emerald-500/10 !text-emerald-300';
                else if (i === result.selectedIndex) tone = '!border-red-500 !bg-red-500/10 !text-red-300';
                else tone = 'opacity-50';
              }
              return (
                <button
                  key={i}
                  onClick={() => choose(i)}
                  disabled={Boolean(result) || (checking && instant)}
                  aria-pressed={selected}
                  className={`exam-option ${tone} disabled:cursor-default`}
                >
                  <span className="exam-letter" aria-hidden="true">
                    {ARABIC_LETTERS[i]}
                  </span>
                  <span className="leading-relaxed pt-1.5 flex-1">{opt}</span>
                  {result && i === result.correctAnswerIndex && (
                    <Check className="w-5 h-5 shrink-0 mt-2" strokeWidth={3} />
                  )}
                  {result && i === result.selectedIndex && !result.isCorrect && (
                    <X className="w-5 h-5 shrink-0 mt-2" strokeWidth={3} />
                  )}
                </button>
              );
            })}
          </div>

          {instant && checking && !result && (
            <p className="mt-4 flex items-center gap-2 text-sm text-inkMuted">
              <Spinner className="w-4 h-4" /> جارٍ التصحيح...
            </p>
          )}
          {instant && checkError && !result && (
            <div className="mt-4">
              <Alert type="error">{checkError}</Alert>
            </div>
          )}
          {result && (
            <div
              className={`mt-5 rounded-2xl border p-4 animate-fadeIn ${
                result.isCorrect ? 'border-emerald-500/40 bg-emerald-500/[0.07]' : 'border-red-500/40 bg-red-500/[0.07]'
              }`}
            >
              <p className={`font-bold flex items-center gap-2 ${result.isCorrect ? 'text-emerald-300' : 'text-red-300'}`}>
                {result.isCorrect ? <Check className="w-5 h-5" strokeWidth={3} /> : <X className="w-5 h-5" strokeWidth={3} />}
                {result.isCorrect
                  ? 'إجابة صحيحة!'
                  : `إجابة خاطئة — الصحيحة: (${ARABIC_LETTERS[result.correctAnswerIndex]})`}
              </p>
              {result.explanation && (
                <p className="mt-2 text-sm text-zinc-300 leading-relaxed flex items-start gap-2">
                  <Lightbulb className="w-4 h-4 shrink-0 mt-0.5 text-accent" />
                  {result.explanation}
                </p>
              )}
            </div>
          )}
        </div>
        )}

        {/* ------- التنقّل (مخفيّ أثناء الإيقاف) ------- */}
        <div className={`flex items-center gap-3 mt-5 ${paused ? 'hidden' : ''}`}>
          <button
            onClick={() => setCurrent((c) => Math.max(0, c - 1))}
            disabled={current === 0}
            className="btn btn-ghost flex-1"
          >
            <ChevronRight className="w-5 h-5" />
            السابق
          </button>

          <button onClick={() => setShowGrid(true)} className="btn btn-ghost" title="كل الأسئلة">
            <Grid3x3 className="w-5 h-5" />
          </button>

          {current === total - 1 ? (
            <button onClick={() => setConfirmSubmit(true)} className="btn-primary flex-1">
              <Send className="w-5 h-5" />
              تسليم
            </button>
          ) : (
            <button onClick={() => setCurrent((c) => Math.min(total - 1, c + 1))} className="btn-primary flex-1">
              التالي
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* زر الإنهاء: محدَّد بإطار ولون تحذيري ليتمايز بوضوح عن زر التسليم الذهبي */}
        <button
          onClick={() => setConfirmSubmit(true)}
          className={`btn w-full mt-4 border-2 border-critical/50 text-critical
                      hover:border-critical hover:bg-critical/10 ${paused ? 'hidden' : ''}`}
        >
          <X className="w-5 h-5" />
          إنهاء الاختبار وتسليمه الآن
        </button>
      </main>

      {/* ------- شبكة التنقّل بين الأسئلة ------- */}
      {showGrid && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="exam-card w-full max-w-lg p-5 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg">كل الأسئلة</h3>
              <button onClick={() => setShowGrid(false)} className="btn btn-ghost btn-sm">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-6 sm:grid-cols-8 gap-2">
              {questions.map((item, i) => {
                const isAnswered = answers[item.id] !== undefined;
                const isFlagged = flagged.includes(item.id);
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setCurrent(i);
                      setShowGrid(false);
                    }}
                    className={`aspect-square rounded-lg font-bold text-sm border transition relative ${
                      i === current
                        ? 'bg-accent on-accent border-accent'
                        : checked[item.id]
                          ? checked[item.id].isCorrect
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                            : 'bg-red-500/15 text-red-300 border-red-500/40'
                          : isAnswered
                          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                          : 'bg-surface2 text-zinc-400 border-zinc-700'
                    }`}
                  >
                    {i + 1}
                    {isFlagged && (
                      <span className="absolute -top-1 -left-1 w-2.5 h-2.5 rounded-full bg-amber-400" />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-4 mt-5 text-xs text-zinc-400">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-emerald-500/40" /> مُجاب
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-zinc-700" /> غير مُجاب
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-amber-400" /> مُعلَّم للمراجعة
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ------- تأكيد التسليم ------- */}
      {confirmSubmit && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm grid place-items-center p-4">
          <div className="exam-card w-full max-w-md p-6 text-center">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/15 text-amber-300 grid place-items-center mx-auto mb-4">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <h3 className="text-xl font-bold">تأكيد التسليم</h3>
            <p className="text-zinc-400 mt-3 leading-relaxed">
              أجبت على <span className="font-extrabold text-zinc-100">{answeredCount}</span> من أصل{' '}
              <span className="font-extrabold text-zinc-100">{total}</span> سؤال.
              {answeredCount < total && ' الأسئلة غير المُجابة ستُحتسب خاطئة.'}
            </p>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setConfirmSubmit(false)}
                disabled={submitting}
                className="btn btn-ghost flex-1"
              >
                متابعة الحل
              </button>
              <button onClick={() => submit(false)} disabled={submitting} className="btn-primary flex-1">
                {submitting ? <Spinner className="w-5 h-5 on-accent" /> : <Send className="w-5 h-5" />}
                تسليم
              </button>
            </div>
          </div>
        </div>
      )}

      {submitting && !confirmSubmit && (
        <div className="fixed inset-0 z-50 bg-black/80 grid place-items-center">
          <div className="text-center space-y-3">
            <Spinner className="w-10 h-10 mx-auto" />
            <p className="text-zinc-300">جارٍ تسليم إجاباتك وتصحيحها...</p>
          </div>
        </div>
      )}
    </div>
  );
}
