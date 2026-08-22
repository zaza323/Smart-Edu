import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FullPageLoader } from './ui';

/** يمنع الوصول لصفحات الطالب قبل تسجيل الدخول. */
export function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullPageLoader text="جارٍ التحقق من الحساب..." />;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  return children;
}

/**
 * يمنع الوصول للوحة الإدارة لغير الأدمن.
 * ملاحظة أمنية: هذا إخفاء واجهة فقط — الحماية الفعلية في Security Rules
 * و`requireAdmin` داخل Cloud Functions (قسم 9 من الـ PRD).
 */
export function RequireAdmin({ children }) {
  const { user, isAdmin, loading } = useAuth();

  if (loading) return <FullPageLoader text="جارٍ التحقق من الصلاحيات..." />;
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/app" replace />;
  return children;
}
