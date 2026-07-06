"use client";

import { useState } from "react";

type OptionalPasswordFieldProps = {
  label?: string;
  name?: string;
  placeholder?: string;
  defaultValue?: string;
};

export function OptionalPasswordField({
  label = "Password",
  name = "password",
  placeholder = "New password (leave blank to keep existing)",
  defaultValue = "",
}: OptionalPasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-blue-700">{label}</span>
      <div className="relative">
        <input
          name={name}
          type={visible ? "text" : "password"}
          placeholder={placeholder}
          defaultValue={defaultValue}
          className="w-full rounded-xl border border-blue-200 bg-white px-3 py-2 pr-12 text-sm text-blue-950 outline-none focus:border-blue-400"
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? "Hide password" : "Show password"}
          title={visible ? "Hide password" : "Show password"}
          className="absolute inset-y-0 right-3 my-auto inline-flex h-9 w-9 items-center justify-center rounded-full text-blue-500 transition hover:bg-blue-100 hover:text-blue-900"
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
    </label>
  );
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
      <path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
      <path d="M3 3l18 18" />
      <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
      <path d="M9.9 5.1A10.8 10.8 0 0 1 12 4.5C18.5 4.5 22 12 22 12a18.8 18.8 0 0 1-3.2 4.3" />
      <path d="M6.1 6.1C3.2 8.2 2 12 2 12s3.5 7.5 10 7.5c1 0 2-.2 2.9-.5" />
    </svg>
  );
}
