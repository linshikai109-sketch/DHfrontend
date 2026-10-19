import { describe, it, expect } from "vitest";
import { reportV5Fixture, fixtureStorage } from "../src/domain/report-v5-fixture";
import { bindDevelopmentAnalysis } from "../src/domain/development-analysis";
import { createDevelopmentReport, currentDevelopmentReport, roleStory } from "../src/domain/development-report";
import { createMockService } from "../src/domain/service";
import { seedSnapshot } from "../src/domain/fixtures";

describe("v5 source-bound natural report", () => {
  it("keeps one person's nine paragraphs and multiple actual fictional sources", () => {
    const w=reportV5Fixture().workspaces.emma, r=currentDevelopmentReport(w)!;
    expect(r.analysis?.sections.map(s=>s.title)).toEqual(["过去","现在","未来"]);
    expect(r.analysis?.sections.map(s=>s.paragraphs.length)).toEqual([3,3,3]);
    expect(r.analysis?.sections.flatMap(s=>s.paragraphs).join("").length).toBe(1040);
    expect(w.context).toHaveLength(8);expect(r.story.sourceIds).toHaveLength(3);
    expect(roleStory(w).title).toBe("问题破译者");expect(w.plan.items).toHaveLength(0);
  });
  it("never gives an empty or unrelated user the fictional full story", () => {
    const w=seedSnapshot().workspaces.emma,r=createDevelopmentReport(w);
    expect(r.analysis?.mode).toBe("limited_projection");
    expect(JSON.stringify(r)).not.toContain("B2B");expect(JSON.stringify(r)).not.toContain("八周");
    expect(r.story.title).toBe("还需要了解你的经历");
  });
  it("binds supplied analysis to current sources without claiming semantic verification", () => {
    const w=reportV5Fixture().workspaces.emma,a=w.developmentReport!.analysis!;
    expect(bindDevelopmentAnalysis(w,{...a,mode:"supplied_analysis"}).mode).toBe("supplied_analysis");
    expect(()=>bindDevelopmentAnalysis(w,{...a,sourceToken:"old"})).toThrow();
    expect(()=>bindDevelopmentAnalysis(w,{...a,sourceIds:["other-person"]})).toThrow();
    expect(()=>bindDevelopmentAnalysis(w,{...a,sections:[a.sections[2],a.sections[1],a.sections[0]]})).toThrow();
  });
  it("invalidates narrative and role after any fixture correction, withdrawal or stale source", () => {
    for(const mode of ["correction","withdrawal","stale"]){const w=reportV5Fixture().workspaces.emma;
      if(mode==="correction")w.context[0].title="已更正";
      if(mode==="withdrawal")w.context[0].deleted=true;
      if(mode==="stale")w.context[0].status="stale";
      expect(currentDevelopmentReport(w)).toBeUndefined();expect(roleStory(w).title).not.toBe("问题破译者");
    }
  });
  it("persists fixture separately and leaves original user's journal and workspace intact", async () => {
    const map=new Map<string,string>([["dhai-mvp-product-demo-v1","existing-user"],["emma-request","user-journal"]]);
    const storage={getItem:(k:string)=>map.get(k)??null,setItem:(k:string,v:string)=>{map.set(k,v)},removeItem:(k:string)=>{map.delete(k)}};
    const scoped=fixtureStorage(storage),service=createMockService(scoped),w=service.getSnapshot().workspaces.emma;
    expect(currentDevelopmentReport(w)?.analysis?.mode).toBe("synthetic_fixture");
    scoped.setItem("emma-request","fixture-journal");scoped.removeItem("emma-request");
    expect(map.get("emma-request")).toBe("user-journal");expect(map.get("dhai-mvp-product-demo-v1")).toBe("existing-user");
    expect(currentDevelopmentReport(createMockService(scoped).getSnapshot().workspaces.emma)).toEqual(w.developmentReport);
  });
  it("loads a legacy five-field report without pretending it is a new analysis", () => {
    const snapshot=reportV5Fixture();delete snapshot.workspaces.emma.developmentReport!.analysis;
    const raw=JSON.stringify(snapshot);const service=createMockService({getItem:()=>raw,setItem:()=>{throw Error("must not migrate on read")}});
    expect(service.getSnapshot().workspaces.emma.developmentReport?.analysis).toBeUndefined();
  });
});
