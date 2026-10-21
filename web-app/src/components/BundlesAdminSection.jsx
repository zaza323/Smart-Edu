import { useEffect, useState } from 'react';
import { collection, deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { Package, Plus, Save, Trash2 } from 'lucide-react';
import { db } from '../lib/firebase';
import { bundleFullPrice, bundleSubjects, fetchBundles } from '../lib/bundles';
import { Alert, Spinner } from './ui';

const EMPTY_BUNDLE = { id: '', name: '', description: '', price: 0, subjectIds: [], active: true };

/**
 * إدارة الباقات من صفحة «المواد والأسعار».
 * الباقة طلب دفع واحد يفعّل عدة مواد معاً عند القبول (Cloud Function `approvePayment`).
 */
export default function BundlesAdminSection({ subjects }) {
  const [bundles, setBundles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setBundles(await fetchBundles());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function toggleSubject(id) {
    const ids = editing.subjectIds.includes(id)
      ? editing.subjectIds.filter((x) => x !== id)
      : [...editing.subjectIds, id];
    setEditing({ ...editing, subjectIds: ids });
  }

  async function saveBundle() {
    if (!editing.name.trim()) {
      setError('اسم الباقة مطلوب.');
      return;
    }
    if (editing.subjectIds.length < 2) {
      setError('اختر مادتين على الأقل للباقة.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const ref = editing.id ? doc(db, 'bundles', editing.id) : doc(collection(db, 'bundles'));
      await setDoc(
        ref,
        {
          name: editing.name.trim(),
          description: editing.description.trim(),
          price: Number(editing.price) || 0,
          // بترتيب المواد في الصفحة، لا بترتيب الضغط على الخانات
          subjectIds: subjects.map((s) => s.id).filter((id) => editing.subjectIds.includes(id)),
          active: Boolean(editing.active),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      setEditing(null);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function removeBundle() {
    setBusy(true);
    try {
      await deleteDoc(doc(db, 'bundles', confirmDelete.id));
      setConfirmDelete(null);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const fullPrice = editing ? bundleFullPrice(editing, subjects) : 0;

  return (
    <div className="card p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-bold text-lg flex items-center gap-2">
          <Package className="w-5 h-5 text-accent" />
          الباقات
        </h2>
        <button onClick={() => setEditing({ ...EMPTY_BUNDLE })} className="btn-primary btn-sm">
          <Plus className="w-4 h-4" />
          باقة جديدة
        </button>
      </div>
      <p className="text-sm text-zinc-400">
        الباقة تجمع عدة مواد بسعر واحد: يرسل الطالب إثبات دفع واحداً، وعند قبوله تُفعَّل كل مواد الباقة معاً.
      </p>

      <Alert type="error">{error}</Alert>

      {loading ? (
        <div className="flex justify-center py-6">
          <Spinner className="w-6 h-6" />
        </div>
      ) : bundles.length === 0 ? (
        <p className="text-sm text-zinc-500">لا توجد باقات بعد.</p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {bundles.map((b) => {
            const items = bundleSubjects(b, subjects);
            return (
              <div key={b.id} className="bg-surface2 rounded-xl p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-bold text-accent truncate">{b.name}</h3>
                    <p className="text-sm text-zinc-400 mt-0.5">
                      {items.map((s) => s.name).join(' + ') || 'لا مواد'}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => setEditing({ ...EMPTY_BUNDLE, ...b, subjectIds: b.subjectIds || [] })}
                      className="btn btn-ghost btn-sm"
                    >
                      تعديل
                    </button>
                    <button onClick={() => setConfirmDelete(b)} className="btn btn-ghost btn-sm text-red-400">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-zinc-400">
                  <span className="bg-zinc-800 rounded-lg px-2.5 py-1">
                    {b.price ?? 0} د.أ (بدل {bundleFullPrice(b, subjects)})
                  </span>
                  <span
                    className={`rounded-lg px-2.5 py-1 ${
                      b.active === false ? 'bg-red-500/15 text-red-300' : 'bg-emerald-500/15 text-emerald-300'
                    }`}
                  >
                    {b.active === false ? 'مخفية' : 'ظاهرة'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* نافذة تعديل/إضافة باقة */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm grid place-items-center p-4 overflow-y-auto">
          <div className="card w-full max-w-lg p-6 space-y-4 my-8">
            <h3 className="text-lg font-bold">{editing.id ? 'تعديل باقة' : 'باقة جديدة'}</h3>

            <Alert type="error">{error}</Alert>

            <div>
              <label className="label" htmlFor="bname">
                اسم الباقة
              </label>
              <input
                id="bname"
                className="field"
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                placeholder="باقة الفصل الأول"
              />
            </div>

            <div>
              <span className="label">مواد الباقة</span>
              <div className="space-y-2">
                {subjects.map((s) => (
                  <label key={s.id} className="flex items-center gap-3 cursor-pointer bg-surface2 rounded-xl px-4 py-2.5">
                    <input
                      type="checkbox"
                      checked={editing.subjectIds.includes(s.id)}
                      onChange={() => toggleSubject(s.id)}
                      className="w-5 h-5 accent-[rgb(var(--c-accent-fill))]"
                    />
                    <span className="flex-1 text-sm">
                      {s.name}
                      <span className="text-zinc-500"> — {[s.grade, s.semester].filter(Boolean).join(' — ')}</span>
                    </span>
                    <span className="text-xs text-zinc-500">{s.price ?? 0} د.أ</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="label" htmlFor="bprice">
                سعر الباقة (دينار)
              </label>
              <input
                id="bprice"
                type="number"
                min="0"
                className="field"
                value={editing.price}
                onChange={(e) => setEditing({ ...editing, price: e.target.value })}
              />
              {fullPrice > 0 && (
                <p className="text-xs text-zinc-500 mt-1.5">
                  مجموع أسعار المواد المختارة منفردة: {fullPrice} دينار — يظهر للطالب مشطوباً بجانب سعر الباقة.
                </p>
              )}
            </div>

            <div>
              <label className="label" htmlFor="bdesc">
                وصف مختصر (اختياري)
              </label>
              <textarea
                id="bdesc"
                rows={2}
                className="field resize-none"
                value={editing.description}
                onChange={(e) => setEditing({ ...editing, description: e.target.value })}
              />
            </div>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={editing.active !== false}
                onChange={(e) => setEditing({ ...editing, active: e.target.checked })}
                className="w-5 h-5 accent-[rgb(var(--c-accent-fill))]"
              />
              <span className="text-sm">إظهار الباقة للطلاب</span>
            </label>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => {
                  setEditing(null);
                  setError('');
                }}
                className="btn btn-ghost flex-1"
              >
                إلغاء
              </button>
              <button onClick={saveBundle} disabled={busy} className="btn-primary flex-1">
                {busy ? <Spinner className="w-5 h-5 on-accent" /> : <Save className="w-5 h-5" />}
                حفظ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* تأكيد حذف باقة */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm grid place-items-center p-4">
          <div className="card w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-bold">حذف الباقة «{confirmDelete.name}»؟</h3>
            <p className="text-sm text-amber-300 leading-relaxed">
              الاشتراكات المفعّلة سابقاً عبر الباقة تبقى كما هي، لكن طلبات الدفع المعلّقة لهذه الباقة
              لن يمكن قبولها بعد الحذف.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)} className="btn btn-ghost flex-1">
                إلغاء
              </button>
              <button onClick={removeBundle} disabled={busy} className="btn-danger flex-1">
                {busy ? <Spinner className="w-5 h-5" /> : <Trash2 className="w-5 h-5" />}
                حذف
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
