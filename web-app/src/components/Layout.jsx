import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  BookOpenCheck,
  ClipboardList,
  Trophy,
  CreditCard,
  Database,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  ShieldCheck,
  User,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import ThemeToggle from './ThemeToggle';

const studentLinks = [
  { to: '/app', label: 'المواد', icon: BookOpenCheck, end: true },
  { to: '/app/leaderboard', label: 'لوحة الأبطال', icon: Trophy },
  { to: '/app/history', label: 'سجل محاولاتي', icon: ClipboardList },
  { to: '/app/account', label: 'حسابي', icon: User },
];

const adminLinks = [
  { to: '/admin', label: 'نظرة عامة', icon: LayoutDashboard, end: true },
  { to: '/admin/payments', label: 'طلبات الدفع', icon: CreditCard },
  { to: '/admin/students', label: 'الطلاب', icon: Users },
  { to: '/admin/questions', label: 'الأسئلة', icon: Database },
  { to: '/admin/subjects', label: 'المواد والأسعار', icon: GraduationCap },
  { to: '/admin/stats', label: 'إحصائيات الأداء', icon: ClipboardList },
];

export default function Layout({ variant = 'student' }) {
  const { profile, isAdmin, logout, user } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const links = variant === 'admin' ? adminLinks : studentLinks;

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="min-h-screen flex flex-col bg-base">
      <header className="sticky top-0 z-40 bg-base/90 backdrop-blur border-b border-zinc-800">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
          <Link
            to={variant === 'admin' ? '/admin' : '/app'}
            className="flex items-center gap-3 shrink-0"
          >
            <img src="/logo.png" alt="Smart Edu Pro" className="brand-logo h-9" />
            {/* اسم القسم يظهر على الشاشات الواسعة فقط — يوفّر مساحة لعناصر التنقّل */}
            <span className="font-extrabold text-accent hidden lg:block whitespace-nowrap">
              {variant === 'admin' ? 'لوحة الإدارة' : 'بنك الأسئلة'}
            </span>
          </Link>

          {/* min-w-0 + overflow-x-auto: لو ضاقت المساحة ينزلق الشريط أفقياً
              بدل أن تُضغط العناصر ويلتفّ نصّها على سطرين */}
          <nav className="hidden md:flex items-center gap-1 min-w-0 overflow-x-auto nav-scroll rounded-full border border-zinc-800 bg-surface/90 p-1">
            {links.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${
                    isActive
                      ? 'bg-brandFill text-white shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-100'
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <ThemeToggle />
            {isAdmin && variant === 'student' && (
              <Link to="/admin" className="btn btn-ghost btn-sm hidden sm:inline-flex">
                <ShieldCheck className="w-4 h-4" />
                الإدارة
              </Link>
            )}
            {isAdmin && variant === 'admin' && (
              <Link to="/app" className="btn btn-ghost btn-sm hidden sm:inline-flex">
                <BookOpenCheck className="w-4 h-4" />
                واجهة الطالب
              </Link>
            )}
            <button onClick={handleLogout} className="btn btn-ghost btn-sm" title="تسجيل الخروج">
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">خروج</span>
            </button>
            <button
              className="md:hidden btn btn-ghost btn-sm"
              onClick={() => setOpen((v) => !v)}
              aria-label="القائمة"
            >
              {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {open && (
          <nav className="md:hidden border-t border-zinc-800 bg-surface px-4 py-3 flex flex-col gap-1">
            {links.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-3 rounded-lg font-semibold ${
                    isActive ? 'bg-accent/10 text-accent' : 'text-zinc-300 hover:bg-zinc-800'
                  }`
                }
              >
                <Icon className="w-5 h-5" />
                {label}
              </NavLink>
            ))}
            {isAdmin && (
              <NavLink
                to={variant === 'admin' ? '/app' : '/admin'}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-3 py-3 rounded-lg font-semibold text-zinc-300 hover:bg-zinc-800"
              >
                <ShieldCheck className="w-5 h-5" />
                {variant === 'admin' ? 'واجهة الطالب' : 'لوحة الإدارة'}
              </NavLink>
            )}
          </nav>
        )}
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6 animate-fadeIn">
        <Outlet />
      </main>

      <footer className="border-t border-zinc-800 py-5 text-center text-xs text-zinc-600">
        <p>
          {profile?.fullName || user?.email} — Smart Edu Pro &copy; {new Date().getFullYear()}
        </p>
      </footer>
    </div>
  );
}
