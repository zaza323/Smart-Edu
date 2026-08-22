import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { applyTheme, persistTheme, resolveTheme, storedTheme, systemTheme } from '../lib/theme';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => resolveTheme());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // ما دام المستخدم لم يختر يدوياً، نتابع تغيّر إعداد نظام التشغيل مباشرة
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const media = window.matchMedia('(prefers-color-scheme: light)');
    const onChange = () => {
      if (!storedTheme()) setTheme(systemTheme());
    };
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const toggle = useCallback(() => {
    setTheme((current) => {
      const next = current === 'light' ? 'dark' : 'light';
      persistTheme(next); // الاختيار اليدوي له أولوية دائمة بعد أول تدخّل
      return next;
    });
  }, []);

  const value = useMemo(() => ({ theme, toggle, isLight: theme === 'light' }), [theme, toggle]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme يجب أن يُستخدم داخل ThemeProvider');
  return ctx;
}
