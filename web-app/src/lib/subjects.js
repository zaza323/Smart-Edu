import { collection, doc, getDocs, writeBatch } from 'firebase/firestore';
import { db } from './firebase';

/**
 * ترتيب المواد للعرض حسب `displayOrder` تصاعدياً.
 * الفرز يتم في المتصفح لا عبر `orderBy` في Firestore، لأن المستندات التي لا تحمل
 * الحقل تُستبعَد كلياً من استعلامات orderBy — وهذا كان سيُخفي أي مادة أُنشئت قبل
 * إضافة الميزة. مجموعة المواد صغيرة (عشرات على الأكثر) فالفرز المحلي بلا تكلفة.
 */
export function sortSubjects(list) {
  return [...list].sort((a, b) => {
    const oa = Number.isFinite(a.displayOrder) ? a.displayOrder : 9999;
    const ob = Number.isFinite(b.displayOrder) ? b.displayOrder : 9999;
    if (oa !== ob) return oa - ob;
    return String(a.name || '').localeCompare(String(b.name || ''), 'ar');
  });
}

/** يجلب كل المواد مرتّبة جاهزة للعرض. */
export async function fetchSubjects({ onlyActive = false } = {}) {
  const snap = await getDocs(collection(db, 'subjects'));
  const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return sortSubjects(onlyActive ? list.filter((s) => s.active !== false) : list);
}

/**
 * يكتب ترتيباً متسلسلاً (0,1,2...) لكل المواد بعد أي عملية تبديل.
 * إعادة الترقيم الكاملة تضمن عدم بقاء فجوات أو تكرار أو مادة بلا ترتيب.
 */
export async function persistSubjectOrder(orderedList) {
  const batch = writeBatch(db);
  orderedList.forEach((s, index) => {
    batch.update(doc(db, 'subjects', s.id), { displayOrder: index });
  });
  await batch.commit();
}
