import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, Menu, Moon, Sun, X } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

const NAV_LINKS = [
  { href: '#features', label: 'المزايا' },
  { href: '#demo', label: 'جرّب بنفسك' },
  { href: '#subjects', label: 'المواد والأسعار' },
  { href: '#steps', label: 'كيف تشترك' },
  { href: '#faq', label: 'الأسئلة الشائعة' },
];

/** شريط علوي ثابت بزجاج شفاف، مع قائمة منسدلة على الهاتف. */
export default function LandingHeader({ user }) {
  const { isLight, toggle } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const ThemeIcon = isLight ? Moon : Sun;
  const themeLabel = isLight ? 'التبديل إلى الوضع الداكن' : 'التبديل إلى الوضع الفاتح';

  return (
    <header className="fixed top-0 inset-x-0 z-50 bg-lp-bg/85 backdrop-blur-md border-b border-lp-line">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-3">
        <a href="#top" className="lp-focus flex items-center gap-3 rounded-xl p-1 shrink-0">
          <img src="/logo.png" alt="Smart Edu Pro" className="brand-logo h-9 sm:h-10" />
          <span className="hidden sm:flex flex-col">
            <span className="font-extrabold text-lg flex items-center gap-1.5">
              Smart Edu Pro
              <span className="lp-pill !px-1.5 !py-0 !text-[10px]">توجيهي</span>
            </span>
            <span className="text-xs text-lp-muted">بنك الأسئلة التفاعلي</span>
          </span>
        </a>

        <nav className="hidden lg:flex items-center gap-7 text-sm font-semibold text-lp-muted">
          {NAV_LINKS.map((link) => (
            <a key={link.href} href={link.href} className="hover:text-lp-primaryInk transition-colors">
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={toggle}
            title={themeLabel}
            aria-label={themeLabel}
            className="lp-focus w-10 h-10 rounded-full grid place-items-center border border-lp-line bg-lp-raised/60 text-lp-muted hover:text-lp-primaryInk transition-colors"
          >
            <ThemeIcon className="w-5 h-5" />
          </button>

          {user ? (
            <Link to="/app" className="lp-btn-primary px-5 min-h-[44px] text-sm">
              لوحتي
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                className="lp-focus hidden sm:inline-block rounded-lg px-3 py-2 text-sm font-semibold hover:text-lp-primaryInk transition-colors"
              >
                دخول
              </Link>
              <Link to="/register" className="lp-btn-primary px-4 sm:px-5 min-h-[44px] text-sm">
                <span className="sm:hidden">إنشاء حساب</span>
                <span className="hidden sm:inline">إنشاء حساب مجاني</span>
              </Link>
            </>
          )}

          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? 'إغلاق القائمة' : 'فتح القائمة'}
            aria-expanded={menuOpen}
            aria-controls="lp-mobile-menu"
            className="lp-focus lg:hidden w-10 h-10 rounded-lg grid place-items-center text-lp-muted hover:text-lp-ink"
          >
            {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav
          id="lp-mobile-menu"
          className="lg:hidden px-6 pt-2 pb-5 border-t border-lp-line bg-lp-bg/95 flex flex-col gap-1 font-semibold text-lp-muted"
        >
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="py-2.5 hover:text-lp-primaryInk"
            >
              {link.label}
            </a>
          ))}
          {!user && (
            <>
              <hr className="border-lp-line my-2" />
              <Link to="/login" className="py-2.5 text-lp-ink flex items-center justify-between hover:text-lp-primaryInk">
                تسجيل الدخول
                <ChevronLeft className="w-4 h-4" />
              </Link>
            </>
          )}
        </nav>
      )}
    </header>
  );
}
