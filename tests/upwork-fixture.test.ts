import { beforeEach, describe, expect, it } from "vitest";
import { upworkFixture } from "../src/domain/upwork-fixture";
import { agencyQuestId, upworkCases, casePreviewQuest } from "../src/domain/upwork-cases";
import { fixtureStorage } from "../src/domain/report-v5-fixture";
import { createMockService, setDemoFault } from "../src/domain/service";
import { pictureEntries, pictureToken } from "../src/domain/profile-picture";
import { currentDevelopmentReport, roleStory, shareCard } from "../src/domain/development-report";
import { currentAction, enterpriseScope } from "../src/domain/profile";
import { projectArtifact } from "../src/domain/workbench-artifacts";
import { fixtureViewVersion, setFixtureViewNamespace } from "../src/domain/view-state";
import type { Command, Role } from "../src/domain/types";

beforeEach(() => { setDemoFault("none"); setFixtureViewNamespace(false); });
function setup() {
  const map = new Map<string,string>();
  const storage = {getItem:(key:string)=>map.get(key)??null,setItem:(key:string,value:string)=>{map.set(key,value);},removeItem:(key:string)=>{map.delete(key);}};
  const scoped = fixtureStorage(storage,"upwork-v1",upworkFixture);
  const service = createMockService(scoped); let n=0;
  const run=(role:Role,command:Command)=>service.execute({role,command,operationId:`upwork-test-${++n}`});
  return {service,run,map,storage,scoped};
}
describe("explicit Upwork demo with one agency mainline", () => {
  it("isolates new workspace, drafts and journals without replacing old user or v6 data", () => {
    const t=setup();
    t.map.set("dhai-mvp-product-demo-v1","user-saved");
    t.map.set("dhai-mvp-product-demo-v1:explicit-report-v6-fixture","v6-saved");
    t.map.set("emma-john-v2-pending-demo_mock","user-pending");
    t.scoped.setItem("emma-john-v2-pending-demo_mock","upwork-pending");
    t.scoped.removeItem("emma-john-v2-pending-demo_mock");
    expect(t.map.get("emma-john-v2-pending-demo_mock")).toBe("user-pending");
    expect(t.map.get("dhai-mvp-product-demo-v1")).toBe("user-saved");
    expect(t.map.get("dhai-mvp-product-demo-v1:explicit-report-v6-fixture")).toBe("v6-saved");
    const initial=t.scoped.getItem("dhai-mvp-product-demo-v1");
    fixtureStorage(t.storage,"upwork-v1",()=>{throw Error("must not overwrite saved demo");});
    expect(t.scoped.getItem("dhai-mvp-product-demo-v1")).toBe(initial);
    setFixtureViewNamespace(true,"upwork-v1");expect(fixtureViewVersion()).toBe("upwork-v1");
    setFixtureViewNamespace(true,"v6");expect(fixtureViewVersion()).toBe("v6");
  });
  it("does not invent Emma skills or mix supplemental clients into John", () => {
    const s=upworkFixture();const john=s.workspaces.john,emma=s.workspaces.emma;
    expect(john.acquisition.confirmed).toBe(false);expect(john.acquisition.review).toBe(true);
    expect(enterpriseScope(john)).toBe("当前营销机构 · 运营自动化");
    expect(s.quests).toHaveLength(1);expect(s.quests[0].id).toBe(agencyQuestId);
    expect(john.plan.items).toHaveLength(0);expect(s.attempts).toHaveLength(0);expect(s.results).toHaveLength(0);
    expect(JSON.stringify(john)).not.toMatch(/分包商|医疗|VBA/);
    expect(JSON.stringify(emma)).not.toMatch(/医疗资格|Windows|VBA|NDA|保险证明/);
    expect(currentDevelopmentReport(emma)?.analysis?.mode).toBe("synthetic_fixture");
    expect(roleStory(emma).sourceIds.every(id=>id.startsWith("fixture:"))).toBe(true);
    expect(shareCard(roleStory(emma),{avatar:false,title:true,story:false})).not.toHaveProperty("sourceIds");
  });
  it("retains four independent source scopes, prices and constraints without ISO currency", () => {
    expect(upworkCases).toHaveLength(4);
    expect(upworkCases.every(c=>c.url.includes(c.postId))).toBe(true);
    expect(JSON.stringify(upworkCases)).not.toContain("USD");
    const coi=upworkCases.find(c=>c.id==="coi")!;
    expect(coi.price).toContain("仅第一阶段");expect(coi.summary).toContain("分包商");
    expect(coi.requirements).toContain("不存税号");expect(coi.effort).toContain("不包含在 $400");
    const medical=upworkCases.find(c=>c.id==="medical")!;
    expect(medical.effort).toContain("少于 30");expect(medical.boundaries).toContain("合成文档");
    const excel=upworkCases.find(c=>c.id==="excel")!;
    expect(excel.tools).toContain("不用 AI、API、云服务或外部插件");
    for(const c of upworkCases.slice(1)){const preview=casePreviewQuest(c);expect(preview.deadline).toBe("");expect(preview.summary).toBe(c.summary);}
  });
  it("confirms John once and keeps sourced constraints available to workbench projection", async () => {
    const t=setup(),before=t.service.getSnapshot().workspaces.john;
    await t.run("john",{type:"confirmContext",limited:false,pictureToken:pictureToken(before)});
    const s=t.service.getSnapshot(),w=s.workspaces.john;
    expect(w.acquisition.confirmed).toBe(true);expect(enterpriseScope(w)).toBe("当前营销机构 · 运营自动化");
    expect(currentAction(w).status).toBe("candidate");
    expect(projectArtifact(w,s).quests.map(q=>q.id)).toEqual([agencyQuestId]);
    expect(pictureEntries(w).some(e=>e.text.includes("$2,500"))).toBe(true);
    expect(w.blueprint.nodes.every(n=>n.kind==="hypothesis"&&n.status==="planned")).toBe(true);
  });
  it("runs the existing join-submit-human-review chain with demo-only output and no silent acceptance", async () => {
    const t=setup();const quest=t.service.getSnapshot().quests[0];
    await t.run("emma",{type:"joinQuest",id:quest.id,questVersion:quest.version});
    let attempt=t.service.getSnapshot().attempts[0];
    await t.run("emma",{type:"saveAttempt",id:attempt.id,text:"演示交付：合成数据报表草稿。缺失的广告指标标未知，人工审核尚未完成。",materials:[],baseVersion:attempt.version});
    attempt=t.service.getSnapshot().attempts[0];
    await t.run("emma",{type:"submitAttempt",id:attempt.id,baseVersion:attempt.version,disclosure:[]});
    const s=t.service.getSnapshot();expect(s.attempts[0].status).toBe("awaiting_feedback");expect(s.results).toHaveLength(0);
    await expect(t.run("john",{type:"reviewSubmission",submissionId:s.submissions[0].id,decision:"accepted",comment:"演示审核",criteria:quest.criteria.map(()=>false)})).rejects.toMatchObject({code:"CRITERIA_UNMET"});
    await t.run("john",{type:"reviewSubmission",submissionId:s.submissions[0].id,decision:"accepted",comment:"演示审核：检查合成输入与来源，不代表真实客户交付。",criteria:quest.criteria.map(()=>true)});
    const done=t.service.getSnapshot();expect(done.results).toHaveLength(1);expect(done.attempts[0].status).toBe("completed");
    expect(done.quests[0].requirements).toContain("只用合成数据");
  });
});
