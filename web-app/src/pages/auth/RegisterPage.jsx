import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { authErrorMessage } from '../../lib/firebase';
import { Alert, Spinner } from '../../components/ui';
import ThemeToggle from '../../components/ThemeToggle';
import { DEFAULT_GRADE, GRADES } from '../../lib/grades';

const PHONE_RE = /^(07\d{8}|\+9627\d{8})$/;

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    email: '',
    grade: DEFAULT_GRADE,
    password: '',
    confirm: '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function validate() {
    if (form.fullName.trim().length < 3) return 'الرجاء إدخال الاسم الكامل.';
    if (!PHONE_RE.test(form.phone.trim()))
      return 'رقم الهاتف غير صحيح — الصيغة المتوقعة: 07XXXXXXXX';
    if (form.password.length < 6) return 'كلمة المرور يجب أن تكون 6 أحرف على الأقل.';
    if (form.password !== form.confirm) return 'كلمتا المرور غير متطابقتين.';
    return '';
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setError('');
    setBusy(true);
    try {
      await register(form);
      navigate('/app', { replace: true });
    } catch (err) {
      setError(authErrorMessage(err.code));
    } finally {
      setBusy(false);
    }
  }

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  return (
    <div className="min-h-screen grid place-items-center px-4 py-10">
      <ThemeToggle variant="floating" />
      <div className="w-full max-w-md">
        <Link to="/" className="flex flex-col items-center gap-3 mb-8">
          <img src="/logo.png" alt="Smart Edu Pro" className="brand-logo h-16" />
          <h1 className="text-2xl font-extrabold text-accent">بنك الأسئلة التفاعلي</h1>
        </Link>

        <form onSubmit={handleSubmit} className="card p-6 sm:p-8 space-y-4">
          <div>
            <h2 className="text-xl font-bold">إنشاء حساب طالب جديد</h2>
            <p className="text-zinc-500 text-sm mt-1">
              التسجيل مجاني — تفعيل المواد يتم بعد رفع إثبات الدفع
            </p>
          </div>

          <Alert type="error">{error}</Alert>

          <div>
            <label className="label" htmlFor="fullName">
              الاسم الكامل
            </label>
            <input
              id="fullName"
              className="field"
              required
              value={form.fullName}
              onChange={set('fullName')}
              placeholder="مثال: محمد أحمد الزعبي"
            />
          </div>

          <div>
            <label className="label" htmlFor="phone">
              رقم الهاتف
            </label>
            <input
              id="phone"
              dir="ltr"
              className="field text-left"
              required
              value={form.phone}
              onChange={set('phone')}
              placeholder="07XXXXXXXX"
            />
          </div>

          <div>
            <label className="label" htmlFor="email">
              البريد الإلكتروني
            </label>
            <input
              id="email"
              type="email"
              dir="ltr"
              className="field text-left"
              required
              autoComplete="email"
              value={form.email}
              onChange={set('email')}
              placeholder="student@example.com"
            />
          </div>

          <div>
            <label className="label" htmlFor="grade">
              الصف الدراسي
            </label>
            <select id="grade" className="field" required value={form.grade} onChange={set('grade')}>
              {GRADES.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
            <p className="text-xs text-zinc-500 mt-1.5">
              يظهر بجانب اسمك في لوحة الأبطال.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label" htmlFor="password">
                كلمة المرور
              </label>
              <input
                id="password"
                type="password"
                className="field"
                required
                autoComplete="new-password"
                value={form.password}
                onChange={set('password')}
                placeholder="6 أحرف فأكثر"
              />
            </div>
            <div>
              <label className="label" htmlFor="confirm">
                تأكيد كلمة المرور
              </label>
              <input
                id="confirm"
                type="password"
                className="field"
                required
                autoComplete="new-password"
                value={form.confirm}
                onChange={set('confirm')}
              />
            </div>
          </div>

          <button type="submit" disabled={busy} className="btn-primary w-full !mt-6">
            {busy ? <Spinner className="w-5 h-5 on-accent" /> : <UserPlus className="w-5 h-5" />}
            إنشاء الحساب
          </button>

          <p className="text-center text-sm text-zinc-400 pt-1">
            لديك حساب بالفعل؟{' '}
            <Link to="/login" className="text-accent font-bold hover:text-accentHover">
              سجّل الدخول
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
