import { NextResponse } from "next/server";
import { PERSONAS, personaByKey } from "@/lib/personas";
import { PERSONA_COOKIE } from "@/lib/session";

/** Choose which role to act as (Round 2 ships without sign-in). */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { persona?: string };
  const persona = PERSONAS.find((p) => p.key === body.persona);
  if (!persona) {
    return NextResponse.json({ error: `Unknown persona "${body.persona}"` }, { status: 400 });
  }
  const res = NextResponse.json({ ok: true, persona: personaByKey(persona.key) });
  res.headers.set(
    "Set-Cookie",
    `${PERSONA_COOKIE}=${persona.key}; Path=/; Max-Age=31536000; SameSite=Lax`,
  );
  return res;
}
