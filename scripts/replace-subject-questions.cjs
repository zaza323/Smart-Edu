/**
 * استبدال كامل لأسئلة مادة ودروسها من ملف JSON مُستخرَج ومُراجَع مسبقاً.
 *
 *   node scripts/replace-subject-questions.cjs <subjectId> <file.json>         ← معاينة فقط
 *   node scripts/replace-subject-questions.cjs <subjectId> <file.json> --yes   ← تنفيذ
 *
 * الملف: { questions: [{ docId, subjectId, lessonNumber, lesson, questionText,
 *          optionsText[4], correctAnswerIndex, ... }] } — بالصيغة نفسها التي يكتبها
 * مستورد Word (functions/lib/extractQuestions.js).
 *
 * يحذف كل أسئلة المادة الحالية، ويكتب الجديدة، ويعيد بناء قائمة الدروس وعدد الأسئلة.
 * محاولات الطلاب السابقة تبقى كما هي، والأسئلة المحفوظة المحذوفة تُتجاهَل تلقائياً.
 */
const fs = require('fs');
const { adminFirestore, FieldValue } = require('./lib/admin.cjs');

function validate(questions, subjectId) {
  const problems = [];
  const ids = new Set();
  questions.forEach((q, i) => {
    const where = `#${i + 1} (الدرس ${q.lessonNumber}، السؤال ${q.questionNumber})`;
    if (q.subjectId !== subjectId) problems.push(`${where}: مادة مختلفة «${q.subjectId}»`);
    if (!q.docId || ids.has(q.docId)) problems.push(`${where}: معرّف مفقود أو مكرّر`);
    ids.add(q.docId);
    if (!Number.isInteger(q.lessonNumber) || !q.lesson) problems.push(`${where}: الدرس ناقص`);
    if (!String(q.questionText || '').trim()) problems.push(`${where}: نص السؤال فارغ`);
    if (!Array.isArray(q.optionsText) || q.optionsText.length !== 4 || q.optionsText.some((o) => !String(o).trim())) {
      problems.push(`${where}: الخيارات ليست 4`);
    }
    if (![0, 1, 2, 3].includes(q.correctAnswerIndex)) problems.push(`${where}: الإجابة الصحيحة غير محددة`);
  });
  return problems;
}

function lessonsOf(questions) {
  const map = new Map();
  for (const q of questions) {
    const e = map.get(q.lessonNumber) || { number: q.lessonNumber, title: q.lesson, count: 0 };
    e.count += 1;
    map.set(q.lessonNumber, e);
  }
  return [...map.values()].sort((a, b) => a.number - b.number);
}

async function main() {
  const [subjectId, file, flag] = process.argv.slice(2);
  if (!subjectId || !file) {
    console.log('الاستخدام: node scripts/replace-subject-questions.cjs <subjectId> <file.json> [--yes]');
    process.exit(1);
  }
  const { questions } = JSON.parse(fs.readFileSync(file, 'utf8'));
  const problems = validate(questions, subjectId);
  if (problems.length) {
    console.log(`الملف فيه ${problems.length} مشكلة — لم يُنفَّذ شيء:\n` + problems.slice(0, 20).join('\n'));
    process.exit(1);
  }

  const db = adminFirestore();
  const subjectRef = db.doc(`subjects/${subjectId}`);
  const subject = await subjectRef.get();
  if (!subject.exists) throw new Error(`المادة «${subjectId}» غير موجودة.`);
  const existing = await db.collection('questions').where('subjectId', '==', subjectId).select().get();
  const lessons = lessonsOf(questions);

  console.log(`المادة: ${subject.data().name} (${subjectId})`);
  console.log(`سيُحذف: ${existing.size} سؤالاً و${(subject.data().lessons || []).length} درساً`);
  console.log(`سيُضاف: ${questions.length} سؤالاً في ${lessons.length} درساً:`);
  for (const l of lessons) console.log(`  ${String(l.number).padStart(2)}. ${l.title} — ${l.count}`);

  if (flag !== '--yes') {
    console.log('\nمعاينة فقط. للتنفيذ أعد الأمر نفسه مع --yes في آخره.');
    return;
  }

  const writer = db.bulkWriter();
  existing.docs.forEach((d) => writer.delete(d.ref));
  await writer.flush();
  console.log(`\n✓ حُذف ${existing.size}`);

  for (const { docId, ...payload } of questions) {
    writer.set(db.doc(`questions/${docId}`), { ...payload, createdAt: FieldValue.serverTimestamp() });
  }
  await writer.close();
  console.log(`✓ أُضيف ${questions.length}`);

  await subjectRef.update({ lessons, questionCount: questions.length, updatedAt: FieldValue.serverTimestamp() });
  const check = await db.collection('questions').where('subjectId', '==', subjectId).count().get();
  console.log(`✓ حُدّثت الدروس. عدد أسئلة المادة الآن: ${check.data().count}`);
}

main().catch((err) => {
  console.error('فشل:', err.message);
  process.exit(1);
});
