import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { AlertOctagon, BarChart3, TrendingUp } from 'lucide-react';
import { db } from '../../lib/firebase';
import { fetchSubjects } from '../../lib/subjects';
import { Alert, EmptyState, Spinner } from '../../components/ui';

export default function StatsPage() {
  const [subjects, setSubjects] = useState([]);
  const [subjectId, setSubjectId] = useState('');
  const [attempts, setAttempts] = useState([]);
  const [hardest, setHardest] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const list = await fetchSubjects();
        setSubjects(list);
        if (list[0]) setSubjectId(list[0].id);
        else setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!subjectId) return;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const [attemptsSnap, statsSnap] = await Promise.all([
          getDocs(
            query(
              collection(db, 'attempts'),
              where('subjectId', '==', subjectId),
              orderBy('submittedAt', 'desc'),
              limit(500)
            )
          ),
          getDocs(
            query(
              collection(db, 'questionStats'),
              where('subjectId', '==', subjectId),
              orderBy('timesWrong', 'desc'),
              limit(20)
            )
          ),
        ]);
        setAttempts(
          attemptsSnap.docs.map((d) => d.data()).filter((a) => a.status === 'submitted')
        );
        setHardest(statsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {
        setError(`${err.message} — قد يلزم إنشاء الفهرس المركّب من رابط الخطأ في Console.`);
      } finally {
        setLoading(false);
      }
    })();
  }, [subjectId]);

  const summary = useMemo(() => {
    if (attempts.length === 0) return null;
    const avg = attempts.reduce((s, a) => s + (a.percentage || 0), 0) / attempts.length;
    const byLesson = new Map();
    attempts.forEach((a) => {
      const key = a.lessonLabel || 'اختبار شامل';
      const prev = byLesson.get(key) || { sum: 0, n: 0 };
      byLesson.set(key, { sum: prev.sum + (a.percentage || 0), n: prev.n + 1 });
    });
    return {
      avg: Math.round(avg * 10) / 10,
      total: attempts.length,
      byLesson: [...byLesson.entries()]
        .map(([label, v]) => ({ label, avg: Math.round((v.sum / v.n) * 10) / 10, n: v.n }))
        .sort((a, b) => a.avg - b.avg),
    };
  }, [attempts]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold">إحصائيات الأداء</h1>
        <p className="text-zinc-400 mt-1">متوسط علامات الطلاب والأسئلة الأكثر خطأً.</p>
      </div>

      <Alert type="error">{error}</Alert>

      <select
        className="field sm:w-72"
        value={subjectId}
        onChange={(e) => setSubjectId(e.target.value)}
      >
        {subjects.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>

      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner className="w-8 h-8" />
        </div>
      ) : !summary ? (
        <EmptyState
          icon={BarChart3}
          title="لا توجد بيانات كافية بعد"
          description="ستظهر الإحصائيات بعد أن يبدأ الطلاب بحل الاختبارات في هذه المادة."
        />
      ) : (
        <>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="card p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-accent/10 text-accent grid place-items-center">
                <TrendingUp className="w-6 h-6" />
              </div>
              <div>
                <p className="text-zinc-400 text-sm">متوسط العلامات</p>
                <p className="text-2xl font-extrabold">{summary.avg}%</p>
              </div>
            </div>
            <div className="card p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-sky-500/10 text-sky-300 grid place-items-center">
                <BarChart3 className="w-6 h-6" />
              </div>
              <div>
                <p className="text-zinc-400 text-sm">اختبارات مُسلَّمة</p>
                <p className="text-2xl font-extrabold">{summary.total}</p>
              </div>
            </div>
          </div>

          {/* متوسط الأداء لكل درس */}
          <div className="card p-6">
            <h2 className="font-bold text-lg mb-5">متوسط الأداء حسب نطاق الاختبار</h2>
            <div className="space-y-4">
              {summary.byLesson.map((row) => (
                <div key={row.label}>
                  <div className="flex items-center justify-between text-sm mb-1.5 gap-3">
                    <span className="text-zinc-300 truncate">{row.label}</span>
                    <span className="text-zinc-400 shrink-0">
                      {row.avg}% · {row.n} محاولة
                    </span>
                  </div>
                  <div className="h-2.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        row.avg >= 70 ? 'bg-emerald-400' : row.avg >= 50 ? 'bg-amber-400' : 'bg-red-400'
                      }`}
                      style={{ width: `${row.avg}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* الأسئلة الأكثر خطأً */}
          <div className="card p-6">
            <h2 className="font-bold text-lg mb-1 flex items-center gap-2">
              <AlertOctagon className="w-5 h-5 text-amber-300" />
              الأسئلة الأكثر خطأً
            </h2>
            <p className="text-zinc-500 text-sm mb-5">
              نقاط الضعف الشائعة — مفيدة لتركيز الشرح والتسويق.
            </p>

            {hardest.length === 0 ? (
              <p className="text-zinc-500 text-sm">لا توجد بيانات بعد.</p>
            ) : (
              <div className="space-y-3">
                {hardest.map((h) => {
                  const rate = h.timesShown ? Math.round((h.timesWrong / h.timesShown) * 100) : 0;
                  return (
                    <div key={h.id} className="bg-surface2 rounded-xl px-4 py-3">
                      <p className="text-sm leading-relaxed">{h.questionText}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs">
                        <span className="text-red-300 font-bold">{rate}% خطأ</span>
                        <span className="text-zinc-500">
                          {h.timesWrong} خطأ من {h.timesShown} محاولة
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
