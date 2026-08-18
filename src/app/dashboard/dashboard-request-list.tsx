"use client";

import React from "react";
import { DocketDetailsModal } from "../docket-details-modal";
import { StatusUpdateModal } from "../status-update-modal";
import { AssignmentPicker, type AssignmentPickerAssignment } from "./assignment-picker";
import { AdminManagerStatusSelect } from "./admin-manager-status-select";
import { DashboardMediaPopup } from "./dashboard-media-popup";
import { ReviewNoteButton } from "./review-note-popup";
import { DashboardRequestRow, PreviousStatusButton, PrintServicePdfLink, type DashboardCompanyHistoryRequest } from "./dashboard-request-row";
import { normalizeStatus } from "../status-utils";
import { formatDocketNumber } from "@/lib/docket";
import type { DashboardRequestMediaItem } from "@/lib/gallery";

const COMPLETED_REASSIGN_WINDOW_MS = 72 * 60 * 60 * 1000;
const PRIORITY_DAY_FACTOR = 10000;
const PAGE_SIZE_OPTIONS = [10, 25, 50];

export type DashboardListRequest = {
  id: string;
  docketNumber: string;
  createdAt: Date;
  name: string;
  company: string;
  contactPerson2: string | null;
  phoneNumber1: string;
  phoneNumber2: string | null;
  fullAddress: string;
  installationDate?: Date | string | null;
  complaintDetails: string | null;
  area: string;
  product: string;
  callType: string;
  serviceBillingType: string | null;
  chargeableAmount: number | null;
  dashboardOrder: number | null;
  assignedToId: string | null;
  assignedAt?: Date | string | null;
  status: string | null;
  statusSubmittedAt?: Date | string | null;
  statusReason: string | null;
  closedAt: Date | string | null;
  closedByName: string | null;
  lastAttemptByName?: string | null;
  lastAttemptAt?: Date | string | null;
  assignedTo?: { name: string } | null;
  assignments?: AssignmentPickerAssignment[];
  activities?: DashboardServiceActivity[];
  createdBy?: { name: string } | null;
  mediaItems?: DashboardRequestMediaItem[];
  companyHistoryRequests?: DashboardCompanyHistoryRequest[];
};

export type DashboardServiceActivity = {
  id: string;
  type: string;
  title: string;
  details: string | null;
  status: string | null;
  statusReason: string | null;
  employeeName: string | null;
  actorName: string | null;
  actorRole: string | null;
  createdAt: Date | string;
};

type DashboardRequestListProps = {
  requests: DashboardListRequest[];
  products: Array<{ id: string; name: string }>;
  employees: Array<{ id: string; name: string }>;
  canEditDocket: boolean;
  canAssign: boolean;
  isEmployee: boolean;
};

type DaysSortMode = "default" | "asc" | "desc";

export function DashboardRequestList({
  requests,
  products,
  employees,
  canEditDocket,
  canAssign,
  isEmployee,
}: DashboardRequestListProps) {
  const [items, setItems] = React.useState(requests);
  const [orderMessage, setOrderMessage] = React.useState("");
  const [starredRequestIds, setStarredRequestIds] = React.useState<Set<string>>(() => getStarredRequestIds(requests));
  const [starredDayByRequestId, setStarredDayByRequestId] = React.useState<Map<string, number>>(() =>
    getStarredDayByRequestId(requests, getTodayPriorityDay()),
  );
  const [todayPriorityDay, setTodayPriorityDay] = React.useState(() => getTodayPriorityDay());
  const [daysSortMode, setDaysSortMode] = React.useState<DaysSortMode>("default");
  const [currentPage, setCurrentPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(PAGE_SIZE_OPTIONS[0]);
  const canReorder = canEditDocket && canAssign && !isEmployee;
  const canDragRows = canReorder && daysSortMode === "default";

  const normalOrderIds = React.useRef(getNormalOrderIds(requests));
  const dragItem = React.useRef<number | null>(null);
  const dragOverItem = React.useRef<number | null>(null);

  React.useEffect(() => {
    setItems(requests);
    setStarredRequestIds(getStarredRequestIds(requests));
    setStarredDayByRequestId(getStarredDayByRequestId(requests, todayPriorityDay));
    normalOrderIds.current = getNormalOrderIds(requests);
  }, [requests, todayPriorityDay]);

  React.useEffect(() => {
    const interval = window.setInterval(() => setTodayPriorityDay(getTodayPriorityDay()), 60000);
    return () => window.clearInterval(interval);
  }, []);

  const displayedItems = React.useMemo(
    () =>
      sortItemsByDaysOld(
        items,
        daysSortMode,
        (request) => starredRequestIds.has(request.id) && (starredDayByRequestId.get(request.id) ?? todayPriorityDay - 1) >= todayPriorityDay,
      ),
    [items, daysSortMode, starredRequestIds, starredDayByRequestId, todayPriorityDay],
  );
  const totalPages = Math.max(1, Math.ceil(displayedItems.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStartIndex = (safeCurrentPage - 1) * pageSize;
  const paginatedItems = React.useMemo(
    () => displayedItems.slice(pageStartIndex, pageStartIndex + pageSize),
    [displayedItems, pageStartIndex, pageSize],
  );

  React.useEffect(() => {
    setCurrentPage(1);
  }, [requests, daysSortMode]);

  React.useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  const handleDragStart = (e: React.DragEvent<HTMLTableRowElement>, id: string) => {
    if (!canDragRows) {
      e.preventDefault();
      return;
    }

    const idx = items.findIndex((it) => it.id === id);
    dragItem.current = idx >= 0 ? idx : null;
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent<HTMLTableRowElement>, id: string) => {
    if (!canDragRows) {
      return;
    }

    e.preventDefault();
    const idx = items.findIndex((it) => it.id === id);
    dragOverItem.current = idx >= 0 ? idx : null;
  };

  const handleDrop = (e: React.DragEvent<HTMLTableRowElement>, id: string) => {
    if (!canDragRows) {
      return;
    }

    e.preventDefault();
    const from = dragItem.current;
    if (dragOverItem.current === null) {
      const idx = items.findIndex((it) => it.id === id);
      dragOverItem.current = idx >= 0 ? idx : null;
    }
    const to = dragOverItem.current;
    if (from === null || to === null || from === to) return;
    setItems((current) => {
      const copy = [...current];
      const [moved] = copy.splice(from, 1);
      copy.splice(to, 0, moved);
      normalOrderIds.current = copy.map((item) => item.id);
      void saveDashboardOrder(copy.map((item) => item.id), starredRequestIds, starredDayByRequestId);
      return copy;
    });
    dragItem.current = null;
    dragOverItem.current = null;
  };

  const handleDragEnd = () => {
    dragItem.current = null;
    dragOverItem.current = null;
  };

  const handleToggleStar = (id: string) => {
    if (!canReorder) {
      return;
    }

    setItems((current) => {
      const from = current.findIndex((item) => item.id === id);
      if (from < 0) {
        return current;
      }

      const isStarred = starredRequestIds.has(id);

      if (isStarred) {
        const nextStarredRequestIds = new Set(starredRequestIds);
        nextStarredRequestIds.delete(id);
        const nextStarredDayByRequestId = new Map(starredDayByRequestId);
        nextStarredDayByRequestId.delete(id);

        const moved = current[from];
        const starredItems = current.filter((item) => item.id !== id && nextStarredRequestIds.has(item.id));
        const unstarredItems = current.filter((item) => item.id !== id && !nextStarredRequestIds.has(item.id));
        const targetNormalIndex = getNormalOrderIndex(normalOrderIds.current, id);
        let targetIndex = unstarredItems.findIndex(
          (item) => getNormalOrderIndex(normalOrderIds.current, item.id) > targetNormalIndex,
        );

        if (targetIndex < 0) {
          targetIndex = unstarredItems.length;
        }

        const restoredUnstarredItems = [...unstarredItems];
        restoredUnstarredItems.splice(targetIndex, 0, moved);
        const copy = [...starredItems, ...restoredUnstarredItems];
        setStarredRequestIds(nextStarredRequestIds);
        setStarredDayByRequestId(nextStarredDayByRequestId);
        void saveDashboardOrder(copy.map((item) => item.id), nextStarredRequestIds, nextStarredDayByRequestId);
        return copy;
      }

      const copy = [...current];
      const [moved] = copy.splice(from, 1);
      const nextStarredRequestIds = new Set(starredRequestIds);
      const nextStarredDayByRequestId = new Map(starredDayByRequestId);

      copy.unshift(moved);
      nextStarredRequestIds.add(id);
      nextStarredDayByRequestId.set(id, todayPriorityDay);
      setStarredRequestIds(nextStarredRequestIds);
      setStarredDayByRequestId(nextStarredDayByRequestId);
      void saveDashboardOrder(copy.map((item) => item.id), nextStarredRequestIds, nextStarredDayByRequestId);
      return copy;
    });
  };

  const saveDashboardOrder = async (
    requestIds: string[],
    nextStarredRequestIds: Set<string>,
    nextStarredDayByRequestId: Map<string, number>,
  ) => {
    setOrderMessage("Saving order...");

    try {
      const response = await fetch("/api/dashboard/reorder", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          requestIds,
          starredRequestIds: Array.from(nextStarredRequestIds),
          starredDays: Object.fromEntries(
            Array.from(nextStarredDayByRequestId.entries()).filter(([requestId]) =>
              nextStarredRequestIds.has(requestId),
            ),
          ),
        }),
      });
      const json = await response.json();

      if (!json.success) {
        setOrderMessage(json.message || "Order was not saved");
        return;
      }

      setOrderMessage("Order saved");
      window.setTimeout(() => setOrderMessage(""), 1500);
    } catch (error) {
      console.error(error);
      setOrderMessage("Order was not saved");
    }
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-blue-200 bg-white">
      {orderMessage ? (
        <div className="border-b border-blue-100 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700">
          {orderMessage}
        </div>
      ) : null}
      <div className="space-y-3 p-1.5 md:hidden">
        {paginatedItems.map((request) => {
          const isCompletedRequest = isClosedStatus(request.status);
          const isReassignLocked = isCompletedRequest && !isCompletedReassignWindowOpen(request);
          const priority = getDashboardPriority(request);
          const assignedEmployeeNames = getAssignedEmployeeNames(request);
          const displayDocketNumber = formatDocketNumber(request.docketNumber);

          return (
          <article
            key={request.id}
            className={`rounded-2xl border p-3 text-sm text-blue-900 shadow-sm ${priority.cardClassName}`}
          >
            <div className="mb-3 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <DocketDetailsModal
                    request={request}
                    canEdit={canEditDocket}
                    canAssign={canAssign}
                    employees={employees}
                    products={products}
                    renderTrigger={(open) => (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          open();
                        }}
                        className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-blue-300 bg-white px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-blue-800 shadow-sm transition hover:border-blue-500 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-300"
                        aria-label={`Open docket details for ${displayDocketNumber}`}
                      >
                        <span className="min-w-0">{displayDocketNumber}</span>
                        <OpenDocketIcon />
                      </button>
                    )}
                  />
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <PrintServicePdfLink requestId={request.id} docketNumber={displayDocketNumber} />
                    {isEmployee ? <PreviousStatusButton request={request} /> : null}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <span className={`inline-flex rounded-md px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.06em] ring-1 ring-inset ${priority.badgeClassName}`}>
                    {priority.label}
                  </span>
                  <span className="text-[10px] font-semibold text-slate-500">{getComplaintAgeLabel(request)}</span>
                  {isEmployee && request.assignedToId ? <EmployeeCountdownBadge request={request} /> : null}
                </div>
              </div>

              <div className="min-w-0">
                <p className="break-words text-base font-extrabold leading-snug text-blue-700">{request.company}</p>
                <p className="mt-1.5 break-words text-sm font-bold leading-snug text-slate-950">{request.name}</p>
                {!isEmployee ? (
                  <div className="mt-2 flex flex-col items-start">
                    <AdminManagerStatusSelect request={request} />
                    <div className="mt-2">
                      <DashboardMediaPopup docketNumber={request.docketNumber} mediaItems={request.mediaItems} />
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <Detail label="Location" value={request.area} />
              <Detail label="Product" value={request.product} />
              <div className="rounded-lg border border-blue-100 bg-white px-2.5 py-2 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-blue-500">Call Type</p>
                <p className="mt-1 break-words text-[13px] font-bold leading-snug text-blue-950">{request.callType}</p>
                {request.callType === "Service" ? (
                  <p className="mt-1 inline-block whitespace-nowrap text-[9px] font-bold uppercase leading-3 tracking-normal text-blue-700">
                    {request.serviceBillingType ? formatServiceBillingType(request.serviceBillingType) : "Not specified"}
                  </p>
                ) : null}
              </div>
              <div className="rounded-lg border border-blue-100 bg-white px-2.5 py-2 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-blue-500">Amount</p>
                <p className="mt-1 break-words text-[13px] font-bold leading-snug text-blue-950">
                  {formatINRCurrency(request.serviceBillingType === "chargeable" ? request.chargeableAmount ?? 0 : 0)}
                </p>
              </div>
              {!isEmployee ? (
                <>
                  <div className="rounded-lg border border-blue-100 bg-white px-2.5 py-2 shadow-sm">
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-blue-500">Phone</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[13px] font-bold leading-snug text-blue-950">
                      <span>{request.phoneNumber1}</span>
                    </div>
                  </div>
                  {request.phoneNumber2 && <Detail label="Alt Phone" value={request.phoneNumber2} />}
                </>
              ) : null}
              {isEmployee ? (
                  <div className="col-span-2 flex items-center justify-between gap-3 rounded-lg border border-blue-100 bg-blue-50/70 px-2.5 py-2 shadow-sm">
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-blue-500">Status</p>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <StatusUpdateModal request={request} />
                      <DashboardMediaPopup docketNumber={request.docketNumber} mediaItems={request.mediaItems} />
                    </div>
                  </div>
                ) : null}
            </div>

            <div className="mt-3 flex items-center justify-between gap-2">
              <div className="flex-1" />
              {canAssign ? (
                <div className="space-y-2">
                  {assignedEmployeeNames.length > 1 ? (
                    <div className="flex flex-wrap gap-1">
                      {assignedEmployeeNames.map((name) => (
                        <span key={name} className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                          {name}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
                    <p className="text-xs font-semibold text-blue-900">
                      <span className="text-[10px] uppercase tracking-[0.08em] text-blue-600">Assigned to:</span> {request.assignedTo?.name ?? "Unassigned"}
                    </p>
                    {request.assignedAt ? (
                      <p className="mt-1 text-[10px] text-blue-700">Assigned {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(request.assignedAt))}</p>
                    ) : null}
                    {request.status === "Completed" && request.assignedTo?.name ? (
                      <p className="mt-1 text-[11px] text-blue-700">Reassigned to {request.assignedTo.name}</p>
                    ) : null}
                  </div>
                  <AssignmentPicker
                    key={`${request.id}:${request.assignments?.map((assignment) => assignment.employeeId).join(",") ?? request.assignedToId ?? ""}`}
                    requestId={request.id}
                    employees={employees}
                    assignments={request.assignments}
                    defaultEmployeeId={request.assignedToId}
                    compact
                    disabled={isReassignLocked}
                    disabledMessage={isReassignLocked ? "This completed service can no longer be reassigned." : undefined}
                  />
                </div>
              ) : null}
            </div>
          </article>
          );
        })}
        {displayedItems.length === 0 ? (
          <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-6 text-center text-sm font-medium text-blue-700">
            No service requests found.
          </div>
        ) : null}
      </div>

      <div className="hidden overflow-hidden md:block">
        <table className="w-full table-fixed divide-y divide-blue-300 text-left text-xs">
          <colgroup>
            <col className="w-[12%]" />
            <col className="w-[16%]" />
            <col className="w-[10%]" />
            <col className="w-[9%]" />
            <col className="w-[8%]" />
            <col className="w-[9%]" />
            <col className="w-[7%]" />
            <col className="w-[10%]" />
            {canAssign ? <col className="w-[19%]" /> : null}
          </colgroup>
          <thead className="bg-blue-50 text-blue-700">
            <tr>
              <Th>Docket</Th>
            <Th>
              <div className="flex items-center gap-1">
                <span>Days Old</span>
                {canReorder ? <DaysOldSortControls mode={daysSortMode} onChange={setDaysSortMode} /> : null}
              </div>
            </Th>
              <Th>Name</Th>
              <Th>Location</Th>
              <Th>Product</Th>
              <Th>Call Type</Th>
              <Th>Amount</Th>
              <Th>Status</Th>
              {canAssign ? <Th>Allocate</Th> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-blue-100 bg-white">
            {paginatedItems.map((request) => (
              <DashboardRequestRow
                key={request.id}
                request={request}
                products={products}
                employees={employees}
                canEditDocket={canEditDocket}
                canAssign={canAssign}
                isEmployee={isEmployee}
                draggable={canDragRows}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onDragEnd={handleDragEnd}
                onToggleStar={canReorder ? handleToggleStar : undefined}
                isStarred={starredRequestIds.has(request.id)}
                isOldPriorityStar={
                  starredRequestIds.has(request.id) &&
                  (starredDayByRequestId.get(request.id) ?? todayPriorityDay - 1) < todayPriorityDay
                }
              />
            ))}
            {displayedItems.length === 0 ? (
              <tr>
                <td colSpan={canAssign ? 9 : 8} className="px-4 py-10 text-center text-sm font-medium text-blue-700">
                  No service requests found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {displayedItems.length > 0 ? (
        <DashboardPagination
          currentPage={safeCurrentPage}
          pageSize={pageSize}
          totalItems={displayedItems.length}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          onPageSizeChange={(nextPageSize) => {
            setPageSize(nextPageSize);
            setCurrentPage(1);
          }}
        />
      ) : null}
    </section>
  );
}

function DashboardPagination({
  currentPage,
  pageSize,
  totalItems,
  totalPages,
  onPageChange,
  onPageSizeChange,
}: {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}) {
  const pageNumbers = getPaginationItems(currentPage, totalPages);
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(totalItems, currentPage * pageSize);

  return (
    <div className="flex flex-col gap-3 border-t border-blue-100 bg-white px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs font-semibold text-blue-800">
        Showing <span className="text-blue-950">{startItem}-{endItem}</span> of{" "}
        <span className="text-blue-950">{totalItems}</span>
      </p>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        <label className="flex items-center gap-2 text-xs font-semibold text-blue-800">
          Rows
          <select
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            className="h-9 rounded-lg border border-blue-200 bg-blue-50 px-2 text-xs font-semibold text-blue-950 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          >
            {PAGE_SIZE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <nav className="flex items-center gap-1" aria-label="Dashboard pagination">
          <button
            type="button"
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-blue-200 bg-white text-blue-700 shadow-sm transition hover:border-blue-300 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-45"
            aria-label="Previous page"
            title="Previous page"
          >
            <ChevronLeftIcon />
          </button>

          <div className="flex items-center gap-1">
            {pageNumbers.map((page, index) =>
              page === "ellipsis" ? (
                <span key={`ellipsis-${index}`} className="inline-flex h-9 w-7 items-center justify-center text-xs font-bold text-blue-400">
                  ...
                </span>
              ) : (
                <button
                  key={page}
                  type="button"
                  onClick={() => onPageChange(page)}
                  className={`inline-flex h-9 min-w-9 items-center justify-center rounded-lg border px-2 text-xs font-bold shadow-sm transition ${
                    page === currentPage
                      ? "border-blue-600 bg-blue-600 text-white"
                      : "border-blue-200 bg-white text-blue-700 hover:border-blue-300 hover:bg-blue-50"
                  }`}
                  aria-current={page === currentPage ? "page" : undefined}
                >
                  {page}
                </button>
              ),
            )}
          </div>

          <button
            type="button"
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-blue-200 bg-white text-blue-700 shadow-sm transition hover:border-blue-300 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-45"
            aria-label="Next page"
            title="Next page"
          >
            <ChevronRightIcon />
          </button>
        </nav>
      </div>
    </div>
  );
}

function getPaginationItems(currentPage: number, totalPages: number): Array<number | "ellipsis"> {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (currentPage <= 3) {
    return [1, 2, 3, 4, "ellipsis", totalPages];
  }

  if (currentPage >= totalPages - 2) {
    return [1, "ellipsis", totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }

  return [1, "ellipsis", currentPage - 1, currentPage, currentPage + 1, "ellipsis", totalPages];
}

function ChevronLeftIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m15 18-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m9 18 6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DaysOldSortControls({
  mode,
  onChange,
}: {
  mode: DaysSortMode;
  onChange: (mode: DaysSortMode) => void;
}) {
  return (
    <span className="inline-flex items-center gap-0.5" onClick={(event) => event.stopPropagation()}>
      <button
        type="button"
        onClick={() => onChange("asc")}
        className={`inline-flex h-5 w-5 items-center justify-center rounded border text-blue-700 transition hover:bg-blue-100 ${
          mode === "asc" ? "border-blue-400 bg-blue-100" : "border-blue-200 bg-white"
        }`}
        title="Sort newest first"
        aria-label="Sort days old ascending"
      >
        <SortUpIcon />
      </button>
      <button
        type="button"
        onClick={() => onChange("desc")}
        className={`inline-flex h-5 w-5 items-center justify-center rounded border text-blue-700 transition hover:bg-blue-100 ${
          mode === "desc" ? "border-blue-400 bg-blue-100" : "border-blue-200 bg-white"
        }`}
        title="Sort oldest first"
        aria-label="Sort days old descending"
      >
        <SortDownIcon />
      </button>
      <button
        type="button"
        onClick={() => onChange("default")}
        className={`inline-flex h-5 w-5 items-center justify-center rounded border text-blue-700 transition hover:bg-blue-100 ${
          mode === "default" ? "border-blue-400 bg-blue-100" : "border-blue-200 bg-white"
        }`}
        title="Reset order"
        aria-label="Reset days old sorting"
      >
        <ResetSortIcon />
      </button>
    </span>
  );
}

function sortItemsByDaysOld(
  items: DashboardListRequest[],
  mode: DaysSortMode,
  isPinnedRecentPriority: (request: DashboardListRequest) => boolean,
) {
  if (mode === "default") {
    return items;
  }

  const pinnedItems = items.filter(isPinnedRecentPriority);
  const sortableItems = items.filter((item) => !isPinnedRecentPriority(item));

  return [...pinnedItems, ...sortableItems.sort((a, b) => {
    const aTime = getCreatedTime(a);
    const bTime = getCreatedTime(b);
    const comparison = mode === "asc" ? bTime - aTime : aTime - bTime;

    if (comparison !== 0) {
      return comparison;
    }

    return a.docketNumber.localeCompare(b.docketNumber, undefined, {
      numeric: true,
      sensitivity: "base",
    });
  })];
}

function SortUpIcon() {
  return (
    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m7 14 5-5 5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SortDownIcon() {
  return (
    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m7 10 5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ResetSortIcon() {
  return (
    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 7h10a6 6 0 1 1-4.25 10.24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 7h4M4 7v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function getCreatedTime(request: DashboardListRequest) {
  const createdAt = request.createdAt instanceof Date ? request.createdAt : new Date(request.createdAt);
  return Number.isNaN(createdAt.getTime()) ? 0 : createdAt.getTime();
}

function getStarredRequestIds(requests: DashboardListRequest[]) {
  return new Set(requests.filter((request) => (request.dashboardOrder ?? 0) < 0).map((request) => request.id));
}

function getStarredDayByRequestId(requests: DashboardListRequest[], todayPriorityDay: number) {
  return new Map(
    requests
      .filter((request) => (request.dashboardOrder ?? 0) < 0)
      .map((request) => [
        request.id,
        getPriorityStarDay(request.dashboardOrder) ?? todayPriorityDay - 1,
      ]),
  );
}

function getPriorityStarDay(order: number | null) {
  if (typeof order !== "number" || order >= 0) {
    return null;
  }

  const absoluteOrder = Math.abs(order);
  if (absoluteOrder < PRIORITY_DAY_FACTOR) {
    return null;
  }

  return Math.floor(absoluteOrder / PRIORITY_DAY_FACTOR);
}

function getNormalOrderIds(requests: DashboardListRequest[]) {
  return requests.filter((request) => (request.dashboardOrder ?? 0) >= 0).map((request) => request.id);
}

function getNormalOrderIndex(orderIds: string[], id: string) {
  const index = orderIds.indexOf(id);
  return index >= 0 ? index : Number.MAX_SAFE_INTEGER;
}

function getComplaintAgeLabel(request: DashboardListRequest) {
  const createdAt = typeof request.createdAt === "string" ? new Date(request.createdAt) : request.createdAt;
  const completedAt = getCompletedAt(request);
  const endDate = isClosedStatus(request.status) && completedAt ? completedAt : new Date();

  const endDay = getDayNumberInTimeZone(endDate, "Asia/Kolkata");
  const createdDay = getDayNumberInTimeZone(createdAt, "Asia/Kolkata");
  const days = Math.max(0, endDay - createdDay);

  if (days === 0) {
    return "Today";
  }

  if (days === 1) {
    return "1 day";
  }

  return `${days} days`;
}

function getTodayPriorityDay() {
  return getDayNumberInTimeZone(new Date(), "Asia/Kolkata");
}

function getParsedDate(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return null;
}

function getCompletedAt(request: DashboardListRequest) {
  return (
    getParsedDate(request.closedAt) ??
    getParsedDate(request.statusSubmittedAt) ??
    getParsedDate(request.lastAttemptAt)
  );
}

function isCompletedReassignWindowOpen(request: DashboardListRequest) {
  const completedAt = getCompletedAt(request);

  if (!completedAt) {
    return false;
  }

  return Date.now() - completedAt.getTime() <= COMPLETED_REASSIGN_WINDOW_MS;
}

function EmployeeCountdownBadge({ request }: { request: DashboardListRequest }) {
  const assignedAt = getParsedDate(request.assignedAt);

  if (!assignedAt || isClosedStatus(request.status)) {
    return null;
  }

  const now = new Date();
  const assignedDay = new Date(assignedAt);
  const dayStart = new Date(assignedDay.getFullYear(), assignedDay.getMonth(), assignedDay.getDate());
  const deadline9 = new Date(dayStart.getFullYear(), dayStart.getMonth(), dayStart.getDate(), 21, 0, 0);
  const deadline24 = new Date(dayStart.getFullYear(), dayStart.getMonth(), dayStart.getDate(), 24, 0, 0);

  let colorClass = "bg-emerald-50 text-emerald-900 ring-emerald-300";
  let label = `Due in ${formatDuration(deadline9.getTime() - now.getTime())}`;

  if (now >= deadline9 && now < deadline24) {
    colorClass = "bg-amber-50 text-amber-900 ring-amber-300";
    label = `Due in ${formatDuration(deadline24.getTime() - now.getTime())}`;
  }

  if (now >= deadline24) {
    colorClass = "bg-rose-50 text-rose-900 ring-rose-300";
    label = `Overdue by ${formatDuration(now.getTime() - deadline24.getTime())}`;
  }

  return (
    <span className={`inline-flex rounded-md px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${colorClass}`}>
      {label}
    </span>
  );
}

function formatDuration(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.round(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (hours > 0) {
    return minutes > 0 ? `${hours} hr ${minutes} min` : `${hours} hr`;
  }

  return `${minutes} min`;
}

function getDayNumberInTimeZone(value: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);

  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);

  return Math.floor(Date.UTC(year, month - 1, day) / (1000 * 60 * 60 * 24));
}

function isClosedStatus(status: string | null) {
  return normalizeStatus(status) === "Completed";
}

function getAssignedEmployeeNames(request: DashboardListRequest) {
  const names = request.assignments
    ?.map((assignment) => assignment.employee?.name)
    .filter((name): name is string => Boolean(name?.trim())) ?? [];

  if (names.length === 0 && request.assignedTo?.name) {
    names.push(request.assignedTo.name);
  }

  return Array.from(new Set(names.map((name) => name.trim()).filter(Boolean)));
}

function getDashboardPriority(request: DashboardListRequest) {
  const status = normalizeStatus(request.status);

  if (status === "Completed") {
    return {
      label: "Completed",
      cardClassName: "border-emerald-300 bg-emerald-50",
      badgeClassName: "bg-emerald-100 text-emerald-800 ring-emerald-300",
    };
  }

  if (isDashboardRequestOverdue(request)) {
    return {
      label: "Overdue",
      cardClassName: "border-rose-300 bg-rose-50",
      badgeClassName: "bg-rose-100 text-rose-800 ring-rose-300",
    };
  }

  const createdAt = getParsedDate(request.createdAt);
  if (createdAt && getLocalDateKey(createdAt) === getLocalDateKey(new Date())) {
    return {
      label: "Today",
      cardClassName: "border-sky-300 bg-sky-50",
      badgeClassName: "bg-sky-100 text-sky-800 ring-sky-300",
    };
  }

  return {
    label: "Pending",
    cardClassName: "border-blue-200 bg-white",
    badgeClassName: "bg-amber-100 text-amber-800 ring-amber-300",
  };
}

function isDashboardRequestOverdue(request: DashboardListRequest) {
  if (["Completed", "Cancel"].includes(normalizeStatus(request.status))) {
    return false;
  }

  const assignedDates = [
    getParsedDate(request.assignedAt),
    ...(request.assignments ?? []).map((assignment) =>
      ["Completed", "Cancel"].includes(normalizeStatus(assignment.status))
        ? null
        : getParsedDate(assignment.assignedAt),
    ),
  ].filter((date): date is Date => Boolean(date));
  const earliestAssignedAt = assignedDates.sort((a, b) => a.getTime() - b.getTime())[0] ?? null;

  if (!earliestAssignedAt) {
    return false;
  }

  return Date.now() > getAssignmentDeadline(earliestAssignedAt).getTime();
}

function getAssignmentDeadline(assignedAt: Date) {
  const assignedDay = new Date(assignedAt);
  return new Date(assignedDay.getFullYear(), assignedDay.getMonth(), assignedDay.getDate(), 24, 0, 0);
}

function getLocalDateKey(value: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-blue-100 bg-white px-2.5 py-2 shadow-sm">
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-blue-500">{label}</p>
      <p className="mt-1 break-words text-[13px] font-bold leading-snug text-blue-950">{value}</p>
    </div>
  );
}

function OpenDocketIcon() {
  return (
    <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M8 5h11v11M19 5 6 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="whitespace-nowrap border-b-2 border-blue-200 px-2 py-3 text-[10px] font-extrabold uppercase tracking-[0.1em] text-blue-900">
      {children}
    </th>
  );
}

function formatServiceBillingType(value: string) {
  if (value === "amc") {
    return "AMC";
  }

  if (value === "warranty") {
    return "Warranty";
  }

  if (value === "chargeable") {
    return "Chargeable";
  }

  return value;
}

function formatINRCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

