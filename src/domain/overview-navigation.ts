import type { Role } from "./types";
interface Origin { pathname: string; search: string; hash: string }
/** An explicit confirm-and-view action must reopen even after the first visit. */
export function confirmationOverview(role: Role, _alreadyConfirmed: boolean, _origin: Origin) {
  const pathname = role === "emma" ? "/emma/result" : "/john/workbench";
  return { to: `${pathname}?overview=1&reopen=1`,
    state: undefined as { reportReturn: Origin } | undefined };
}
/** Restrict returns to this role's known local entry; never accept an arbitrary destination. */
export function overviewReturn(role: Role, value: unknown): Origin | undefined {
  if (!value || typeof value !== "object") return;
  const item = value as Partial<Origin>;
  const allowed = role === "emma" ? ["/emma/profile"] : ["/john/profile"];
  if (!allowed.includes(item.pathname || "") || typeof item.search !== "string" || typeof item.hash !== "string") return;
  return { pathname: item.pathname!, search: item.search, hash: item.hash };
}
