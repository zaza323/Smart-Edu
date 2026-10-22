import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { Bookmark, BookmarkCheck, CheckCircle2, Clock, RotateCcw, Trophy, XCircle } from 'lucide-react';
import { db } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';
import { saveQuestion, subscribeSaved, unsaveQuestion } from '../../lib/savedQuestions';
import { Alert, Spinner, formatDate, formatDuration } from '../../components/ui';

const ARABIC_LETTERS = ['أ', 'ب', 'ج', 'د'];

function verdict(percentage) {
  if (percentage >= 90) return { text: 'ممتاز! 🎉', tone: 'text-emerald-300' };
  if (percentage >= 75) return { text: 'جيد جداً 👏', tone: 'text-emerald-300' };
  if (percentage >= 60) return { text: 'جيد — تحتاج مراجعة', tone: 'text-amber-300' };
  if (percentage >= 50) return { text: 'مقبول — ركّز أكثر', tone: 'text-amber-300' };
  return { text: 'يحتاج مراجعة جادّة', tone: 'text-red-300' };
}

export default function ResultPage() {
  const { attemptId } = useParams();
  const [attempt, setAttempt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all'); // all | wrong | correct
  const { user } = useAuth();
  const [saved, setSaved] = useState({});

  useEffect(() => (user ? subscribeSaved(user.uid, setSaved) : undefined), [user]);

  function toggleSaved(r) {
    if (!user) return;
    const action = saved[r.questionId]
      ? unsaveQuestion(user.uid, r.questionId)
      : saveQuestion(user.uid, attempt.subjectId, { id: r.questionId, ...r });
    action.catch(() => {});
  }

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'attempts', attemptId));
        if (!snap.exists()) {
          setError('لم يتم العثور على هذه المحاولة.');
        } else if (snap.data().status !== 'submitted') {
          setError('هذه المحاولة لم تُسلَّم بعد.');
        } else {
          setAttempt({ id: snap.id, ...snap.data() });
        }
      } catch {
        setError('تعذّر تحميل النتيجة.');
      } finally {
        setLoading(false);
      }
    })();
  }, [attemptId]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="w-8 h-8" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-xl mx-auto space-y-4">
        <Alert type="error">{error}</Alert>
        <Link to="/app" className="btn-primary w-full">
          العودة للوحة
        </Link>
      </div>
    );
  }

  const v = verdict(attempt.percentage);
  const review = attempt.review || [];
  const shown = review.filter((r) =>
    filter === 'all' ? true : filter === 'wrong' ? !r.isCorrect : r.isCorrect
  );

  return (
    <div className="max-w-3xl mx-auto space-y-5 no-copy">
      {/* بطاقة النتيجة */}
      <div className="card p-7 text-center">
        <div className="w-16 h-16 rounded-2xl bg-accent/10 text-accent grid place-items-center mx-auto mb-4">
          <Trophy className="w-8 h-8" />
        </div>
        <p className="text-zinc-400">نتيجتك في {attempt.subject}</p>
        <p className="text-5xl font-extrabold text-zinc-50 mt-3 tabular-nums" dir="ltr">
          {attempt.score} / {attempt.totalQuestions}
        </p>
        <p className={`text-2xl font-extrabold mt-2 ${v.tone}`}>{attempt.percentage}%</p>
        <p className={`mt-1 font-bold ${v.tone}`}>{v.text}</p>

        <div className="grid grid-cols-3 gap-3 mt-6 text-sm">
          <div className="bg-surface2 rounded-xl py-3">
            <p className="text-emerald-300 font-extrabold text-xl">{attempt.score}</p>
            <p className="text-zinc-500 text-xs mt-0.5">صحيحة</p>
          </div>
          <div className="bg-surface2 rounded-xl py-3">
            <p className="text-red-300 font-extrabold text-xl">
              {attempt.totalQuestions - attempt.score}
            </p>
            <p className="text-zinc-500 text-xs mt-0.5">خاطئة</p>
          </div>
          <div className="bg-surface2 rounded-xl py-3">
            <p className="text-zinc-100 font-extrabold text-xl tabular-nums" dir="ltr">
              {formatDuration(attempt.timeTakenSeconds)}
            </p>
            <p className="text-zinc-500 text-xs mt-0.5">الوقت المستغرق</p>
          </div>
        </div>

        {attempt.autoSubmitted && (
          <p className="text-xs text-amber-300 mt-4 flex items-center justify-center gap-1.5">
            <Clock className="w-4 h-4" />
            تم التسليم تلقائياً عند انتهاء الوقت
          </p>
        )}
        <p className="text-xs text-zinc-600 mt-2">{formatDate(attempt.submittedAt)}</p>

        <div className="flex flex-wrap gap-3 justify-center mt-6">
          <Link to={`/app?start=${attempt.subjectId}`} className="btn-primary">
            <RotateCcw className="w-5 h-5" />
            اختبار جديد
          </Link>
          <Link to="/app/history" className="btn btn-ghost">
            سجل محاولاتي
          </Link>
        </div>
      </div>

      {/* المراجعة التفصيلية */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-extrabold">المراجعة التفصيلية</h2>
        <div className="flex gap-1 bg-surface2 rounded-xl p-1">
          {[
            ['all', 'الكل'],
            ['wrong', 'الخاطئة'],
            ['correct', 'الصحيحة'],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-bold transition ${
                filter === key ? 'bg-accent on-accent' : 'text-zinc-400 hover:text-zinc-100'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {shown.map((r, idx) => (
          <div key={r.questionId} className="card p-5">
            <div className="flex items-start justify-between gap-3 mb-3">
              <span className="flex items-center gap-2">
                <span className="badge bg-zinc-800 text-zinc-400">السؤال {review.indexOf(r) + 1}</span>
                <button
                  type="button"
                  onClick={() => toggleSaved(r)}
                  aria-pressed={Boolean(saved[r.questionId])}
                  title={saved[r.questionId] ? 'إزالة من المحفوظة' : 'احفظه لتراجعه لاحقاً'}
                  className={`badge border transition ${
                    saved[r.questionId]
                      ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                      : 'border-zinc-700 text-zinc-400 hover:text-zinc-100'
                  }`}
                >
                  {saved[r.questionId] ? <BookmarkCheck className="w-3.5 h-3.5" /> : <Bookmark className="w-3.5 h-3.5" />}
                  {saved[r.questionId] ? 'محفوظ' : 'احفظ'}
                </button>
              </span>
              {r.isCorrect ? (
                <span className="badge bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  <CheckCircle2 className="w-4 h-4" />
                  إجابة صحيحة
                </span>
              ) : (
                <span className="badge bg-red-500/15 text-red-300 border border-red-500/30">
                  <XCircle className="w-4 h-4" />
                  {r.selectedIndex === null ? 'لم تُجب' : 'إجابة خاطئة'}
                </span>
              )}
            </div>

            <p className="font-bold leading-relaxed mb-4">{r.questionText}</p>

            <div className="space-y-2">
              {r.optionsText.map((opt, i) => {
                const isCorrect = i === r.correctAnswerIndex;
                const isChosen = i === r.selectedIndex;
                let cls = 'bg-surface2 border-zinc-700 text-zinc-400';
                if (isCorrect) cls = 'bg-emerald-500/10 border-emerald-500/40 text-emerald-200';
                else if (isChosen) cls = 'bg-red-500/10 border-red-500/40 text-red-200';
                return (
                  <div
                    key={i}
                    className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 text-sm ${cls}`}
                  >
                    <span className="w-6 h-6 shrink-0 rounded-md bg-black/20 grid place-items-center font-bold text-xs">
                      {ARABIC_LETTERS[i]}
                    </span>
                    <span className="leading-relaxed flex-1">{opt}</span>
                    {isChosen && <span className="text-xs shrink-0 pt-0.5">إجابتك</span>}
                    {isCorrect && !isChosen && (
                      <span className="text-xs shrink-0 pt-0.5">الصحيحة</span>
                    )}
                  </div>
                );
              })}
            </div>

            {r.explanation && (
              <div className="mt-4 bg-sky-500/10 border border-sky-500/25 rounded-xl px-4 py-3 text-sm text-sky-200 leading-relaxed">
                <span className="font-bold">التوضيح: </span>
                {r.explanation}
              </div>
            )}
            {r.lesson && <p className="text-xs text-zinc-600 mt-3">📖 {r.lesson}</p>}
          </div>
        ))}

        {shown.length === 0 && (
          <p className="text-center text-zinc-500 py-8">لا توجد أسئلة ضمن هذا التصنيف.</p>
        )}
      </div>
    </div>
  );
}
