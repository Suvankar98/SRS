"use client";

import { addCallType, deleteCallType, updateCallType } from "../actions";
import { ConfirmSubmitButton } from "../confirm-submit-button";

type FixedCallTypeItem = {
  id: string;
  name: string;
};

type FixedCallTypesSectionProps = {
  initialCallTypes: FixedCallTypeItem[];
};

export function FixedCallTypesSection({ initialCallTypes }: FixedCallTypesSectionProps) {
  return (
    <article className="rounded-[2rem] border border-blue-200 bg-white p-6 shadow-[0_20px_80px_rgba(15,23,42,0.08)]">
      <h2 className="text-lg font-semibold text-blue-950">Fixed call types</h2>
      <p className="mt-2 text-sm leading-6 text-blue-600">
        Service request forms now use a standard call type list.
      </p>

      <form action={addCallType} className="mt-4 flex gap-2">
        <input
          name="name"
          placeholder="New call type"
          className="w-full rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm outline-none focus:border-blue-400"
          required
        />
        <button
          type="submit"
          className="rounded-xl bg-blue-950 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-800"
        >
          Add
        </button>
      </form>

      <div className="mt-4 grid gap-2">
        {initialCallTypes.map((callType) => (
          <div key={callType.id} className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2">
            <form action={updateCallType} className="flex flex-1 items-center gap-2">
              <input type="hidden" name="id" value={callType.id} />
              <input
                name="name"
                defaultValue={callType.name}
                className="w-full rounded-lg border border-blue-200 bg-white px-2 py-1.5 text-sm font-medium text-blue-900 outline-none focus:border-blue-400"
                aria-label={`Edit call type ${callType.name}`}
              />
              <button
                type="submit"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-blue-300 bg-white text-blue-700 transition hover:bg-blue-50"
                aria-label={`Save ${callType.name}`}
              >
                <CheckIcon />
              </button>
            </form>
            <form action={deleteCallType}>
              <input type="hidden" name="id" value={callType.id} />
              <ConfirmSubmitButton
                confirmMessage={`Are you sure you want to delete fixed call type ${callType.name}?`}
                ariaLabel={`Delete ${callType.name}`}
                title="Delete fixed call type"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-rose-200 bg-white text-rose-600 transition hover:bg-rose-50"
              >
                <TrashIcon />
              </ConfirmSubmitButton>
            </form>
          </div>
        ))}
      </div>
    </article>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <path
        d="M4 7H20M10 11V17M14 11V17M7 7L8 19C8.09 20.05 8.96 20.85 10.01 20.85H13.99C15.04 20.85 15.91 20.05 16 19L17 7M9 7V4.5C9 3.67 9.67 3 10.5 3H13.5C14.33 3 15 3.67 15 4.5V7"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <path d="M5 12.5L9 16.5L19 6.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
