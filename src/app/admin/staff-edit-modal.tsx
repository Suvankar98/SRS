"use client";

import React from "react";

import { updateStaff } from "../actions";
import { OptionalPasswordField } from "./optional-password-field";
import { APP_ROLES } from "@/lib/auth-constants";

type StaffEditModalProps = {
  member: {
    id: string;
    name: string;
    username: string;
    role: string;
    whatsappNumber: string | null;
    phoneNumber1: string | null;
    phoneNumber2: string | null;
    department: string | null;
  };
  departments: Array<{ value: string; label: string }>;
};

export function StaffEditModal({ member, departments }: StaffEditModalProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label={`Edit ${member.name}`}
        title="Edit profile"
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-blue-200 bg-white text-blue-700 transition hover:bg-blue-50"
      >
        <EditIcon />
      </button>

      {isOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="my-8 w-full max-w-xl overflow-hidden rounded-2xl border border-blue-200 bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-blue-100 px-5 py-4">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-blue-500">Edit profile</p>
                <h3 className="mt-1 text-lg font-semibold text-blue-950">{member.name}</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close edit profile"
                title="Close"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-red-200 bg-red-50 text-red-700 transition hover:bg-red-100"
              >
                <CloseIcon />
              </button>
            </div>

            <form action={updateStaff} className="grid gap-3 px-5 py-5">
              <input type="hidden" name="id" value={member.id} />
              <input
                name="name"
                defaultValue={member.name}
                placeholder="Full name"
                className="w-full rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400"
                required
              />
              <input
                name="username"
                defaultValue={member.username}
                placeholder="Username"
                className="w-full rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400"
                required
              />
              <OptionalPasswordField />
              <input
                name="phoneNumber1"
                defaultValue={member.phoneNumber1 ?? member.whatsappNumber ?? ""}
                placeholder="+60123456789 or 9876543210"
                className="w-full rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400"
              />
              <input
                name="phoneNumber2"
                defaultValue={member.phoneNumber2 ?? ""}
                placeholder="+447911123456 or 9876543210"
                className="w-full rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400"
              />
              <select
                name="department"
                defaultValue={member.department ?? "service"}
                className="w-full rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400"
                required
              >
                {departments.map((department) => (
                  <option key={department.value} value={department.value}>
                    {department.label}
                  </option>
                ))}
              </select>
              <select
                name="role"
                defaultValue={member.role}
                className="w-full rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400"
                required
              >
                <option value={APP_ROLES.EMPLOYEE}>Employee</option>
                <option value={APP_ROLES.MANAGER}>Manager</option>
              </select>
              <div className="flex flex-wrap justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="inline-flex items-center justify-center rounded-lg border border-blue-300 bg-white px-4 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-lg bg-blue-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-800"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <path
        d="M4 20H8L18.5 9.5C19.33 8.67 19.33 7.33 18.5 6.5C17.67 5.67 16.33 5.67 15.5 6.5L5 17V20H4ZM14.5 7.5L17.5 10.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M18 6 6 18M6 6l12 12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
