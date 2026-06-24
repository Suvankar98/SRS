"use client";

import { useState } from "react";

type PasswordFieldProps = {
  compact?: boolean;
};

export function PasswordField({ compact = false }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  const inputClass = compact
    ? "h-10 w-full rounded-md border border-white/50 bg-white px-3 pr-10 text-sm text-[#003d73] outline-none transition placeholder:text-slate-400 focus:border-white"
    : "w-full rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 pr-12 text-blue-950 outline-none transition placeholder:text-blue-400 focus:border-blue-400 focus:bg-white";

  const iconClass = compact
    ? "absolute inset-y-0 right-2 my-auto inline-flex h-7 w-7 items-center justify-center rounded-md text-blue-600 transition hover:bg-blue-100 hover:text-blue-900"
    : "absolute inset-y-0 right-3 my-auto inline-flex h-8 w-8 items-center justify-center rounded-full text-blue-500 transition hover:bg-blue-100 hover:text-blue-900";

  return (
    <label className="block">
      <div className="relative">
        <input
          name="password"
          aria-label="Password"
          type={visible ? "text" : "password"}
          placeholder="Enter password"
          className={inputClass}
          required
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? "Hide password" : "Show password"}
          title={visible ? "Hide password" : "Show password"}
          className={iconClass}
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

