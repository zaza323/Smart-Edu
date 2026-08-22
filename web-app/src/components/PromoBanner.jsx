import { Link } from 'react-router-dom';
import { Trophy } from 'lucide-react';

/**
 * لافتة التحفيز للمنافسة.
 * variant='full'    → لافتة بارزة (الطلاب خارج المراكز الذهبية / لوحة الطالب)
 * variant='compact' → نسخة مصغّرة وهادئة (الطلاب داخل أول 10 — محفَّزون أصلاً)
 */
export default function PromoBanner({ variant = 'full', linkTo = '/app/leaderboard' }) {
  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-2.5 rounded-xl border border-accent/25 bg-accent/[0.06] px-4 py-2.5 text-sm">
        <Trophy className="w-4 h-4 text-accent shrink-0" />
        <span className="text-zinc-300">أنت ضمن المراكز الأولى — حافظ على مركزك! 🏆</span>
      </div>
    );
  }

  const content = (
    <div className="relative overflow-hidden rounded-2xl border-2 border-accent bg-gradient-to-l from-accent/20 via-accent/10 to-transparent px-5 py-4 sm:px-6 sm:py-5">
      <div className="absolute -left-6 -top-8 h-28 w-28 rounded-full bg-accent/20 blur-2xl" />
      <div className="relative flex items-center gap-4">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-accent on-accent shadow-lg shadow-accent/20">
          <Trophy className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <p className="text-[1rem] font-extrabold leading-snug text-zinc-50 sm:text-lg">
            ادخل الآن بالمنافسة على المراكز الأولى واربح جوائز قيمة! 🏆
          </p>
          <p className="mt-1 text-xs text-zinc-400 sm:text-sm">
            كل إجابة صحيحة ترفعك في لوحة الأبطال — اضغط لترى مركزك.
          </p>
        </div>
      </div>
    </div>
  );

  return linkTo ? (
    <Link to={linkTo} className="block transition hover:brightness-110">
      {content}
    </Link>
  ) : (
    content
  );
}
