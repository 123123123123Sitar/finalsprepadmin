import { redirect } from "next/navigation";
import { AdminSignInForm } from "@/components/auth/AdminSignInForm";
import { getAdminContext } from "@/lib/admin/auth";

export default async function SignInPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await getAdminContext();
  if (context) {
    redirect("/admin");
  }

  const resolvedSearchParams = (await searchParams) || {};

  const nextHref =
    typeof resolvedSearchParams.next === "string" ? resolvedSearchParams.next : "/admin";
  const initialError =
    resolvedSearchParams.error === "forbidden"
      ? "This account is authenticated but not authorized for the requested admin action."
      : undefined;

  return (
    <main className="relative min-h-screen bg-slate-950 text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(251,146,60,0.28),_transparent_36%),radial-gradient(circle_at_bottom_right,_rgba(56,189,248,0.15),_transparent_28%)]" />
      <div className="relative mx-auto grid w-full max-w-7xl gap-10 px-6 py-10 lg:min-h-screen lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <section className="max-w-xl">
          <p className="text-xs font-medium uppercase tracking-[0.28em] text-orange-200">Internal Operations</p>
          <h1 className="mt-5 font-display text-4xl leading-tight tracking-tight sm:text-5xl lg:text-6xl lg:leading-none">
            Secure admin controls for a paid AI study platform.
          </h1>
          <p className="mt-6 text-base leading-8 text-slate-300">
            This console controls subscription state, AI quota overrides, content health, platform
            flags, and support workflows backed by the same Firebase project as FinalsPrep.
          </p>
          <div className="mt-8 grid gap-4 text-sm text-slate-300 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
              <p className="font-medium text-white">Role-separated access</p>
              <p className="mt-2 leading-6">Support, content, billing, and super-admin scopes stay isolated.</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
              <p className="font-medium text-white">Full audit trail</p>
              <p className="mt-2 leading-6">Every sensitive mutation records actor, target, reason, and before/after state.</p>
            </div>
          </div>
        </section>

        <section>
          <AdminSignInForm initialError={initialError} nextHref={nextHref} />
        </section>
      </div>
    </main>
  );
}
