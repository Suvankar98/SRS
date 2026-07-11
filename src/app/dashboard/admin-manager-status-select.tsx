"use client";

import { updateManagerServiceStatus } from "../actions";
import { RemarkPopup } from "../remark-popup";
import { getStatusLabel, getStatusPillClass } from "../status-utils";

const STATUS_OPTIONS = ["New Call", "In Process", "Completed", "Cancel"] as const;

type AdminManagerStatusSelectProps = {
  request: {
    id: string;
    status: string | null;
    statusReason: string | null;
  };
};

export function AdminManagerStatusSelect({ request }: AdminManagerStatusSelectProps) {
  const status = getStatusLabel(request.status);

  return (
    <div className="space-y-1">
      <form action={updateManagerServiceStatus} onClick={(event) => event.stopPropagation()}>
        <input type="hidden" name="requestId" value={request.id} />
        <select
          name="status"
          defaultValue={status}
          onChange={(event) => event.currentTarget.form?.requestSubmit()}
          className={`w-full max-w-[7.5rem] rounded-md border px-2 py-1 text-[11px] font-semibold outline-none ring-1 ring-inset transition focus:border-blue-400 focus:ring-blue-400 ${getStatusPillClass(
            status,
          )}`}
          aria-label="Update service status"
          title="Update status"
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </form>
      {request.statusReason ? (
        <div className="mt-1">
          <RemarkPopup remark={request.statusReason} />
        </div>
      ) : null}
    </div>
  );
}
