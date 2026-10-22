import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { BookOpenCheck, CreditCard, Package } from 'lucide-react';
import { callFn, db } from '../../lib/firebase';
import { fetchSubjects } from '../../lib/subjects';
import { bundleFullPrice, bundleSubjects, fetchBundles } from '../../lib/bundles';
import { computeStudentStats } from '../../lib/studentStats';
import { loadExamSession, saveExamSession } from '../../lib/examSession';
import { countBySubject, subscribeSaved } from '../../lib/savedQuestions';
import { useAuth } from '../../context/AuthContext';
import { Alert, EmptyState, Spinner } from '../../components/ui';
import GreetingHero from '../../components/dashboard/GreetingHero';
import RaceCard from '../../components/dashboard/RaceCard';
import StatsStrip from '../../components/dashboard/StatsStrip';
import SubjectCard from '../../components/dashboard/SubjectCard';
import ExamCustomizer, { defaultSetup } from '../../components/dashboard/ExamCustomizer';

// المحاولات تُقرأ لحساب الإحصائيات؛ السقف يحمي من تحميل سجل ضخم دفعة واحدة
const ATTEMPTS_LIMIT = 200;
// مراجعة الأخطاء: أقصى عدد أسئلة في الجلسة الواحدة
const MISTAKES_SESSION_MAX = 25;

/** لوحة الطالب (/app): ترحيب، سباق الأبطال، إحصائيات، المواد، وتخصيص الاختبار. */
export default function SubjectsPage() {
  const { user, profile, subscriptionOf } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [subjects, setSubjects] = useState([]);
  const [bundles, setBundles] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');

  const [setup, setSetup] = useState(null);
  const [highlight, setHighlight] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState('');
  const [resumeId, setResumeId] = useState('');
  const [reviewBusy, setReviewBusy] = useState({ subjectId: '', mode: '' });
  const [saved, setSaved] = useState({});
  const customizerRef = useRef(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const [subjectList, bundleList, attemptSnap] = await Promise.all([
          fetchSubjects({ onlyActive: true }),
          // الباقات والمحاولات اختيارية: فشلها لا يمنع عرض المواد
          fetchBundles({ onlyActive: true }).catch(() => []),
          getDocs(
            query(
              collection(db, 'attempts'),
              where('uid', '==', user.uid),
              orderBy('startedAt', 'desc'),
              limit(ATTEMPTS_LIMIT)
            )
          ).catch(() => null),
        ]);
        setSubjects(subjectList);
        setBundles(bundleList);
        setAttempts(attemptSnap ? attemptSnap.docs.map((d) => ({ id: d.id, ...d.data() })) : []);
      } catch {
        setError('تعذّر تحميل قائمة المواد. تحقّق من اتصالك بالإنترنت.');
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  useEffect(() => (user ? subscribeSaved(user.uid, setSaved) : undefined), [user]);
  const savedCounts = useMemo(() => countBySubject(saved), [saved]);

  const stats = useMemo(() => computeStudentStats(attempts, subjects), [attempts, subjects]);
  const statusOf = (id) => subscriptionOf(id).status || 'none';
  const activeSubjects = subjects.filter((s) => statusOf(s.id) === 'active');

  // المحاولة الجارية مع موضع الطالب فيها (من النسخة المحلية إن وُجدت)
  const inProgress = useMemo(() => {
    const a = stats.inProgress;
    if (!a) return null;
    const session = loadExamSession(a.id);
    const total = a.totalQuestions || session?.questions?.length || 0;
    const position =
      session && Number.isInteger(session.current) ? `سؤال ${session.current + 1} من ${total}` : `${total} سؤالاً`;
    return { ...a, position };
  }, [stats.inProgress]);

  // الإعداد الافتراضي للوحة التخصيص: مادة ?start= ثم مادة المحاولة الجارية ثم أول مادة مفعّلة
  useEffect(() => {
    if (loading || activeSubjects.length === 0) return;
    const wanted = searchParams.get('start');
    const pick =
      activeSubjects.find((s) => s.id === wanted) ||
      activeSubjects.find((s) => s.id === stats.inProgress?.subjectId) ||
      activeSubjects[0];
    if (wanted) {
      // ?lessons=1,3 من صفحة تحليل الأداء: «تدرّب على هذا الدرس»
      const lessons = (searchParams.get('lessons') || '')
        .split(',')
        .map(Number)
        .filter((n) => Number.isFinite(n) && n > 0);
      openCustomizer(pick.id, lessons.length ? { mode: 'custom', lessons } : {});
      setSearchParams({}, { replace: true });
    } else if (!setup) {
      setSetup(defaultSetup(pick));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, activeSubjects.length]);

  function openCustomizer(subjectId, preset) {
    const subject = activeSubjects.find((s) => s.id === subjectId);
    if (!subject) return;
    setSetup(defaultSetup(subject, preset));
    setStartError('');
    setResumeId('');
    requestAnimationFrame(() => {
      customizerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (preset.focusLessons) customizerRef.current?.querySelector('input[type=checkbox]')?.focus();
    });
    setHighlight(true);
    setTimeout(() => setHighlight(false), 1200);
  }

  async function launch(subject, payload, onError) {
    try {
      const res = await callFn('startExam', { subjectId: subject.id, ...payload });
      saveExamSession(res.attemptId, {
        questions: res.questions,
        durationSeconds: res.durationSeconds,
        timed: res.timed,
        instantFeedback: res.instantFeedback,
        subjectId: subject.id,
        subject: subject.name,
        lessonLabel: res.lessonLabel,
        answers: {},
        checked: {},
        flagged: [],
        current: 0,
        startedAtLocal: Date.now(),
      });
      navigate(`/exam/${res.attemptId}`, { replace: true });
    } catch (err) {
      onError(err);
    }
  }

  async function startCustomExam(count) {
    const subject = activeSubjects.find((s) => s.id === setup.subjectId);
    if (!subject) return;
    const allLessons = (subject.lessons || []).map((l) => l.number);
    const everyLesson = allLessons.length === 0 || allLessons.every((n) => setup.lessons.includes(n));
    setStarting(true);
    setStartError('');
    setResumeId('');
    await launch(
      subject,
      {
        lessonNumbers: everyLesson ? null : setup.lessons,
        count,
        timed: setup.timed,
        instantFeedback: setup.instant,
      },
      (err) => {
        setStartError(err.details?.attemptId ? 'لديك اختبار جارٍ لم يُسلَّم بعد.' : err.message);
        setResumeId(err.details?.attemptId || '');
      }
    );
    setStarting(false);
  }

  /**
   * جلسة مراجعة بلا مؤقّت مع شرح فوري:
   * 'mistakes' = الأسئلة الخاطئة في آخر ظهور لها، 'saved' = الأسئلة المحفوظة.
   */
  async function startReview(subject, mode) {
    const available =
      mode === 'mistakes' ? stats.subjectStats[subject.id]?.mistakes || 0 : savedCounts[subject.id] || 0;
    setReviewBusy({ subjectId: subject.id, mode });
    setError('');
    await launch(
      subject,
      { mode, count: Math.min(available, MISTAKES_SESSION_MAX), timed: false, instantFeedback: true },
      (err) => setError(err.details?.attemptId ? 'لديك اختبار جارٍ — أكمله أو سلّمه أولاً.' : err.message)
    );
    setReviewBusy({ subjectId: '', mode: '' });
  }

  // سباق الأبطال: مادة المحاولة الجارية، وإلا الأكثر تدريباً، وإلا أول مادة مفعّلة
  const raceSubject = useMemo(() => {
    if (activeSubjects.length === 0) return null;
    const byId = (id) => activeSubjects.find((s) => s.id === id);
    const mostPracticed = Object.entries(stats.subjectStats)
      .filter(([id]) => byId(id))
      .sort((a, b) => b[1].attempts - a[1].attempts)[0]?.[0];
    return byId(stats.inProgress?.subjectId) || byId(mostPracticed) || activeSubjects[0];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSubjects.length, stats]);

  // تُعرض الباقة ما دامت فيها مادة غير مفعّلة للطالب
  const openBundles = bundles
    .map((b) => ({ ...b, items: bundleSubjects(b, subjects), fullPrice: bundleFullPrice(b, subjects) }))
    .filter((b) => b.items.length > 0 && b.items.some((s) => statusOf(s.id) !== 'active'));

  const shownSubjects = filter === 'active' ? activeSubjects : subjects;

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="w-8 h-8" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <GreetingHero
        profile={profile}
        inProgress={inProgress}
        canStart={activeSubjects.length > 0}
        onStartNew={() => setup && openCustomizer(setup.subjectId, { mode: setup.mode })}
      />

      {raceSubject && profile?.role !== 'admin' && (
        <RaceCard uid={user.uid} subjectId={raceSubject.id} subjectName={raceSubject.name} />
      )}

      {activeSubjects.length > 0 && <StatsStrip stats={stats} />}

      {error && <Alert type="error">{error}</Alert>}

      {openBundles.map((b) => (
        <div
          key={b.id}
          className="card p-5 border-accent/40 bg-gradient-to-l from-accent/[0.08] to-transparent flex flex-col sm:flex-row sm:items-center gap-4"
        >
          <div className="w-12 h-12 shrink-0 rounded-xl bg-accent on-accent grid place-items-center">
            <Package className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-lg text-accent">{b.name}</h3>
            <p className="text-zinc-400 text-sm mt-0.5">{b.items.map((s) => s.name).join(' + ')}</p>
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <p className="text-left">
              <span className="text-2xl font-extrabold text-zinc-50">{b.price}</span>{' '}
              <span className="text-zinc-400 text-sm">دينار</span>
              {b.fullPrice > Number(b.price) && (
                <span className="block text-xs text-zinc-500">
                  بدل <s>{b.fullPrice}</s>
                </span>
              )}
            </p>
            <Link to={`/app/subscribe/bundle/${b.id}`} className="btn-primary">
              <CreditCard className="w-5 h-5" />
              اشترك بالباقة
            </Link>
          </div>
        </div>
      ))}

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">موادك الدراسية</h2>
            <p className="text-sm text-zinc-500">اختر المادة للبدء باختبار فوري أو مراجعة حسب الدروس</p>
          </div>
          {subjects.length > 0 && (
            <div className="flex items-center gap-2">
              {[
                ['all', 'جميع المواد'],
                ['active', `المواد المفعّلة (${activeSubjects.length})`],
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilter(key)}
                  aria-pressed={filter === key}
                  className={`px-3 py-1.5 rounded-full text-sm border transition ${
                    filter === key
                      ? 'bg-zinc-800 border-zinc-700 text-zinc-100'
                      : 'border-zinc-800 text-zinc-400 hover:text-zinc-100'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        {subjects.length === 0 ? (
          <EmptyState
            icon={BookOpenCheck}
            title="لا توجد مواد متاحة حالياً"
            description="سيتم إضافة المواد قريباً من قِبل الإدارة."
          />
        ) : shownSubjects.length === 0 ? (
          <p className="text-sm text-zinc-500">لا مواد مفعّلة بعد — اشترك في مادة لتبدأ.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {shownSubjects.map((s) => (
              <SubjectCard
                key={s.id}
                subject={s}
                status={statusOf(s.id)}
                stats={stats.subjectStats[s.id]}
                inProgress={inProgress?.subjectId === s.id ? inProgress : null}
                onCustomize={(preset) => openCustomizer(s.id, preset)}
                savedCount={savedCounts[s.id] || 0}
                onMistakes={() => startReview(s, 'mistakes')}
                onSaved={() => startReview(s, 'saved')}
                busy={reviewBusy.subjectId === s.id ? reviewBusy.mode : ''}
              />
            ))}
          </div>
        )}
      </section>

      {setup && activeSubjects.length > 0 && (
        <ExamCustomizer
          ref={customizerRef}
          subjects={activeSubjects}
          setup={setup}
          onChange={setSetup}
          onStart={startCustomExam}
          busy={starting}
          error={startError}
          resumeId={resumeId}
          highlight={highlight}
        />
      )}
    </div>
  );
}
