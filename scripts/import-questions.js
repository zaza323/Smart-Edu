/**
 * استيراد أسئلة من ملف JSON جاهز إلى Firestore.
 *
 * ملفات Word تُستورد من لوحة الأدمن مباشرة (مشغّل processQuestionImport)؛
 * هذا السكربت لملفات JSON فقط — مثل دفعة أسئلة جاهزة من مصدر آخر.
 *
 * الحقول الناقصة (docId، random، رقم الدرس) تُحتسب تلقائياً من معطيات سطر الأوامر.
 *
 * الاستخدام:
 *   node import-questions.js ../../questions_sample.json --subject-id islamic-11-s1 \
 *        --lesson-number 1 --cohort-year 2010
 *   node import-questions.js data.json --subject-id islamic-11-s1 --dry-run
 *   node import-questions.js data.json --subject-id islamic-11-s1 --overwrite
 *
 * المتطلبات: npm install + serviceAccountKey.json داخل هذا المجلد.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const admin = require('firebase-admin');

const KEY_PATH = path.join(__dirname, 'serviceAccountKey.json');
const BATCH_LIMIT = 450;

function arg(name, fallback = undefined) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const hasFlag = (name) => process.argv.includes(`--${name}`);

function normalize(text) {
  return String(text || '')
    .replace(/[ً-ْٰـ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * معرّف حتمي يمنع تكرار السؤال عند إعادة الاستيراد.
 * تُضمَّن نصوص الخيارات في البصمة لأن بنك الوزارة يحتوي أسئلة مختلفة تشترك في
 * نفس نص السؤال وتختلف في الخيارات فقط — الاعتماد على نص السؤال وحده كان يدمجها.
 */
function makeId(subjectId, lessonNumber, questionText, options) {
  const signature = [
    subjectId,
    lessonNumber,
    normalize(questionText),
    (options || []).map(normalize).join('~'),
  ].join('|');
  return crypto.createHash('sha1').update(signature, 'utf8').digest('hex').slice(0, 24);
}

function chunked(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function main() {
  const file = process.argv[2];
  const subjectId = arg('subject-id');

  if (!file || !subjectId) {
    console.error(
      'الاستخدام: node import-questions.js <file.json> --subject-id <id> [--lesson-number N]\n' +
        '           [--subject "الاسم"] [--grade "الصف"] [--semester "الفصل"] [--cohort-year 2010]\n' +
        '           [--dry-run] [--overwrite]'
    );
    process.exit(1);
  }

  if (!fs.existsSync(KEY_PATH)) {
    console.error(`لم يُعثر على مفتاح حساب الخدمة: ${KEY_PATH}`);
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
  if (!Array.isArray(raw) || raw.length === 0) {
    console.error('الملف فارغ أو ليس مصفوفة JSON.');
    process.exit(1);
  }

  const defaults = {
    subject: arg('subject', ''),
    grade: arg('grade', ''),
    semester: arg('semester', ''),
    lessonNumber: arg('lesson-number') ? Number(arg('lesson-number')) : null,
    cohortYear: arg('cohort-year') ? Number(arg('cohort-year')) : null,
  };

  // ---- تطبيع السجلات + التحقق من صحتها ----
  const invalid = [];
  const prepared = [];
  raw.forEach((q, i) => {
    const options = q.optionsText || q.options;
    const idx = q.correctAnswerIndex;
    if (!q.questionText || !Array.isArray(options) || options.length !== 4) {
      invalid.push(`السطر ${i + 1}: نص السؤال أو الخيارات (4) غير مكتملة`);
      return;
    }
    if (!Number.isInteger(idx) || idx < 0 || idx > 3) {
      invalid.push(`السطر ${i + 1}: correctAnswerIndex غير صالح (${idx})`);
      return;
    }
    const lessonNumber =
      q.lessonNumber !== undefined && q.lessonNumber !== null
        ? Number(q.lessonNumber)
        : defaults.lessonNumber;

    prepared.push({
      docId: q.docId || makeId(subjectId, lessonNumber, q.questionText, options),
      data: {
        subjectId,
        subject: q.subject || defaults.subject,
        grade: q.grade || defaults.grade,
        semester: q.semester || defaults.semester,
        lesson: q.lesson || '',
        lessonNumber,
        questionNumber: q.questionNumber ?? null,
        questionText: q.questionText,
        optionsText: options,
        correctAnswerIndex: idx,
        explanation: q.explanation || '',
        difficulty: q.difficulty || 'medium',
        sourceCohortYear: q.sourceCohortYear ?? defaults.cohortYear,
        random: typeof q.random === 'number' ? q.random : Math.random(),
      },
    });
  });

  admin.initializeApp({ credential: admin.credential.cert(require(KEY_PATH)) });
  const db = admin.firestore();

  // ---- كشف الموجود مسبقاً ----
  console.log('جارٍ فحص الأسئلة الموجودة مسبقاً...');
  const existing = new Set();
  for (const chunk of chunked(prepared.map((p) => p.docId), 300)) {
    const refs = chunk.map((id) => db.collection('questions').doc(id));
    const snaps = await db.getAll(...refs);
    snaps.forEach((s) => s.exists && existing.add(s.id));
  }

  const overwrite = hasFlag('overwrite');
  const toWrite = overwrite ? prepared : prepared.filter((p) => !existing.has(p.docId));

  console.log('='.repeat(60));
  console.log(`المادة              : ${subjectId}`);
  console.log(`سجلات الملف         : ${raw.length}`);
  console.log(`صالحة               : ${prepared.length}`);
  console.log(`مرفوضة              : ${invalid.length}`);
  console.log(`موجودة مسبقاً       : ${existing.size}`);
  console.log(`سيتم كتابتها        : ${toWrite.length}`);
  console.log('='.repeat(60));
  invalid.forEach((m) => console.log(`  ⚠ ${m}`));

  if (hasFlag('dry-run')) {
    console.log('وضع المعاينة (--dry-run) — لم تُكتب أي بيانات.');
    return;
  }

  let written = 0;
  for (const chunk of chunked(toWrite, BATCH_LIMIT)) {
    const batch = db.batch();
    chunk.forEach((p) => {
      batch.set(
        db.collection('questions').doc(p.docId),
        { ...p.data, createdAt: admin.firestore.FieldValue.serverTimestamp() },
        { merge: true }
      );
    });
    await batch.commit();
    written += chunk.length;
    console.log(`  ✓ تمت كتابة ${written}/${toWrite.length}`);
  }

  // ---- تحديث مستند المادة بالدروس وعدد الأسئلة ----
  console.log('جارٍ تحديث بيانات المادة (الدروس وعدد الأسئلة)...');
  const all = await db.collection('questions').where('subjectId', '==', subjectId).get();
  const lessons = new Map();
  all.forEach((snap) => {
    const q = snap.data();
    if (q.lessonNumber === null || q.lessonNumber === undefined) return;
    const entry = lessons.get(q.lessonNumber) || {
      number: q.lessonNumber,
      title: q.lesson || '',
      count: 0,
    };
    entry.count += 1;
    if (!entry.title) entry.title = q.lesson || '';
    lessons.set(q.lessonNumber, entry);
  });

  await db.collection('subjects').doc(subjectId).set(
    {
      questionCount: all.size,
      lessons: [...lessons.values()].sort((a, b) => a.number - b.number),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  console.log('='.repeat(60));
  console.log(`✅ اكتمل الاستيراد. إجمالي أسئلة المادة الآن: ${all.size} ضمن ${lessons.size} درس.`);
  console.log('أكمل بيانات المادة (الاسم/السعر) من لوحة الأدمن → المواد والأسعار.');
}

main().catch((err) => {
  console.error('فشل الاستيراد:', err.message);
  process.exit(1);
});
