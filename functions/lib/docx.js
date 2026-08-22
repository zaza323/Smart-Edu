/**
 * ============================================================================
 *  قارئ ملفات Word (.docx) — التنفيذ الوحيد المعتمد لقراءة مستندات Word.
 * ----------------------------------------------------------------------------
 *  ملف .docx هو أرشيف ZIP يحتوي `word/document.xml`. نقرأ منه:
 *   - فقرات جسم المستند العليا فقط (w:body > w:p) — دون الفقرات داخل الجداول،
 *     حتى لا تختلط خلايا جدول الإجابات بتسلسل الأسئلة.
 *   - الجداول (w:tbl) على حدة، لقراءة «جدول الإجابات الصحيحة» إن وُجد.
 *   - لون الخط لكل run من `w:rPr > w:color/@w:val` — التنسيق المباشر فقط.
 *     اللون الموروث من نمط حرف (rStyle) غير مدعوم؛ لم يظهر في أي ملف حتى الآن،
 *     ولو ظهر فسيُبلَّغ عنه كتحذير «0 إجابات ملوّنة» لا كقبول خاطئ.
 * ============================================================================
 */

const JSZip = require('jszip');
const { DOMParser } = require('@xmldom/xmldom');

/** الأبناء المباشرون من عنصر معيّن باسم وسم محدد. */
function directChildren(node, tagName) {
  const out = [];
  for (let i = 0; i < node.childNodes.length; i++) {
    const child = node.childNodes[i];
    if (child.nodeType === 1 && child.nodeName === tagName) out.push(child);
  }
  return out;
}

function firstDirectChild(node, tagName) {
  return directChildren(node, tagName)[0] || null;
}

/** نص العنصر = تجميع كل عقد w:t بداخله. */
function textOf(node) {
  const parts = [];
  const texts = node.getElementsByTagName('w:t');
  for (let i = 0; i < texts.length; i++) {
    parts.push(texts[i].textContent || '');
  }
  return parts.join('');
}

/** لون الخط المحدد مباشرة على الـ run، أو null. */
function runColor(run) {
  const rPr = firstDirectChild(run, 'w:rPr');
  if (!rPr) return null;
  const color = firstDirectChild(rPr, 'w:color');
  if (!color) return null;
  const val = color.getAttribute('w:val');
  if (!val || val.toLowerCase() === 'auto') return null;
  return val.toUpperCase();
}

/**
 * يفكّ ضغط الملف ويعيد بنية مبسّطة:
 *   { paragraphs: [{ text, runs: [{ text, color }] }], tables: [ [ [cellText] ] ] }
 */
async function readDocx(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const entry = zip.file('word/document.xml');
  if (!entry) throw new Error('الملف ليس مستند Word صالحاً (لا يحتوي word/document.xml).');

  const xml = await entry.async('string');
  // تجاهل تحذيرات المُحلِّل غير القاتلة — مستندات Word الحقيقية تحوي وسوماً كثيرة
  // لا تعنينا، ولا يصحّ أن يفشل الاستيراد بسببها.
  const dom = new DOMParser({ onError: () => {} }).parseFromString(xml, 'text/xml');

  const body = dom.getElementsByTagName('w:body')[0];
  if (!body) throw new Error('مستند Word فارغ أو تالف.');

  const paragraphs = [];
  const tables = [];

  for (let i = 0; i < body.childNodes.length; i++) {
    const node = body.childNodes[i];
    if (node.nodeType !== 1) continue;

    if (node.nodeName === 'w:p') {
      const runs = [];
      const runNodes = node.getElementsByTagName('w:r');
      for (let r = 0; r < runNodes.length; r++) {
        runs.push({ text: textOf(runNodes[r]), color: runColor(runNodes[r]) });
      }
      paragraphs.push({ text: textOf(node), runs });
    } else if (node.nodeName === 'w:tbl') {
      const rows = [];
      const rowNodes = directChildren(node, 'w:tr');
      for (const row of rowNodes) {
        rows.push(directChildren(row, 'w:tc').map((cell) => textOf(cell).trim()));
      }
      tables.push(rows);
    }
  }

  return { paragraphs, tables };
}

module.exports = { readDocx };
