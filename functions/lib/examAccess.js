/**
 * قرار صلاحية بدء اختبار — دالة خالصة بلا أي وصول لقاعدة البيانات أو لـ Firebase،
 * حتى تُختبر وحدها (tests/examAccess.test.js). القراءة من Firestore والكتابة
 * عليها تبقى في index.js؛ هنا القرار فقط.
 *
 * المعاينة المجانية: أي طالب مسجَّل يجرّب الدرس الأول من أي مادة دون اشتراك.
 * شروطها الثلاثة مجتمعة — وأي طلب لا يحققها كلها يُرفض، فلا يصل الطالب لدرس
 * ثانٍ دون دفع:
 *   1) نمط عادي ('normal') — لا مراجعة أخطاء ولا أسئلة محفوظة، فهذان النمطان
 *      يختاران الأسئلة بمعرّفاتها لا بنطاق الدروس.
 *   2) درس واحد بالضبط، وهو أصغر رقم درس في المادة.
 *   3) عدد الأسئلة يُقصّ على السقف في index.js بعد عودة هذا القرار.
 */

/** رقم أول درس في المادة — هو وحده المتاح في المعاينة المجانية. */
function freePreviewLesson(subjectData) {
  const numbers = (subjectData?.lessons || [])
    .map((l) => Number(l.number))
    .filter((n) => Number.isFinite(n));
  return numbers.length > 0 ? Math.min(...numbers) : null;
}

/**
 * @returns {{access:'full'}}
 *        | {{access:'preview', previewLesson:number}}
 *        | {{access:'denied', expired:boolean, previewLesson:number|null}}
 */
function examAccessDecision({ user, subjectId, mode, lessonNumbers, subjectData, now = Date.now() }) {
  if (user?.role === 'admin') return { access: 'full' };

  const sub = (user?.subscriptions || {})[subjectId];
  const expiresMs = typeof sub?.expiresAt?.toMillis === 'function' ? sub.expiresAt.toMillis() : null;
  const expired = Boolean(sub?.status === 'active' && expiresMs !== null && expiresMs < now);
  if (sub?.status === 'active' && !expired) return { access: 'full' };

  const previewLesson = freePreviewLesson(subjectData);
  const firstLessonOnly =
    previewLesson !== null &&
    Array.isArray(lessonNumbers) &&
    lessonNumbers.length === 1 &&
    lessonNumbers[0] === previewLesson;

  // `expired` يُعاد مع المعاينة أيضاً: الاشتراك المنتهي يجب أن يُعلَّم في
  // مستند الطالب حتى لو سُمح له بمعاينة الدرس الأول
  if (mode === 'normal' && firstLessonOnly) return { access: 'preview', expired, previewLesson };
  return { access: 'denied', expired, previewLesson };
}

module.exports = { examAccessDecision, freePreviewLesson };
