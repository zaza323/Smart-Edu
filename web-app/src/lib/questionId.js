/**
 * توليد معرّف السؤال بنفس البصمة المستخدمة في أدوات الاستيراد
 * (`functions/lib/extractQuestions.js` و`scripts/import-questions.js`).
 *
 * ضروري أن تتطابق الخوارزمية تماماً: سؤال يُضاف يدوياً من لوحة الأدمن ثم يصل
 * لاحقاً ضمن ملف Word سيحمل نفس المعرّف، فيُتعرَّف عليه كمكرر ولا يُضاف مرتين.
 *
 * البصمة تشمل نصوص الخيارات وليس نص السؤال وحده، لأن بنك الوزارة يحتوي أسئلة
 * مختلفة تشترك في نفس نص السؤال وتختلف في الخيارات فقط.
 */

function normalize(text) {
  return String(text || '')
    .replace(/[ً-ْٰـ]/g, '') // تشكيل وتطويل
    .replace(/\s+/g, ' ')
    .trim();
}

export async function makeQuestionId(subjectId, lessonNumber, questionText, optionsText) {
  const signature = [
    subjectId,
    lessonNumber,
    normalize(questionText),
    (optionsText || []).map(normalize).join('~'),
  ].join('|');

  const bytes = new TextEncoder().encode(signature);
  const digest = await crypto.subtle.digest('SHA-1', bytes);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 24);
}
