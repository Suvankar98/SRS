"use client";

import { useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

type EmployeeReportPopupProps = {
  children: ReactNode;
  buttonClassName?: string;
};

export function EmployeeReportPopup({ children, buttonClassName }: EmployeeReportPopupProps) {
  const [isOpen, setIsOpen] = useState(false);

  const close = () => setIsOpen(false);
  const modal =
    isOpen
      ? createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto bg-slate-950/55 p-3 sm:p-6"
            onClick={close}
          >
            <div
              className="flex max-h-[calc(100vh-2rem)] w-full max-w-6xl flex-col rounded-2xl border border-blue-200 bg-white p-3 shadow-[0_28px_90px_rgba(15,23,42,0.28)] sm:max-h-[calc(100vh-3rem)] sm:p-4"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-3 flex shrink-0 items-center justify-end">
                <button
                  type="button"
                  onClick={close}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-blue-200 text-blue-700 transition hover:bg-blue-50"
                  aria-label="Close report"
                >
                  x
                </button>
              </div>
              <div className="min-h-0 overflow-auto">{children}</div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={
          buttonClassName ??
          "inline-flex items-center justify-center rounded-full border border-blue-200 bg-white px-3 py-1.5 text-xs font-medium text-blue-700 transition hover:bg-blue-50"
        }
      >
        Report
      </button>
      {modal}
    </>
  );
}
