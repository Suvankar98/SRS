"use client";

import React from "react";

export function RemarkPopup({ remark }: { remark: string }) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 underline decoration-blue-300 underline-offset-2 transition hover:text-blue-800"
      >
        <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3 shrink-0" aria-hidden="true">
          <path
            fillRule="evenodd"
            d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm9 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM6.92 6.085c.081-.16.19-.299.34-.398.145-.097.371-.187.74-.187.28 0 .506.069.668.19a.598.598 0 0 1 .272.505c0 .233-.088.4-.263.55-.165.14-.414.26-.737.38C7.48 7.26 7 7.5 7 8.5h1.5c0-.42.2-.6.63-.77.44-.173.87-.41 1.18-.71.314-.303.49-.72.49-1.27 0-.69-.27-1.24-.76-1.6C9.55 3.83 8.94 3.5 8 3.5c-.64 0-1.22.17-1.68.48-.46.31-.78.77-.92 1.34l1.52.765Z"
            clipRule="evenodd"
          />
        </svg>
        View remark
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-blue-200 bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-blue-950">Remark</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1 text-blue-400 transition hover:bg-blue-50 hover:text-blue-700"
                aria-label="Close"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                  <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                </svg>
              </button>
            </div>
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-blue-900">
              {remark}
            </p>
          </div>
        </div>
      )}
    </>
  );
}

