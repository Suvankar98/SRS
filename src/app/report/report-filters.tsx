"use client";

import React from "react";

type ReportFiltersProps = {
  searchQuery: string;
  selectedStatus: string;
  selectedEmployee: string;
  selectedCallType: string;
  selectedServiceBillingType: string;
  fromDate: string;
  toDate: string;
  assignedFromDate?: string;
  assignedToDate?: string;
  employees: Array<{ id: string; name: string }>;
  callTypeOptions: Array<{ callType: string }>;
};

export default function ReportFilters({
  searchQuery,
  selectedStatus,
  selectedEmployee,
  selectedCallType,
  selectedServiceBillingType,
  fromDate,
  toDate,
  assignedFromDate = "",
  assignedToDate = "",
  employees,
  callTypeOptions,
}: ReportFiltersProps) {
  const [callType, setCallType] = React.useState(selectedCallType);
  const [billingType, setBillingType] = React.useState(selectedServiceBillingType);

  const handleCallTypeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const nextCallType = event.target.value;
    setCallType(nextCallType);
    if (nextCallType !== "Service") {
      setBillingType("");
    }
  };

  return (
    <form className="mt-4 space-y-4">
      <div className="grid gap-3 lg:grid-cols-[minmax(14rem,1.25fr)_repeat(3,minmax(10rem,1fr))]">
        <label className="block">
          <span className="mb-1 block text-xs font-medium uppercase tracking-[0.1em] text-blue-700">Search</span>
          <input name="q" defaultValue={searchQuery} placeholder="Docket, customer, company..." className="h-10 w-full rounded-xl border border-blue-200 bg-white px-3 text-sm text-blue-900 outline-none transition placeholder:text-blue-300 focus:border-blue-400 focus:ring-4 focus:ring-blue-100" />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium uppercase tracking-[0.1em] text-blue-700">Status</span>
          <select name="status" defaultValue={selectedStatus} className="h-10 w-full rounded-xl border border-blue-200 bg-white px-3 text-sm text-blue-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100">
            <option value="">All</option>
            <option value="New Call">New Call</option>
            <option value="In Process">In Process</option>
            <option value="Completed">Completed</option>
            <option value="Cancel">Cancel</option>
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium uppercase tracking-[0.1em] text-blue-700">Assigned To</span>
          <select name="employeeId" defaultValue={selectedEmployee} className="h-10 w-full rounded-xl border border-blue-200 bg-white px-3 text-sm text-blue-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100">
            <option value="">All</option>
            <option value="unassigned">Unassigned</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>{employee.name}</option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium uppercase tracking-[0.1em] text-blue-700">Call Type</span>
          <select name="callType" value={callType} onChange={handleCallTypeChange} className="h-10 w-full rounded-xl border border-blue-200 bg-white px-3 text-sm text-blue-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100">
            <option value="">All</option>
            {callTypeOptions.map((row) => (
              <option key={row.callType} value={row.callType}>{row.callType}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] xl:items-end">
        <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-3">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-blue-700">Created Date</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-[0.1em] text-blue-700">From</span>
              <input type="date" name="from" defaultValue={fromDate} className="h-10 w-full rounded-xl border border-blue-200 bg-white px-3 text-sm text-blue-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-[0.1em] text-blue-700">To</span>
              <input type="date" name="to" defaultValue={toDate} className="h-10 w-full rounded-xl border border-blue-200 bg-white px-3 text-sm text-blue-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
            </label>
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/75 p-3">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-700">Assigned Date</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-[0.1em] text-emerald-700">From</span>
              <input type="date" name="assignedFrom" defaultValue={assignedFromDate} className="h-10 w-full rounded-xl border border-emerald-200 bg-white px-3 text-sm text-emerald-950 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-[0.1em] text-emerald-700">To</span>
              <input type="date" name="assignedTo" defaultValue={assignedToDate} className="h-10 w-full rounded-xl border border-emerald-200 bg-white px-3 text-sm text-emerald-950 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" />
            </label>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] xl:block xl:min-w-48 xl:space-y-3">
          {callType === "Service" ? (
            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-[0.1em] text-blue-700">Service Billing</span>
              <select name="serviceBillingType" value={billingType} onChange={(event) => setBillingType(event.target.value)} className="h-10 w-full rounded-xl border border-blue-200 bg-white px-3 text-sm text-blue-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100">
                <option value="">All</option>
                <option value="warranty">Warranty</option>
                <option value="amc">AMC</option>
                <option value="chargeable">Chargeable</option>
              </select>
            </label>
          ) : (
            <input type="hidden" name="serviceBillingType" value="" />
          )}
          <button type="submit" className="inline-flex h-10 items-center justify-center rounded-xl bg-blue-700 px-5 text-sm font-semibold text-white transition hover:bg-blue-800">
            Apply Filters
          </button>
        </div>
      </div>
    </form>
  );
}
