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
  updateProduct,
} from "../actions";
import { BrandLogo } from "../brand-logo";
import { APP_ROLES } from "@/lib/auth-constants";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getSession();

  if (!session || session.role !== APP_ROLES.ADMIN) {
    redirect("/dashboard");
  }

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
      <header className="mb-6 flex flex-col gap-4 rounded-[2rem] border border-blue-200 bg-white px-6 py-6 shadow-[0_20px_80px_rgba(15,23,42,0.08)] dark:border-slate-700 dark:bg-slate-900 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <div className="inline-flex rounded-xl border border-blue-200 bg-[#003d73] p-2">
            <BrandLogo width={170} className="h-auto w-auto" />
          </div>
          <p className="text-sm uppercase tracking-[0.3em] text-blue-500 dark:text-sky-300">Admin</p>
          <h1 className="text-3xl font-semibold tracking-tight text-blue-950 dark:text-slate-100">Admin panel</h1>
          <p className="text-sm leading-6 text-blue-600 dark:text-slate-300">Manage employees, managers, products, and call types.</p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center md:w-auto md:justify-end">
          <Link
            href="/dashboard"
            className="inline-flex h-12 w-full items-center justify-center rounded-full border border-blue-300 bg-white px-4 text-sm font-medium text-blue-700 transition hover:bg-blue-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 sm:w-auto"
          >
            Dashboard
          </Link>
          <Link
            href="/form"
            className="inline-flex h-12 w-full items-center justify-center rounded-full bg-blue-950 px-4 text-sm font-medium text-white transition hover:bg-blue-800 dark:bg-sky-600 dark:hover:bg-sky-500 sm:w-auto"
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
        <article className="rounded-[2rem] border border-blue-200 bg-white p-6 shadow-[0_20px_80px_rgba(15,23,42,0.08)] dark:border-slate-700 dark:bg-slate-900">
          <h2 className="text-lg font-semibold text-blue-950 dark:text-slate-100">Add employee or manager</h2>
          <form action={addStaff} className="mt-4 space-y-3">
            <input
              name="name"
              placeholder="Full name"
              className="w-full rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm outline-none focus:border-blue-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              required
            />
            <input
              name="username"
              placeholder="Unique username"
              className="w-full rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm outline-none focus:border-blue-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              required
            />
            <input
              name="password"
              type="password"
              placeholder="Password"
              className="w-full rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm outline-none focus:border-blue-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              required
            />
            <input
              name="whatsappNumber"
              type="tel"
              placeholder="WhatsApp number (e.g. +919876543210)"
              className="w-full rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm outline-none focus:border-blue-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
            <select
              name="role"
              defaultValue={APP_ROLES.EMPLOYEE}
              className="w-full rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm outline-none focus:border-blue-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              required
            >
              <option value={APP_ROLES.EMPLOYEE}>Employee</option>
              <option value={APP_ROLES.MANAGER}>Manager</option>
            </select>
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center rounded-xl bg-blue-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-800 dark:bg-sky-600 dark:hover:bg-sky-500"
            >
              Add member
            </button>
          </form>
          <div className="mt-4 space-y-2 text-sm">
            {staffMembers.map((member) => (
              <form
                key={member.id}
                action={deleteStaff}
                className="flex flex-wrap items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-blue-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
              >
                <input type="hidden" name="id" value={member.id} />
                <p className="min-w-0 flex-1 truncate">
                  {member.name} ({member.username})
                </p>
                <span className="rounded-full bg-blue-100 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-blue-600 dark:bg-slate-700 dark:text-slate-200">
                  {member.whatsappNumber ? member.whatsappNumber : "No WA"}
                </span>
                <span className="rounded-full bg-blue-200 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-blue-700 dark:bg-slate-600 dark:text-slate-100">
                  {member.role.toLowerCase()}
                </span>
                <button
                  type="submit"
                  aria-label={`Delete ${member.name}`}
                  title="Delete user"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 bg-white text-rose-600 transition hover:bg-rose-50 dark:border-rose-700 dark:bg-slate-900 dark:text-rose-300"
                >
                  <TrashIcon />
                </button>
              </form>
            ))}
          </div>
        </article>

        <article className="rounded-[2rem] border border-blue-200 bg-white p-6 shadow-[0_20px_80px_rgba(15,23,42,0.08)] dark:border-slate-700 dark:bg-slate-900">
          <h2 className="text-lg font-semibold text-blue-950 dark:text-slate-100">Products</h2>
          <form action={addProduct} className="mt-4 flex gap-2">
            <input
              name="name"
              placeholder="New product"
              className="w-full rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm outline-none focus:border-blue-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              required
            />
            <button
              type="submit"
              className="rounded-xl bg-blue-950 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-800 dark:bg-sky-600 dark:hover:bg-sky-500"
            >
              Add
            </button>
          </form>
          <div className="mt-4 space-y-2">
            {products.map((product) => (
              <form key={product.id} action={updateProduct} className="flex flex-col gap-2 sm:flex-row">
                <input type="hidden" name="id" value={product.id} />
                <input
                  name="name"
                  defaultValue={product.name}
                  className="w-full rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm outline-none focus:border-blue-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  required
                />
                <button
                  type="submit"
                  className="rounded-xl border border-blue-300 bg-white px-3 py-2 text-xs font-medium text-blue-700 transition hover:bg-blue-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 sm:whitespace-nowrap"
                >
                  Update
                </button>
                <button
                  type="submit"
                  formAction={deleteProduct}
                  aria-label={`Delete ${product.name}`}
                  title="Delete product"
                  className="inline-flex h-10 w-full items-center justify-center rounded-xl border border-rose-200 bg-white text-rose-600 transition hover:bg-rose-50 dark:border-rose-700 dark:bg-slate-900 dark:text-rose-300 sm:w-10"
                >
                  <TrashIcon />
                </button>
              </form>
            ))}
          </div>
        </article>

        <article className="rounded-[2rem] border border-blue-200 bg-white p-6 shadow-[0_20px_80px_rgba(15,23,42,0.08)] dark:border-slate-700 dark:bg-slate-900">
          <h2 className="text-lg font-semibold text-blue-950 dark:text-slate-100">Call types</h2>
          <form action={addCallType} className="mt-4 flex gap-2">
            <input
              name="name"
              placeholder="New call type"
              className="w-full rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm outline-none focus:border-blue-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              required
            />
            <button
              type="submit"
              className="rounded-xl bg-blue-950 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-800 dark:bg-sky-600 dark:hover:bg-sky-500"
            >
              Add
            </button>
          </form>
          <div className="mt-4 space-y-2">
            {callTypes.map((callType) => (
              <form key={callType.id} action={updateCallType} className="flex flex-col gap-2 sm:flex-row">
                <input type="hidden" name="id" value={callType.id} />
                <input
                  name="name"
                  defaultValue={callType.name}
                  className="w-full rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm outline-none focus:border-blue-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  required
                />
                <button
                  type="submit"
                  className="rounded-xl border border-blue-300 bg-white px-3 py-2 text-xs font-medium text-blue-700 transition hover:bg-blue-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 sm:whitespace-nowrap"
                >
                  Update
                </button>
                <button
                  type="submit"
                  formAction={deleteCallType}
                  aria-label={`Delete ${callType.name}`}
                  title="Delete call type"
                  className="inline-flex h-10 w-full items-center justify-center rounded-xl border border-rose-200 bg-white text-rose-600 transition hover:bg-rose-50 dark:border-rose-700 dark:bg-slate-900 dark:text-rose-300 sm:w-10"
                >
                  <TrashIcon />
                </button>
              </form>
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

