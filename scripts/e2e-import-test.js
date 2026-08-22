/**
 * اختبار مسار استيراد ملف Word كاملاً كما يحدث من لوحة الأدمن:
 * إنشاء سجل استيراد → رفع الملف إلى Storage → انتظار المشغّل → التحقق من النتيجة.
 *
 * يستخدم مادة تجريبية مستقلة ثم يحذفها هي وأسئلتها، فلا يمسّ بياناتك الحقيقية.
 */
const path = require('path');
const admin = require('firebase-admin');

const BUCKET = 'smart-edu-pro-d012b.firebasestorage.app';
const SUBJECT = 'e2e-import-test-subject';
const DOCX = path.join(__dirname, '..', 'functions', 'tests', 'sample.docx');

admin.initializeApp({
  credential: admin.credential.cert(require('./serviceAccountKey.json')),
  storageBucket: BUCKET,
});
const db = admin.firestore();

const pass = (m) => console.log('  ✅ ' + m);
const fail = (m) => { console.log('  ❌ ' + m); process.exitCode = 1; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForJob(jobId, timeoutMs = 180000) {
  const started = Date.now();
  let last = '';
  while (Date.now() - started < timeoutMs) {
    const snap = await db.doc(`importJobs/${jobId}`).get();
    const job = snap.data();
    if (job && job.status !== last) {
      console.log(`    … الحالة: ${job.status}`);
      last = job.status;
    }
    if (job && (job.status === 'done' || job.status === 'failed')) return job;
    await sleep(3000);
  }
  return null;
}

async function main() {
  const jobId = `${SUBJECT}_${Date.now()}`;
  const filePath = `imports/${SUBJECT}/${jobId}.docx`;
  try {
    console.log('\n[0] تجهيز مادة تجريبية');
    await db.doc(`subjects/${SUBJECT}`).set({
      name: 'مادة اختبار الاستيراد',
      grade: 'الحادي عشر',
      semester: 'الفصل الأول',
      price: 0,
      minutesPerQuestion: 1,
      active: false, // مخفية عن الطلاب
      displayOrder: 999,
    });
    pass('أُنشئت المادة التجريبية (مخفية عن الطلاب)');

    console.log('\n[1] إنشاء سجل الاستيراد ورفع الملف (كما تفعل الواجهة)');
    await db.doc(`importJobs/${jobId}`).set({
      subjectId: SUBJECT,
      subjectName: 'مادة اختبار الاستيراد',
      fileName: 'sample.docx',
      status: 'uploading',
      importedCount: 0,
      duplicateCount: 0,
      warnings: [],
      startedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await admin.storage().bucket().upload(DOCX, {
      destination: filePath,
      metadata: {
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        metadata: { jobId, subjectId: SUBJECT, originalName: 'sample.docx' },
      },
    });
    pass('رُفع الملف — بانتظار التقاط المشغّل...');

    console.log('\n[2] متابعة سجل الاستيراد لحظياً');
    const job = await waitForJob(jobId);
    if (!job) return fail('انتهت المهلة دون أن يكمل المشغّل — راجع سجلات الدالة.');
    if (job.status === 'failed') return fail(`فشل الاستيراد: ${job.error}`);
    pass(`اكتمل: ${job.importedCount} مستورد، ${job.duplicateCount} مكرر، ${(job.warnings || []).length} تحذير`);

    console.log('\n[3] التحقق من صحة النتائج');
    // الملف الاصطناعي يحوي 7 أسئلة: 3 سليمة و4 معطوبة عمداً
    job.importedCount === 3
      ? pass('استورد 3 أسئلة سليمة فقط (رفض الأربعة المعطوبة)')
      : fail(`عدد غير متوقع: ${job.importedCount}`);
    (job.warnings || []).length === 4
      ? pass('4 تحذيرات صريحة للأسئلة المرفوضة')
      : fail(`عدد التحذيرات: ${(job.warnings || []).length}`);

    const written = await db.collection('questions').where('subjectId', '==', SUBJECT).get();
    written.size === 3
      ? pass(`كُتبت 3 أسئلة فعلياً في Firestore`)
      : fail(`عدد المكتوب: ${written.size}`);

    const one = written.docs.map((d) => d.data()).find((q) => q.questionNumber === 1);
    one && one.correctAnswerIndex === 1 && one.lessonNumber === 3
      ? pass('الإجابة الصحيحة ورقم الدرس مقروءان من الملف بدقة')
      : fail(`بيانات خاطئة: ${JSON.stringify(one).slice(0, 160)}`);
    one && one.grade === 'الحادي عشر' && one.subject === 'مادة اختبار الاستيراد'
      ? pass('المادة والصف مأخوذان من مستند المادة لا من الملف')
      : fail('لم تُربط بيانات المادة');

    const subj = (await db.doc(`subjects/${SUBJECT}`).get()).data();
    subj.questionCount === 3 && (subj.lessons || []).length === 1
      ? pass(`مستند المادة حُدِّث: ${subj.questionCount} سؤال، الدرس ${subj.lessons[0].number} «${subj.lessons[0].title}»`)
      : fail(`مستند المادة لم يُحدَّث: ${JSON.stringify(subj.lessons)}`);

    console.log('\n[4] إعادة رفع نفس الملف → يجب تجاهل كل الأسئلة كمكررة');
    const jobId2 = `${SUBJECT}_${Date.now()}_again`;
    await db.doc(`importJobs/${jobId2}`).set({
      subjectId: SUBJECT, fileName: 'sample.docx', status: 'uploading',
      startedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    await admin.storage().bucket().upload(DOCX, {
      destination: `imports/${SUBJECT}/${jobId2}.docx`,
      metadata: { metadata: { jobId: jobId2, subjectId: SUBJECT, originalName: 'sample.docx' } },
    });
    const job2 = await waitForJob(jobId2);
    if (!job2 || job2.status !== 'done') return fail('فشلت إعادة الاستيراد');
    job2.importedCount === 0 && job2.duplicateCount === 3
      ? pass('0 مستورد، 3 مكررة — منع التكرار يعمل')
      : fail(`نتيجة غير متوقعة: ${job2.importedCount} مستورد، ${job2.duplicateCount} مكرر`);

    const after = await db.collection('questions').where('subjectId', '==', SUBJECT).get();
    after.size === 3 ? pass('عدد الأسئلة ما زال 3 — لم يتضاعف') : fail(`تضاعفت: ${after.size}`);
  } finally {
    console.log('\n[تنظيف]');
    const qs = await db.collection('questions').where('subjectId', '==', SUBJECT).get();
    for (const d of qs.docs) await d.ref.delete();
    const jobs = await db.collection('importJobs').where('subjectId', '==', SUBJECT).get();
    for (const d of jobs.docs) await d.ref.delete();
    await db.doc(`subjects/${SUBJECT}`).delete().catch(() => {});
    const [files] = await admin.storage().bucket().getFiles({ prefix: `imports/${SUBJECT}/` });
    for (const f of files) await f.delete().catch(() => {});
    console.log(`  ✅ حُذفت المادة التجريبية و${qs.size} سؤال و${files.length} ملف`);
  }
}

main().catch((e) => { console.error('فشل:', e.message); process.exitCode = 1; });
