import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

/**
 * زر تبديل الوضع الفاتح/الداكن.
 * variant='button' → مطابق لأزرار شريط التنقّل.
 * variant='floating' → دائرة عائمة للصفحات التي لا شريط تنقّل فيها (الدخول/التسجيل).
 */
export default function ThemeToggle({ variant = 'button', className = '' }) {
  const { isLight, toggle } = useTheme();
  const label = isLight ? 'التبديل إلى الوضع الداكن' : 'التبديل إلى الوضع الفاتح';
  const Icon = isLight ? Moon : Sun;

  if (variant === 'floating') {
    return (
      <button
        onClick={toggle}
        title={label}
        aria-label={label}
        className={`fixed top-4 left-4 z-50 w-11 h-11 rounded-full grid place-items-center
                    bg-surface border border-zinc-700 text-zinc-300 shadow-lg
                    transition hover:border-accent hover:text-accent ${className}`}
      >
        <Icon className="w-5 h-5" />
      </button>
    );
  }

  return (
    <button
      onClick={toggle}
      title={label}
      aria-label={label}
      className={`btn btn-ghost btn-sm !px-2.5 ${className}`}
    >
      <Icon className="w-4 h-4" />
    </button>
  );
}
