import Link from "next/link";
import { redirect } from "next/navigation";

import {
  addCallType,
  addStaff,
  addProduct,
  deleteCallType,
  deleteStaff,
  deleteProduct,
  logout,
  updateCallType,
  updateStaff,
  updateProduct,
} from "../actions";
import { BrandLogo } from "../brand-logo";
import { ConfirmSubmitButton } from "../confirm-submit-button";
import { APP_ROLES } from "@/lib/auth-constants";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type AdminPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const session = await getSession();

  if (!session || session.role !== APP_ROLES.ADMIN) {
    redirect("/dashboard");
  }

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const editStaffParam = resolvedSearchParams.editStaff;
  const editingStaffId = Array.isArray(editStaffParam) ? editStaffParam[0] : editStaffParam;
  const hasEditingStaff = typeof editingStaffId === "string" && editingStaffId.trim() !== "";

  const [staffMembers, products, callTypes] = await Promise.all([
    prisma.user.findMany({
      where: { role: { in: [APP_ROLES.MANAGER, APP_ROLES.EMPLOYEE] } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.product.findMany({ orderBy: { name: "asc" } }),
    prisma.callType.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-6 flex flex-col gap-4 rounded-[2rem] border border-blue-200 bg-white px-6 py-6 shadow-[0_20px_80px_rgba(15,23,42,0.08)] md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <div className="inline-flex rounded-xl border border-blue-200 bg-[#003d73] p-2">
            <BrandLogo width={170} className="h-auto w-auto" />
          </div>
          <p className="text-sm uppercase tracking-[0.3em] text-blue-500">Admin</p>
          <h1 className="text-3xl font-semibold tracking-tight text-blue-950">Admin panel</h1>
          <p className="text-sm leading-6 text-blue-600">Manage employees, managers, products, and call types.</p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center md:w-auto md:justify-end">
          <Link
            href="/dashboard"
            className="inline-flex h-12 w-full items-center justify-center rounded-full border border-blue-300 bg-white px-4 text-sm font-medium text-blue-700 transition hover:bg-blue-50 sm:w-auto"
          >
            Dashboard
          </Link>
          <Link
            href="/form"
            className="inline-flex h-12 w-full items-center justify-center rounded-full bg-blue-950 px-4 text-sm font-medium text-white transition hover:bg-blue-800 sm:w-auto"
          >
            New call
          </Link>
          <form action={logout}>
            <button
              type="submit"
              className="danger-btn inline-flex h-12 w-full items-center justify-center rounded-full px-4 text-sm font-medium sm:w-auto"
            >
              Logout
            </button>
          </form>
        </div>
      </header>

      <section className="grid gap-6 lg:grid-cols-3">
        <article className="rounded-[2rem] border border-blue-200 bg-white p-6 shadow-[0_20px_80px_rgba(15,23,42,0.08)]">
          <h2 className="text-lg font-semibold text-blue-950">Add employee or manager</h2>
          <form action={addStaff} className="mt-4 space-y-3">
            <input
              name="name"
              placeholder="Full name"
              className="w-full rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm outline-none focus:border-blue-400"
              required
            />
            <input
              name="username"
              placeholder="Unique username"
              className="w-full rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm outline-none focus:border-blue-400"
              required
            />
            <input
              name="password"
              type="password"
              placeholder="Password"
              className="w-full rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm outline-none focus:border-blue-400"
              required
            />
            <input
              name="whatsappNumber"
              type="tel"
              placeholder="WhatsApp number (e.g. +919876543210)"
              className="w-full rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm outline-none focus:border-blue-400"
            />
            <select
              name="role"
              defaultValue={APP_ROLES.EMPLOYEE}
              className="w-full rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm outline-none focus:border-blue-400"
              required
            >
              <option value={APP_ROLES.EMPLOYEE}>Employee</option>
              <option value={APP_ROLES.MANAGER}>Manager</option>
            </select>
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center rounded-xl bg-blue-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-800"
            >
              Add member
            </button>
          </form>
          <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50/60 p-3 text-xs text-blue-700">
            Team members: {staffMembers.length}
          </div>
          <div className="mt-3 max-h-[26rem] space-y-2 overflow-y-auto pr-1 text-sm">
            {staffMembers.map((member) => (
              <div
                key={member.id}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 rounded-xl border border-blue-200 bg-white px-3 py-3 text-blue-700 shadow-sm"
              >
                <div className="min-w-0">
                  {hasEditingStaff && editingStaffId === member.id ? (
                    <form action={updateStaff} className="space-y-2">
                      <input type="hidden" name="id" value={member.id} />
                      <input
                        name="name"
                        defaultValue={member.name}
                        placeholder="Full name"
                        className="w-full rounded-lg border border-blue-200 bg-blue-50 px-2 py-1.5 text-xs outline-none focus:border-blue-400"
                        required
                      />
                      <input
                        name="username"
                        defaultValue={member.username}
                        placeholder="Username"
                        className="w-full rounded-lg border border-blue-200 bg-blue-50 px-2 py-1.5 text-xs outline-none focus:border-blue-400"
                        required
                      />
                      <input
                        name="whatsappNumber"
                        defaultValue={member.whatsappNumber ?? ""}
                        placeholder="WhatsApp number"
                        className="w-full rounded-lg border border-blue-200 bg-blue-50 px-2 py-1.5 text-xs outline-none focus:border-blue-400"
                      />
                      <select
                        name="role"
                        defaultValue={member.role}
                        className="w-full rounded-lg border border-blue-200 bg-blue-50 px-2 py-1.5 text-xs outline-none focus:border-blue-400"
                        required
                      >
                        <option value={APP_ROLES.EMPLOYEE}>Employee</option>
                        <option value={APP_ROLES.MANAGER}>Manager</option>
                      </select>
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          className="inline-flex items-center justify-center rounded-lg bg-blue-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-800"
                        >
                          Save
                        </button>
                        <Link
                          href="/admin?tab=staff"
                          className="inline-flex items-center justify-center rounded-lg border border-blue-300 bg-white px-3 py-1.5 text-xs font-medium text-blue-700 transition hover:bg-blue-50"
                        >
                          Cancel
                        </Link>
                      </div>
                    </form>
                  ) : (
                    <>
                      <p className="font-semibold text-blue-900">{member.name}</p>
                      <p className="text-xs text-blue-600">@{member.username}</p>
                      <p className="mt-1 text-xs text-blue-700">
                        WhatsApp: {member.whatsappNumber ? member.whatsappNumber : "Not provided"}
                      </p>
                      <span className="mt-2 inline-flex rounded-full bg-blue-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-blue-700">
                        {member.role.toLowerCase()}
                      </span>
                    </>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <form action={deleteStaff}>
                    <input type="hidden" name="id" value={member.id} />
                    <ConfirmSubmitButton
                      confirmMessage={`Are you sure you want to delete ${member.name}?`}
                      ariaLabel={`Delete ${member.name}`}
                      title="Delete user"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 bg-white text-rose-600 transition hover:bg-rose-50"
                    >
                      <TrashIcon />
                    </ConfirmSubmitButton>
                  </form>
                  <Link
                    href={`/admin?tab=staff&editStaff=${member.id}`}
                    aria-label={`Edit ${member.name}`}
                    title="Edit profile"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-blue-200 bg-white text-blue-700 transition hover:bg-blue-50"
                  >
                    <EditIcon />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-[2rem] border border-blue-200 bg-white p-6 shadow-[0_20px_80px_rgba(15,23,42,0.08)]">
          <h2 className="text-lg font-semibold text-blue-950">Products</h2>
          <form action={addProduct} className="mt-4 flex gap-2">
            <input
              name="name"
              placeholder="New product"
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
          <div className="mt-4 space-y-2">
            {products.map((product) => (
              <div key={product.id} className="flex flex-col gap-2 sm:flex-row">
                <form action={updateProduct} className="flex w-full flex-col gap-2 sm:flex-row">
                  <input type="hidden" name="id" value={product.id} />
                  <input
                    name="name"
                    defaultValue={product.name}
                    className="w-full rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm outline-none focus:border-blue-400"
                    required
                  />
                  <button
                    type="submit"
                    className="rounded-xl border border-blue-300 bg-white px-3 py-2 text-xs font-medium text-blue-700 transition hover:bg-blue-50 sm:whitespace-nowrap"
                  >
                    Update
                  </button>
                </form>
                <form action={deleteProduct}>
                  <input type="hidden" name="id" value={product.id} />
                  <ConfirmSubmitButton
                    confirmMessage={`Are you sure you want to delete product ${product.name}?`}
                    ariaLabel={`Delete ${product.name}`}
                    title="Delete product"
                    className="inline-flex h-10 w-full items-center justify-center rounded-xl border border-rose-200 bg-white text-rose-600 transition hover:bg-rose-50 sm:w-10"
                  >
                    <TrashIcon />
                  </ConfirmSubmitButton>
                </form>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-[2rem] border border-blue-200 bg-white p-6 shadow-[0_20px_80px_rgba(15,23,42,0.08)]">
          <h2 className="text-lg font-semibold text-blue-950">Call types</h2>
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
          <div className="mt-4 space-y-2">
            {callTypes.map((callType) => (
              <div key={callType.id} className="flex flex-col gap-2 sm:flex-row">
                <form action={updateCallType} className="flex w-full flex-col gap-2 sm:flex-row">
                  <input type="hidden" name="id" value={callType.id} />
                  <input
                    name="name"
                    defaultValue={callType.name}
                    className="w-full rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm outline-none focus:border-blue-400"
                    required
                  />
                  <button
                    type="submit"
                    className="rounded-xl border border-blue-300 bg-white px-3 py-2 text-xs font-medium text-blue-700 transition hover:bg-blue-50 sm:whitespace-nowrap"
                  >
                    Update
                  </button>
                </form>
                <form action={deleteCallType}>
                  <input type="hidden" name="id" value={callType.id} />
                  <ConfirmSubmitButton
                    confirmMessage={`Are you sure you want to delete call type ${callType.name}?`}
                    ariaLabel={`Delete ${callType.name}`}
                    title="Delete call type"
                    className="inline-flex h-10 w-full items-center justify-center rounded-xl border border-rose-200 bg-white text-rose-600 transition hover:bg-rose-50 sm:w-10"
                  >
                    <TrashIcon />
                  </ConfirmSubmitButton>
                </form>
              </div>
            ))}
          </div>
        </article>
      </section>
    </main>
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


