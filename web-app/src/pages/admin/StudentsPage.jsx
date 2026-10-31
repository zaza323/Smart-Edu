import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { Check, Copy, KeyRound, RefreshCw, Search, Settings2, Trash2, UserPlus, Users } from 'lucide-react';
import { callFn, db } from '../../lib/firebase';
import { fetchSubjects } from '../../lib/subjects';
import { displayLogin, isPhoneAccountEmail, normalizeJordanPhone } from '../../lib/phoneLogin';
import { DEFAULT_GRADE, GRADES } from '../../lib/grades';
import { Alert, EmptyState, Modal, Spinner, StatusBadge, formatDate } from '../../components/ui';

const LOGIN_URL = 'https://smart-edu-bank.netlify.app/login';

/** كلمة مرور سهلة الكتابة على الهاتف: 4 أحرف (بلا المتشابهة) + 4 أرقام. */
function generatePassword() {
  const letters = 'abcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const pick = (set, n) =>
    Array.from(crypto.getRandomValues(new Uint32Array(n)), (v) => set[v % set.length]).join('');
  return pick(letters, 4) + pick(digits, 4);
}

const digitsOnly = (v) => String(v || '').replace(/\D/g, '');

/** حالة الاشتراك الفعلية (منتهٍ إن مرّ تاريخ الانتهاء). */
function effectiveStatus(sub) {
  if (!sub) return 'none';
  if (sub.status === 'active' && sub.expiresAt?.toMillis && sub.expiresAt.toMillis() < Date.now()) return 'expired';
  return sub.status || 'none';
}

function CopyButton({ text, label = 'نسخ' }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm"
      onClick={() =>
        navigator.clipboard?.writeText(text).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        })
      }
    >
      {done ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
      {done ? 'نُسخ' : label}
    </button>
  );
}

/** بطاقة بيانات الدخول بعد الإنشاء أو تغيير كلمة المرور — جاهزة للإرسال للطالب. */
function CredentialsCard({ name, phone, password }) {
  const message = `أهلاً ${name}،\nحسابك على بنك أسئلة Smart Edu Pro جاهز:\nرابط الدخول: ${LOGIN_URL}\nرقم الدخول: ${phone}\nكلمة المرور: ${password}`;
  return (
    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 space-y-3">
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
        <dt className="text-zinc-400">رقم الدخول</dt>
        <dd className="font-bold tabular-nums" dir="ltr">{phone}</dd>
        <dt className="text-zinc-400">كلمة المرور</dt>
        <dd className="font-bold font-mono" dir="ltr">{password}</dd>
      </dl>
      <CopyButton text={message} label="نسخ رسالة الدخول للطالب" />
    </div>
  );
}

export default function StudentsPage() {
  const [students, setStudents] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // all | active | inactive
  const [subjectFilter, setSubjectFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [managingId, setManagingId] = useState(null);
  const [adding, setAdding] = useState(false);

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
            limit(1000)
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

  const subjectName = (id) => subjects.find((s) => s.id === id)?.name || id;

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    // البحث بالرقم يتجاهل المسافات و+962 والصفر الأول: «795 436 326» يطابق 0795436326
    const phoneTerm = normalizeJordanPhone(term)?.slice(1) || (digitsOnly(term).length >= 4 ? digitsOnly(term) : '');
    return students.filter((s) => {
      const subs = s.subscriptions || {};
      const activeIds = Object.keys(subs).filter((id) => effectiveStatus(subs[id]) === 'active');
      if (filter === 'active' && activeIds.length === 0) return false;
      if (filter === 'inactive' && activeIds.length > 0) return false;
      if (subjectFilter && !activeIds.includes(subjectFilter)) return false;
      if (!term) return true;
      if (phoneTerm && digitsOnly(s.phone).includes(phoneTerm)) return true;
      return [s.fullName, s.email, s.phone]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term));
    });
  }, [students, search, filter, subjectFilter]);

  const managing = students.find((s) => s.id === managingId) || null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">الطلاب</h1>
          <p className="text-zinc-400 mt-1">
            {students.length} طالب مسجّل
            {filtered.length !== students.length && ` · يظهر ${filtered.length}`}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} disabled={loading} className="btn btn-ghost btn-sm">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            تحديث
          </button>
          <button onClick={() => setAdding(true)} className="btn-primary btn-sm">
            <UserPlus className="w-4 h-4" />
            إضافة طالب
          </button>
        </div>
      </div>

      <Alert type="error">{error}</Alert>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-5 h-5 absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="search"
            className="field pr-11"
            placeholder="ابحث بالاسم أو رقم الهاتف..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="field sm:w-44" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">كل الطلاب</option>
          <option value="active">المفعّلون</option>
          <option value="inactive">غير المفعّلين</option>
        </select>
        <select className="field sm:w-52" value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)}>
          <option value="">كل المواد</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              مفعّل في: {s.name}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner className="w-8 h-8" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Users} title={students.length ? 'لا يوجد طلاب مطابقون للبحث' : 'لا يوجد طلاب بعد'} />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead className="bg-surface2 text-zinc-400">
              <tr>
                <th className="text-right px-4 py-3 font-bold">الطالب</th>
                <th className="text-right px-4 py-3 font-bold">الهاتف / الدخول</th>
                <th className="text-right px-4 py-3 font-bold">الاشتراكات</th>
                <th className="text-right px-4 py-3 font-bold">التسجيل</th>
                <th className="text-right px-4 py-3 font-bold"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} className="border-t border-zinc-800 hover:bg-surface2/50">
                  <td className="px-4 py-3">
                    <p className="font-bold">{s.fullName}</p>
                    {s.grade && <p className="text-xs text-zinc-500">{s.grade}</p>}
                  </td>
                  <td className="px-4 py-3 text-zinc-400" dir="ltr">
                    <div className="text-right">
                      <p className="tabular-nums">{s.phone}</p>
                      {!isPhoneAccountEmail(s.email) && <p className="text-xs text-zinc-600">{s.email}</p>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(s.subscriptions || {}).length === 0 ? (
                        <span className="text-zinc-600 text-xs">—</span>
                      ) : (
                        Object.entries(s.subscriptions).map(([sid, sub]) => (
                          <span key={sid} className="inline-flex items-center gap-1.5">
                            <span className="text-xs text-zinc-400">{subjectName(sid)}</span>
                            <StatusBadge status={effectiveStatus(sub)} />
                          </span>
                        ))
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-zinc-500 text-xs">{formatDate(s.createdAt)}</td>
                  <td className="px-4 py-3 text-left">
                    <button onClick={() => setManagingId(s.id)} className="btn btn-ghost btn-sm">
                      <Settings2 className="w-4 h-4" />
                      إدارة
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {adding && <AddStudentDialog subjects={subjects} onClose={() => setAdding(false)} onCreated={load} />}

      {managing && (
        <ManageStudentDialog
          key={managing.id}
          student={managing}
          subjects={subjects}
          onClose={() => setManagingId(null)}
          onChanged={load}
          onDeleted={() => {
            setManagingId(null);
            load();
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
//  إضافة طالب
// ---------------------------------------------------------------------------
function AddStudentDialog({ subjects, onClose, onCreated }) {
  const activeSubjects = subjects.filter((s) => s.active !== false);
  const blank = () => ({
    fullName: '',
    phone: '',
    grade: DEFAULT_GRADE,
    password: generatePassword(),
    subjectIds: activeSubjects.map((s) => s.id),
    durationDays: '',
  });
  const [form, setForm] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState(null);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const toggleSubject = (id) =>
    setForm({
      ...form,
      subjectIds: form.subjectIds.includes(id) ? form.subjectIds.filter((x) => x !== id) : [...form.subjectIds, id],
    });

  async function submit(e) {
    e.preventDefault();
    setError('');
    const phone = normalizeJordanPhone(form.phone);
    if (!phone) return setError('رقم الهاتف غير صحيح — اكتبه مثل 0791234567.');
    if (form.password.length < 6) return setError('كلمة المرور 6 أحرف على الأقل.');
    setBusy(true);
    try {
      await callFn('adminCreateStudent', {
        fullName: form.fullName,
        phone,
        password: form.password,
        grade: form.grade,
        subjectIds: form.subjectIds,
        durationDays: form.durationDays ? Number(form.durationDays) : null,
      });
      setCreated({ name: form.fullName.trim(), phone, password: form.password });
      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (created) {
    return (
      <Modal title="تم إنشاء الحساب" onClose={onClose}>
        <p className="text-sm text-zinc-400">
          أُنشئ حساب <strong className="text-zinc-100">{created.name}</strong>
          {form.subjectIds.length > 0 && ` وفُعّلت ${form.subjectIds.map((id) => subjects.find((s) => s.id === id)?.name || id).join('، ')}`}
          . أرسل له بيانات الدخول:
        </p>
        <CredentialsCard {...created} />
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="btn btn-ghost flex-1">
            إغلاق
          </button>
          <button
            type="button"
            onClick={() => {
              setCreated(null);
              setForm(blank());
            }}
            className="btn-primary flex-1"
          >
            <UserPlus className="w-4 h-4" />
            إضافة طالب آخر
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="إضافة طالب جديد" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Alert type="error">{error}</Alert>
        <div>
          <label className="label" htmlFor="new-name">الاسم</label>
          <input id="new-name" required minLength={2} className="field" value={form.fullName} onChange={set('fullName')} />
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="new-phone">رقم الهاتف (للدخول)</label>
            <input
              id="new-phone"
              required
              inputMode="tel"
              dir="ltr"
              className="field text-left"
              placeholder="07XXXXXXXX"
              value={form.phone}
              onChange={set('phone')}
            />
          </div>
          <div>
            <label className="label" htmlFor="new-grade">الصف</label>
            <select id="new-grade" className="field" value={form.grade} onChange={set('grade')}>
              {GRADES.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="label" htmlFor="new-password">كلمة المرور</label>
          <div className="flex gap-2">
            <input
              id="new-password"
              required
              minLength={6}
              dir="ltr"
              className="field text-left font-mono"
              value={form.password}
              onChange={set('password')}
            />
            <button
              type="button"
              onClick={() => setForm({ ...form, password: generatePassword() })}
              className="btn btn-ghost !px-3 shrink-0"
              title="توليد كلمة مرور جديدة"
              aria-label="توليد كلمة مرور جديدة"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        <fieldset className="space-y-2">
          <legend className="label">تفعيل المواد</legend>
          {activeSubjects.length === 0 ? (
            <p className="text-sm text-zinc-500">لا توجد مواد متاحة.</p>
          ) : (
            activeSubjects.map((s) => (
              <label key={s.id} className="flex items-center gap-3 rounded-xl border border-zinc-800 px-3 py-2.5 cursor-pointer hover:border-zinc-700">
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-[rgb(var(--c-accent))]"
                  checked={form.subjectIds.includes(s.id)}
                  onChange={() => toggleSubject(s.id)}
                />
                <span className="text-sm">{s.name}</span>
              </label>
            ))
          )}
        </fieldset>
        {form.subjectIds.length > 0 && (
          <div>
            <label className="label" htmlFor="new-duration">مدة الاشتراك بالأيام (اتركه فارغاً = دائم)</label>
            <input id="new-duration" type="number" min="1" className="field" placeholder="مثال: 120" value={form.durationDays} onChange={set('durationDays')} />
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className="btn btn-ghost flex-1">إلغاء</button>
          <button type="submit" disabled={busy} className="btn-primary flex-1">
            {busy ? <Spinner className="w-5 h-5 on-accent" /> : <UserPlus className="w-4 h-4" />}
            إنشاء الحساب
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
//  إدارة طالب: البيانات، كلمة المرور، الاشتراكات، الحذف
// ---------------------------------------------------------------------------
function Section({ title, children }) {
  return (
    <section className="space-y-3 border-t border-zinc-800 pt-4 first:border-0 first:pt-0">
      <h4 className="font-bold text-sm text-zinc-300">{title}</h4>
      {children}
    </section>
  );
}

function ManageStudentDialog({ student, subjects, onClose, onChanged, onDeleted }) {
  const phoneAccount = isPhoneAccountEmail(student.email);
  const [info, setInfo] = useState({
    fullName: student.fullName || '',
    phone: student.phone || '',
    grade: student.grade || DEFAULT_GRADE,
  });
  const [password, setPassword] = useState('');
  const [newCreds, setNewCreds] = useState(null);
  const [durationDays, setDurationDays] = useState('');
  const [busy, setBusy] = useState(''); // اسم العملية الجارية
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function run(name, fn, doneText, refresh = true) {
    setBusy(name);
    setError('');
    setNotice('');
    try {
      await fn();
      if (doneText) setNotice(doneText);
      if (refresh) await onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  }

  const saveInfo = (e) => {
    e.preventDefault();
    if (phoneAccount && !normalizeJordanPhone(info.phone)) {
      setError('رقم الهاتف غير صحيح — اكتبه مثل 0791234567.');
      return;
    }
    run('info', () => callFn('adminUpdateStudent', { uid: student.id, ...info }), 'حُفظت البيانات.');
  };

  const savePassword = (e) => {
    e.preventDefault();
    if (password.length < 6) {
      setError('كلمة المرور 6 أحرف على الأقل.');
      return;
    }
    run('password', async () => {
      await callFn('adminUpdateStudent', { uid: student.id, password });
      setNewCreds({ name: student.fullName, phone: phoneAccount ? student.phone : student.email, password });
      setPassword('');
    });
  };

  const setSub = (subjectId, status) =>
    run(`sub:${subjectId}`, () =>
      callFn('setSubscription', {
        uid: student.id,
        subjectId,
        status,
        durationDays: status === 'active' && durationDays ? Number(durationDays) : null,
      })
    );

  const remove = () =>
    run(
      'delete',
      async () => {
        await callFn('adminDeleteStudent', { uid: student.id });
        onDeleted();
      },
      '',
      false
    );

  const subs = student.subscriptions || {};
  // المواد المتاحة + أي مادة قديمة ما زال للطالب اشتراك فيها
  const rows = [
    ...subjects.filter((s) => s.active !== false || subs[s.id]),
    ...Object.keys(subs)
      .filter((id) => !subjects.some((s) => s.id === id))
      .map((id) => ({ id, name: id })),
  ];

  return (
    <Modal title={`إدارة: ${student.fullName}`} onClose={onClose} maxWidth="max-w-lg">
      <Alert type="error">{error}</Alert>
      <Alert type="success">{notice}</Alert>

      <Section title="البيانات">
        <form onSubmit={saveInfo} className="space-y-3">
          <div>
            <label className="label" htmlFor="m-name">الاسم</label>
            <input id="m-name" required minLength={2} className="field" value={info.fullName} onChange={(e) => setInfo({ ...info, fullName: e.target.value })} />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="m-phone">{phoneAccount ? 'رقم الهاتف (رقم الدخول)' : 'رقم الهاتف'}</label>
              <input id="m-phone" dir="ltr" inputMode="tel" className="field text-left" value={info.phone} onChange={(e) => setInfo({ ...info, phone: e.target.value })} />
            </div>
            <div>
              <label className="label" htmlFor="m-grade">الصف</label>
              <select id="m-grade" className="field" value={info.grade} onChange={(e) => setInfo({ ...info, grade: e.target.value })}>
                {[...new Set([...GRADES, info.grade].filter(Boolean))].map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
          </div>
          {!phoneAccount && (
            <p className="text-xs text-zinc-500" dir="ltr">
              <span dir="rtl">يدخل بالبريد: </span>
              {displayLogin(student.email)}
            </p>
          )}
          <button type="submit" disabled={!!busy} className="btn btn-ghost btn-sm">
            {busy === 'info' && <Spinner className="w-4 h-4" />}
            حفظ البيانات
          </button>
        </form>
      </Section>

      <Section title="كلمة المرور">
        {newCreds ? (
          <>
            <p className="text-sm text-zinc-400">تغيّرت كلمة المرور. أرسل للطالب بياناته الجديدة:</p>
            <CredentialsCard {...newCreds} />
          </>
        ) : (
          <form onSubmit={savePassword} className="flex gap-2">
            <input
              dir="ltr"
              className="field text-left font-mono placeholder:font-cairo"
              placeholder="كلمة مرور جديدة"
              aria-label="كلمة مرور جديدة"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button type="button" onClick={() => setPassword(generatePassword())} className="btn btn-ghost !px-3 shrink-0" title="توليد" aria-label="توليد كلمة مرور">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button type="submit" disabled={!!busy || !password} className="btn btn-ghost shrink-0">
              {busy === 'password' ? <Spinner className="w-4 h-4" /> : <KeyRound className="w-4 h-4" />}
              تعيين
            </button>
          </form>
        )}
      </Section>

      <Section title="الاشتراكات">
        <ul className="space-y-2">
          {rows.map((s) => {
            const sub = subs[s.id];
            const status = effectiveStatus(sub);
            const isActive = status === 'active';
            return (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-800 px-3 py-2.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{s.name}</span>
                    <StatusBadge status={status} />
                  </div>
                  {isActive && (
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {sub.expiresAt?.toDate ? `ينتهي ${formatDate(sub.expiresAt)}` : 'اشتراك دائم'}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() => setSub(s.id, isActive ? 'none' : 'active')}
                  className={isActive ? 'btn btn-ghost btn-sm' : 'btn-primary btn-sm'}
                >
                  {busy === `sub:${s.id}` && <Spinner className={`w-4 h-4 ${isActive ? '' : 'on-accent'}`} />}
                  {isActive ? 'إلغاء التفعيل' : 'تفعيل'}
                </button>
              </li>
            );
          })}
        </ul>
        <div>
          <label className="label" htmlFor="m-duration">مدة التفعيل الجديد بالأيام (فارغ = دائم)</label>
          <input id="m-duration" type="number" min="1" className="field" placeholder="مثال: 120" value={durationDays} onChange={(e) => setDurationDays(e.target.value)} />
        </div>
      </Section>

      <Section title="حذف الطالب">
        {confirmDelete ? (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 space-y-3">
            <p className="text-sm text-red-200 leading-relaxed">
              سيُحذف حساب <strong>{student.fullName}</strong> نهائياً مع اختباراته وأسئلته المحفوظة، ولن يستطيع الدخول.
              طلبات الدفع تبقى في السجل. لا يمكن التراجع.
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setConfirmDelete(false)} className="btn btn-ghost btn-sm flex-1">تراجع</button>
              <button type="button" onClick={remove} disabled={!!busy} className="btn-danger btn-sm flex-1">
                {busy === 'delete' ? <Spinner className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
                نعم، احذف نهائياً
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirmDelete(true)} className="btn btn-ghost btn-sm text-red-400 hover:!text-red-300 hover:!border-red-500/50">
            <Trash2 className="w-4 h-4" />
            حذف الطالب
          </button>
        )}
      </Section>
    </Modal>
  );
}
