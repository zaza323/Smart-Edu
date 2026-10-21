import { useEffect, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { Link } from 'react-router-dom';
import {
  ArrowDown,
  ArrowUp,
  Database,
  GraduationCap,
  Plus,
  Save,
  Trash2,
  Upload,
  Wallet,
} from 'lucide-react';
import { db } from '../../lib/firebase';
import { fetchSubjects, persistSubjectOrder } from '../../lib/subjects';
import { Alert, EmptyState, Spinner } from '../../components/ui';
import ImportQuestionsDialog from '../../components/ImportQuestionsDialog';
import BundlesAdminSection from '../../components/BundlesAdminSection';

const EMPTY_SUBJECT = {
  id: '',
  name: '',
  grade: '',
  semester: '',
  description: '',
  price: 0,
  minutesPerQuestion: 0.4,
  active: true,
};

export default function SubjectsAdminPage() {
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [importing, setImporting] = useState(null);

  const [payment, setPayment] = useState({
    accountName: '',
    bankName: '',
    iban: '',
    wallet: '',
    note: '',
  });
  const [payBusy, setPayBusy] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [list, paySnap] = await Promise.all([
        fetchSubjects(),
        getDoc(doc(db, 'settings', 'payment')),
      ]);
      setSubjects(list);
      if (paySnap.exists()) setPayment({ ...payment, ...paySnap.data() });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** تبديل موقع مادة مع جارتها، ثم إعادة ترقيم الترتيب كاملاً. */
  async function moveSubject(index, direction) {
    const target = index + direction;
    if (target < 0 || target >= subjects.length) return;
    const next = [...subjects];
    [next[index], next[target]] = [next[target], next[index]];
    setSubjects(next); // تحديث فوري للواجهة قبل تأكيد الكتابة
    try {
      await persistSubjectOrder(next);
    } catch (err) {
      setError(err.message);
      await load();
    }
  }

  async function saveSubject() {
    const id = (editing.id || '').trim();
    if (!id || !editing.name.trim()) {
      setError('معرّف المادة واسمها مطلوبان.');
      return;
    }
    if (!/^[a-z0-9-]+$/.test(id)) {
      setError('معرّف المادة يجب أن يكون بحروف إنجليزية صغيرة وأرقام وشرطات فقط (مثال: islamic-11-s1).');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await setDoc(
        doc(db, 'subjects', id),
        {
          name: editing.name.trim(),
          grade: editing.grade.trim(),
          semester: editing.semester.trim(),
          description: editing.description.trim(),
          price: Number(editing.price) || 0,
          minutesPerQuestion: Number(editing.minutesPerQuestion) || 0.4,
          active: Boolean(editing.active),
          displayOrder: Number.isFinite(editing.displayOrder)
            ? editing.displayOrder
            : subjects.length,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      setEditing(null);
      setMsg('تم حفظ المادة.');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function removeSubject() {
    setBusy(true);
    try {
      await deleteDoc(doc(db, 'subjects', confirmDelete.id));
      setConfirmDelete(null);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function savePayment() {
    setPayBusy(true);
    setError('');
    try {
      await setDoc(
        doc(db, 'settings', 'payment'),
        { ...payment, updatedAt: serverTimestamp() },
        { merge: true }
      );
      setMsg('تم حفظ بيانات التحويل.');
    } catch (err) {
      setError(err.message);
    } finally {
      setPayBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">المواد والأسعار</h1>
          <p className="text-zinc-400 mt-1">
            عدد الأسئلة وقائمة الدروس تُحدَّث تلقائياً عند الاستيراد من أداة Python.
          </p>
        </div>
        <button onClick={() => setEditing({ ...EMPTY_SUBJECT })} className="btn-primary btn-sm">
          <Plus className="w-4 h-4" />
          مادة جديدة
        </button>
      </div>

      <Alert type="error">{error}</Alert>
      <Alert type="success">{msg}</Alert>

      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner className="w-8 h-8" />
        </div>
      ) : subjects.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="لا توجد مواد بعد"
          description="أضف أول مادة ثم استورد أسئلتها عبر أداة الاستيراد."
        />
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {subjects.map((s, index) => (
            <div key={s.id} className="card p-5">
              <div className="flex items-start justify-between gap-3">
                {/* سهما الترتيب */}
                <div className="flex flex-col gap-1 shrink-0">
                  <button
                    onClick={() => moveSubject(index, -1)}
                    disabled={index === 0}
                    title="تحريك للأعلى"
                    className="w-7 h-7 grid place-items-center rounded-lg border border-zinc-700 text-zinc-400 transition enabled:hover:border-accent enabled:hover:text-accent disabled:opacity-30"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => moveSubject(index, 1)}
                    disabled={index === subjects.length - 1}
                    title="تحريك للأسفل"
                    className="w-7 h-7 grid place-items-center rounded-lg border border-zinc-700 text-zinc-400 transition enabled:hover:border-accent enabled:hover:text-accent disabled:opacity-30"
                  >
                    <ArrowDown className="w-4 h-4" />
                  </button>
                </div>

                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-lg text-accent truncate">{s.name}</h3>
                  <p className="text-xs text-zinc-600 mt-0.5" dir="ltr">
                    {s.id}
                  </p>
                  <p className="text-sm text-zinc-500 mt-1">
                    {[s.grade, s.semester].filter(Boolean).join(' — ')}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => setEditing({ ...EMPTY_SUBJECT, ...s })} className="btn btn-ghost btn-sm">
                    تعديل
                  </button>
                  <button onClick={() => setConfirmDelete(s)} className="btn btn-ghost btn-sm text-red-400">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mt-4 text-xs text-zinc-400">
                <span className="bg-zinc-800 rounded-lg px-2.5 py-1">{s.price ?? 0} د.أ</span>
                <span className="bg-zinc-800 rounded-lg px-2.5 py-1">{s.questionCount ?? 0} سؤال</span>
                <span className="bg-zinc-800 rounded-lg px-2.5 py-1">
                  {(s.lessons || []).length} درس
                </span>
                <span className="bg-zinc-800 rounded-lg px-2.5 py-1">
                  {Math.round((s.minutesPerQuestion ?? 0.4) * 20 * 10) / 10} د/20 سؤال
                </span>
                <span
                  className={`rounded-lg px-2.5 py-1 ${
                    s.active === false ? 'bg-red-500/15 text-red-300' : 'bg-emerald-500/15 text-emerald-300'
                  }`}
                >
                  {s.active === false ? 'مخفية' : 'ظاهرة'}
                </span>
              </div>

              <div className="flex gap-2 mt-4">
                <Link to={`/admin/questions/${s.id}`} className="btn btn-ghost btn-sm flex-1">
                  <Database className="w-4 h-4" />
                  إدارة الأسئلة
                </Link>
                <button onClick={() => setImporting(s)} className="btn-primary btn-sm flex-1">
                  <Upload className="w-4 h-4" />
                  استيراد أسئلة
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {importing && (
        <ImportQuestionsDialog
          subject={importing}
          onClose={async (changed) => {
            setImporting(null);
            if (changed) await load();
          }}
        />
      )}

      {!loading && <BundlesAdminSection subjects={subjects} />}

      {/* بيانات التحويل */}
      <div className="card p-6 space-y-4">
        <h2 className="font-bold text-lg flex items-center gap-2">
          <Wallet className="w-5 h-5 text-accent" />
          بيانات التحويل المعروضة للطلاب
        </h2>

        <div className="grid sm:grid-cols-2 gap-4">
          {[
            ['accountName', 'اسم صاحب الحساب'],
            ['bankName', 'اسم البنك'],
            ['iban', 'رقم الحساب / IBAN'],
            ['wallet', 'المحفظة الإلكترونية'],
          ].map(([key, label]) => (
            <div key={key}>
              <label className="label" htmlFor={key}>
                {label}
              </label>
              <input
                id={key}
                className="field"
                value={payment[key] || ''}
                onChange={(e) => setPayment({ ...payment, [key]: e.target.value })}
              />
            </div>
          ))}
        </div>

        <div>
          <label className="label" htmlFor="note">
            ملاحظة إضافية للطالب
          </label>
          <textarea
            id="note"
            rows={2}
            className="field resize-none"
            value={payment.note || ''}
            onChange={(e) => setPayment({ ...payment, note: e.target.value })}
            placeholder="مثال: اكتب اسمك ورقم هاتفك في خانة ملاحظات التحويل."
          />
        </div>

        <button onClick={savePayment} disabled={payBusy} className="btn-primary">
          {payBusy ? <Spinner className="w-5 h-5 on-accent" /> : <Save className="w-5 h-5" />}
          حفظ بيانات التحويل
        </button>
      </div>

      {/* نافذة تعديل/إضافة مادة */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm grid place-items-center p-4 overflow-y-auto">
          <div className="card w-full max-w-lg p-6 space-y-4 my-8">
            <h3 className="text-lg font-bold">
              {subjects.some((s) => s.id === editing.id) ? 'تعديل مادة' : 'مادة جديدة'}
            </h3>

            <div>
              <label className="label" htmlFor="sid">
                معرّف المادة (يُستخدم في الروابط وأداة الاستيراد)
              </label>
              <input
                id="sid"
                dir="ltr"
                className="field text-left"
                value={editing.id}
                disabled={subjects.some((s) => s.id === editing.id)}
                onChange={(e) => setEditing({ ...editing, id: e.target.value })}
                placeholder="islamic-11-s1"
              />
            </div>

            <div>
              <label className="label" htmlFor="sname">
                اسم المادة
              </label>
              <input
                id="sname"
                className="field"
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                placeholder="التربية الإسلامية"
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label" htmlFor="sgrade">
                  الصف
                </label>
                <input
                  id="sgrade"
                  className="field"
                  value={editing.grade}
                  onChange={(e) => setEditing({ ...editing, grade: e.target.value })}
                  placeholder="الحادي عشر"
                />
              </div>
              <div>
                <label className="label" htmlFor="ssem">
                  الفصل
                </label>
                <input
                  id="ssem"
                  className="field"
                  value={editing.semester}
                  onChange={(e) => setEditing({ ...editing, semester: e.target.value })}
                  placeholder="الفصل الأول"
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label" htmlFor="sprice">
                  السعر (دينار)
                </label>
                <input
                  id="sprice"
                  type="number"
                  min="0"
                  className="field"
                  value={editing.price}
                  onChange={(e) => setEditing({ ...editing, price: e.target.value })}
                />
              </div>
              <div>
                <label className="label" htmlFor="smpq">
                  دقائق لكل سؤال
                </label>
                <input
                  id="smpq"
                  type="number"
                  min="0.1"
                  step="0.1"
                  className="field"
                  value={editing.minutesPerQuestion}
                  onChange={(e) => setEditing({ ...editing, minutesPerQuestion: e.target.value })}
                />
                <p className="text-xs text-zinc-500 mt-1.5">
                  0.4 ={' '}
                  <span className="font-bold text-zinc-300">8 دقائق لكل 20 سؤالاً</span> — أي{' '}
                  {Math.round((Number(editing.minutesPerQuestion) || 0.4) * 20 * 10) / 10} دقيقة
                  لكل 20 سؤالاً بالقيمة الحالية.
                </p>
              </div>
            </div>

            <div>
              <label className="label" htmlFor="sdesc">
                وصف مختصر
              </label>
              <textarea
                id="sdesc"
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
              <span className="text-sm">إظهار المادة للطلاب</span>
            </label>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setEditing(null)} className="btn btn-ghost flex-1">
                إلغاء
              </button>
              <button onClick={saveSubject} disabled={busy} className="btn-primary flex-1">
                {busy ? <Spinner className="w-5 h-5 on-accent" /> : <Save className="w-5 h-5" />}
                حفظ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* تأكيد حذف مادة */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm grid place-items-center p-4">
          <div className="card w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-bold">حذف المادة «{confirmDelete.name}»؟</h3>
            <p className="text-sm text-amber-300 leading-relaxed">
              لن تُحذف أسئلة المادة من قاعدة البيانات، لكن المادة ستختفي من واجهة الطلاب وستتوقف
              اختباراتها.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)} className="btn btn-ghost flex-1">
                إلغاء
              </button>
              <button onClick={removeSubject} disabled={busy} className="btn-danger flex-1">
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
