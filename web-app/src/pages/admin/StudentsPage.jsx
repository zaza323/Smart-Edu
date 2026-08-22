import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { RefreshCw, Search, Settings2, Users } from 'lucide-react';
import { callFn, db } from '../../lib/firebase';
import { fetchSubjects } from '../../lib/subjects';
import { Alert, EmptyState, Spinner, StatusBadge, formatDate } from '../../components/ui';

export default function StudentsPage() {
  const [students, setStudents] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // all | active | inactive
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ subjectId: '', status: 'active', durationDays: '' });
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [usersSnap, subjectsList] = await Promise.all([
        getDocs(
          query(
            collection(db, 'users'),
            where('role', '==', 'student'),
            orderBy('createdAt', 'desc'),
            limit(500)
          )
        ),
        fetchSubjects(),
      ]);
      setStudents(usersSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setSubjects(subjectsList);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return students.filter((s) => {
      const hasActive = Object.values(s.subscriptions || {}).some((x) => x.status === 'active');
      if (filter === 'active' && !hasActive) return false;
      if (filter === 'inactive' && hasActive) return false;
      if (!term) return true;
      return [s.fullName, s.email, s.phone]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term));
    });
  }, [students, search, filter]);

  function openEditor(student) {
    setEditing(student);
    setForm({ subjectId: subjects[0]?.id || '', status: 'active', durationDays: '' });
  }

  async function applySubscription() {
    if (!form.subjectId) return;
    setBusy(true);
    setError('');
    try {
      await callFn('setSubscription', {
        uid: editing.id,
        subjectId: form.subjectId,
        status: form.status,
        durationDays: form.durationDays ? Number(form.durationDays) : null,
      });
      setEditing(null);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">الطلاب</h1>
          <p className="text-zinc-400 mt-1">{students.length} طالب مسجّل.</p>
        </div>
        <button onClick={load} disabled={loading} className="btn btn-ghost btn-sm">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          تحديث
        </button>
      </div>

      <Alert type="error">{error}</Alert>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-5 h-5 absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            className="field pr-11"
            placeholder="ابحث بالاسم أو البريد أو الهاتف..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="field sm:w-48" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">كل الطلاب</option>
          <option value="active">المفعّلون</option>
          <option value="inactive">غير المفعّلين</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner className="w-8 h-8" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Users} title="لا يوجد طلاب مطابقون للبحث" />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead className="bg-surface2 text-zinc-400">
              <tr>
                <th className="text-right px-4 py-3 font-bold">الطالب</th>
                <th className="text-right px-4 py-3 font-bold">التواصل</th>
                <th className="text-right px-4 py-3 font-bold">الاشتراكات</th>
                <th className="text-right px-4 py-3 font-bold">التسجيل</th>
                <th className="text-right px-4 py-3 font-bold"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} className="border-t border-zinc-800">
                  <td className="px-4 py-3 font-bold">{s.fullName}</td>
                  <td className="px-4 py-3 text-zinc-400" dir="ltr">
                    <div className="text-right">
                      <p>{s.phone}</p>
                      <p className="text-xs text-zinc-600">{s.email}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(s.subscriptions || {}).length === 0 ? (
                        <span className="text-zinc-600 text-xs">—</span>
                      ) : (
                        Object.entries(s.subscriptions).map(([sid, sub]) => (
                          <span key={sid} className="inline-flex items-center gap-1.5">
                            <span className="text-xs text-zinc-400">
                              {sub.subjectName || sid}
                            </span>
                            <StatusBadge status={sub.status} />
                          </span>
                        ))
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-zinc-500 text-xs">{formatDate(s.createdAt)}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => openEditor(s)} className="btn btn-ghost btn-sm">
                      <Settings2 className="w-4 h-4" />
                      اشتراك
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* تعديل اشتراك يدوي */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm grid place-items-center p-4">
          <div className="card w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-bold">تعديل اشتراك: {editing.fullName}</h3>

            <div>
              <label className="label" htmlFor="subjectId">
                المادة
              </label>
              <select
                id="subjectId"
                className="field"
                value={form.subjectId}
                onChange={(e) => setForm({ ...form, subjectId: e.target.value })}
              >
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label" htmlFor="status">
                الحالة
              </label>
              <select
                id="status"
                className="field"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                <option value="active">مفعّل</option>
                <option value="pending">قيد المراجعة</option>
                <option value="expired">منتهٍ</option>
                <option value="none">غير مشترك</option>
              </select>
            </div>

            <div>
              <label className="label" htmlFor="durationDays">
                مدة الاشتراك بالأيام (اتركه فارغاً = دائم)
              </label>
              <input
                id="durationDays"
                type="number"
                min="1"
                className="field"
                value={form.durationDays}
                onChange={(e) => setForm({ ...form, durationDays: e.target.value })}
                placeholder="مثال: 120"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setEditing(null)} className="btn btn-ghost flex-1">
                إلغاء
              </button>
              <button onClick={applySubscription} disabled={busy} className="btn-primary flex-1">
                {busy ? <Spinner className="w-5 h-5 on-accent" /> : null}
                حفظ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
