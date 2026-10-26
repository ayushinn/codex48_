/**
 * Demo personas stand in for sign-in during Round 2.
 *
 * The Round 2 brief requires that the submitted link opens for anyone, with no
 * sign-in, so authentication is deliberately deferred (documented as a plan
 * change in the README). The role model itself is real: permissions below are
 * what the state machine enforces server-side, and every transition records
 * which persona performed it in the append-only audit log.
 */

export type Role = "creator" | "manager" | "reviewer" | "admin";

export type Persona = {
  key: string;
  name: string;
  role: Role;
  title: string;
  blurb: string;
};

export const PERSONAS: Persona[] = [
  {
    key: "ayushi",
    name: "Ayushi Upadhyay",
    role: "creator",
    title: "Creator · Content",
    blurb: "Writes drafts, runs preflight, resolves findings, submits for review.",
  },
  {
    key: "ishita",
    name: "Ishita Rao",
    role: "manager",
    title: "Content Manager",
    blurb: "Takes reviews, approves or requests changes, owns the knowledge base and insights.",
  },
  {
    key: "arjun",
    name: "Arjun Mehta",
    role: "reviewer",
    title: "Authorised Reviewer · Compliance",
    blurb: "Read-only on content; verifies claims against the facts registry and signs off.",
  },
  {
    key: "admin",
    name: "Workspace Admin",
    role: "admin",
    title: "Admin",
    blurb: "Guideline versions, registries, roles and workspace settings.",
  },
];

export const DEFAULT_PERSONA = PERSONAS[0];

export function personaByKey(key: string | null | undefined): Persona {
  return PERSONAS.find((p) => p.key === key) ?? DEFAULT_PERSONA;
}
