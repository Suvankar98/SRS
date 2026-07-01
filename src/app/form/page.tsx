import Link from "next/link";
import { redirect } from "next/navigation";

import { createServiceRequest, logout } from "../actions";
import { BrandLogo } from "../brand-logo";
import { APP_ROLES } from "@/lib/auth-constants";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ServiceCallBillingFields } from "../service-call-billing-fields";

export const dynamic = "force-dynamic";

export default async function FormPage() {
  const session = await getSession();

  if (!session || (session.role !== APP_ROLES.ADMIN && session.role !== APP_ROLES.MANAGER)) {
    redirect("/dashboard");
  }

  const products = await prisma.product.findMany({ orderBy: { name: "asc" } });

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 rounded-[2rem] border border-white/10 bg-[#004b8d]/90 px-4 py-5 text-white shadow-2xl shadow-blue-900/30 backdrop-blur sm:px-6 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <div className="inline-flex rounded-xl border border-white/20 bg-[#003d73] p-2">
            <BrandLogo width={175} className="h-auto w-auto" />
          </div>
          <p className="text-sm uppercase tracking-[0.3em] text-blue-100">SRS Service Desk</p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Create a new service call</h1>
          <p className="max-w-2xl text-sm leading-6 text-blue-100 sm:text-base">
            Admin can create service requests and assign them later from dashboard.
          </p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center md:w-auto md:justify-end">
          <Link
            href="/dashboard"
            className="inline-flex w-full items-center justify-center rounded-full border border-blue-300/40 bg-blue-300/10 px-5 py-3 text-center text-sm font-medium text-blue-100 transition hover:bg-blue-300/20 sm:w-auto"
          >
            View dashboard
          </Link>
          <Link
            href="/report"
            className="inline-flex w-full items-center justify-center rounded-full border border-blue-300/40 bg-blue-300/10 px-5 py-3 text-center text-sm font-medium text-blue-100 transition hover:bg-blue-300/20 sm:w-auto"
          >
            Reports
          </Link>
          <Link
            href="/admin"
            className="inline-flex w-full items-center justify-center rounded-full border border-blue-300/40 bg-blue-300/10 px-5 py-3 text-center text-sm font-medium text-blue-100 transition hover:bg-blue-300/20 sm:w-auto"
          >
            Admin panel
          </Link>
          <form action={logout}>
            <button
              type="submit"
              className="danger-btn inline-flex w-full items-center justify-center rounded-full px-4 py-3 text-sm font-medium sm:w-auto"
            >
              Logout
            </button>
          </form>
        </div>
      </header>

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
            <Field label="Phone Number 1" name="phoneNumber1" placeholder="Primary contact number" type="tel" />
            <Field label="Phone Number 2" name="phoneNumber2" placeholder="Secondary contact number" type="tel" />
            <label>
              <span className="mb-2 block text-sm font-medium text-blue-700">Area</span>
              <select
                name="area"
                className="w-full rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-blue-950 outline-none transition focus:border-blue-400 focus:bg-white"
                defaultValue=""
                required
              >
                <option value="" disabled>
                  Select Kolkata area
                </option>
                <option value="Alipore">Alipore</option>
                <option value="Ballygunge">Ballygunge</option>
                <option value="Baghajatin">Baghajatin</option>
                <option value="Behala">Behala</option>
                <option value="Bhowanipore">Bhowanipore</option>
                <option value="Dum Dum">Dum Dum</option>
                <option value="EM Bypass">EM Bypass</option>
                <option value="Esplanade">Esplanade</option>
                <option value="Garia">Garia</option>
                <option value="Jadavpur">Jadavpur</option>
                <option value="Kalighat">Kalighat</option>
                <option value="Kasba">Kasba</option>
                <option value="Kidderpore">Kidderpore</option>
                <option value="Lake Town">Lake Town</option>
                <option value="New Alipore">New Alipore</option>
                <option value="Park Circus">Park Circus</option>
                <option value="Park Street">Park Street</option>
                <option value="Rajarhat">Rajarhat</option>
                <option value="Salt Lake">Salt Lake</option>
                <option value="Sealdah">Sealdah</option>
                <option value="Shyambazar">Shyambazar</option>
                <option value="Tollygunge">Tollygunge</option>
              </select>
            </label>
            <label>
              <span className="mb-2 block text-sm font-medium text-blue-700">Full Address</span>
              <textarea
                name="fullAddress"
                rows={4}
                placeholder="Street, building, landmark, city, postal code"
                className="w-full rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-blue-950 outline-none transition placeholder:text-blue-400 focus:border-blue-400 focus:bg-white"
                required
              />
            </label>
            <label>
              <span className="mb-2 block text-sm font-medium text-blue-700">Product</span>
              <select
                name="product"
                className="w-full rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-blue-950 outline-none transition focus:border-blue-400 focus:bg-white"
                defaultValue=""
                required
              >
                <option value="" disabled>
                  Select a product
                </option>
                {products.map((product) => (
                  <option key={product.id} value={product.name}>
                    {product.name}
                  </option>
                ))}
              </select>
            </label>

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
        className="w-full rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-blue-950 outline-none transition placeholder:text-blue-400 focus:border-blue-400 focus:bg-white"
        required={name !== "phoneNumber2"}
      />
    </label>
  );
}


