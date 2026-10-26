/**
 * Approval state machine.
 *
 * Statuses and their legal transitions live here; the API refuses illegal
 * transitions with 409 rather than trusting the client, and every accepted
 * transition writes an audit entry (actor, time, guideline version, reason).
 */

export const STATUSES = [
  "DRAFT",
  "SELF_REVIEW",
  "READY_FOR_REVIEW",
  "IN_REVIEW",
  "CHANGES_REQUESTED",
  "APPROVED",
  "PUBLISH_READY",
] as const;

export type Status = (typeof STATUSES)[number];

export const STATUS_LABEL: Record<Status, string> = {
  DRAFT: "Draft",
  SELF_REVIEW: "Self review",
  READY_FOR_REVIEW: "Ready for review",
  IN_REVIEW: "In review",
  CHANGES_REQUESTED: "Changes requested",
  APPROVED: "Approved",
  PUBLISH_READY: "Publish-ready",
};

export type ActionKey =
  | "run_preflight"
  | "submit"
  | "take_review"
  | "approve"
  | "request_changes"
  | "mark_publish_ready";

export type Action = {
  key: ActionKey;
  label: string;
  from: Status[];
  to: Status;
  roles: ("creator" | "manager" | "reviewer" | "admin")[];
  /** Human decides: reason required (dismissible findings / request changes). */
  requiresReason?: boolean;
  /** Blocks when unresolved blocker findings remain (only "submit"). */
  gatedOnBlockers?: boolean;
};

export const ACTIONS: Action[] = [
  {
    key: "run_preflight",
    label: "Run preflight",
    from: ["DRAFT", "CHANGES_REQUESTED", "SELF_REVIEW"],
    to: "SELF_REVIEW",
    roles: ["creator", "admin"],
  },
  {
    key: "submit",
    label: "Submit for review",
    from: ["SELF_REVIEW"],
    to: "READY_FOR_REVIEW",
    roles: ["creator", "admin"],
    gatedOnBlockers: true,
  },
  {
    key: "take_review",
    label: "Take into review",
    from: ["READY_FOR_REVIEW"],
    to: "IN_REVIEW",
    roles: ["manager", "reviewer", "admin"],
  },
  {
    key: "approve",
    label: "Approve",
    from: ["IN_REVIEW"],
    to: "APPROVED",
    roles: ["manager", "reviewer", "admin"],
  },
  {
    key: "request_changes",
    label: "Request changes",
    from: ["IN_REVIEW"],
    to: "CHANGES_REQUESTED",
    roles: ["manager", "reviewer", "admin"],
    requiresReason: true,
  },
  {
    key: "mark_publish_ready",
    label: "Mark publish-ready & export",
    from: ["APPROVED"],
    to: "PUBLISH_READY",
    roles: ["manager", "admin", "creator"],
  },
];

export function findAction(key: string): Action | undefined {
  return ACTIONS.find((a) => a.key === key);
}

export type TransitionCheck =
  | { ok: true; action: Action }
  | { ok: false; status: number; error: string };

export function checkTransition(args: {
  actionKey: string;
  currentStatus: string;
  role: string;
  allowSelfApproval: boolean;
  openBlockers: number;
}): TransitionCheck {
  const action = findAction(args.actionKey);
  if (!action) return { ok: false, status: 404, error: `Unknown action "${args.actionKey}".` };
  if (!action.from.includes(args.currentStatus as Status)) {
    return {
      ok: false,
      status: 409,
      error: `"${action.label}" is not legal from ${args.currentStatus}. Legal from: ${
        action.from.join(", ") || "none"
      }.`,
    };
  }
  if (!action.roles.includes(args.role as Action["roles"][number])) {
    return { ok: false, status: 403, error: `Role "${args.role}" cannot "${action.label}".` };
  }
  // No self-approval: a creator may not sign off their own content unless the
  // workspace explicitly allows single-person sign-off.
  if (action.key === "approve" && args.role === "creator" && !args.allowSelfApproval) {
    return {
      ok: false,
      status: 403,
      error:
        "A creator cannot approve their own content. Ask a Content Manager or Authorised Reviewer to sign off, or enable single-person sign-off in workspace settings.",
    };
  }
  if (action.gatedOnBlockers && args.openBlockers > 0) {
    return {
      ok: false,
      status: 422,
      error: `${args.openBlockers} blocker finding${
        args.openBlockers > 1 ? "s are" : " is"
      } still open. Accept, edit or dismiss each blocker (dismissals require a reason) before submitting.`,
    };
  }
  return { ok: true, action };
}
