import { Link } from 'react-router-dom';
import { ArrowLeft, BookOpen, Bookmark, Flag, Lock, LockOpen, RefreshCw, Sparkles } from 'lucide-react';
import { Spinner } from '../ui';
import { arCount } from '../landing/common';
import { ProgressRing } from './widgets';

const STATUS = {
  active: { text: 'مفعّل', cls: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300', dot: true },
  pending: { text: 'قيد المراجعة', cls: 'bg-amber-500/15 border-amber-500/30 text-amber-300' },
  expired: { text: 'منتهٍ', cls: 'bg-zinc-800 border-zinc-700 text-zinc-400' },
  none: { text: 'مغلق', cls: 'bg-zinc-800 border-zinc-700 text-zinc-400', lock: true },
};

/**
 * بطاقة مادة في لوحة الطالب.
 * onCustomize(preset): يفتح لوحة «تخصيص الاختبار» على هذه المادة بإعداد مسبق.
 */
export default function SubjectCard({
  subject,
  status,
  stats,
  inProgress,
  savedCount = 0,
  onCustomize,
  onMistakes,
  onSaved,
  busy, // 'mistakes' | 'saved' | ''
}) {
  const active = status === 'active';
  const badge = STATUS[status] || STATUS.none;
  const questionCount = Number(subject.questionCount) || 0;
  const lessonCount = subject.lessons?.length || 0;
  const details = [subject.grade, subject.semester].filter(Boolean).join(' — ');
  const mistakes = stats?.mistakes || 0;

  return (
    <div
      className={`card p-5 sm:p-6 flex flex-col justify-between gap-5 relative overflow-hidden group transition hover:border-zinc-700 ${
        active ? '' : 'bg-surface/70'
      }`}
    >
      {active && (
        <div className="pointer-events-none absolute -top-16 -left-16 w-36 h-36 rounded-full bg-emerald-500/10 blur-2xl transition-transform duration-500 group-hover:scale-125" />
      )}

      <div className="relative">
        <div className="flex items-center justify-between gap-2 mb-4">
          <span className={`badge border ${badge.cls}`}>
            {badge.dot && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />}
            {badge.lock && <Lock className="w-3.5 h-3.5" />}
            {badge.text}
          </span>
          <span className="text-xs text-zinc-500">
            {arCount(questionCount, { one: 'سؤال واحد', two: 'سؤالان', few: 'أسئلة', many: 'سؤالاً' })}
            {lessonCount > 0 && ` · ${arCount(lessonCount, { one: 'درس واحد', two: 'درسان', few: 'دروس', many: 'درساً' })}`}
          </span>
        </div>

        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            <h3 className="text-lg font-bold">{subject.name}</h3>
            {details && <p className="text-sm text-zinc-500 mt-0.5">{details}</p>}
          </div>
          {active ? (
            <ProgressRing value={stats?.mastery ?? 0} tone="stroke-emerald-400">
              <span className="text-[11px] font-bold tabular-nums">{stats?.mastery ?? 0}%</span>
              <span className="text-[8px] text-zinc-500">إتقان</span>
            </ProgressRing>
          ) : (
            <div className="w-12 h-12 shrink-0 rounded-full grid place-items-center bg-zinc-800 border border-zinc-700 text-zinc-400">
              <BookOpen className="w-6 h-6" />
            </div>
          )}
        </div>

        {active ? (
          stats?.attempts ? (
            <div className="flex flex-wrap gap-1.5">
              <span className="px-2.5 py-1 rounded-lg bg-zinc-800/80 border border-zinc-700/60 text-xs">
                آخر نتيجة: <strong className="text-brandInk tabular-nums" dir="ltr">{Math.round(stats.lastPct)}%</strong>
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-zinc-800/80 border border-zinc-700/60 text-xs">
                أفضل نتيجة: <strong className="text-emerald-300 tabular-nums" dir="ltr">{Math.round(stats.bestPct)}%</strong>
              </span>
              {stats.weakest && (
                <button
                  type="button"
                  disabled={stats.weakest.number === null}
                  onClick={() => onCustomize({ mode: 'custom', lessons: [stats.weakest.number] })}
                  title="ابدأ اختباراً في هذا الدرس"
                  className="px-2.5 py-1 rounded-lg bg-accent/10 enabled:hover:bg-accent/20 border border-accent/30 text-accent text-xs flex items-center gap-1 text-right"
                >
                  <Flag className="w-3.5 h-3.5 shrink-0" />
                  الأضعف: {stats.weakest.title}
                </button>
              )}
            </div>
          ) : (
            <p className="text-sm text-zinc-500">لم تختبر نفسك في هذه المادة بعد — ابدأ باختبار سريع.</p>
          )
        ) : (
          <>
            {subject.description && (
              <p className="text-sm text-zinc-400 leading-relaxed mb-4">{subject.description}</p>
            )}
            {subject.price != null && (
              <div className="rounded-xl bg-zinc-800/60 border border-zinc-700/50 px-4 py-3 flex items-center justify-between">
                <span className="text-xs text-zinc-400">الوصول الكامل للمادة</span>
                <span className="font-bold text-accent tabular-nums">{subject.price} د.أ</span>
              </div>
            )}
          </>
        )}
      </div>

      <div className="relative flex flex-col gap-3">
        {active ? (
          <>
            {inProgress ? (
              <Link
                to={`/exam/${inProgress.id}`}
                className="btn w-full bg-brandFill hover:bg-brandFillHover text-white"
              >
                كمّل من حيث وقفت ({inProgress.position})
                <ArrowLeft className="w-4 h-4" />
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => onCustomize({ mode: 'full' })}
                className="btn w-full bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-100"
              >
                ابدأ اختباراً جديداً
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-2 text-xs px-1">
              <button
                type="button"
                onClick={() => onCustomize({ mode: 'quick' })}
                className="text-brandInk hover:underline"
              >
                اختبار سريع (10)
              </button>
              <span className="text-zinc-700">•</span>
              <button
                type="button"
                onClick={() => onCustomize({ mode: 'custom', focusLessons: true })}
                className="text-zinc-400 hover:text-zinc-100"
              >
                حسب الدرس
              </button>
              <span className="text-zinc-700">•</span>
              <button
                type="button"
                onClick={onMistakes}
                disabled={!mistakes || Boolean(busy)}
                title={mistakes ? 'اختبار بلا مؤقّت من أسئلة أخطأت فيها، مع شرح فوري' : 'لا أخطاء سابقة لمراجعتها'}
                className="flex items-center gap-1 text-red-400 enabled:hover:text-red-300 disabled:text-zinc-600 disabled:cursor-not-allowed"
              >
                {busy === 'mistakes' ? <Spinner className="w-3.5 h-3.5" /> : 'راجع أخطائي'}
                <span
                  className={`px-1.5 rounded-full text-[10px] font-bold border ${
                    mistakes ? 'bg-red-500/15 text-red-300 border-red-500/30' : 'bg-zinc-800 text-zinc-500 border-zinc-700'
                  }`}
                >
                  {mistakes}
                </span>
              </button>
              <span className="text-zinc-700">•</span>
              <button
                type="button"
                onClick={onSaved}
                disabled={!savedCount || Boolean(busy)}
                title={
                  savedCount
                    ? 'اختبار بلا مؤقّت من الأسئلة التي حفظتها، مع شرح فوري'
                    : 'احفظ أسئلة بزر «مراجعة لاحقاً» أثناء الاختبار أو من صفحة النتيجة'
                }
                className="flex items-center gap-1 text-amber-300 enabled:hover:underline disabled:text-zinc-600 disabled:cursor-not-allowed"
              >
                {busy === 'saved' ? <Spinner className="w-3.5 h-3.5" /> : <Bookmark className="w-3.5 h-3.5" />}
                المحفوظة
                <span
                  className={`px-1.5 rounded-full text-[10px] font-bold border ${
                    savedCount ? 'bg-amber-500/15 border-amber-500/30' : 'bg-zinc-800 text-zinc-500 border-zinc-700'
                  }`}
                >
                  {savedCount}
                </span>
              </button>
            </div>
          </>
        ) : status === 'pending' ? (
          <Link to={`/app/subscribe/${subject.id}`} className="btn btn-ghost w-full">
            <Sparkles className="w-5 h-5" />
            متابعة حالة الطلب
          </Link>
        ) : (
          <Link to={`/app/subscribe/${subject.id}`} className="btn-primary w-full">
            {status === 'expired' ? <RefreshCw className="w-5 h-5" /> : <LockOpen className="w-5 h-5" />}
            {status === 'expired' ? 'جدّد اشتراكك في المادة' : 'اشترك الآن وفعّل المادة'}
          </Link>
        )}
      </div>
    </div>
  );
}
