import { aiConfigured, spendState } from "@/lib/engine/llm";

export const dynamic = "force-dynamic";

const RULES = [
  {
    rule: "No auto-publish",
    detail:
      "Preflight ends at approved, publish-ready plus export. Nothing is ever published by the system, and no suggestion is applied without an explicit human accept.",
  },
  {
    rule: "Evidence-linked findings",
    detail:
      "Every finding quotes the exact clause it breaks and the exact span of the draft it refers to. A deterministic verifier (code, not a model) confirms both before display; failures are counted, not hidden.",
  },
  {
    rule: "Judgement calls are labelled",
    detail:
      "Low-confidence findings render as judgement calls, never as errors, so a human - not a model - owns the ambiguous cases.",
  },
  {
    rule: "Human decisions are signal",
    detail:
      "Every dismissal requires a reason, and those reasons cluster into guideline-gap candidates in Insights, feeding the next version of the brand book.",
  },
];

export default function DisclosurePage() {
  const ai = aiConfigured();
  const spend = spendState();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="rounded-xl border border-line bg-white p-5">
        <h1 className="text-xl font-semibold">AI and external services disclosure</h1>
        <p className="mt-2 text-sm text-slate-600">
          Required by the brief and shown in-product, not only in a document. This page is the same
          disclosure a judge, a regulator or a founder can click.
        </p>
      </header>

      <section className="rounded-xl border border-line bg-white p-5 text-sm">
        <h2 className="font-semibold">Review engines in this workspace</h2>
        <table className="mt-3 w-full">
          <tbody>
            <tr className="border-b border-line">
              <td className="py-2 pr-3 font-medium">Deterministic rule engine</td>
              <td className="py-2 text-right">
                <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                  always on
                </span>
              </td>
            </tr>
            <tr className="border-b border-line">
              <td className="py-2 pr-3 font-medium">Model pass (tone, messaging, nuance)</td>
              <td className="py-2 text-right">
                <span
                  className={`rounded px-2 py-0.5 text-xs font-medium ${
                    ai ? "bg-indigo-50 text-indigo-700" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {ai ? "configured" : "no key configured — disabled"}
                </span>
              </td>
            </tr>
            <tr>
              <td className="py-2 pr-3 font-medium">Citation verifier</td>
              <td className="py-2 text-right text-xs text-slate-600">
                code, runs on every candidate finding
              </td>
            </tr>
          </tbody>
        </table>

        <div className="mt-4 rounded-md border border-line bg-slate-50 p-3 text-xs text-slate-600">
          <p>
            <strong>Provider:</strong>{" "}
            {ai
              ? `${process.env.OPENAI_MODEL ?? "gpt-4o-mini"} via ${
                  (process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/^https?:\/\//, "").split("/")[0]
                } (OpenAI-compatible)`
              : "none — this deployment runs without a model"}
          </p>
          <p className="mt-1">
            <strong>What is sent when a model pass runs:</strong> the draft text, the retrieved clause
            texts for this workspace, its terminology and approved facts. Nothing else.
          </p>
          <p className="mt-1">
            <strong>What is never sent or stored:</strong> session material, other workspaces' content,
            or customer documents for training. The key stays server-side; the browser never calls a
            model directly.
          </p>
          <p className="mt-1">
            <strong>Spend cap:</strong> ${spend.cap.toFixed(2)} per day, enforced in the adapter
            (today's estimated spend: ${spend.spent.toFixed(4)}). When the cap is hit the model pass is
            skipped, never silently paid.
          </p>
        </div>
      </section>

      <section className="rounded-xl border border-line bg-white p-5 text-sm">
        <h2 className="font-semibold">External services</h2>
        <ul className="mt-3 space-y-2 text-slate-700">
          <li>
            <strong>Hosting:</strong> the deployment platform serving this site (state the platform used
            in your submission, e.g. Vercel or Netlify).
          </li>
          <li>
            <strong>Database:</strong> PostgreSQL for workspaces, guidelines, reviews, findings and the
            audit log. Locally it runs as an embedded PGlite instance.
          </li>
          <li>
            <strong>AI provider:</strong> {ai ? "configured above" : "not configured for this deployment"}.
          </li>
          <li>
            <strong>Sign-in email:</strong> none — Round 2 ships without authentication so the link opens
            for anyone (see README for the plan change and its rationale).
          </li>
        </ul>
      </section>

      <section className="rounded-xl border border-line bg-white p-5 text-sm">
        <h2 className="font-semibold">Product rules that are enforced, not promised</h2>
        <ul className="mt-3 space-y-3">
          {RULES.map((r) => (
            <li key={r.rule}>
              <p className="font-medium">{r.rule}</p>
              <p className="text-slate-600">{r.detail}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-line bg-white p-5 text-sm">
        <h2 className="font-semibold">AI use in building this product</h2>
        <p className="mt-2 text-slate-600">
          This project was built with AI coding assistance during the official build window, as disclosed
          in the repository and the Round 2 submission. Libraries used are listed in the repository's
          README (Next.js, React, Drizzle ORM, Tailwind CSS, Mammoth, unpdf, Zod). No third-party brand
          material was scraped: the demo workspace content is fictional.
        </p>
      </section>
    </div>
  );
}
