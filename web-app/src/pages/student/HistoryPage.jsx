import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { ClipboardList, TrendingUp } from 'lucide-react';
import { db } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';
import {
  EmptyState,
  Spinner,
  StatusBadge,
  formatDate,
  formatDuration,
} from '../../components/ui';

export default function HistoryPage() {
  const { user } = useAuth();
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return undefined;
    const q = query(
      collection(db, 'attempts'),
      where('uid', '==', user.uid),
      orderBy('startedAt', 'desc'),
      limit(100)
    );
    return onSnapshot(
      q,
      (snap) => {
        setAttempts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      () => setLoading(false)
    );
  }, [user]);

  const submitted = useMemo(() => attempts.filter((a) => a.status === 'submitted'), [attempts]);

  const average = useMemo(() => {
    if (submitted.length === 0) return 0;
    const sum = submitted.reduce((acc, a) => acc + (a.percentage || 0), 0);
    return Math.round((sum / submitted.length) * 10) / 10;
  }, [submitted]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="w-8 h-8" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold">سجل محاولاتي</h1>
        <p className="text-zinc-400 mt-1">تابع تطوّر أدائك عبر الزمن.</p>
      </div>

      {submitted.length > 0 && (
        <div className="card p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-accent/10 text-accent grid place-items-center">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <p className="text-zinc-400 text-sm">متوسط علاماتك في {submitted.length} اختبار</p>
            <p className="text-2xl font-extrabold text-zinc-50">{average}%</p>
          </div>
        </div>
      )}

      {attempts.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="لم تحل أي اختبار بعد"
          description="ابدأ اختبارك الأول من صفحة المواد وستظهر نتائجك هنا."
          action={
            <Link to="/app" className="btn-primary">
              تصفّح المواد
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {attempts.map((a) => {
            const isSubmitted = a.status === 'submitted';
            const inner = (
              <div className="card p-5 hover:border-zinc-700 transition">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-accent truncate">{a.subject}</p>
                    <p className="text-sm text-zinc-500 truncate mt-0.5">{a.lessonLabel}</p>
                  </div>
                  <StatusBadge status={a.status} />
                </div>

                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-4 text-sm">
                  {isSubmitted ? (
                    <>
                      <span className="font-extrabold text-lg text-zinc-50" dir="ltr">
                        {a.score}/{a.totalQuestions}
                      </span>
                      <span
                        className={`font-bold ${
                          a.percentage >= 60 ? 'text-emerald-300' : 'text-amber-300'
                        }`}
                      >
                        {a.percentage}%
                      </span>
                      <span className="text-zinc-500" dir="ltr">
                        {formatDuration(a.timeTakenSeconds)}
                      </span>
                    </>
                  ) : (
                    <span className="text-zinc-500">{a.totalQuestions} سؤال</span>
                  )}
                  <span className="text-zinc-600 text-xs mr-auto">{formatDate(a.startedAt)}</span>
                </div>
              </div>
            );

            if (isSubmitted) {
              return (
                <Link key={a.id} to={`/app/result/${a.id}`} className="block">
                  {inner}
                </Link>
              );
            }
            if (a.status === 'in_progress') {
              return (
                <Link key={a.id} to={`/exam/${a.id}`} className="block">
                  {inner}
                </Link>
              );
            }
            return <div key={a.id}>{inner}</div>;
          })}
        </div>
      )}
    </div>
  );
}
