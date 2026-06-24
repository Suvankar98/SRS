import { login } from "./actions";
import { BrandLogo } from "./brand-logo";
import { PasswordField } from "./password-field";

type HomeProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

export default async function Home({ searchParams }: HomeProps) {
  const resolvedSearchParams = await searchParams;
  const showError = resolvedSearchParams?.error === "1";
  const showDatabaseError = resolvedSearchParams?.error === "2";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl items-center justify-center px-4 py-6 sm:px-6 lg:px-8">
      <section className="relative w-full max-w-md overflow-hidden rounded-[2rem] border border-[#0170C3] bg-[#0170C3] px-8 py-10 text-white shadow-[0_28px_80px_rgba(1,112,195,0.35)]">
        <div className="pointer-events-none absolute inset-0 bg-white/14 [clip-path:polygon(100%_0,100%_100%,0_100%)]" />

        <div className="relative z-10">
          <div className="mb-6 flex justify-center">
            <BrandLogo width={185} className="h-auto w-auto" />
          </div>

          <h1 className="text-center text-4xl font-bold tracking-tight">USER LOGIN</h1>

          <form action={login} className="mt-8 space-y-6">
            <label className="relative block">
              <span className="sr-only">Username</span>
              <span className="absolute left-0 top-1/2 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white text-[#0170C3] shadow-sm">
                <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden="true">
                  <path d="M12 12C14.49 12 16.5 9.99 16.5 7.5S14.49 3 12 3 7.5 5.01 7.5 7.5 9.51 12 12 12Z" stroke="currentColor" strokeWidth="1.8" />
                  <path d="M4.5 20.25C4.5 16.94 7.86 14.25 12 14.25C16.14 14.25 19.5 16.94 19.5 20.25" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </span>
              <input
                name="username"
                type="text"
                placeholder="Username"
                className="h-12 w-full rounded-full border border-white bg-white px-16 text-base text-[#0170C3] outline-none placeholder:text-[#0170C3]/70 focus:border-white"
                required
              />
            </label>

            <PasswordField />

            {showError ? (
              <p className="rounded-xl border border-white bg-white px-3 py-2 text-sm text-[#0170C3]">
                Invalid username or password.
              </p>
            ) : null}

            {showDatabaseError ? (
              <p className="rounded-xl border border-white bg-white px-3 py-2 text-sm text-[#0170C3]">
                The service is temporarily unavailable. Please try again later.
              </p>
            ) : null}

            <button
              type="submit"
              className="inline-flex h-12 w-full items-center justify-center rounded-full border border-white bg-white text-2xl font-semibold tracking-tight text-[#0170C3] transition hover:opacity-90"
            >
              LOGIN
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}

