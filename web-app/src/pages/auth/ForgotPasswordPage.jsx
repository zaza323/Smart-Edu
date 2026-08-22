import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, MailCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { authErrorMessage } from '../../lib/firebase';
import { Alert, Spinner } from '../../components/ui';
import ThemeToggle from '../../components/ThemeToggle';

export default function ForgotPasswordPage() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await resetPassword(email);
      setSent(true);
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
        </Link>

        <form onSubmit={handleSubmit} className="card p-6 sm:p-8 space-y-5">
          <div>
            <h2 className="text-xl font-bold">استرجاع كلمة المرور</h2>
            <p className="text-zinc-500 text-sm mt-1">
              أدخل بريدك الإلكتروني وسنرسل لك رابط إعادة التعيين
            </p>
          </div>

          <Alert type="error">{error}</Alert>
          {sent && (
            <Alert type="success">
              تم إرسال رابط إعادة التعيين إلى بريدك. تفقّد صندوق الوارد (وأيضاً مجلد الرسائل
              المزعجة Spam).
            </Alert>
          )}

          <div>
            <label className="label" htmlFor="email">
              البريد الإلكتروني
            </label>
            <input
              id="email"
              type="email"
              dir="ltr"
              required
              className="field text-left"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="student@example.com"
            />
          </div>

          <button type="submit" disabled={busy || sent} className="btn-primary w-full">
            {busy ? <Spinner className="w-5 h-5 on-accent" /> : <MailCheck className="w-5 h-5" />}
            إرسال الرابط
          </button>

          <Link
            to="/login"
            className="flex items-center justify-center gap-2 text-sm text-zinc-400 hover:text-accent"
          >
            <ArrowRight className="w-4 h-4" />
            العودة لتسجيل الدخول
          </Link>
        </form>
      </div>
    </div>
  );
}
