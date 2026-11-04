import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from './firebase';

/**
 * حضور الطالب («متصل الآن») عبر نبضة دورية في مستند لوحة الأبطال.
 *
 * لماذا نبضة لا كشف قطع اتصال: كشف القطع الحقيقي يحتاج Realtime Database
 * و`onDisconnect`، وهي خدمة ثانية كاملة لا يستعملها المشروع. النبضة تكفي هنا:
 * إغلاق المتصفح يوقفها، فيسقط الطالب من حالة «متصل» وحده بعد انقضاء النافذة
 * دون أن يكتب أحد شيئاً.
 *
 * الكتابة في `leaderboard` لأنها المجموعة الوحيدة التي يقرأها الطلاب عن بعضهم
 * (الأسماء والنقاط فقط)، فلا يحتاج عرض اللوحة قراءة إضافية لكل صف.
 */

// فترة النبض تضبط الكلفة مباشرة: 3 دقائق = 20 كتابة لكل ساعة لكل طالب.
// والنافذة تتسع لنبضة ضائعة (3 + 3 + هامش) حتى لا يومض المؤشّر عند تعثّر
// الشبكة — ثمنها أن من يغلق المتصفح قد يبقى ظاهراً «متصلاً» حتى 8 دقائق.
const BEAT_MS = 3 * 60 * 1000;
export const ONLINE_WINDOW_MS = 8 * 60 * 1000;

/** هل الختم الزمني يقع داخل نافذة «متصل الآن»؟ */
export function isOnline(lastSeenAt) {
  const ms = lastSeenAt?.toMillis?.();
  return Boolean(ms && Date.now() - ms < ONLINE_WINDOW_MS);
}

/**
 * يبدأ النبض ويعيد دالة إيقافه.
 * المستند قد لا يوجد قبل أول اختبار (يُنشأ في submitExam)، فيفشل التحديث
 * ويُتجاهل بهدوء — الطالب خارج اللوحة أصلاً فلا شيء يعرض حضوره.
 */
export function startPresence(uid) {
  const ref = doc(db, 'leaderboard', uid);

  const beat = () => {
    if (document.visibilityState !== 'visible') return;
    updateDoc(ref, { lastSeenAt: serverTimestamp() }).catch(() => {});
  };

  beat();
  const timer = setInterval(beat, BEAT_MS);
  // العودة للتبويب تنبض فوراً بدل انتظار الدورة التالية
  document.addEventListener('visibilitychange', beat);

  return () => {
    clearInterval(timer);
    document.removeEventListener('visibilitychange', beat);
  };
}
