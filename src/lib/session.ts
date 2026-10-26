import { cookies } from "next/headers";
import { DEFAULT_PERSONA, personaByKey, type Persona } from "@/lib/personas";

export const PERSONA_COOKIE = "pf_persona";

export async function getPersonaFromCookie(): Promise<Persona> {
  const jar = await cookies();
  return personaByKey(jar.get(PERSONA_COOKIE)?.value);
}
