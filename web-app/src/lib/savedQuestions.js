import { collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from './firebase';

/**
 * الأسئلة التي حفظها الطالب للمراجعة: users/{uid}/saved/{questionId}.
 * تُخزَّن نسخة نصية للعرض فقط (بلا الإجابة الصحيحة)؛ جلسة «راجع المحفوظة»
 * تجلب الأسئلة الأصلية من الخادم عبر startExam بوضع 'saved'.
 */
const savedCol = (uid) => collection(db, 'users', uid, 'saved');

/** اشتراك حيّ: يستدعي onChange بخريطة { questionId: {...} } عند كل تغيير. */
export function subscribeSaved(uid, onChange) {
  return onSnapshot(
    savedCol(uid),
    (snap) => onChange(Object.fromEntries(snap.docs.map((d) => [d.id, { id: d.id, ...d.data() }]))),
    () => onChange({})
  );
}

export function saveQuestion(uid, subjectId, q) {
  return setDoc(doc(savedCol(uid), q.id), {
    subjectId,
    questionText: String(q.questionText || '').slice(0, 3000),
    lesson: q.lesson || '',
    lessonNumber: q.lessonNumber ?? null,
    savedAt: serverTimestamp(),
  });
}

export function unsaveQuestion(uid, questionId) {
  return deleteDoc(doc(savedCol(uid), questionId));
}

/** عدد المحفوظ لكل مادة: { subjectId: count } */
export function countBySubject(saved) {
  const counts = {};
  for (const s of Object.values(saved)) counts[s.subjectId] = (counts[s.subjectId] || 0) + 1;
  return counts;
}
