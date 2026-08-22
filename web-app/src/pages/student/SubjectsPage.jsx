import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchSubjects } from '../../lib/subjects';
import { BookOpenCheck, CreditCard, PlayCircle, Sparkles } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Alert, EmptyState, Spinner, StatusBadge, formatDate } from '../../components/ui';
import PromoBanner from '../../components/PromoBanner';

export default function SubjectsPage() {
  const { profile, subscriptionOf } = useAuth();
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        setSubjects(await fetchSubjects({ onlyActive: true }));
      } catch {
        setError('تعذّر تحميل قائمة المواد. تحقّق من اتصالك بالإنترنت.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const hasActiveSubscription = Object.values(profile?.subscriptions || {}).some(
    (s) => s.status === 'active'
  );

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
        <h1 className="text-2xl font-extrabold">
          أهلاً {profile?.fullName?.split(' ')[0] || ''} 👋
        </h1>
        <p className="text-zinc-400 mt-1">اختر مادة مفعّلة لبدء اختبار جديد، أو اشترك بمادة جديدة.</p>
      </div>

      {hasActiveSubscription && <PromoBanner />}

      {error && <Alert type="error">{error}</Alert>}

      {subjects.length === 0 ? (
        <EmptyState
          icon={BookOpenCheck}
          title="لا توجد مواد متاحة حالياً"
          description="سيتم إضافة المواد قريباً من قِبل الإدارة."
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {subjects.map((s) => {
            const sub = subscriptionOf(s.id);
            const isActive = sub.status === 'active';
            return (
              <div key={s.id} className="card p-5 flex flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-bold text-lg text-accent truncate">{s.name}</h3>
                    <p className="text-zinc-500 text-sm mt-0.5">
                      {[s.grade, s.semester].filter(Boolean).join(' — ')}
                    </p>
                  </div>
                  <StatusBadge status={sub.status} />
                </div>

                <div className="mt-4 flex flex-wrap gap-2 text-xs text-zinc-400">
                  <span className="bg-zinc-800 rounded-lg px-2.5 py-1">
                    {s.questionCount ?? 0} سؤال
                  </span>
                  <span className="bg-zinc-800 rounded-lg px-2.5 py-1">
                    {(s.lessons || []).length} درس
                  </span>
                  {!isActive && s.price != null && (
                    <span className="bg-zinc-800 rounded-lg px-2.5 py-1">{s.price} دينار</span>
                  )}
                </div>

                {isActive && sub.expiresAt && (
                  <p className="text-xs text-zinc-500 mt-3">
                    ينتهي الاشتراك: {formatDate(sub.expiresAt)}
                  </p>
                )}

                <div className="mt-auto pt-5">
                  {isActive ? (
                    <Link to={`/app/exam-setup/${s.id}`} className="btn-primary w-full">
                      <PlayCircle className="w-5 h-5" />
                      ابدأ اختباراً
                    </Link>
                  ) : sub.status === 'pending' ? (
                    <Link to={`/app/subscribe/${s.id}`} className="btn btn-ghost w-full">
                      <Sparkles className="w-5 h-5" />
                      متابعة حالة الطلب
                    </Link>
                  ) : (
                    <Link to={`/app/subscribe/${s.id}`} className="btn-primary w-full">
                      <CreditCard className="w-5 h-5" />
                      اشترك الآن
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
