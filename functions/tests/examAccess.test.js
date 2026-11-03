/**
 * اختبار بوابة المعاينة المجانية — الدرس الأول وحده متاح بلا اشتراك.
 * يركّز على محاولات الالتفاف: نطاق أوسع، درس آخر، أنماط المراجعة، واشتراك منتهٍ.
 *
 * التشغيل:  node tests/examAccess.test.js
 */

const { examAccessDecision, freePreviewLesson } = require('../lib/examAccess');

let failures = 0;
const pass = (m) => console.log('  ✅ ' + m);
const fail = (m) => { console.log('  ❌ ' + m); failures += 1; };
const check = (cond, ok, bad) => (cond ? pass(ok) : fail(bad));

const NOW = 1_700_000_000_000;
const ts = (ms) => ({ toMillis: () => ms });

// المادة: دروسها تبدأ من 3 عمداً — «أول درس» هو أصغر رقم لا الرقم 1
const subjectData = { lessons: [{ number: 5 }, { number: 3 }, { number: 9 }] };
const SUBJECT = 'islamic';

const decide = (overrides) =>
  examAccessDecision({
    user: { subscriptions: {} },
    subjectId: SUBJECT,
    mode: 'normal',
    lessonNumbers: [3],
    subjectData,
    now: NOW,
    ...overrides,
  });

console.log('\nرقم درس المعاينة');
check(freePreviewLesson(subjectData) === 3, 'أصغر رقم درس هو درس المعاينة', 'رقم درس المعاينة خاطئ');
check(freePreviewLesson({ lessons: [] }) === null, 'مادة بلا دروس ⇒ لا معاينة', 'مادة بلا دروس يجب ألا تُعاين');
check(freePreviewLesson(null) === null, 'مادة غير موجودة ⇒ لا معاينة', 'مادة غير موجودة يجب ألا تُعاين');

console.log('\nالوصول الكامل');
check(
  decide({ user: { role: 'admin' } }).access === 'full',
  'الأدمن يصل لكل شيء',
  'الأدمن يجب أن يصل لكل شيء'
);
check(
  decide({
    user: { subscriptions: { [SUBJECT]: { status: 'active' } } },
    lessonNumbers: null,
  }).access === 'full',
  'المشترك الفعّال يأخذ كل الدروس',
  'المشترك الفعّال يجب أن يأخذ كل الدروس'
);
check(
  decide({
    user: { subscriptions: { [SUBJECT]: { status: 'active', expiresAt: ts(NOW + 1000) } } },
    lessonNumbers: null,
  }).access === 'full',
  'اشتراك لم ينتهِ بعد يبقى كاملاً',
  'اشتراك ساري يجب أن يبقى كاملاً'
);

console.log('\nالمعاينة المجانية المسموحة');
check(decide({}).access === 'preview', 'غير مشترك + الدرس الأول ⇒ معاينة', 'الدرس الأول يجب أن يُعاين');
check(
  decide({ user: { subscriptions: { [SUBJECT]: { status: 'pending' } } } }).access === 'preview',
  'طلب قيد المراجعة يبقى له حق المعاينة',
  'قيد المراجعة يجب أن يُعاين'
);
const expiredSub = {
  user: { subscriptions: { [SUBJECT]: { status: 'active', expiresAt: ts(NOW - 1000) } } },
};
check(
  decide(expiredSub).access === 'preview' && decide(expiredSub).expired === true,
  'اشتراك منتهٍ ⇒ معاينة فقط مع تعليمه منتهياً',
  'الاشتراك المنتهي يجب أن يُعلَّم ويُحصر بالمعاينة'
);
check(
  decide({ ...expiredSub, lessonNumbers: [5] }).access === 'denied' &&
    decide({ ...expiredSub, lessonNumbers: [5] }).expired === true,
  'اشتراك منتهٍ + درس آخر ⇒ رفض',
  'الاشتراك المنتهي يجب أن يُرفض خارج الدرس الأول'
);

console.log('\nمحاولات الالتفاف — كلها تُرفض');
const denied = (label, overrides) =>
  check(decide(overrides).access === 'denied', label, `ثغرة: ${label}`);

denied('كل الدروس (lessonNumbers = null)', { lessonNumbers: null });
denied('درس آخر وحده', { lessonNumbers: [5] });
denied('الدرس الأول + درس آخر', { lessonNumbers: [3, 5] });
denied('درس غير موجود', { lessonNumbers: [99] });
denied('مصفوفة فارغة', { lessonNumbers: [] });
denied('نمط مراجعة الأخطاء', { mode: 'mistakes' });
denied('نمط الأسئلة المحفوظة', { mode: 'saved' });
denied('نمط مراجعة الأخطاء بالدرس الأول', { mode: 'mistakes', lessonNumbers: [3] });
denied('اشتراك منتهٍ الصلاحية بكل الدروس', {
  user: { subscriptions: { [SUBJECT]: { status: 'expired' } } },
  lessonNumbers: null,
});
denied('اشتراك مادة أخرى لا يفتح هذه المادة', {
  user: { subscriptions: { arabic: { status: 'active' } } },
  lessonNumbers: null,
});
denied('مادة بلا دروس', { subjectData: { lessons: [] } });

console.log(
  failures === 0 ? '\n✅ كل اختبارات بوابة المعاينة نجحت\n' : `\n❌ فشل ${failures} اختباراً\n`
);
process.exit(failures === 0 ? 0 : 1);
