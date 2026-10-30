/**
 * حسابات تُنشئها الإدارة بلا بريد: الدخول برقم الهاتف، ويُخزَّن في Firebase Auth
 * كبريد داخلي مبني على الرقم (لا تُرسَل إليه رسائل، فاستعادة كلمة المرور عبر الإدارة).
 */
export const PHONE_EMAIL_DOMAIN = 'phone.smart-edu-bank.netlify.app';

const toLatinDigits = (s) =>
  s.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));

/** رقم أردني بصيغة 07XXXXXXXX، أو null إن لم يكن رقماً صالحاً. */
export function normalizeJordanPhone(input) {
  let d = toLatinDigits(String(input || '')).replace(/\D/g, '');
  if (d.startsWith('00962')) d = d.slice(5);
  else if (d.startsWith('962')) d = d.slice(3);
  if (d.length === 9 && d.startsWith('7')) d = `0${d}`;
  return /^07[789]\d{7}$/.test(d) ? d : null;
}

export const phoneLoginEmail = (phone) => `${phone}@${PHONE_EMAIL_DOMAIN}`;

/** حقل الدخول يقبل البريد أو رقم الهاتف — يعيد البريد الذي يُسجَّل به الدخول. */
export function loginIdentifierToEmail(input) {
  const value = String(input || '').trim();
  if (value.includes('@')) return value;
  const phone = normalizeJordanPhone(value);
  return phone ? phoneLoginEmail(phone) : value;
}

export const isPhoneAccountEmail = (email) => String(email || '').endsWith(`@${PHONE_EMAIL_DOMAIN}`);

/** يعرض رقم الهاتف بدل البريد الداخلي لحسابات الهاتف. */
export const displayLogin = (email) => (isPhoneAccountEmail(email) ? email.split('@')[0] : email);
