import { redirect } from "next/navigation";

import { createServiceRequest } from "../actions";
import { APP_ROLES } from "@/lib/auth-constants";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getProductOptions } from "@/lib/product-options";
import { ServiceCallBillingFields } from "../service-call-billing-fields";
import { CustomerDetailsFields, type SavedCompanyOption } from "./customer-details-fields";
import { ProductAutocomplete } from "../product-autocomplete";
import { PHONE_VALIDATION_MESSAGE } from "@/lib/phone";

export const dynamic = "force-dynamic";

type FormPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function FormPage({ searchParams }: FormPageProps) {
  const session = await getSession();

  if (!session || (session.role !== APP_ROLES.ADMIN && session.role !== APP_ROLES.MANAGER)) {
    redirect("/dashboard");
  }

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const phoneErrorParam = resolvedSearchParams.phoneError;
  const showPhoneError = (Array.isArray(phoneErrorParam) ? phoneErrorParam[0] : phoneErrorParam) === "1";
  const [databaseProducts, savedRequests, importedSavedCustomers] = await Promise.all([
    prisma.product.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.serviceRequest.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "asc" },
      take: 100,
      select: {
        company: true,
        name: true,
        contactPerson2: true,
        phoneNumber1: true,
        phoneNumber2: true,
        area: true,
        fullAddress: true,
      },
    }),
    prisma.savedCustomer.findMany({
      orderBy: { updatedAt: "desc" },
      select: {
        company: true,
        name: true,
        phoneNumber1: true,
        area: true,
        fullAddress: true,
      },
    }),
  ]);
  const products = getProductOptions(databaseProducts);
  const savedCompanies = buildSavedCompanyOptions(savedRequests, importedSavedCustomers);

  return (
    <main className="mx-auto flex min-h-full w-full max-w-7xl flex-col gap-6 px-4 py-4 sm:px-6 lg:px-8">
      <section>
        <form
          action={createServiceRequest}
          className="mx-auto max-w-4xl rounded-[2rem] border border-blue-200 bg-white p-4 shadow-[0_20px_80px_rgba(15,23,42,0.08)] sm:p-8"
        >
          <div className="mb-8 space-y-2">
            <h2 className="text-2xl font-semibold text-blue-950">New service request</h2>
            <p className="text-sm leading-6 text-blue-600">Fill details and submit.</p>
          </div>

          {showPhoneError ? (
            <p className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {PHONE_VALIDATION_MESSAGE}
            </p>
          ) : null}

          <div className="grid gap-4 sm:gap-5 md:grid-cols-2">
            <CustomerDetailsFields savedCompanies={savedCompanies} />
            <ProductAutocomplete products={products} name="product" placeholder="Type product name" required />

            <ServiceCallBillingFields />

            <label className="md:col-span-2">
              <span className="mb-2 block text-sm font-medium text-blue-700">Complaint Details</span>
              <textarea
                name="complaintDetails"
                rows={3}
                placeholder="Describe the issue, symptoms, and any observations"
                className="w-full rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-blue-950 outline-none transition placeholder:text-blue-400 focus:border-blue-400 focus:bg-white"
                required
              />
            </label>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center rounded-full bg-blue-950 px-6 py-3 text-sm font-medium text-white transition hover:bg-blue-800 sm:w-auto"
            >
              Submit request
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}

type ImportedSavedCompany = {
  company: string;
  name: string;
  phoneNumber1: string;
  area: string;
  fullAddress: string;
};

function buildSavedCompanyOptions(requests: SavedCompanyOption[], importedCustomers: ImportedSavedCompany[]) {
  const options = new Map<string, SavedCompanyOption>();

  requests.forEach((request) => {
    const key = getSavedCompanyKey(request.company);
    if (!key || options.has(key)) {
      return;
    }

    options.set(key, request);
  });

  importedCustomers.forEach((customer) => {
    const key = getSavedCompanyKey(customer.company);
    if (!key || options.has(key)) {
      return;
    }

    options.set(key, {
      company: customer.company,
      name: customer.name,
      contactPerson2: null,
      phoneNumber1: customer.phoneNumber1,
      phoneNumber2: null,
      area: customer.area,
      fullAddress: customer.fullAddress,
    });
  });

  return Array.from(options.values());
}

function getSavedCompanyKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}
