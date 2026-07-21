import { redirect } from "next/navigation";

import {
  addStaff,
  addProduct,
  deleteStaff,
  deleteProduct,
  updateProduct,
} from "../actions";
import { ConfirmSubmitButton } from "../confirm-submit-button";
import { FixedCallTypesSection } from "./fixed-call-types-section";
import { SavedCustomerDetailsPanel, type SavedCustomerCompany } from "./saved-customer-details-panel";
import { StaffEditModal } from "./staff-edit-modal";
import { APP_ROLES } from "@/lib/auth-constants";
import { getSession, roleCanAssign } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SRTEC_PRODUCT_NAMES } from "@/lib/product-options";
import { PHONE_VALIDATION_MESSAGE } from "@/lib/phone";

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

  if (!session || !roleCanAssign(session.role)) {
    redirect("/dashboard");
  }

  const isAdmin = session.role === APP_ROLES.ADMIN;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const duplicateParam = resolvedSearchParams.duplicate;
  const showDuplicateWarning = (Array.isArray(duplicateParam) ? duplicateParam[0] : duplicateParam) === "1";
  const tabParam = resolvedSearchParams.tab;
  const activeTab = Array.isArray(tabParam) ? tabParam[0] : tabParam;
  const phoneErrorParam = resolvedSearchParams.phoneError;
  const showPhoneError = (Array.isArray(phoneErrorParam) ? phoneErrorParam[0] : phoneErrorParam) === "1";
  const duplicateItemLabel = activeTab === "call-types" ? "call type" : "product";

  if ((await prisma.product.count()) === 0) {
    await prisma.product.createMany({
      data: SRTEC_PRODUCT_NAMES.map((name) => ({ name })),
      skipDuplicates: true,
    });
  }

  const [staffMembers, products, callTypes, savedCustomerDetails, importedSavedCustomers] = await Promise.all([
    prisma.user.findMany({
      where: { role: { in: [APP_ROLES.MANAGER, APP_ROLES.EMPLOYEE] } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.product.findMany({ orderBy: { name: "asc" } }),
    prisma.callType.findMany({ orderBy: { name: "asc" } }),
    prisma.serviceRequest.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "asc" },
      take: 100,
      select: {
        id: true,
        company: true,
        name: true,
        contactPerson2: true,
        phoneNumber1: true,
        phoneNumber2: true,
        area: true,
        fullAddress: true,
        installationDate: true,
        createdAt: true,
      },
    }),
    prisma.savedCustomer.findMany({
      orderBy: { createdAt: "asc" },
    }),
  ]);
  const savedCustomerCompanies = buildSavedCustomerCompanies(savedCustomerDetails, importedSavedCustomers);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.16),_transparent_40%),linear-gradient(135deg,_#f8fbff_0%,_#eef6ff_100%)]">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-6 rounded-[1.25rem] border border-blue-200 bg-white p-4 shadow-[0_16px_50px_rgba(15,23,42,0.08)] sm:p-5">
          <div className="grid gap-4 xl:grid-cols-[minmax(13rem,0.72fr)_minmax(0,2fr)] xl:items-stretch">
            <div className="flex min-h-28 flex-col justify-between rounded-lg bg-blue-950 px-4 py-4 text-white">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-200">Admin panel</p>
                <h1 className="mt-2 text-2xl font-semibold tracking-tight">Overview</h1>
              </div>
              <p className="mt-4 text-xs leading-5 text-blue-100">Manage users, products, and call categories from one place.</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-blue-100 bg-blue-50/70 p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-500">Team members</p>
                    <p className="mt-3 text-3xl font-semibold leading-none text-blue-950">{staffMembers.length}</p>
                  </div>
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white text-blue-700 shadow-sm">
                    <TeamMetricIcon />
                  </span>
                </div>
                <div className="mt-4 h-1.5 rounded-full bg-blue-100">
                  <div className="h-full w-2/3 rounded-full bg-blue-600" />
                </div>
              </div>

              <div className="rounded-lg border border-cyan-100 bg-cyan-50/70 p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-600">Products</p>
                    <p className="mt-3 text-3xl font-semibold leading-none text-slate-950">{products.length}</p>
                  </div>
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white text-cyan-700 shadow-sm">
                    <ProductMetricIcon />
                  </span>
                </div>
                <div className="mt-4 h-1.5 rounded-full bg-cyan-100">
                  <div className="h-full w-4/5 rounded-full bg-cyan-600" />
                </div>
              </div>

              <div className="rounded-lg border border-indigo-100 bg-indigo-50/70 p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-indigo-600">Call types</p>
                    <p className="mt-3 text-3xl font-semibold leading-none text-slate-950">{callTypes.length}</p>
                  </div>
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white text-indigo-700 shadow-sm">
                    <CallTypeMetricIcon />
                  </span>
                </div>
                <div className="mt-4 h-1.5 rounded-full bg-indigo-100">
                  <div className="h-full w-1/2 rounded-full bg-indigo-600" />
                </div>
              </div>
            </div>
          </div>
        </header>

        {showPhoneError ? (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {PHONE_VALIDATION_MESSAGE}
          </div>
        ) : null}

        {showDuplicateWarning ? (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
            This {duplicateItemLabel} already exists. Please use a different name.
          </div>
        ) : null}

        <section className="space-y-6">
          {isAdmin ? (
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
                placeholder="+60123456789 or 9876543210"
                className="w-full rounded-2xl border border-blue-200 bg-blue-50 px-3 py-2.5 text-sm outline-none focus:border-blue-400"
              />
              <input
                name="phoneNumber2"
                type="tel"
                placeholder="+447911123456 or 9876543210"
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
          ) : null}

          <div className={`grid gap-6 ${isAdmin ? "xl:grid-cols-[1.08fr_0.92fr]" : ""}`}>
            {isAdmin ? (
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
                        <StaffEditModal member={member} departments={[...STAFF_DEPARTMENT_OPTIONS]} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </article>
            ) : null}

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

          <div className="grid gap-6 xl:grid-cols-2">
            <FixedCallTypesSection initialCallTypes={callTypes.map((callType) => ({ id: callType.id, name: callType.name }))} />
            <SavedCustomerDetailsPanel companies={savedCustomerCompanies} totalRequests={savedCustomerCompanies.length} />
          </div>
        </section>
      </div>
    </main>
  );
}

function TeamMetricIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <path
        d="M8.5 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM15.5 10a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM3.5 19c.4-3.1 2.3-5 5-5s4.6 1.9 5 5M13.5 14.2c.6-.2 1.3-.3 2-.3 2.4 0 4.1 1.5 4.5 4.4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ProductMetricIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <path
        d="M4.5 8.5 12 4l7.5 4.5v7L12 20l-7.5-4.5v-7ZM12 12.7 19.2 8.5M12 12.7 4.8 8.5M12 12.7V20"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CallTypeMetricIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <path
        d="M5 6.5h14M5 12h14M5 17.5h8M17.5 15.5 20 18l-2.5 2.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
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

function formatAdminDate(value: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(value);
}

type AdminSavedCustomerRequest = {
  id: string;
  source?: "serviceRequest";
  company: string;
  name: string;
  contactPerson2: string | null;
  phoneNumber1: string;
  phoneNumber2: string | null;
  area: string;
  fullAddress: string;
  installationDate: Date | null;
  createdAt: Date;
};

type AdminImportedSavedCustomer = {
  id: string;
  company: string;
  name: string;
  phoneNumber1: string;
  area: string;
  fullAddress: string;
  installationDate: Date | null;
  createdAt: Date;
};

function buildSavedCustomerCompanies(
  requests: AdminSavedCustomerRequest[],
  importedCustomers: AdminImportedSavedCustomer[],
): SavedCustomerCompany[] {
  const companies = new Map<string, SavedCustomerCompany>();

  requests.forEach((request) => {
    const companyKey = getSavedCustomerCompanyKey(request.company) || "unknown";
    const existing = companies.get(companyKey);

    if (existing) {
      return;
    }

    companies.set(companyKey, {
      company: request.company,
      detail: formatSavedCustomerRequest({ ...request, source: "serviceRequest" }),
    });
  });

  importedCustomers.forEach((customer) => {
    const companyKey = getSavedCustomerCompanyKey(customer.company) || "unknown";
    const existing = companies.get(companyKey);

    if (existing) {
      return;
    }

    companies.set(companyKey, {
      company: customer.company,
      detail: {
        id: customer.id,
        source: "savedCustomer",
        name: customer.name,
        contactPerson2: null,
        phoneNumber1: customer.phoneNumber1,
        phoneNumber2: null,
        area: customer.area,
        fullAddress: customer.fullAddress,
        installationDate: customer.installationDate,
        installationDateInputValue: formatDateInputValue(customer.installationDate),
        installationDateLabel: formatInstallationDate(customer.installationDate),
        createdAtLabel: formatAdminDate(customer.createdAt),
      },
    });
  });

  return Array.from(companies.values());
}

function formatSavedCustomerRequest(request: AdminSavedCustomerRequest) {
  return {
    id: request.id,
    source: request.source ?? "serviceRequest",
    name: request.name,
    contactPerson2: request.contactPerson2,
    phoneNumber1: request.phoneNumber1,
    phoneNumber2: request.phoneNumber2,
    area: request.area,
    fullAddress: request.fullAddress,
    installationDate: request.installationDate,
    installationDateInputValue: formatDateInputValue(request.installationDate),
    installationDateLabel: formatInstallationDate(request.installationDate),
    createdAtLabel: formatAdminDate(request.createdAt),
  };
}

function formatDateInputValue(value: Date | null) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

function formatInstallationDate(value: Date | null) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(value);
}

function getSavedCustomerCompanyKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}


