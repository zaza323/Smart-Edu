import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchSubjects } from '../lib/subjects';
import { useAuth } from '../context/AuthContext';
import LandingHeader from '../components/landing/LandingHeader';
import HeroSection from '../components/landing/HeroSection';
import FeatureStory from '../components/landing/FeatureStory';
import DemoQuestion from '../components/landing/DemoQuestion';
import StatsBand from '../components/landing/StatsBand';
import SubjectsSection from '../components/landing/SubjectsSection';
import StepsSection from '../components/landing/StepsSection';
import FaqSection from '../components/landing/FaqSection';

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
    <div className="min-h-screen bg-lp-bg text-lp-ink overflow-x-hidden">
      <LandingHeader user={user} />
      <main>
        <HeroSection user={user} />
        <FeatureStory />
        <DemoQuestion user={user} />
        {!loading && <StatsBand subjects={subjects} />}
        <SubjectsSection subjects={subjects} loading={loading} user={user} />
        <StepsSection />
        <FaqSection />
      </main>
      <LandingFooter />
      <MobileStickyBar user={user} subjects={subjects} />
    </div>
  );
}

function LandingFooter() {
  return (
    // الحشوة السفلية على الهاتف تترك مكاناً لشريط «مستعد للبدء؟» الثابت
    <footer className="py-10 pb-28 sm:pb-10 border-t border-lp-line bg-lp-alt text-xs text-lp-muted">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="" className="brand-logo h-7" />
          <span className="font-bold text-lp-ink">Smart Edu Pro</span>
          <span className="hidden sm:inline">— بنك الأسئلة التفاعلي لطلاب التوجيهي</span>
        </div>
        <div>Smart Edu Pro &copy; {new Date().getFullYear()} — جميع الحقوق محفوظة</div>
      </div>
    </footer>
  );
}

/** شريط سفلي على الهاتف يظهر بعد تجاوز الواجهة الأولى. */
function MobileStickyBar({ user, subjects }) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const onScroll = () => setShown(window.scrollY > 500);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const prices = subjects.map((s) => Number(s.price)).filter((p) => Number.isFinite(p) && p > 0);
  const minPrice = prices.length ? Math.min(...prices) : null;

  return (
    <div
      className={`sm:hidden fixed bottom-0 inset-x-0 z-40 p-3 flex items-center justify-between gap-3 bg-lp-bg/95 backdrop-blur-lg border-t border-lp-line shadow-lg transition-transform duration-300 ${
        shown ? 'translate-y-0' : 'translate-y-full'
      }`}
      aria-hidden={!shown}
    >
      <div>
        <span className="block text-xs font-bold">{user ? 'أكمل تدريبك' : 'مستعد للبدء؟'}</span>
        {minPrice !== null && (
          <span className="text-[11px] text-lp-primaryInk">الاشتراك يبدأ من {minPrice} دينار</span>
        )}
      </div>
      <Link
        to={user ? '/app' : '/register'}
        tabIndex={shown ? 0 : -1}
        className="lp-btn-primary px-5 py-2.5 text-xs"
      >
        {user ? 'لوحتي' : 'أنشئ حسابك مجاناً'}
      </Link>
    </div>
  );
}
