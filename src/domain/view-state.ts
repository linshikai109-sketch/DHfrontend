import type { Role, RuntimeProfile } from "./types";
let prefix = "emma-john-v2-view";
export function fixtureViewVersion(){return prefix.endsWith(":explicit-report-fresh-fixture")?"fresh":prefix.endsWith(":explicit-report-upwork-v1-fixture")?"upwork-v1":prefix.endsWith(":explicit-report-v6-fixture")?"v6":prefix.endsWith(":explicit-report-v5-fixture")?"v5":null;}
export function fixtureViewEnabled(){return fixtureViewVersion()!==null;}
export function setFixtureViewNamespace(enabled:boolean, version: "v5" | "v6" | "upwork-v1" | "fresh" = "v5") { prefix=enabled?`emma-john-v2-view:explicit-report-${version}-fixture`:"emma-john-v2-view"; }
export function readViewResult<T>(profile:RuntimeProfile, role:Role, key:string, fallback:T):{ok:true;value:T}|{ok:false;error:string} {
  try {
    const raw=localStorage.getItem(`${prefix}:${profile}:${role}:${key}`);
    return {ok:true,value:raw===null?fallback:JSON.parse(raw)};
  } catch { return {ok:false,error:"已有资料暂时无法读取，请保留草稿后重试"}; }
}
export function readView<T>(profile:RuntimeProfile,role:Role,key:string,fallback:T):T {
 const result=readViewResult(profile,role,key,fallback);return result.ok?result.value:fallback;
}
export function writeView(
  profile: RuntimeProfile,
  role: Role,
  key: string,
  value: unknown,
) {
  try {
    localStorage.setItem(
      `${prefix}:${profile}:${role}:${key}`,
      JSON.stringify(value),
    );
    return true;
  } catch {
    return false;
  }
}
