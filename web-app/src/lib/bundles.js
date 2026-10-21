import { collection, getDocs } from 'firebase/firestore';
import { db } from './firebase';

/**
 * الباقات: عدة مواد بسعر واحد. المستند يحمل `name` و`price` و`subjectIds` و`active`.
 * تفعيل الباقة عند قبول الدفع يتم في Cloud Function `approvePayment` من مستند الباقة نفسه.
 */
export async function fetchBundles({ onlyActive = false } = {}) {
  const snap = await getDocs(collection(db, 'bundles'));
  const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return (onlyActive ? list.filter((b) => b.active !== false) : list).sort((a, b) =>
    String(a.name || '').localeCompare(String(b.name || ''), 'ar')
  );
}

/** مواد الباقة الموجودة فعلاً، بترتيب `subjectIds`. */
export function bundleSubjects(bundle, subjects) {
  const byId = new Map(subjects.map((s) => [s.id, s]));
  return (bundle.subjectIds || []).map((id) => byId.get(id)).filter(Boolean);
}

/** مجموع أسعار مواد الباقة منفردة — يُعرض مشطوباً بجانب سعر الباقة. */
export function bundleFullPrice(bundle, subjects) {
  return bundleSubjects(bundle, subjects).reduce((sum, s) => sum + (Number(s.price) || 0), 0);
}
