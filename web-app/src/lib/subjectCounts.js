import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';

/**
 * مزامنة `questionCount` وقائمة `lessons` في مستند المادة بعد إضافة أو حذف سؤال
 * واحد من لوحة الأدمن.
 *
 * لماذا هذا ضروري: واجهة الطالب لا تستطيع قراءة مجموعة `questions` إطلاقاً
 * (قواعد الأمان)، فهي تعتمد كلياً على هذين الحقلين لعرض الدروس وأعداد الأسئلة.
 * أدوات الاستيراد الدفعي تعيد حسابهما بالكامل؛ هنا نعدّلهما تدريجياً (±1).
 */
export async function syncSubjectCounts(subjectId, { lessonNumber, lessonTitle, delta }) {
  const ref = doc(db, 'subjects', subjectId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;

  const data = snap.data();
  const lessons = [...(data.lessons || [])];
  const questionCount = Math.max(0, (Number(data.questionCount) || 0) + delta);

  if (lessonNumber !== null && lessonNumber !== undefined) {
    const idx = lessons.findIndex((l) => Number(l.number) === Number(lessonNumber));
    if (idx === -1) {
      if (delta > 0) {
        lessons.push({ number: Number(lessonNumber), title: lessonTitle || '', count: delta });
      }
    } else {
      const next = Math.max(0, (Number(lessons[idx].count) || 0) + delta);
      if (next === 0) lessons.splice(idx, 1);
      else lessons[idx] = { ...lessons[idx], count: next };
    }
    lessons.sort((a, b) => Number(a.number) - Number(b.number));
  }

  await updateDoc(ref, { questionCount, lessons });
}
