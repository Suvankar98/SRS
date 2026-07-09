"use client";

import React from "react";

type EmployeeDocketActionsProps = {
  docketNumber: string;
  fullAddress: string;
};

export function EmployeeDocketActions({ docketNumber, fullAddress }: EmployeeDocketActionsProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();

    try {
      await navigator.clipboard.writeText(docketNumber);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  const handleOpenMap = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();

    const address = fullAddress.trim();
    if (!address) {
      return;
    }

    const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
    window.open(mapsUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <span className="inline-flex max-w-full items-center gap-1.5">
      <span className="min-w-0 break-words font-semibold text-blue-950">{docketNumber}</span>
      <button
        type="button"
        onClick={handleCopy}
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-blue-200 bg-white text-blue-700 transition hover:bg-blue-50"
        aria-label={copied ? "Docket number copied" : "Copy docket number"}
        title={copied ? "Copied" : "Copy docket number"}
      >
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M8 7V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-2"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <rect
            x="4"
            y="7"
            width="12"
            height="14"
            rx="2"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <button
        type="button"
        onClick={handleOpenMap}
        disabled={!fullAddress.trim()}
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-blue-200 bg-white text-blue-700 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
        aria-label="Open address in maps"
        title="Open address in maps"
      >
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M12 21s7-5.2 7-12a7 7 0 1 0-14 0c0 6.8 7 12 7 12Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="12" cy="9" r="2.5" stroke="currentColor" strokeWidth="2" />
        </svg>
      </button>
    </span>
  );
}
