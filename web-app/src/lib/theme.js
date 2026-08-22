/**
 * إدارة الوضع الفاتح/الداكن.
 *
 * الأولوية: اختيار المستخدم اليدوي (localStorage) ثم تفضيل نظام التشغيل.
 * الكتابة الفعلية على <html data-theme> تحدث أيضاً في سكربت مضمّن داخل
 * index.html يعمل قبل تحميل React، حتى لا تومض الصفحة بلون خاطئ عند الفتح.
 */

export const THEME_KEY = 'sep_theme';

export function systemTheme() {
  return typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-color-scheme: light)').matches
    ? 'light'
    : 'dark';
}

/** الاختيار اليدوي المحفوظ، أو null إن لم يتدخّل المستخدم بعد. */
export function storedTheme() {
  try {
    const value = localStorage.getItem(THEME_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}

export function resolveTheme() {
  return storedTheme() || systemTheme();
}

export function applyTheme(theme) {
  const value = theme === 'light' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', value);
  // لون شريط المتصفح على الهاتف يتبع الوضع أيضاً
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', value === 'light' ? '#faf8f3' : '#18181b');
  return value;
}

export function persistTheme(theme) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* الوضع الخاص أو ذاكرة ممتلئة — التبديل يبقى فعّالاً لهذه الجلسة */
  }
}
