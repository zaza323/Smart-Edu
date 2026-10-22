import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { BookmarkX, ChartLine, PlayCircle, Table2 } from 'lucide-react';
import { callFn, db } from '../../lib/firebase';
import { fetchSubjects } from '../../lib/subjects';
import { computeSubjectProgress } from '../../lib/studentStats';
import { subscribeSaved, unsaveQuestion } from '../../lib/savedQuestions';
import { saveExamSession } from '../../lib/examSession';
import { useAuth } from '../../context/AuthContext';
import { Alert, EmptyState, Spinner, formatDate } from '../../components/ui';
import ScoreChart from '../../components/progress/ScoreChart';
import LessonBars from '../../components/progress/LessonBars';

const ATTEMPTS_LIMIT = 200;
const SAVED_SESSION_MAX = 25;

function Tile({ label, value, hint }) {
  return (
    <div className="card !shadow-md p-4">
      <div className="text-xs text-zinc-400">{label}</div>
      <div className="mt-2 text-2xl font-extrabold">
        <span dir="ltr">{value}</span>
      </div>
      {hint && <div className="mt-1 text-xs text-zinc-500">{hint}</div>}
    </div>
  );
}

/** تحليل الأداء (/app/progress): تطوّر النتيجة، الدروس، والأسئلة المحفوظة — لكل مادة. */
export default function ProgressPage() {
  const { user, subscriptionOf } = useAuth();
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [saved, setSaved] = useState({});
  const [subjectId, setSubjectId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showTable, setShowTable] = useState(false);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const [subjectList, snap] = await Promise.all([
          fetchSubjects({ onlyActive: true }),
          getDocs(
            query(
              collection(db, 'attempts'),
              where('uid', '==', user.uid),
              orderBy('startedAt', 'desc'),
              limit(ATTEMPTS_LIMIT)
            )
          ),
        ]);
        setSubjects(subjectList);
        setAttempts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch {
        setError('تعذّر تحميل بيانات الأداء.');
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  useEffect(() => (user ? subscribeSaved(user.uid, setSaved) : undefined), [user]);

  // المواد التي فيها اختبارات مسلَّمة أو اشتراك مفعّل، الأكثر نشاطاً أولاً
  const choices = useMemo(() => {
    const counts = {};
    for (const a of attempts) if (a.status === 'submitted') counts[a.subjectId] = (counts[a.subjectId] || 0) + 1;
    return subjects
      .filter((s) => counts[s.id] || subscriptionOf(s.id).status === 'active')
      .sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjects, attempts]);

  // المادة المختارة، وإلا الأكثر نشاطاً — تُحسب مباشرة لا في useEffect حتى لا يمرّ
  // رسم أول بلا مادة
  const subject = choices.find((s) => s.id === subjectId) || choices[0];
  const activeId = subject?.id || '';
  const progress = useMemo(
    () => (subject ? computeSubjectProgress(attempts, subject) : null),
    [attempts, subject]
  );
  const savedList = useMemo(
    () =>
      Object.values(saved)
        .filter((q) => q.subjectId === activeId)
        .sort((a, b) => (b.savedAt?.toMillis?.() || 0) - (a.savedAt?.toMillis?.() || 0)),
    [saved, activeId]
  );

  // الأضعف: أقل دقة بين الدروس التي أُجيب فيها 3 أسئلة على الأقل
  const weakestNumber = useMemo(() => {
    const tested = (progress?.lessons || []).filter((l) => l.total >= 3 && l.accuracy < 100);
    return tested.sort((a, b) => a.accuracy - b.accuracy)[0]?.number ?? null;
  }, [progress]);

  async function startSavedReview() {
    setStarting(true);
    setError('');
    try {
      const res = await callFn('startExam', {
        subjectId: activeId,
        mode: 'saved',
        count: Math.min(savedList.length, SAVED_SESSION_MAX),
        timed: false,
        instantFeedback: true,
      });
      saveExamSession(res.attemptId, {
        questions: res.questions,
        durationSeconds: res.durationSeconds,
        timed: res.timed,
        instantFeedback: res.instantFeedback,
        subjectId: activeId,
        subject: subject?.name || activeId,
        lessonLabel: res.lessonLabel,
        answers: {},
        checked: {},
        flagged: [],
        current: 0,
        startedAtLocal: Date.now(),
      });
      navigate(`/exam/${res.attemptId}`);
    } catch (err) {
      setError(err.details?.attemptId ? 'لديك اختبار جارٍ — أكمله أو سلّمه أولاً.' : err.message);
      setStarting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="w-8 h-8" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold">تحليل الأداء</h1>
        <p className="text-zinc-400 mt-1">تابع تطوّر نتائجك ونقاط قوتك وضعفك في كل درس.</p>
      </div>

      {error && <Alert type="error">{error}</Alert>}

      {choices.length === 0 ? (
        <EmptyState
          icon={ChartLine}
          title="لا توجد بيانات بعد"
          description="اشترك في مادة وأكمل اختباراً لتظهر تحليلات أدائك هنا."
          action={
            <Link to="/app" className="btn-primary">
              انتقل إلى المواد
            </Link>
          }
        />
      ) : (
        <>
          {/* المادة — الفلتر الوحيد، في صف واحد فوق كل ما يحكمه */}
          <div className="flex flex-wrap items-center gap-2">
            {choices.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSubjectId(s.id)}
                aria-pressed={s.id === activeId}
                className={`px-4 py-1.5 rounded-full text-sm border transition ${
                  s.id === activeId
                    ? 'bg-brandFill border-brandFill text-white'
                    : 'border-zinc-700 text-zinc-400 hover:text-zinc-100'
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>

          <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Tile label="اختبارات مكتملة" value={progress.exams} />
            <Tile label="متوسط النتيجة" value={progress.avgPct === null ? '—' : `${progress.avgPct}%`} />
            <Tile label="أفضل نتيجة" value={progress.bestPct === null ? '—' : `${progress.bestPct}%`} />
            <Tile label="الإتقان" value={`${progress.mastery}%`} hint="أسئلة مختلفة أجبتها صحيحاً" />
          </section>

          <section className="card p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <div>
                <h2 className="font-bold">نتيجتك في كل اختبار</h2>
                <p className="text-xs text-zinc-500">مرّر المؤشّر أو استخدم الأسهم لعرض تفاصيل كل اختبار</p>
              </div>
              {progress.series.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowTable((v) => !v)}
                  aria-pressed={showTable}
                  className="btn btn-ghost btn-sm"
                >
                  {showTable ? <ChartLine className="w-4 h-4" /> : <Table2 className="w-4 h-4" />}
                  {showTable ? 'عرض كرسم' : 'عرض كجدول'}
                </button>
              )}
            </div>

            {progress.series.length === 0 ? (
              <p className="text-sm text-zinc-500 py-8 text-center">لم تكمل أي اختبار في هذه المادة بعد.</p>
            ) : showTable ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-zinc-500">
                    <tr className="border-b border-zinc-800">
                      <th className="text-right font-semibold py-2">التاريخ</th>
                      <th className="text-right font-semibold py-2">النطاق</th>
                      <th className="text-right font-semibold py-2">الصحيحة</th>
                      <th className="text-right font-semibold py-2">النتيجة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...progress.series].reverse().map((p) => (
                      <tr key={p.id} className="border-b border-zinc-800/60">
                        <td className="py-2 text-zinc-400">{formatDate(p.at)}</td>
                        <td className="py-2">{p.label}</td>
                        <td className="py-2 tabular-nums">
                          {p.score}/{p.total}
                        </td>
                        <td className="py-2">
                          <Link to={`/app/result/${p.id}`} className="font-bold tabular-nums hover:underline" dir="ltr">
                            {p.pct}%
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <ScoreChart series={progress.series} />
            )}
          </section>

          <section className="card p-5">
            <h2 className="font-bold mb-1">الأداء حسب الدرس</h2>
            <p className="text-xs text-zinc-500 mb-4">
              نسبة الصحيح من الأسئلة التي أجبتها في كل درس، واتجاهها: آخر نصف إجاباتك فيه مقابل النصف الأقدم
            </p>
            {progress.lessons.length ? (
              <LessonBars subjectId={activeId} lessons={progress.lessons} weakestNumber={weakestNumber} />
            ) : (
              <p className="text-sm text-zinc-500">أسئلة هذه المادة غير مقسّمة على دروس.</p>
            )}
          </section>

          <section className="card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="font-bold">الأسئلة المحفوظة ({savedList.length})</h2>
                <p className="text-xs text-zinc-500">
                  تحفظها بزر «مراجعة لاحقاً» أثناء الاختبار، أو بزر «احفظ» في صفحة النتيجة
                </p>
              </div>
              {savedList.length > 0 && subscriptionOf(activeId).status === 'active' && (
                <button type="button" onClick={startSavedReview} disabled={starting} className="btn-primary btn-sm">
                  {starting ? <Spinner className="w-4 h-4 on-accent" /> : <PlayCircle className="w-4 h-4" />}
                  راجعها الآن
                </button>
              )}
            </div>
            {savedList.length === 0 ? (
              <p className="text-sm text-zinc-500">لا أسئلة محفوظة في هذه المادة.</p>
            ) : (
              <ul className="space-y-2">
                {savedList.map((q) => (
                  <li key={q.id} className="flex items-start justify-between gap-3 rounded-xl bg-base/40 border border-zinc-800 p-3">
                    <div className="min-w-0">
                      <p className="text-sm leading-relaxed line-clamp-2">{q.questionText}</p>
                      {q.lesson && <p className="text-xs text-zinc-500 mt-1">{q.lesson}</p>}
                    </div>
                    <button
                      type="button"
                      onClick={() => unsaveQuestion(user.uid, q.id).catch(() => {})}
                      title="إزالة من المحفوظة"
                      aria-label="إزالة من المحفوظة"
                      className="btn btn-ghost btn-sm !px-2 shrink-0 text-zinc-400 hover:text-red-300"
                    >
                      <BookmarkX className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
