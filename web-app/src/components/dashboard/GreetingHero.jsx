import { Link } from 'react-router-dom';
import { ArrowLeft, Hand, PlayCircle } from 'lucide-react';
import { loadExamSession } from '../../lib/examSession';

/** ترحيب + استئناف المحاولة الجارية إن وُجدت. */
export default function GreetingHero({ profile, inProgress, canStart, onStartNew }) {
  const firstName = profile?.fullName?.trim().split(/\s+/)[0] || '';

  let resumeText = null;
  if (inProgress) {
    // رقم السؤال الحالي محفوظ محلياً في هذا المتصفح فقط؛ من جهاز آخر نعرض العدد الكلي
    const session = loadExamSession(inProgress.id);
    const total = inProgress.totalQuestions || session?.questions?.length || 0;
    resumeText =
      session && Number.isInteger(session.current)
        ? `سؤال ${session.current + 1} من ${total}`
        : `${total} سؤالاً`;
  }

  return (
    <section className="card p-5 sm:p-7 flex flex-col md:flex-row md:items-center justify-between gap-5">
      <div className="flex items-center gap-4 min-w-0">
        <div className="relative w-14 h-14 shrink-0 rounded-full grid place-items-center bg-accent/15 border border-accent/30 text-accent">
          <Hand className="w-7 h-7" />
          {inProgress && (
            <span className="absolute -top-0.5 -right-0.5 flex w-4 h-4">
              <span className="absolute inset-0 rounded-full bg-emerald-400 opacity-75 animate-ping" />
              <span className="relative w-4 h-4 rounded-full bg-emerald-500" />
            </span>
          )}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold">أهلاً {firstName}</h1>
            {profile?.grade && (
              <span className="badge bg-brand/15 text-brandInk border border-brand/30">{profile.grade}</span>
            )}
          </div>
          <p className="mt-1 text-sm sm:text-[0.95rem] text-zinc-400 flex items-center gap-2">
            {inProgress ? (
              <>
                <span className="w-2 h-2 shrink-0 rounded-full bg-emerald-400" />
                <span>
                  كمّل من حيث وقفت في <strong className="text-zinc-100">{inProgress.subject}</strong> ({resumeText})
                </span>
              </>
            ) : canStart ? (
              'جاهز لجولة جديدة؟ اختر مادة وابدأ اختباراً.'
            ) : (
              'اشترك في مادة لتبدأ التدريب على بنك الأسئلة.'
            )}
          </p>
        </div>
      </div>

      {inProgress ? (
        <Link
          to={`/exam/${inProgress.id}`}
          className="btn bg-brandFill hover:bg-brandFillHover text-white rounded-full px-6 shadow-lg shadow-brand/20"
        >
          متابعة المحاولة
          <ArrowLeft className="w-5 h-5" />
        </Link>
      ) : (
        canStart && (
          <button
            type="button"
            onClick={onStartNew}
            className="btn bg-brandFill hover:bg-brandFillHover text-white rounded-full px-6 shadow-lg shadow-brand/20"
          >
            <PlayCircle className="w-5 h-5" />
            ابدأ اختباراً
          </button>
        )
      )}
    </section>
  );
}
