import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { ArrowRight, ListChecks, PlayCircle, Timer } from 'lucide-react';
import { callFn, db } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';
import { Alert, Spinner } from '../../components/ui';
import { saveExamSession } from '../../lib/examSession';

const COUNT_OPTIONS = [10, 20, 30, 40, 50];
// مطابق لـ MAX_QUESTIONS_PER_EXAM في Cloud Functions (محكوم بحد حجم مستند Firestore)
const MAX_ALLOWED = 500;
const MIN_ALLOWED = 5;

export default function ExamSetupPage() {
  const { subjectId } = useParams();
  const navigate = useNavigate();
  const { subscriptionOf } = useAuth();

  const [subject, setSubject] = useState(null);
  const [lessonNumber, setLessonNumber] = useState('all');
  // choice: رقم جاهز | 'all' (كل الأسئلة المتاحة) | 'custom' (عدد يكتبه الطالب)
  const [choice, setChoice] = useState(20);
  const [customRaw, setCustomRaw] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [resumeId, setResumeId] = useState('');

  const sub = subscriptionOf(subjectId);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'subjects', subjectId));
        setSubject(snap.exists() ? { id: snap.id, ...snap.data() } : null);
      } finally {
        setLoading(false);
      }
    })();
  }, [subjectId]);

  const lessons = (subject?.lessons || []).slice().sort((a, b) => a.number - b.number);
  const minutesPerQuestion = subject?.minutesPerQuestion || 0.4;

  // عدد الأسئلة المتاح فعلياً ضمن النطاق المختار (الدرس أو المادة كاملة)
  const availableInScope =
    lessonNumber === 'all'
      ? subject?.questionCount || 0
      : lessons.find((l) => String(l.number) === String(lessonNumber))?.count || 0;

  const ceiling = Math.min(availableInScope || MAX_ALLOWED, MAX_ALLOWED);

  // العدد الفعلي الذي سيُطلب من الخادم
  const effectiveCount =
    choice === 'all'
      ? ceiling
      : choice === 'custom'
        ? Math.min(parseInt(customRaw, 10) || 0, ceiling)
        : Math.min(choice, ceiling);

  const customInvalid =
    choice === 'custom' && (!customRaw || parseInt(customRaw, 10) < MIN_ALLOWED);

  async function start() {
    if (customInvalid) {
      setError(`أدخل عدداً بين ${MIN_ALLOWED} و${ceiling}.`);
      return;
    }
    setBusy(true);
    setError('');
    setResumeId('');
    try {
      const res = await callFn('startExam', {
        subjectId,
        lessonNumber: lessonNumber === 'all' ? null : Number(lessonNumber),
        count: choice === 'all' ? 'all' : effectiveCount,
      });
      saveExamSession(res.attemptId, {
        questions: res.questions,
        durationSeconds: res.durationSeconds,
        subjectId,
        subject: subject?.name || subjectId,
        lessonLabel:
          lessonNumber === 'all'
            ? 'اختبار شامل'
            : `الدرس ${lessonNumber}: ${
                lessons.find((l) => String(l.number) === String(lessonNumber))?.title || ''
              }`,
        answers: {},
        flagged: [],
        startedAtLocal: Date.now(),
      });
      navigate(`/exam/${res.attemptId}`, { replace: true });
    } catch (err) {
      if (err.details?.attemptId) {
        setResumeId(err.details.attemptId);
        setError('لديك اختبار جارٍ لم يُسلَّم بعد.');
      } else {
        setError(err.message);
      }
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="w-8 h-8" />
      </div>
    );
  }

  if (!subject) return <Alert type="error">هذه المادة غير موجودة.</Alert>;

  if (sub.status !== 'active') {
    return (
      <div className="max-w-xl mx-auto space-y-4">
        <Alert type="warning">اشتراكك في هذه المادة غير مفعّل.</Alert>
        <Link to={`/app/subscribe/${subjectId}`} className="btn-primary w-full">
          الاشتراك في المادة
        </Link>
      </div>
    );
  }

  const estimatedMinutes = Math.round(effectiveCount * minutesPerQuestion);

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <Link to="/app" className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-accent">
        <ArrowRight className="w-4 h-4" />
        رجوع للمواد
      </Link>

      <div className="card p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-extrabold text-accent">{subject.name}</h1>
          <p className="text-zinc-500 text-sm mt-1">إعداد اختبار جديد</p>
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

        {/* اختيار الدرس */}
        <div>
          <label className="label" htmlFor="lesson">
            <ListChecks className="w-4 h-4 inline ml-1" />
            نطاق الاختبار
          </label>
          <select
            id="lesson"
            className="field"
            value={lessonNumber}
            onChange={(e) => setLessonNumber(e.target.value)}
          >
            <option value="all">اختبار شامل — كل الدروس ({subject.questionCount ?? 0} سؤال)</option>
            {lessons.map((l) => (
              <option key={l.number} value={l.number}>
                الدرس {l.number}: {l.title} ({l.count} سؤال)
              </option>
            ))}
          </select>
        </div>

        {/* عدد الأسئلة */}
        <div>
          <span className="label">عدد الأسئلة</span>

          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {COUNT_OPTIONS.map((n) => (
              <button
                key={n}
                type="button"
                disabled={n > ceiling}
                onClick={() => setChoice(n)}
                className={`py-3 rounded-xl font-bold transition border disabled:opacity-40 disabled:cursor-not-allowed ${
                  choice === n
                    ? 'bg-accent on-accent border-accent'
                    : 'bg-surface2 border-zinc-700 text-zinc-300 enabled:hover:border-accent'
                }`}
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setChoice('all')}
              className={`py-3 rounded-xl font-bold transition border ${
                choice === 'all'
                  ? 'bg-accent on-accent border-accent'
                  : 'bg-surface2 border-zinc-700 text-zinc-300 hover:border-accent'
              }`}
            >
              الكل
            </button>
          </div>

          {/* عدد مخصّص */}
          <div className="flex items-center gap-3 mt-3">
            <button
              type="button"
              onClick={() => setChoice('custom')}
              className={`py-3 px-4 rounded-xl font-bold transition border shrink-0 ${
                choice === 'custom'
                  ? 'bg-accent on-accent border-accent'
                  : 'bg-surface2 border-zinc-700 text-zinc-300 hover:border-accent'
              }`}
            >
              عدد آخر
            </button>
            <input
              type="number"
              inputMode="numeric"
              min={MIN_ALLOWED}
              max={ceiling}
              value={customRaw}
              onFocus={() => setChoice('custom')}
              onChange={(e) => {
                setCustomRaw(e.target.value.replace(/\D/g, ''));
                setChoice('custom');
              }}
              placeholder={`من ${MIN_ALLOWED} إلى ${ceiling}`}
              className={`field flex-1 ${
                choice === 'custom' && customInvalid && customRaw ? 'border-red-500/60' : ''
              }`}
            />
          </div>

          <p className="text-xs text-zinc-500 mt-2 leading-relaxed">
            {choice === 'all' ? (
              <>
                «الكل» = كل الأسئلة المتاحة في النطاق المختار (
                <span className="text-zinc-300 font-bold">{ceiling} سؤال</span>
                {availableInScope > MAX_ALLOWED && ` — الحد الأقصى للاختبار الواحد ${MAX_ALLOWED}`}
                ).
              </>
            ) : (
              <>
                المتاح في هذا النطاق: <span className="text-zinc-300 font-bold">{availableInScope}</span>{' '}
                سؤال. إذا كان أقل من المطلوب، سيُنشأ الاختبار بالعدد المتاح.
              </>
            )}
          </p>
        </div>

        {/* الوقت */}
        <div className="bg-surface2 rounded-xl px-4 py-3 flex items-center gap-3">
          <Timer className="w-5 h-5 text-accent" />
          <p className="text-sm">
            {effectiveCount >= MIN_ALLOWED ? (
              <>
                <span className="font-extrabold text-zinc-50">{effectiveCount} سؤال</span>
                <span className="text-zinc-500"> · </span>
                مدة متوقعة:{' '}
                <span className="font-extrabold text-zinc-50">{estimatedMinutes} دقيقة</span>
                {/* «0.4 دقيقة للسؤال» صياغة غير مفهومة — تُعرض كمعدّل لكل 20 سؤالاً */}
                <span className="text-zinc-500">
                  {' '}
                  (بواقع {Math.round(minutesPerQuestion * 20 * 10) / 10} دقائق لكل 20 سؤالاً)
                </span>
              </>
            ) : (
              <span className="text-zinc-500">
                أدخل عدد الأسئلة أولاً (الحد الأدنى {MIN_ALLOWED}).
              </span>
            )}
          </p>
        </div>

        <Alert type="info">
          بمجرد الضغط على «ابدأ الاختبار» يبدأ المؤقّت. عند انتهاء الوقت يُسلَّم الاختبار
          تلقائياً بإجاباتك الحالية.
        </Alert>

        <button
          onClick={start}
          disabled={busy || effectiveCount < MIN_ALLOWED}
          className="btn-primary w-full text-lg py-4"
        >
          {busy ? <Spinner className="w-5 h-5 on-accent" /> : <PlayCircle className="w-6 h-6" />}
          ابدأ الاختبار
        </button>
      </div>
    </div>
  );
}
