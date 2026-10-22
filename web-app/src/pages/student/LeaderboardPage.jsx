import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FieldPath,
  collection,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { Crown, RefreshCw, Trophy } from 'lucide-react';
import { db } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';
import { Alert, EmptyState, Spinner } from '../../components/ui';
import PromoBanner from '../../components/PromoBanner';

const TOP_LIMIT = 50;

// حدود الشارات حسب الترتيب (تُحسب وقت العرض، غير مخزّنة)
const GOLD_MAX = 10;
const SILVER_MAX = 20;
const BRONZE_MAX = 33;

function badgeOf(rank) {
  if (rank <= GOLD_MAX) {
    return { emoji: '🥇', label: 'ذهبي', ring: 'border-amber-400/60 bg-amber-400/10', text: 'text-amber-300' };
  }
  if (rank <= SILVER_MAX) {
    return { emoji: '🥈', label: 'فضي', ring: 'border-zinc-300/40 bg-zinc-300/10', text: 'text-zinc-200' };
  }
  if (rank <= BRONZE_MAX) {
    return { emoji: '🥉', label: 'برونزي', ring: 'border-orange-500/40 bg-orange-500/10', text: 'text-orange-300' };
  }
  return null;
}

export default function LeaderboardPage() {
  const { user, profile } = useAuth();
  const [subjectId, setSubjectId] = useState('');
  const [rows, setRows] = useState([]);
  const [myEntry, setMyEntry] = useState(null); // { rank, score, fullName, grade } لو خارج الـ50
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // المواد المفعّلة للطالب فقط — المنافسة لكل مادة على حدة
  const subjects = useMemo(() => {
    const subs = profile?.subscriptions || {};
    return Object.entries(subs)
      .filter(([, s]) => s.status === 'active')
      .map(([id, s]) => ({ id, name: s.subjectName || id }));
  }, [profile]);

  useEffect(() => {
    if (!subjectId && subjects.length > 0) setSubjectId(subjects[0].id);
    if (subjects.length === 0) setLoading(false);
  }, [subjects, subjectId]);

  async function load(sid) {
    if (!sid) return;
    setLoading(true);
    setError('');
    try {
      // مسار الحقل يُبنى بـ FieldPath لأن معرّف المادة يحتوي شرطات
      // (تحليل النص "subjectScores.islamic-11-s1" كان سيفشل)
      const scorePath = new FieldPath('subjectScores', sid);

      const snap = await getDocs(
        query(collection(db, 'leaderboard'), orderBy(scorePath, 'desc'), limit(TOP_LIMIT))
      );
      const list = snap.docs.map((d, i) => ({
        uid: d.id,
        rank: i + 1,
        ...d.data(),
        score: d.data().subjectScores?.[sid] ?? 0,
      }));
      setRows(list);

      // إن لم يكن الطالب ضمن أول 50، نحسب مركزه بعدّاد رخيص (بلا قراءة كل المستندات)
      if (!list.some((r) => r.uid === user.uid)) {
        const mine = await getDoc(doc(db, 'leaderboard', user.uid));
        const myScore = mine.exists() ? mine.data().subjectScores?.[sid] : undefined;
        if (myScore === undefined) {
          setMyEntry(null);
        } else {
          const ahead = await getCountFromServer(
            query(collection(db, 'leaderboard'), where(scorePath, '>', myScore))
          );
          setMyEntry({
            uid: user.uid,
            rank: ahead.data().count + 1,
            score: myScore,
            fullName: mine.data().fullName || profile?.fullName || '',
            grade: mine.data().grade || profile?.grade || '',
          });
        }
      } else {
        setMyEntry(null);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (subjectId) load(subjectId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectId]);

  const myRank = rows.find((r) => r.uid === user?.uid)?.rank ?? myEntry?.rank ?? null;

  if (subjects.length === 0) {
    return (
      <div className="space-y-5">
        <h1 className="text-2xl font-extrabold">لوحة الأبطال</h1>
        <PromoBanner linkTo={null} />
        <EmptyState
          icon={Trophy}
          title="لا توجد مواد مفعّلة بعد"
          description="اشترك في مادة وابدأ الحل لتدخل المنافسة على المراكز الأولى."
          action={
            <Link to="/app" className="btn-primary">
              تصفّح المواد
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold flex items-center gap-2">
            <Trophy className="w-6 h-6 text-accent" />
            لوحة الأبطال
          </h1>
          <p className="text-zinc-400 mt-1 text-sm">
            الترتيب حسب مجموع إجاباتك الصحيحة في المادة — يتحدّث بعد كل اختبار.
          </p>
        </div>
        <button onClick={() => load(subjectId)} disabled={loading} className="btn btn-ghost btn-sm">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          تحديث
        </button>
      </div>

      {/* اللافتة: مصغّرة للمراكز الذهبية، بارزة لغيرهم */}
      <PromoBanner variant={myRank && myRank <= GOLD_MAX ? 'compact' : 'full'} linkTo={null} />

      {/* تبديل المواد */}
      {subjects.length > 1 && (
        <div className="flex gap-1 bg-surface2 rounded-xl p-1 overflow-x-auto">
          {subjects.map((s) => (
            <button
              key={s.id}
              onClick={() => setSubjectId(s.id)}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition whitespace-nowrap ${
                subjectId === s.id ? 'bg-accent on-accent' : 'text-zinc-400 hover:text-zinc-100'
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      {error && <Alert type="error">{error}</Alert>}

      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner className="w-8 h-8" />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Crown}
          title="لم يدخل أحد المنافسة بعد"
          description="كن أول من يتصدّر — ابدأ اختباراً الآن وستظهر هنا فوراً."
          action={
            <Link to={`/app?start=${subjectId}`} className="btn-primary">
              ابدأ اختباراً
            </Link>
          }
        />
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <Row key={r.uid} row={r} isMe={r.uid === user?.uid} />
          ))}

          {/* مركز الطالب حين يكون خارج أول 50 — يظهر دائماً */}
          {myEntry && (
            <>
              <div className="flex items-center gap-3 py-2">
                <div className="h-px flex-1 bg-zinc-800" />
                <span className="text-xs text-zinc-600">مركزك</span>
                <div className="h-px flex-1 bg-zinc-800" />
              </div>
              <Row row={myEntry} isMe />
            </>
          )}

          {/* لم يدخل المنافسة في هذه المادة بعد */}
          {!myEntry && !rows.some((r) => r.uid === user?.uid) && (
            <div className="card border-dashed p-5 text-center">
              <p className="text-zinc-400 text-sm">
                لم تدخل المنافسة في هذه المادة بعد.{' '}
                <Link to={`/app?start=${subjectId}`} className="text-accent font-bold underline">
                  ابدأ اختباراً
                </Link>{' '}
                ليظهر اسمك هنا.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ row, isMe }) {
  const badge = badgeOf(row.rank);
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition ${
        isMe
          ? 'border-accent bg-accent/10 shadow-lg shadow-accent/5'
          : badge
            ? `${badge.ring}`
            : 'border-zinc-800 bg-surface'
      }`}
    >
      {/* الترتيب */}
      <div className="w-11 shrink-0 text-center">
        {badge ? (
          <span className="text-2xl leading-none" title={badge.label}>
            {badge.emoji}
          </span>
        ) : (
          <span className="text-lg font-extrabold text-zinc-500 tabular-nums">{row.rank}</span>
        )}
        {badge && (
          <p className={`text-[10px] font-bold mt-0.5 tabular-nums ${badge.text}`}>#{row.rank}</p>
        )}
      </div>

      {/* الاسم والصف */}
      <div className="min-w-0 flex-1">
        <p className={`font-bold truncate ${isMe ? 'text-accent' : 'text-zinc-100'}`}>
          {row.fullName || 'طالب'}
          {isMe && <span className="mr-2 text-xs font-extrabold text-accent">← أنت</span>}
        </p>
        <p className="text-xs text-zinc-500 truncate mt-0.5">{row.grade || '—'}</p>
      </div>

      {/* عدد الإجابات الصحيحة */}
      <div className="shrink-0 text-left">
        <p className="text-xl font-extrabold text-zinc-50 tabular-nums">{row.score}</p>
        <p className="text-[10px] text-zinc-500">إجابة صحيحة</p>
      </div>
    </div>
  );
}
