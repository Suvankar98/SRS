"use client";

import { useState } from "react";
import type { ReactNode } from "react";

type ConfirmSubmitButtonProps = {
  confirmMessage: string;
  ariaLabel: string;
  title: string;
  className: string;
  children: ReactNode;
};

export function ConfirmSubmitButton({
  confirmMessage,
  ariaLabel,
  title,
  className,
  children,
}: ConfirmSubmitButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [formElement, setFormElement] = useState<HTMLFormElement | null>(null);

  function openConfirmation(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    setFormElement(event.currentTarget.form);
    setIsOpen(true);
  }

  function handleConfirm() {
    if (formElement) {
      formElement.submit();
      return;
    }

    setIsOpen(false);
  }

  return (
    <>
      <button type="button" aria-label={ariaLabel} title={title} className={className} onClick={openConfirmation}>
        {children}
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
          <div className="w-full max-w-md rounded-2xl border border-rose-300 bg-white p-5 shadow-[0_24px_80px_rgba(127,29,29,0.25)]">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-rose-700">Delete Confirmation</p>
            <p className="mt-3 text-sm font-medium leading-6 text-rose-800">{confirmMessage}</p>
            <p className="mt-2 text-xs leading-5 text-rose-700/90">
              This action permanently removes data from the database.
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="inline-flex items-center justify-center rounded-lg bg-rose-700 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-rose-600"
              >
                Delete now
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
