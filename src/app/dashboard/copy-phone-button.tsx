"use client";

import React from "react";

type CopyPhoneButtonProps = {
  value: string;
};

export function CopyPhoneButton({ value }: CopyPhoneButtonProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();

    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex h-8 items-center justify-center rounded-full border border-blue-200 bg-white px-2.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-50"
      aria-label={copied ? "Phone number copied" : "Copy phone number"}
    >
      <span className="sr-only">{copied ? "Phone number copied" : "Copy phone number"}</span>
      <svg
        className="h-4 w-4"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M8 3H16C17.1046 3 18 3.89543 18 5V7H16V5H8V17H10V19H8C6.89543 19 6 18.1046 6 17V5C6 3.89543 6.89543 3 8 3Z"
          fill="currentColor"
        />
        <path
          d="M8 7H18C19.1046 7 20 7.89543 20 9V19C20 20.1046 19.1046 21 18 21H8C6.89543 21 6 20.1046 6 19V9C6 7.89543 6.89543 7 8 7ZM8 9V19H18V9H8Z"
          fill="currentColor"
        />
      </svg>
      <span className="ml-2 hidden sm:inline">{copied ? "Copied" : "Copy"}</span>
    </button>
  );
}
