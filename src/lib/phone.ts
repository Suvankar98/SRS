export const PHONE_VALIDATION_MESSAGE =
  "Please enter a valid phone number. International numbers must include the country code (e.g. +60123456789).";

export function normalizePhoneNumber(value: string) {
  return value.trim().replace(/[\s()-]/g, "");
}

export function normalizePhoneNumberForStorage(raw: string) {
  const normalized = normalizePhoneNumber(raw);
  const isInternational = /^\+[1-9]\d{7,14}$/.test(normalized);
  const isLocalIndian = /^[6-9]\d{9}$/.test(normalized);
  const isLegacyIndianWithCountryCode = /^91[6-9]\d{9}$/.test(normalized);

  if (isInternational) {
    return normalized;
  }

  if (isLocalIndian) {
    return `+91${normalized}`;
  }

  if (isLegacyIndianWithCountryCode) {
    return `+${normalized}`;
  }

  return null;
}

export function isValidPhoneNumber(raw: string) {
  return normalizePhoneNumberForStorage(raw) !== null;
}

export function formatPhoneNumber(raw: string) {
  const normalized = normalizePhoneNumberForStorage(raw);
  if (!normalized) {
    return raw.trim();
  }

  if (/^\+91[6-9]\d{9}$/.test(normalized)) {
    return `+91 ${normalized.slice(3)}`;
  }

  return normalized;
}

export function getPhoneCopyValue(raw: string) {
  return normalizePhoneNumberForStorage(raw) ?? raw.trim();
}

export const normalizeIndianPhoneNumber = normalizePhoneNumberForStorage;
export const formatIndianPhoneNumber = formatPhoneNumber;
export const getIndianPhoneCopyValue = getPhoneCopyValue;
