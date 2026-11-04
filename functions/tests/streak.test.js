/**
 * اختبار منطق الحماسات اليومية — يغطّي سيناريوهات القواعد المعتمدة:
 * عتبة الخمسة، تكرار السؤال، حماسة واحدة في اليوم، السبعة والمكافأة،
 * التصفير بعدها، الانقطاع والعودة، والطلبات المتزامنة.
 *
 * التشغيل:  node tests/streak.test.js
 */

const { applyAnswers, emptyStreak, isBroken, previousDay, STREAK_RULES } = require('../lib/streak');

const { DAILY_GOAL, STREAK_TARGET, REWARD_POINTS } = STREAK_RULES;

let failures = 0;
const pass = (m) => console.log('  ✅ ' + m);
const fail = (m) => { console.log('  ❌ ' + m); failures += 1; };
const check = (cond, ok, bad) => (cond ? pass(ok) : fail(bad));
const eq = (a, b, label) => check(a === b, `${label} = ${b}`, `${label}: توقّعت ${b} فجاء ${a}`);

/** يحلّ n أسئلة مختلفة في يوم، بمعرّفات فريدة لذلك اليوم. */
const ids = (day, n, offset = 0) => Array.from({ length: n }, (_, i) => `${day}-q${i + offset}`);

/** يمرّ على أيام متتالية ويحلّ الهدف في كلّ منها. */
function runDays(state, days) {
  let s = state;
  let last = null;
  for (const day of days) {
    last = applyAnswers(s, day, ids(day, DAILY_GOAL));
    s = last.state;
  }
  return { state: s, last };
}

const D1 = '2026-03-01';
const D2 = '2026-03-02';
const D3 = '2026-03-03';

console.log('\nحساب اليوم السابق');
eq(previousDay('2026-03-01'), '2026-02-28', 'بداية الشهر');
eq(previousDay('2026-01-01'), '2025-12-31', 'بداية السنة');
eq(previousDay('2024-03-01'), '2024-02-29', 'سنة كبيسة');

console.log('\nعتبة الخمسة أسئلة');
{
  const none = applyAnswers(null, D1, []);
  check(!none.events.streakEarned && none.state.today.count === 0, 'دخول بلا حل ⇒ لا حماسة', 'الدخول وحده لا يمنح حماسة');

  const four = applyAnswers(null, D1, ids(D1, 4));
  eq(four.state.today.count, 4, 'بعد 4 أسئلة العدّاد');
  check(!four.events.streakEarned, '4 أسئلة ⇒ لا حماسة بعد', '4 أسئلة يجب ألا تمنح حماسة');
  eq(four.state.current, 0, 'الحماسات بعد 4 أسئلة');

  const fifth = applyAnswers(four.state, D1, [`${D1}-q4`]);
  check(fifth.events.streakEarned, 'السؤال الخامس ⇒ حماسة', 'السؤال الخامس يجب أن يمنح حماسة');
  eq(fifth.state.current, 1, 'الحماسات بعد الخامس');
  eq(fifth.state.totalEarned, 1, 'إجمالي الحماسات');
  eq(fifth.state.longest, 1, 'أطول سلسلة');
}

console.log('\nتكرار السؤال نفسه');
{
  const repeated = applyAnswers(null, D1, [`${D1}-a`, `${D1}-a`, `${D1}-a`, `${D1}-a`, `${D1}-a`]);
  eq(repeated.state.today.count, 1, 'خمس مرات لنفس السؤال تُحتسب');
  check(!repeated.events.streakEarned, 'تكرار السؤال لا يمنح حماسة', 'تكرار السؤال يجب ألا يمنح حماسة');

  const four = applyAnswers(null, D1, ids(D1, 4));
  const again = applyAnswers(four.state, D1, ids(D1, 4)); // نفس الأربعة
  eq(again.state.today.count, 4, 'إعادة نفس الأسئلة تُبقي العدّاد');
  check(!again.changed, 'إعادة نفس الأسئلة لا تغيّر شيئاً', 'إعادة نفس الأسئلة يجب ألا تغيّر الحالة');
}

console.log('\nحماسة واحدة في اليوم مهما زاد الحل');
{
  const first = applyAnswers(null, D1, ids(D1, DAILY_GOAL));
  const more = applyAnswers(first.state, D1, ids(D1, 20, 100));
  eq(more.state.current, 1, 'الحماسات بعد حل 20 سؤالاً إضافياً');
  check(!more.events.streakEarned, 'لا حماسة ثانية في اليوم نفسه', 'اليوم الواحد يجب ألا يمنح حماستين');
  eq(more.state.totalEarned, 1, 'إجمالي الحماسات بعد يوم واحد');
  check(more.state.today.ids.length === 0, 'المعرّفات تُفرَّغ بعد بلوغ الهدف', 'المعرّفات يجب أن تُفرَّغ');
}

console.log('\nسبعة أيام متتالية ⇒ 30 نقطة');
{
  const days = Array.from({ length: STREAK_TARGET }, (_, i) => `2026-03-${String(i + 1).padStart(2, '0')}`);
  const { state, last } = runDays(null, days);
  check(last.events.reward !== null, 'اليوم السابع ⇒ مكافأة', 'اليوم السابع يجب أن يمنح مكافأة');
  eq(last.events.reward.points, REWARD_POINTS, 'نقاط المكافأة');
  eq(state.current, 0, 'العدّاد بعد المكافأة');
  eq(state.longest, STREAK_TARGET, 'أطول سلسلة');
  eq(state.totalEarned, STREAK_TARGET, 'إجمالي الحماسات');
  eq(state.rewardsCount, 1, 'عدد المكافآت');
  eq(state.rewardPoints, REWARD_POINTS, 'مجموع نقاط المكافآت');

  // لا مكافأة ثانية في اليوم السابع نفسه مهما تكرّر الطلب
  const retry = applyAnswers(state, days[STREAK_TARGET - 1], ids('x', DAILY_GOAL, 500));
  check(retry.events.reward === null, 'لا مكافأة مكرّرة في اليوم نفسه', 'المكافأة يجب ألا تتكرر');
  eq(retry.state.rewardsCount, 1, 'عدد المكافآت بعد إعادة الطلب');

  // اليوم الثامن يبدأ سلسلة جديدة من 1
  const eighth = applyAnswers(state, '2026-03-08', ids('2026-03-08', DAILY_GOAL));
  eq(eighth.state.current, 1, 'الحماسات في اليوم الثامن');
  eq(eighth.state.longest, STREAK_TARGET, 'أطول سلسلة تبقى محفوظة');
}

console.log('\nالانقطاع والعودة');
{
  const { state } = runDays(null, [D1, D2, D3]);
  eq(state.current, 3, 'الحماسات بعد ثلاثة أيام');

  const gapDay = '2026-03-05'; // غاب يوم 04
  const back = applyAnswers(state, gapDay, ids(gapDay, DAILY_GOAL));
  check(back.events.broken, 'العودة بعد غياب ⇒ حدث انقطاع', 'الانقطاع يجب أن يُرصد');
  eq(back.state.current, 1, 'الحماسات بعد العودة');
  eq(back.state.longest, 3, 'أطول سلسلة تبقى 3');
  eq(back.state.totalEarned, 4, 'إجمالي الحماسات يستمر بالتراكم');

  check(isBroken(state, gapDay), 'isBroken ترصد الانقطاع قبل الحل', 'isBroken يجب أن ترصد الانقطاع');
  check(!isBroken(state, '2026-03-04'), 'اليوم التالي مباشرة ليس انقطاعاً', 'اليوم التالي يجب ألا يُعدّ انقطاعاً');
  check(!isBroken(state, D3), 'يوم الحماسة نفسه ليس انقطاعاً', 'يوم الحماسة يجب ألا يُعدّ انقطاعاً');
  check(!isBroken(emptyStreak(), D1), 'طالب جديد ليس منقطعاً', 'الطالب الجديد يجب ألا يُعدّ منقطعاً');
}

console.log('\nالطلبات المتزامنة ونفس اليوم من جهازين');
{
  // جهازان يقرآن الحالة نفسها ويرسلان دفعتين — المعاملة الذرّية تعيد تشغيل
  // الثانية على نتيجة الأولى، وهذا ما تحاكيه هذه الحالة
  const base = applyAnswers(null, D1, ids(D1, 3));
  const deviceA = applyAnswers(base.state, D1, ids(D1, 3)); // مكرّرة
  const deviceB = applyAnswers(deviceA.state, D1, ids(D1, 5, 3)); // جديدة
  eq(deviceA.state.today.count, 3, 'الجهاز الأول بإجابات مكرّرة');
  check(deviceB.events.streakEarned, 'الجهاز الثاني يكمل الهدف', 'الهدف يجب أن يكتمل عبر الجهازين');
  eq(deviceB.state.current, 1, 'حماسة واحدة رغم الجهازين');
  eq(deviceB.state.totalEarned, 1, 'إجمالي الحماسات رغم الجهازين');
}

console.log('\nتبديل اليوم يصفّر تقدّم الأمس');
{
  const partial = applyAnswers(null, D1, ids(D1, 4)); // لم يبلغ الهدف
  const nextDay = applyAnswers(partial.state, D2, ids(D2, 1));
  eq(nextDay.state.today.count, 1, 'عدّاد اليوم الجديد');
  eq(nextDay.state.current, 0, 'الأمس الناقص لا يمنح حماسة');
  check(!nextDay.events.streakEarned, 'أربعة أسئلة بالأمس لا تُرحَّل', 'تقدّم الأمس الناقص يجب ألا يُرحَّل');
}

console.log('\nمدخلات غير صالحة');
{
  const junk = applyAnswers(null, D1, ['', null, undefined, 42, {}, `${D1}-ok`]);
  eq(junk.state.today.count, 1, 'المعرّفات غير النصّية تُتجاهل');
}

console.log(
  failures === 0 ? '\n✅ كل اختبارات الحماسات نجحت\n' : `\n❌ فشل ${failures} اختباراً\n`
);
process.exit(failures === 0 ? 0 : 1);
