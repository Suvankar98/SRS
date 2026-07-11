import { redirect } from "next/navigation";

import { createServiceRequest } from "../actions";
import { APP_ROLES } from "@/lib/auth-constants";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getProductOptions } from "@/lib/product-options";
import { ServiceCallBillingFields } from "../service-call-billing-fields";
import { AreaAutocomplete } from "./area-autocomplete";
import { ProductAutocomplete } from "../product-autocomplete";

export const dynamic = "force-dynamic";

export default async function FormPage() {
  const session = await getSession();

  if (!session || (session.role !== APP_ROLES.ADMIN && session.role !== APP_ROLES.MANAGER)) {
    redirect("/dashboard");
  }

  const databaseProducts = await prisma.product.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
  const products = getProductOptions(databaseProducts);

  return (
    <main className="mx-auto flex min-h-full w-full max-w-7xl flex-col gap-6 px-4 py-4 sm:px-6 lg:px-8">
      <section>
        <form
          action={createServiceRequest}
          className="mx-auto max-w-4xl rounded-[2rem] border border-blue-200 bg-white p-4 shadow-[0_20px_80px_rgba(15,23,42,0.08)] sm:p-6 sm:p-8"
        >
          <div className="mb-8 space-y-2">
            <h2 className="text-2xl font-semibold text-blue-950">New service request</h2>
            <p className="text-sm leading-6 text-blue-600">Fill details and submit.</p>
          </div>

          <div className="grid gap-4 sm:gap-5 md:grid-cols-2">
            <Field label="Name" name="name" placeholder="Enter customer name" />
            <Field label="Company" name="company" placeholder="Company or organization" />
            <Field label="Phone Number 1" name="phoneNumber1" placeholder="+91 9876543210" type="tel" />
            <Field label="Phone Number 2" name="phoneNumber2" placeholder="+91 9876543210" type="tel" />
            <AreaAutocomplete />
            <label>
              <span className="mb-2 block text-sm font-medium text-blue-700">Full Address</span>
              <textarea
                name="fullAddress"
                rows={2}
                placeholder="Street, building, landmark, city, postal code"
                className="w-full min-h-[3.5rem] max-h-56 resize-y rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-blue-950 outline-none transition placeholder:text-blue-400 focus:border-blue-400 focus:bg-white"
                required
              />
            </label>
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

type FieldProps = {
  label: string;
  name: string;
  placeholder: string;
  type?: string;
};

function Field({ label, name, placeholder, type = "text" }: FieldProps) {
  return (
    <label>
      <span className="mb-2 block text-sm font-medium text-blue-700">{label}</span>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        inputMode={type === "tel" ? "tel" : undefined}
        className="w-full rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-blue-950 outline-none transition placeholder:text-blue-400 focus:border-blue-400 focus:bg-white"
        required={name !== "phoneNumber2"}
      />
    </label>
  );
}


