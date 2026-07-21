"use client";

import React from "react";

const COUNTRY_CODES = [
  { code: "+91", label: "India" },
  { code: "+60", label: "Malaysia" },
  { code: "+44", label: "UK" },
  { code: "+1", label: "USA" },
  { code: "+971", label: "UAE" },
  { code: "+65", label: "Singapore" },
  { code: "+880", label: "Bangladesh" },
  { code: "+977", label: "Nepal" },
  { code: "+94", label: "Sri Lanka" },
  { code: "+61", label: "Australia" },
] as const;

type PhoneNumberInputProps = {
  name: string;
  label?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  required?: boolean;
  wrapperClassName?: string;
  inputClassName?: string;
  selectClassName?: string;
};

const baseInputClassName =
  "min-w-0 flex-1 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5 text-sm text-blue-950 outline-none transition placeholder:text-blue-400 focus:border-blue-400 focus:bg-white";
const baseSelectClassName =
  "w-28 shrink-0 rounded-xl border border-blue-200 bg-white px-2 py-2.5 text-sm font-semibold text-blue-800 outline-none transition focus:border-blue-400";

export function PhoneNumberInput({
  name,
  label,
  value,
  defaultValue = "",
  onChange,
  required = false,
  wrapperClassName = "",
  inputClassName = baseInputClassName,
  selectClassName = baseSelectClassName,
}: PhoneNumberInputProps) {
  const initialValue = value ?? defaultValue;
  const [countryCode, setCountryCode] = React.useState(() => getPhoneParts(initialValue).countryCode);
  const [localNumber, setLocalNumber] = React.useState(() => getPhoneParts(initialValue).localNumber);
  const submittedValue = composePhoneValue(countryCode, localNumber);

  React.useEffect(() => {
    const parts = getPhoneParts(value ?? defaultValue);
    setCountryCode(parts.countryCode);
    setLocalNumber(parts.localNumber);
  }, [value, defaultValue]);

  function updateCountryCode(nextCode: string) {
    setCountryCode(nextCode);
    onChange?.(composePhoneValue(nextCode, localNumber));
  }

  function updateLocalNumber(nextNumber: string) {
    setLocalNumber(nextNumber);
    onChange?.(composePhoneValue(countryCode, nextNumber));
  }

  return (
    <label className={wrapperClassName}>
      {label ? <span className="mb-2 block text-sm font-medium text-blue-700">{label}</span> : null}
      <input type="hidden" name={name} value={submittedValue} />
      <div className="flex min-w-0 gap-2">
        <select
          value={countryCode}
          onChange={(event) => updateCountryCode(event.target.value)}
          className={selectClassName}
          aria-label={label ? `${label} country code` : "Country code"}
        >
          {COUNTRY_CODES.map((country) => (
            <option key={country.code} value={country.code}>
              {country.code} {country.label}
            </option>
          ))}
        </select>
        <input
          value={localNumber}
          onChange={(event) => updateLocalNumber(event.target.value)}
          type="tel"
          inputMode="tel"
          placeholder="Phone number"
          required={required}
          className={inputClassName}
        />
      </div>
    </label>
  );
}

function getPhoneParts(value: string) {
  const compact = value.trim().replace(/[\s()-]/g, "");

  if (!compact) {
    return { countryCode: "+91", localNumber: "" };
  }

  if (/^[6-9]\d{9}$/.test(compact)) {
    return { countryCode: "+91", localNumber: compact };
  }

  if (/^91[6-9]\d{9}$/.test(compact)) {
    return { countryCode: "+91", localNumber: compact.slice(2) };
  }

  const matchingCountry = [...COUNTRY_CODES]
    .sort((a, b) => b.code.length - a.code.length)
    .find((country) => compact.startsWith(country.code));

  if (matchingCountry) {
    return {
      countryCode: matchingCountry.code,
      localNumber: compact.slice(matchingCountry.code.length),
    };
  }

  return { countryCode: "+91", localNumber: compact };
}

function composePhoneValue(countryCode: string, localNumber: string) {
  const compactNumber = localNumber.trim().replace(/[\s()-]/g, "");

  if (!compactNumber) {
    return "";
  }

  if (compactNumber.startsWith("+")) {
    return compactNumber;
  }

  return `${countryCode}${compactNumber}`;
}
