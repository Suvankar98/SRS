import Link from "next/link";
import { redirect } from "next/navigation";

import {
  addStaff,
  addProduct,
  deleteStaff,
  deleteProduct,
  logout,
  updateStaff,
  updateProduct,
} from "../actions";
import { BrandLogo } from "../brand-logo";
import { ConfirmSubmitButton } from "../confirm-submit-button";
import { FixedCallTypesSection } from "./fixed-call-types-section";
import { OptionalPasswordField } from "./optional-password-field";
import { APP_ROLES } from "@/lib/auth-constants";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SRTEC_PRODUCT_NAMES } from "@/lib/product-options";

export const dynamic = "force-dynamic";

const STAFF_DEPARTMENT_OPTIONS = [
  { value: "sales", label: "Sales" },
  { value: "service", label: "Service" },
  { value: "backoffice", label: "Backoffice" },
] as const;

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
  const duplicateParam = resolvedSearchParams.duplicate;
  const showDuplicateWarning = (Array.isArray(duplicateParam) ? duplicateParam[0] : duplicateParam) === "1";
  const tabParam = resolvedSearchParams.tab;
  const activeTab = Array.isArray(tabParam) ? tabParam[0] : tabParam;
  const duplicateItemLabel = activeTab === "call-types" ? "call type" : "product";

  if ((await prisma.product.count()) === 0) {
    await prisma.product.createMany({
      data: SRTEC_PRODUCT_NAMES.map((name) => ({ name })),
      skipDuplicates: true,
    });
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
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.16),_transparent_40%),linear-gradient(135deg,_#f8fbff_0%,_#eef6ff_100%)]">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-6 overflow-hidden rounded-[2rem] border border-blue-200/70 bg-gradient-to-br from-[#001f3f] via-[#003d73] to-[#1d4ed8] p-6 text-white shadow-[0_20px_80px_rgba(15,23,42,0.2)] sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl space-y-3">
              <div className="inline-flex rounded-2xl border border-white/20 bg-white/10 p-2 backdrop-blur">
                <BrandLogo width={180} className="h-auto w-auto" />
              </div>
              <div className="space-y-2">
                <p className="text-sm uppercase tracking-[0.28em] text-blue-100/90">Admin control center</p>
                <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Manage your team and service setup</h1>
                <p className="max-w-xl text-sm leading-6 text-blue-100/85">
                  Keep staff, products, and fixed call types organised from one modern workspace.
                </p>
              </div>
            </div>
            <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center lg:w-auto lg:justify-end">
              <Link
                href="/dashboard"
                className="inline-flex h-12 w-full items-center justify-center rounded-full border border-white/25 bg-white/10 px-4 text-sm font-medium text-white transition hover:bg-white/20 sm:w-auto"
              >
                Dashboard
              </Link>
              <Link
                href="/report"
                className="inline-flex h-12 w-full items-center justify-center rounded-full border border-white/25 bg-white/10 px-4 text-sm font-medium text-white transition hover:bg-white/20 sm:w-auto"
              >
                Reports
              </Link>
              <Link
                href="/form"
                className="inline-flex h-12 w-full items-center justify-center rounded-full bg-white px-4 text-sm font-medium text-blue-950 transition hover:bg-blue-50 sm:w-auto"
              >
                New call
              </Link>
              <form action={logout}>
                <button
                  type="submit"
                  className="danger-btn inline-flex h-12 w-full items-center justify-center rounded-full border border-rose-300/70 bg-rose-500/90 px-4 text-sm font-medium text-white transition hover:bg-rose-500 sm:w-auto"
                >
                  Logout
                </button>
              </form>
            </div>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm">
              <p className="text-sm text-blue-100/80">Team members</p>
              <p className="mt-2 text-2xl font-semibold">{staffMembers.length}</p>
            </div>
            <div className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm">
              <p className="text-sm text-blue-100/80">Products</p>
              <p className="mt-2 text-2xl font-semibold">{products.length}</p>
            </div>
            <div className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm">
              <p className="text-sm text-blue-100/80">Fixed call types</p>
              <p className="mt-2 text-2xl font-semibold">{callTypes.length}</p>
            </div>
          </div>
        </header>

        {showDuplicateWarning ? (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
            This {duplicateItemLabel} already exists. Please use a different name.
          </div>
        ) : null}

        <section className="space-y-6">
          <article className="rounded-[2rem] border border-blue-200 bg-white p-6 shadow-[0_20px_80px_rgba(15,23,42,0.08)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-blue-950">Add staff and manager</h2>
                <p className="mt-1 text-sm text-blue-600">Create a new staff or manager account from one place.</p>
              </div>
            </div>

            <form action={addStaff} className="mt-5 grid gap-3 md:grid-cols-2">
              <input
                name="name"
                placeholder="Full name"
                className="w-full rounded-2xl border border-blue-200 bg-blue-50 px-3 py-2.5 text-sm outline-none focus:border-blue-400"
                required
              />
              <input
                name="username"
                placeholder="Unique username"
                className="w-full rounded-2xl border border-blue-200 bg-blue-50 px-3 py-2.5 text-sm outline-none focus:border-blue-400"
                required
              />
              <input
                name="password"
                type="password"
                placeholder="Password"
                className="w-full rounded-2xl border border-blue-200 bg-blue-50 px-3 py-2.5 text-sm outline-none focus:border-blue-400"
                required
              />
              <input
                name="phoneNumber1"
                type="tel"
                placeholder="Phone number 1"
                className="w-full rounded-2xl border border-blue-200 bg-blue-50 px-3 py-2.5 text-sm outline-none focus:border-blue-400"
              />
              <input
                name="phoneNumber2"
                type="tel"
                placeholder="Phone number 2"
                className="w-full rounded-2xl border border-blue-200 bg-blue-50 px-3 py-2.5 text-sm outline-none focus:border-blue-400"
              />
              <select
                name="department"
                defaultValue="service"
                className="w-full rounded-2xl border border-blue-200 bg-blue-50 px-3 py-2.5 text-sm outline-none focus:border-blue-400"
                required
              >
                {STAFF_DEPARTMENT_OPTIONS.map((department) => (
                  <option key={department.value} value={department.value}>
                    {department.label}
                  </option>
                ))}
              </select>
              <select
                name="role"
                defaultValue={APP_ROLES.EMPLOYEE}
                className="w-full rounded-2xl border border-blue-200 bg-blue-50 px-3 py-2.5 text-sm outline-none focus:border-blue-400 md:col-span-2"
                required
              >
                <option value={APP_ROLES.EMPLOYEE}>Employee</option>
                <option value={APP_ROLES.MANAGER}>Manager</option>
              </select>
              <button
                type="submit"
                className="inline-flex w-full items-center justify-center rounded-2xl bg-blue-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-800 md:col-span-2"
              >
                Add member
              </button>
            </form>
          </article>

          <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
            <article className="rounded-[2rem] border border-blue-200 bg-white p-6 shadow-[0_20px_80px_rgba(15,23,42,0.08)]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-blue-950">Staff and managers</h2>
                  <p className="mt-1 text-sm text-blue-600">Manage existing team members and keep their access updated.</p>
                </div>
                <span className="inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
                  {staffMembers.length} active
                </span>
              </div>

              <div className="mt-5 space-y-3">
                {staffMembers.map((member) => (
                  <div
                    key={member.id}
                    className="rounded-2xl border border-blue-200 bg-blue-50/60 p-4 shadow-sm"
                  >
                    <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
                      <div className="min-w-0 space-y-3">
                        {hasEditingStaff && editingStaffId === member.id ? (
                          <form action={updateStaff} className="grid gap-3">
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
                              placeholder="Phone number 1"
                              className="w-full rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400"
                            />
                            <input
                              name="phoneNumber2"
                              defaultValue={member.phoneNumber2 ?? ""}
                              placeholder="Phone number 2"
                              className="w-full rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400"
                            />
                            <select
                              name="department"
                              defaultValue={member.department ?? "service"}
                              className="w-full rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400"
                              required
                            >
                              {STAFF_DEPARTMENT_OPTIONS.map((department) => (
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
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="submit"
                                className="inline-flex items-center justify-center rounded-lg bg-blue-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-800"
                              >
                                Save
                              </button>
                              <Link
                                href="/admin?tab=staff"
                                className="inline-flex items-center justify-center rounded-lg border border-blue-300 bg-white px-3 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-50"
                              >
                                Cancel
                              </Link>
                            </div>
                          </form>
                        ) : (
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <p className="font-semibold text-blue-950">{member.name}</p>
                                <p className="text-xs text-blue-600">@{member.username}</p>
                              </div>
                              <span className="inline-flex rounded-full bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-blue-700">
                                {member.role.toLowerCase()}
                              </span>
                            </div>
                            <div className="grid gap-2 sm:grid-cols-2">
                              <p className="text-xs text-blue-700">Points: {member.performancePoints}</p>
                              <p className="text-xs text-blue-700">Phone 1: {member.phoneNumber1 ?? member.whatsappNumber ?? "Not provided"}</p>
                              <p className="text-xs text-blue-700">Phone 2: {member.phoneNumber2 ?? "Not provided"}</p>
                              <p className="text-xs text-blue-700">Department: {formatStaffDepartment(member.department)}</p>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-wrap items-start gap-2 justify-end">
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
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-[2rem] border border-blue-200 bg-white p-6 shadow-[0_20px_80px_rgba(15,23,42,0.08)]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-blue-950">Products</h2>
                  <p className="mt-1 text-sm text-blue-600">Create and update the products used across the service forms.</p>
                </div>
                <span className="inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
                  {products.length} listed
                </span>
              </div>
              <form action={addProduct} className="mt-5 flex flex-col gap-3 sm:flex-row">
                <input
                  name="name"
                  placeholder="New product"
                  className="w-full rounded-2xl border border-blue-200 bg-blue-50 px-3 py-2.5 text-sm outline-none focus:border-blue-400"
                  required
                />
                <button
                  type="submit"
                  className="rounded-2xl bg-blue-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-800 sm:min-w-[7rem]"
                >
                  Add
                </button>
              </form>
              <div className="mt-5 max-h-[34rem] space-y-3 overflow-y-auto pr-2">
                {products.map((product) => (
                  <div key={product.id} className="rounded-2xl border border-blue-200 bg-blue-50/70 p-3">
                    <div className="grid grid-cols-[minmax(0,1fr)_2.5rem] gap-2">
                      <form action={updateProduct} className="grid min-w-0 grid-cols-[minmax(0,1fr)_2.5rem] gap-2">
                        <input type="hidden" name="id" value={product.id} />
                        <input
                          name="name"
                          defaultValue={product.name}
                          className="w-full rounded-2xl border border-blue-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400"
                          required
                        />
                        <button
                          type="submit"
                          aria-label={`Update ${product.name}`}
                          title="Update product"
                          className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-blue-300 bg-white text-blue-700 transition hover:bg-blue-50"
                        >
                          <EditIcon />
                        </button>
                      </form>
                      <form action={deleteProduct}>
                        <input type="hidden" name="id" value={product.id} />
                        <ConfirmSubmitButton
                          confirmMessage={`Are you sure you want to delete product ${product.name}?`}
                          ariaLabel={`Delete ${product.name}`}
                          title="Delete product"
                          className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-rose-200 bg-white text-rose-600 transition hover:bg-rose-50"
                        >
                          <TrashIcon />
                        </ConfirmSubmitButton>
                      </form>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          </div>

          <FixedCallTypesSection initialCallTypes={callTypes.map((callType) => ({ id: callType.id, name: callType.name }))} />
        </section>
      </div>
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

function formatStaffDepartment(department: string | null) {
  return STAFF_DEPARTMENT_OPTIONS.find((option) => option.value === department)?.label ?? "Not selected";
}


