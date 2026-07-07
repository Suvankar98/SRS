"use client";

import React from "react";

type ReportFiltersProps = {
  searchQuery: string;
  selectedStatus: string;
  selectedEmployee: string;
  selectedCallType: string;
  selectedServiceBillingType: string;
  selectedArea: string;
  fromDate: string;
  toDate: string;
  employees: Array<{ id: string; name: string }>;
  callTypeOptions: Array<{ callType: string }>;
  areaOptions: Array<{ area: string }>;
};

export default function ReportFilters({
  searchQuery,
  selectedStatus,
  selectedEmployee,
  selectedCallType,
  selectedServiceBillingType,
  selectedArea,
  fromDate,
  toDate,
  employees,
  callTypeOptions,
  areaOptions,
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
    <form className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <label className="block">
        <span className="mb-1 block text-xs font-medium uppercase tracking-[0.1em] text-blue-700">Search</span>
        <input name="q" defaultValue={searchQuery} placeholder="Docket, customer, company..." className="w-full rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900 outline-none focus:border-blue-400" />
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-medium uppercase tracking-[0.1em] text-blue-700">Status</span>
        <select name="status" defaultValue={selectedStatus} className="w-full rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900 outline-none focus:border-blue-400">
          <option value="">All</option>
          <option value="New Call">New Call</option>
          <option value="In Process">In Process</option>
          <option value="Completed">Completed</option>
          <option value="Cancel">Cancel</option>
        </select>
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-medium uppercase tracking-[0.1em] text-blue-700">Assigned To</span>
        <select name="employeeId" defaultValue={selectedEmployee} className="w-full rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900 outline-none focus:border-blue-400">
          <option value="">All</option>
          <option value="unassigned">Unassigned</option>
          {employees.map((employee) => (
            <option key={employee.id} value={employee.id}>{employee.name}</option>
          ))}
        </select>
      </label>

      <div className="">
        <label className="block">
          <span className="mb-1 block text-xs font-medium uppercase tracking-[0.1em] text-blue-700">Call Type</span>
          <select name="callType" value={callType} onChange={handleCallTypeChange} className="w-full rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900 outline-none focus:border-blue-400">
            <option value="">All</option>
            {callTypeOptions.map((row) => (
              <option key={row.callType} value={row.callType}>{row.callType}</option>
            ))}
          </select>
        </label>
      </div>

      <label className="block">
        <span className="mb-1 block text-xs font-medium uppercase tracking-[0.1em] text-blue-700">Area</span>
        <select name="area" defaultValue={selectedArea} className="w-full rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900 outline-none focus:border-blue-400">
          <option value="">All</option>
          {areaOptions.map((row) => (
            <option key={row.area} value={row.area}>{row.area}</option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-medium uppercase tracking-[0.1em] text-blue-700">From Date</span>
        <input type="date" name="from" defaultValue={fromDate} className="w-full rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900 outline-none focus:border-blue-400" />
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-medium uppercase tracking-[0.1em] text-blue-700">To Date</span>
        <input type="date" name="to" defaultValue={toDate} className="w-full rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900 outline-none focus:border-blue-400" />
      </label>

      {/* Billing type area: only show when Call Type === Service */}
      <div className="flex items-end gap-2 xl:justify-end">
        <div className="w-full">
          {callType === "Service" ? (
            <div className="mb-2">
              <label className="block">
                <span className="mb-1 block text-xs font-medium uppercase tracking-[0.1em] text-blue-700">Service Billing Type</span>
                <select name="serviceBillingType" value={billingType} onChange={(event) => setBillingType(event.target.value)} className="w-full rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900 outline-none focus:border-blue-400">
                  <option value="">All</option>
                  <option value="warranty">Warranty</option>
                  <option value="amc">AMC</option>
                  <option value="chargeable">Chargeable</option>
                </select>
              </label>
            </div>
          ) : (
            <div style={{height: '56px'}} />
          )}
        </div>

        <div>
          <button type="submit" className="inline-flex items-center justify-center rounded-full bg-blue-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-800">
            Apply Filters
          </button>
        </div>
      </div>
    </form>
  );
}
