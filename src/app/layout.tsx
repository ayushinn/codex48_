import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { PersonaSwitcher } from "@/components/PersonaSwitcher";
import { getPersonaFromCookie } from "@/lib/session";
import { aiConfigured } from "@/lib/engine/llm";

export const metadata: Metadata = {
  title: "Preflight — brand governance before publication",
  description:
    "Paste content, check it against your own brand guidelines, approved facts and terminology, and let a human decide. Every finding quotes the exact clause it breaks.",
};

const NAV = [
  { href: "/", label: "Workspace" },
  { href: "/reviews/new", label: "New review" },
  { href: "/knowledge", label: "Knowledge base" },
  { href: "/insights", label: "Insights" },
  { href: "/disclosure", label: "AI & services" },
];

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const persona = await getPersonaFromCookie();
  const ai = aiConfigured();

  return (
    <html lang="en">
      <body className="min-h-screen">
        <header className="border-b border-line bg-white">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
            <Link href="/" className="flex items-baseline gap-2 font-semibold tracking-tight">
              <span className="text-lg">PreFlight</span>
              <span className="hidden text-xs font-normal text-slate-500 sm:inline">
                brand governance before publication
              </span>
            </Link>
            <nav className="flex flex-wrap items-center gap-4 text-sm">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-slate-600 underline-offset-4 hover:text-ink hover:underline"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="ml-auto flex items-center gap-3">
              <span
                className={`hidden rounded-full px-2.5 py-1 text-xs font-medium sm:inline ${
                  ai ? "bg-indigo-50 text-indigo-700" : "bg-slate-100 text-slate-600"
                }`}
                title={
                  ai
                    ? "Model pass enabled in this workspace; every model quote still passes the citation verifier."
                    : "No AI key configured: findings come from the deterministic rule engine."
                }
              >
                {ai ? "AI-assisted review" : "Rule-engine review"}
              </span>
              <PersonaSwitcher current={persona.key} />
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>

        <footer className="border-t border-line bg-white">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-slate-500">
            <p>
              Preflight — Codex 48 Hackathon, Round 2 build. Automation proposes; humans decide; every
              decision is logged.
            </p>
            <p>
              <Link href="/disclosure" className="underline underline-offset-4">
                AI and external service disclosure
              </Link>
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
