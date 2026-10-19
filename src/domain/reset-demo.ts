import { seedSnapshot } from "./fixtures";
import type { Role } from "./types";

type Storage = Pick<globalThis.Storage, "length" | "key" | "getItem" | "setItem" | "removeItem">;
export const resetScope = "将清除当前资料及上次重新体验中的 Emma 和 John 两个角色的回答、画像、草稿、计划、任务进度、附件和待确认操作。其他资料版本和同域其他应用数据保留。确认后进入当前角色第一题，无法撤销。";
export function resetDemo(storage: Storage, role: Role, fixture: string | null) {
  const version = ["v5", "v6", "upwork-v1", "fresh"].includes(fixture ?? "") ? fixture : null;
  const suffix = version ? `:explicit-report-${version}-fixture` : "";
  const scopes = new Set([suffix, ":explicit-report-fresh-fixture"]);
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (!key) continue;
    for (const scope of scopes) {
      if (key === `dhai-mvp-product-demo-v1${scope}` || key === `emma-john-v2-pending-demo_mock${scope}` || key.startsWith(`emma-john-v2-view${scope}:demo_mock:`)) keys.push(key);
    }
  }
  keys.push("dhai-mvp-product-demo-v1:explicit-report-fresh-fixture");
  if (version) keys.push(`dhai-mvp-product-demo-v1${suffix}`);
  const saved = [...new Set(keys)].map(key => [key, storage.getItem(key)] as const);
  const freshKey = "dhai-mvp-product-demo-v1:explicit-report-fresh-fixture";
  try {
    for (const [key] of saved) storage.removeItem(key);
    const empty = JSON.stringify(seedSnapshot());
    storage.setItem(freshKey, empty);
    // Old fixture history must also stay blank rather than recreate a completed seed.
    if (version) storage.setItem(`dhai-mvp-product-demo-v1${suffix}`, empty);
  } catch (error) {
    for (const [key, value] of saved) {if (value !== null) storage.setItem(key, value); else storage.removeItem(key);}
    throw error;
  }
  return `/mvp-ui/v2/${role}/onboarding?fixture=fresh`;
}
