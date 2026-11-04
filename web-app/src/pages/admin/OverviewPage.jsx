import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Banknote,
  ClipboardCheck,
  Coins,
  CreditCard,
  Database,
  Flame,
  Gift,
  RefreshCw,
  Users,
} from 'lucide-react';
import { callFn } from '../../lib/firebase';
import { Alert, Spinner, StatCard } from '../../components/ui';

export default function OverviewPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      setData(await callFn('adminOverview'));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">نظرة عامة</h1>
          <p className="text-zinc-400 mt-1">ملخّص أرقام المنصة.</p>
        </div>
        <button onClick={load} disabled={loading} className="btn btn-ghost btn-sm">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          تحديث
        </button>
      </div>

      <Alert type="error">{error}</Alert>

      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner className="w-8 h-8" />
        </div>
      ) : data ? (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <StatCard icon={Users} label="الطلاب المسجّلون" value={data.students} />
            <StatCard
              icon={CreditCard}
              label="طلبات دفع معلّقة"
              value={data.pendingPayments}
              tone="amber"
            />
            <StatCard
              icon={Banknote}
              label="إجمالي المبيعات"
              value={`${data.totalRevenue} د.أ`}
              hint={`${data.approvedPayments} اشتراك مفعّل`}
              tone="emerald"
            />
            <StatCard icon={Database} label="أسئلة بنك الأسئلة" value={data.questions} tone="sky" />
            <StatCard
              icon={ClipboardCheck}
              label="اختبارات مُسلَّمة"
              value={data.submittedAttempts}
              tone="sky"
            />
          </div>

          {data.pendingPayments > 0 && (
            <Alert type="warning">
              يوجد {data.pendingPayments} طلب دفع بانتظار المراجعة.{' '}
              <Link to="/admin/payments" className="underline font-bold">
                مراجعتها الآن
              </Link>
            </Alert>
          )}

          {data.streaks && <StreakStats s={data.streaks} />}
        </>
      ) : null}
    </div>
  );
}

/** إحصائيات الحماسات اليومية — الأرقام محسوبة خادمياً بتوقيت عمّان. */
function StreakStats({ s }) {
  const committed = s.studentsWithStreakToday + s.studentsWorkingToday;
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Flame className="w-5 h-5 text-orange-400" />
          الحماسات اليومية
        </h2>
        <span className="text-xs text-zinc-500">
          يوم {s.day} بتوقيت عمّان · {s.trackedStudents} طالباً في النظام
        </span>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          icon={Flame}
          label="حماسات مُنحت اليوم"
          value={s.studentsWithStreakToday}
          hint={`${s.studentsWorkingToday} ما زالوا دون الهدف`}
          tone="amber"
        />
        <StatCard
          icon={Gift}
          label="مكافآت اليوم"
          value={s.rewardsToday}
          hint={`${s.rewardPointsToday} نقطة وُزّعت اليوم`}
          tone="amber"
        />
        <StatCard
          icon={Coins}
          label="إجمالي النقاط الموزّعة"
          value={s.totalRewardPoints}
          hint={`${s.totalStreaksEarned} حماسة مكتسبة إجمالاً`}
          tone="emerald"
        />
        <StatCard
          icon={Flame}
          label="سلاسل نشطة"
          value={s.activeStreaks}
          hint="حماستهم محفوظة اليوم أو أمس"
          tone="emerald"
        />
        <StatCard
          icon={Flame}
          label="سلاسل منقطعة"
          value={s.brokenStreaks}
          hint="غابوا يوماً فأكثر"
        />
        <StatCard
          icon={ClipboardCheck}
          label="الملتزمون اليوم"
          value={committed}
          hint="بدأوا الحل اليوم"
          tone="sky"
        />
      </div>
    </section>
  );
}
