import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { authErrorMessage } from '../../lib/firebase';
import { Alert, Spinner } from '../../components/ui';
import ThemeToggle from '../../components/ThemeToggle';

export default function LoginPage() {
  const { login, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!authLoading && user) {
      navigate(location.state?.from || '/app', { replace: true });
    }
  }, [user, authLoading, navigate, location.state]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(form.email, form.password);
      navigate(location.state?.from || '/app', { replace: true });
    } catch (err) {
      setError(authErrorMessage(err.code));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center px-4 py-10">
      <ThemeToggle variant="floating" />
      <div className="w-full max-w-md">
        <Link to="/" className="flex flex-col items-center gap-3 mb-8">
          <img src="/logo.png" alt="Smart Edu Pro" className="brand-logo h-16" />
          <h1 className="text-2xl font-extrabold text-accent">بنك الأسئلة التفاعلي</h1>
        </Link>

        <form onSubmit={handleSubmit} className="card p-6 sm:p-8 space-y-5">
          <div>
            <h2 className="text-xl font-bold">تسجيل دخول الطالب</h2>
            <p className="text-zinc-500 text-sm mt-1">أدخل بياناتك للمتابعة إلى بنك الأسئلة</p>
          </div>

          <Alert type="error">{error}</Alert>

          <div>
            <label className="label" htmlFor="email">
              البريد الإلكتروني
            </label>
            <input
              id="email"
              type="email"
              dir="ltr"
              required
              autoComplete="email"
              className="field text-left"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="student@example.com"
            />
          </div>

          <div>
            <label className="label" htmlFor="password">
              كلمة المرور
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPass ? 'text' : 'password'}
                required
                autoComplete="current-password"
                className="field pl-12"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-accent"
                aria-label="إظهار كلمة المرور"
              >
                {showPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <button type="submit" disabled={busy} className="btn-primary w-full">
            {busy ? <Spinner className="w-5 h-5 on-accent" /> : <LogIn className="w-5 h-5" />}
            دخول
          </button>

          <div className="flex items-center justify-between text-sm pt-1">
            <Link to="/forgot-password" className="text-zinc-400 hover:text-accent">
              نسيت كلمة المرور؟
            </Link>
            <Link to="/register" className="text-accent font-bold hover:text-accentHover">
              إنشاء حساب جديد
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
