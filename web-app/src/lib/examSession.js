/**
 * حفظ حالة الاختبار محلياً (قسم 10 من الـ PRD):
 * "تجربة اختبار لا تفقد إجابات الطالب عند انقطاع الاتصال المؤقت".
 *
 * نستخدم localStorage لا sessionStorage حتى تنجو الإجابات من إغلاق التبويب
 * أو إعادة تحميل الصفحة. لا تُخزَّن أي إجابة صحيحة هنا — الخادم وحده يعرفها.
 */

const PREFIX = 'sep_exam_';
const MAX_AGE_MS = 6 * 60 * 60 * 1000; // 6 ساعات

export function saveExamSession(attemptId, data) {
  try {
    localStorage.setItem(PREFIX + attemptId, JSON.stringify({ ...data, savedAt: Date.now() }));
  } catch {
    /* الذاكرة ممتلئة أو الوضع الخاص — نتجاهل */
  }
}

export function loadExamSession(attemptId) {
  try {
    const raw = localStorage.getItem(PREFIX + attemptId);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data.savedAt || Date.now() - data.savedAt > MAX_AGE_MS) {
      clearExamSession(attemptId);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export function clearExamSession(attemptId) {
  try {
    localStorage.removeItem(PREFIX + attemptId);
  } catch {
    /* تجاهل */
  }
}

/** تنظيف أي جلسات اختبار قديمة متروكة. */
export function pruneExamSessions() {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(PREFIX)) continue;
      const data = JSON.parse(localStorage.getItem(key) || '{}');
      if (!data.savedAt || Date.now() - data.savedAt > MAX_AGE_MS) localStorage.removeItem(key);
    }
  } catch {
    /* تجاهل */
  }
}
