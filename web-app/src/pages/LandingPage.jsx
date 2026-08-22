import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchSubjects } from '../lib/subjects';
import {
  BarChart3,
  BookOpenCheck,
  CheckCircle2,
  ShieldCheck,
  Timer,
  Zap,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Spinner } from '../components/ui';
import ThemeToggle from '../components/ThemeToggle';

const features = [
  {
    icon: Timer,
    title: 'محاكاة امتحان الوزارة',
    text: 'مؤقّت تنازلي وشريط تقدّم يحاكيان جوّ الامتحان الحقيقي لتتعوّد على إدارة وقتك.',
  },
  {
    icon: Zap,
    title: 'تصحيح فوري',
    text: 'نتيجتك تظهر لحظة التسليم، مع مراجعة تفصيلية لكل سؤال وإجابته الصحيحة.',
  },
  {
    icon: BarChart3,
    title: 'تتبّع تطوّرك',
    text: 'سجل كامل لكل محاولاتك السابقة لتعرف أين تحسّنت وأين تحتاج مراجعة.',
  },
  {
    icon: ShieldCheck,
    title: 'أسئلة موثوقة',
    text: 'بنك أسئلة منسّق حسب الدروس، مبني على نماذج الوزارة وأسئلة الأجيال السابقة.',
  },
];

export default function LandingPage() {
  const { user } = useAuth();
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setSubjects(await fetchSubjects({ onlyActive: true }));
      } catch {
        setSubjects([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="min-h-screen bg-base">
      {/* شريط علوي */}
      <header className="border-b border-zinc-800">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Smart Edu Pro" className="brand-logo h-9" />
            <span className="font-extrabold text-accent hidden sm:block">Smart Edu Pro</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {user ? (
              <Link to="/app" className="btn-primary btn-sm">
                لوحتي
              </Link>
            ) : (
              <>
                <Link to="/login" className="btn btn-ghost btn-sm">
                  دخول
                </Link>
                <Link to="/register" className="btn-primary btn-sm">
                  إنشاء حساب
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* الواجهة الرئيسية */}
      <section className="max-w-6xl mx-auto px-4 pt-16 pb-12 text-center">
        <span className="badge bg-accent/10 text-accent border border-accent/25 mb-6">
          <BookOpenCheck className="w-4 h-4" />
          لطلاب التوجيهي
        </span>
        <h1 className="text-3xl sm:text-5xl font-extrabold leading-tight">
          بنك الأسئلة <span className="text-accent">التفاعلي</span>
        </h1>
        <p className="text-zinc-400 mt-5 max-w-2xl mx-auto leading-relaxed text-lg">
          تدرّب على آلاف الأسئلة المرتّبة حسب الدروس، بتجربة اختبار تحاكي امتحان الوزارة تماماً،
          مع تصحيح فوري وتقرير أداء يوضّح لك نقاط ضعفك بدقة.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
          <Link to={user ? '/app' : '/register'} className="btn-primary px-8">
            ابدأ الآن
          </Link>
          <a href="#subjects" className="btn btn-ghost px-8">
            المواد والأسعار
          </a>
        </div>
      </section>

      {/* المزايا */}
      <section className="max-w-6xl mx-auto px-4 py-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {features.map(({ icon: Icon, title, text }) => (
          <div key={title} className="card p-6">
            <div className="w-11 h-11 rounded-xl bg-accent/10 text-accent grid place-items-center mb-4">
              <Icon className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-lg">{title}</h3>
            <p className="text-zinc-400 text-sm mt-2 leading-relaxed">{text}</p>
          </div>
        ))}
      </section>

      {/* المواد */}
      <section id="subjects" className="max-w-6xl mx-auto px-4 py-12">
        <h2 className="text-2xl font-extrabold text-center mb-8">المواد المتاحة</h2>

        {loading ? (
          <div className="flex justify-center py-10">
            <Spinner className="w-8 h-8" />
          </div>
        ) : subjects.length === 0 ? (
          <p className="text-center text-zinc-500">
            سيتم إضافة المواد قريباً — تابعنا لمعرفة موعد الإطلاق.
          </p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {subjects.map((s) => (
              <div key={s.id} className="card p-6 flex flex-col">
                <h3 className="font-bold text-lg text-accent">{s.name}</h3>
                <p className="text-zinc-500 text-sm mt-1">
                  {[s.grade, s.semester].filter(Boolean).join(' — ')}
                </p>
                {s.description && (
                  <p className="text-zinc-400 text-sm mt-3 leading-relaxed">{s.description}</p>
                )}
                <div className="mt-auto pt-5 flex items-end justify-between">
                  <div>
                    <span className="text-3xl font-extrabold text-zinc-50">{s.price ?? '—'}</span>
                    <span className="text-zinc-500 text-sm mr-1">دينار</span>
                  </div>
                  <Link to={user ? `/app/subscribe/${s.id}` : '/register'} className="btn-primary btn-sm">
                    اشترك
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* كيف يعمل */}
      <section className="max-w-3xl mx-auto px-4 py-12">
        <h2 className="text-2xl font-extrabold text-center mb-8">كيف تحصل على اشتراكك؟</h2>
        <ol className="space-y-4">
          {[
            'أنشئ حسابك مجاناً بالاسم ورقم الهاتف والبريد الإلكتروني.',
            'اختر المادة التي تريدها وشاهد بيانات التحويل والمبلغ المطلوب.',
            'حوّل المبلغ، ثم ارفع صورة إثبات الدفع من داخل حسابك.',
            'بعد موافقة الإدارة يُفعَّل اشتراكك وتبدأ الحل مباشرة.',
          ].map((step, i) => (
            <li key={i} className="card p-4 flex items-start gap-4">
              <span className="w-8 h-8 shrink-0 rounded-lg bg-accent on-accent font-extrabold grid place-items-center">
                {i + 1}
              </span>
              <p className="text-zinc-300 leading-relaxed pt-1">{step}</p>
            </li>
          ))}
        </ol>
        <div className="flex justify-center mt-8">
          <Link to={user ? '/app' : '/register'} className="btn-primary px-8">
            <CheckCircle2 className="w-5 h-5" />
            إنشاء حساب الآن
          </Link>
        </div>
      </section>

      <footer className="border-t border-zinc-800 py-6 text-center text-sm text-zinc-600">
        Smart Edu Pro &copy; {new Date().getFullYear()} — جميع الحقوق محفوظة
      </footer>
    </div>
  );
}
