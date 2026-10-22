import { useEffect, useState } from 'react';
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
import { ArrowLeft, Trophy } from 'lucide-react';
import { db } from '../../lib/firebase';

/**
 * سباق لوحة الأبطال لمادة واحدة: مركز الطالب، والطالب الذي يسبقه مباشرة،
 * وكم نقطة تفصله عنه. النقاط = مجموع إجاباته الصحيحة في المادة (تُجمع في submitExam).
 */
export default function RaceCard({ uid, subjectId, subjectName }) {
  const [race, setRace] = useState(null); // null = تحميل
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setRace(null);
    setFailed(false);
    (async () => {
      try {
        // معرّف المادة فيه شرطات، فمسار الحقل يُبنى بـ FieldPath لا بنص منقوط
        const scorePath = new FieldPath('subjectScores', subjectId);
        const mine = await getDoc(doc(db, 'leaderboard', uid));
        const myScore = mine.exists() ? mine.data().subjectScores?.[subjectId] : undefined;
        if (myScore === undefined) {
          if (!cancelled) setRace({ joined: false });
          return;
        }
        const aheadQuery = query(collection(db, 'leaderboard'), where(scorePath, '>', myScore));
        const [aheadCount, nextSnap] = await Promise.all([
          getCountFromServer(aheadQuery),
          getDocs(query(aheadQuery, orderBy(scorePath, 'asc'), limit(1))),
        ]);
        const next = nextSnap.docs[0];
        if (!cancelled) {
          setRace({
            joined: true,
            rank: aheadCount.data().count + 1,
            myScore,
            next: next
              ? {
                  name: (next.data().fullName || '').trim().split(/\s+/)[0] || 'الطالب الذي يسبقك',
                  score: next.data().subjectScores?.[subjectId] ?? 0,
                }
              : null,
          });
        }
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uid, subjectId]);

  if (failed) return null;

  let message;
  let progress = 0;
  let scoreLabel = '';
  if (!race) {
    message = 'جارٍ تحميل ترتيبك...';
  } else if (!race.joined) {
    message = `أكمل أول اختبار في ${subjectName} لتدخل السباق — كل إجابة صحيحة نقطة.`;
  } else if (!race.next) {
    message = 'أنت في الصدارة! حافظ على مركزك الأول.';
    progress = 100;
    scoreLabel = `${race.myScore} نقطة`;
  } else {
    const gap = race.next.score - race.myScore;
    message = (
      <>
        ناقصك <strong className="text-zinc-100">{gap} نقطة</strong> لتتجاوز {race.next.name} وتصل للمركز #
        {race.rank - 1}
      </>
    );
    progress = race.next.score ? Math.round((race.myScore / race.next.score) * 100) : 0;
    scoreLabel = `${race.myScore} / ${race.next.score} نقطة`;
  }

  return (
    <section className="card p-5 bg-gradient-to-l from-surface via-surface to-accent/[0.05]">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-12 h-12 shrink-0 rounded-xl grid place-items-center bg-accent/15 border border-accent/30 text-accent">
            <Trophy className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-accent">سباق لوحة الأبطال — {subjectName}</span>
              {race?.joined && (
                <span className="badge bg-zinc-800 border border-zinc-700 text-zinc-100">المركز #{race.rank}</span>
              )}
            </div>
            <p className="text-sm text-zinc-400 mt-0.5">{message}</p>
          </div>
        </div>

        <div className="flex items-center gap-4 lg:w-1/2">
          {race?.joined && (
            <div className="flex-1 min-w-0">
              <div className="flex justify-between text-xs text-zinc-400 mb-1.5">
                <span>تقدّم الترتيب</span>
                <span className="font-semibold text-brandInk tabular-nums">{scoreLabel}</span>
              </div>
              <div className="h-2.5 rounded-full bg-zinc-800 border border-zinc-700/50 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-l from-brand to-sky-400 transition-all duration-1000"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
          <Link
            to="/app/leaderboard"
            className="shrink-0 mr-auto flex items-center gap-1 text-sm font-semibold text-brandInk hover:underline"
          >
            لوحة الأبطال
            <ArrowLeft className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
