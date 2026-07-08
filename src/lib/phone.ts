export function normalizeIndianPhoneNumber(raw: string) {
  const digits = raw.replace(/\D/g, "");

  let nationalNumber = "";
  if (digits.length === 10) {
    nationalNumber = digits;
  } else if (digits.length === 11 && digits.startsWith("0")) {
    nationalNumber = digits.slice(1);
  } else if (digits.length === 12 && digits.startsWith("91")) {
    nationalNumber = digits.slice(2);
  }

  if (!/^[6-9]\d{9}$/.test(nationalNumber)) {
    return null;
  }

  return `+91${nationalNumber}`;
}

export function formatIndianPhoneNumber(raw: string) {
  const normalized = normalizeIndianPhoneNumber(raw);
  if (!normalized) {
    return raw.trim();
  }

  return `+91 ${normalized.slice(3)}`;
}

export function getIndianPhoneCopyValue(raw: string) {
  return normalizeIndianPhoneNumber(raw) ?? raw.trim();
}
