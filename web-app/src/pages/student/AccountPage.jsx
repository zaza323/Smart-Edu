import { useEffect, useState } from 'react';
import { KeyRound, Save, UserCog } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { authErrorMessage } from '../../lib/firebase';
import { Alert, Spinner, StatusBadge, formatDate } from '../../components/ui';
import { DEFAULT_GRADE, GRADES } from '../../lib/grades';

export default function AccountPage() {
  const { profile, user, updateProfileInfo, changePassword } = useAuth();

  const [info, setInfo] = useState({ fullName: '', phone: '', grade: '' });
  const [infoMsg, setInfoMsg] = useState({ type: '', text: '' });
  const [infoBusy, setInfoBusy] = useState(false);

  const [pass, setPass] = useState({ current: '', next: '', confirm: '' });
  const [passMsg, setPassMsg] = useState({ type: '', text: '' });
  const [passBusy, setPassBusy] = useState(false);

  useEffect(() => {
    if (profile) {
      setInfo({
        fullName: profile.fullName || '',
        phone: profile.phone || '',
        grade: profile.grade || DEFAULT_GRADE,
      });
    }
  }, [profile]);

  async function saveInfo(e) {
    e.preventDefault();
    setInfoMsg({ type: '', text: '' });
    if (info.fullName.trim().length < 3) {
      setInfoMsg({ type: 'error', text: 'الرجاء إدخال الاسم الكامل.' });
      return;
    }
    setInfoBusy(true);
    try {
      await updateProfileInfo(info);
      setInfoMsg({ type: 'success', text: 'تم حفظ بياناتك بنجاح.' });
    } catch {
      setInfoMsg({ type: 'error', text: 'تعذّر حفظ البيانات، حاول مرة أخرى.' });
    } finally {
      setInfoBusy(false);
    }
  }

  async function savePassword(e) {
    e.preventDefault();
    setPassMsg({ type: '', text: '' });
    if (pass.next.length < 6) {
      setPassMsg({ type: 'error', text: 'كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل.' });
      return;
    }
    if (pass.next !== pass.confirm) {
      setPassMsg({ type: 'error', text: 'كلمتا المرور غير متطابقتين.' });
      return;
    }
    setPassBusy(true);
    try {
      await changePassword(pass.current, pass.next);
      setPass({ current: '', next: '', confirm: '' });
      setPassMsg({ type: 'success', text: 'تم تغيير كلمة المرور بنجاح.' });
    } catch (err) {
      setPassMsg({ type: 'error', text: authErrorMessage(err.code) });
    } finally {
      setPassBusy(false);
    }
  }

  const subs = Object.entries(profile?.subscriptions || {});

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <h1 className="text-2xl font-extrabold">حسابي</h1>

      {/* البيانات الشخصية */}
      <form onSubmit={saveInfo} className="card p-6 space-y-4">
        <h2 className="font-bold text-lg flex items-center gap-2">
          <UserCog className="w-5 h-5 text-accent" />
          البيانات الشخصية
        </h2>

        {infoMsg.text && <Alert type={infoMsg.type}>{infoMsg.text}</Alert>}

        <div>
          <label className="label" htmlFor="fullName">
            الاسم الكامل
          </label>
          <input
            id="fullName"
            className="field"
            value={info.fullName}
            onChange={(e) => setInfo({ ...info, fullName: e.target.value })}
          />
        </div>

        <div>
          <label className="label" htmlFor="phone">
            رقم الهاتف
          </label>
          <input
            id="phone"
            dir="ltr"
            className="field text-left"
            value={info.phone}
            onChange={(e) => setInfo({ ...info, phone: e.target.value })}
          />
        </div>

        <div>
          <label className="label" htmlFor="grade">
            الصف الدراسي
          </label>
          <select
            id="grade"
            className="field"
            value={info.grade}
            onChange={(e) => setInfo({ ...info, grade: e.target.value })}
          >
            {GRADES.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>

        <div>
          <span className="label">البريد الإلكتروني</span>
          <input dir="ltr" className="field text-left opacity-60" value={user?.email || ''} disabled />
        </div>

        <button type="submit" disabled={infoBusy} className="btn-primary">
          {infoBusy ? <Spinner className="w-5 h-5 on-accent" /> : <Save className="w-5 h-5" />}
          حفظ التعديلات
        </button>
      </form>

      {/* الاشتراكات */}
      <div className="card p-6 space-y-4">
        <h2 className="font-bold text-lg">اشتراكاتي</h2>
        {subs.length === 0 ? (
          <p className="text-zinc-500 text-sm">لا توجد اشتراكات بعد.</p>
        ) : (
          <div className="space-y-2">
            {subs.map(([subjectId, s]) => (
              <div
                key={subjectId}
                className="flex items-center justify-between gap-3 bg-surface2 rounded-xl px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="font-bold truncate">{s.subjectName || subjectId}</p>
                  {s.expiresAt && (
                    <p className="text-xs text-zinc-500 mt-0.5">
                      ينتهي: {formatDate(s.expiresAt)}
                    </p>
                  )}
                </div>
                <StatusBadge status={s.status} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* كلمة المرور */}
      <form onSubmit={savePassword} className="card p-6 space-y-4">
        <h2 className="font-bold text-lg flex items-center gap-2">
          <KeyRound className="w-5 h-5 text-accent" />
          تغيير كلمة المرور
        </h2>

        {passMsg.text && <Alert type={passMsg.type}>{passMsg.text}</Alert>}

        <div>
          <label className="label" htmlFor="current">
            كلمة المرور الحالية
          </label>
          <input
            id="current"
            type="password"
            className="field"
            required
            autoComplete="current-password"
            value={pass.current}
            onChange={(e) => setPass({ ...pass, current: e.target.value })}
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label" htmlFor="next">
              الجديدة
            </label>
            <input
              id="next"
              type="password"
              className="field"
              required
              autoComplete="new-password"
              value={pass.next}
              onChange={(e) => setPass({ ...pass, next: e.target.value })}
            />
          </div>
          <div>
            <label className="label" htmlFor="confirmPass">
              تأكيد الجديدة
            </label>
            <input
              id="confirmPass"
              type="password"
              className="field"
              required
              autoComplete="new-password"
              value={pass.confirm}
              onChange={(e) => setPass({ ...pass, confirm: e.target.value })}
            />
          </div>
        </div>

        <button type="submit" disabled={passBusy} className="btn-primary">
          {passBusy ? <Spinner className="w-5 h-5 on-accent" /> : <KeyRound className="w-5 h-5" />}
          تحديث كلمة المرور
        </button>
      </form>
    </div>
  );
}
