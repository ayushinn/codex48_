/**
 * Provider-agnostic AI adapter.
 *
 * Speaks OpenAI-compatible chat completions with structured JSON output, so the
 * provider is chosen by environment variables alone (OPENAI_BASE_URL /
 * OPENAI_MODEL / OPENAI_API_KEY). The key never reaches the browser, every
 * call is disclosed in-product, and a hard daily spend cap lives here.
 *
 * With no key configured the product still runs: the deterministic rule engine
 * produces the findings and the UI reports the review as rules-only.
 */

export type LlmFinding = {
  clauseCode: string;
  quote: string;
  clauseQuote?: string;
  why: string;
  suggestion?: string;
  confidence?: "high" | "medium" | "low";
};

type Usage = { prompt_tokens?: number; completion_tokens?: number };

const CAP_USD = Number(process.env.AI_SPEND_CAP_USD ?? "2.00");
// Approximate blended price per 1M tokens; kept in code so the cap is auditable.
const PRICE_PER_1M = 0.4;

function spendLedger(): { day: string; spent: number } {
  const g = globalThis as unknown as { __pfSpend?: { day: string; spent: number } };
  const today = new Date().toISOString().slice(0, 10);
  if (!g.__pfSpend || g.__pfSpend.day !== today) g.__pfSpend = { day: today, spent: 0 };
  return g.__pfSpend;
}

export function aiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export function spendState(): { cap: number; spent: number; configured: boolean } {
  return { cap: CAP_USD, spent: spendLedger().spent, configured: aiConfigured() };
}

function recordUsage(usage: Usage | undefined): void {
  const tokens = (usage?.prompt_tokens ?? 0) + (usage?.completion_tokens ?? 0);
  spendLedger().spent += (tokens / 1_000_000) * PRICE_PER_1M;
}

export async function runLlmReview(args: {
  content: string;
  channel: string;
  clauses: { code: string; section: string; title: string; body: string }[];
  terms: { term: string; kind: string; replacement?: string | null }[];
  facts: { claim: string; source: string }[];
}): Promise<{ findings: LlmFinding[]; model: string; provider: string } | null> {
  if (!aiConfigured()) return null;
  if (spendLedger().spent >= CAP_USD) {
    console.warn("[preflight] AI spend cap reached for today; skipping model pass.");
    return null;
  }

  const base = (process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  const provider = base.replace(/^https?:\/\//, "").split("/")[0];

  const system = `You are the review engine of Preflight, a brand-governance tool. You review one draft against a client's own brand clauses.

Rules you must follow:
- You may ONLY cite clause codes from the list provided. Never invent a code.
- Every finding must quote the exact offending words from the draft inside «guillemets», copied verbatim from the draft, and quote the governing clause text inside «» as clauseQuote ONLY if you copy it verbatim from the provided clause body. If you are unsure, do not include the finding.
- Explain in 1-2 plain sentences why it is a problem.
- Suggest a minimal, intent-preserving replacement ("" deletes the quote).
- Confidence: "high" for clear rule breaches, "medium" for judgement, "low" for taste.
- Do not flag anything the rules do not cover. Do not rewrite the piece.

Return ONLY JSON matching:
{"findings":[{"clauseCode":"GB-x.y","quote":"...","why":"...","suggestion":"...","confidence":"high|medium|low"}]}`;

  const user = `CHANNEL: ${args.channel}\n\nCLAUDES AVAILABLE:\n${args.clauses
    .map((c) => `${c.code} [${c.section}] ${c.title}: ${c.body}`)
    .join("\n")}\n\nTERMS: ${args.terms
    .map((t) => `${t.kind}:${t.term}${t.replacement ? ` -> ${t.replacement}` : ""}`)
    .join("; ")}\n\nAPPROVED FACTS: ${args.facts
    .map((f) => `${f.claim} (source: ${f.source})`)
    .join("; ")}\n\nDRAFT:\n${args.content}`;

  const body = {
    model,
    temperature: 0,
    response_format: { type: "json_object" },
    max_tokens: 900,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  };

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(`${base}/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        console.warn(`[preflight] AI provider returned ${res.status}: ${(await res.text()).slice(0, 300)}`);
        return null;
      }
      const json = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
        usage?: Usage;
      };
      recordUsage(json.usage);
      const raw = json.choices?.[0]?.message?.content ?? "";
      const parsed = JSON.parse(raw) as { findings?: LlmFinding[] };
      const findings = (parsed.findings ?? []).filter(
        (f) => typeof f?.clauseCode === "string" && typeof f?.quote === "string" && typeof f?.why === "string",
      );
      return { findings, model, provider };
    } catch (err) {
      console.warn(`[preflight] AI pass attempt ${attempt} failed:`, (err as Error).message);
    }
  }
  return null;
}
