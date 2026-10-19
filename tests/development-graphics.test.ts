import { describe, it, expect } from "vitest";
import { reportV6Fixture } from "../src/domain/report-v6-fixture";
import { reportV5Fixture, fixtureStorage } from "../src/domain/report-v5-fixture";
import { bindDevelopmentAnalysis } from "../src/domain/development-analysis";
import { currentDevelopmentReport, createDevelopmentReport } from "../src/domain/development-report";
import { seedSnapshot } from "../src/domain/fixtures";

describe("v6 source-bound illustrated report", () => {
  it("separates known order, undated contribution and equal practice relationships", () => {
    const w=reportV6Fixture().workspaces.emma, a=w.developmentReport!.analysis!, g=a.graphics!;
    expect(a.sections.map(s=>s.paragraphs.length)).toEqual([1,1,1]);
    expect(g.timeline.map(n=>n.sourceIds)).toEqual([["fixture:S1"],["fixture:S2"]]);
    expect(g.undated[0].sourceIds).toEqual(["fixture:S3"]);
    expect(g.practices).toHaveLength(3); expect(g.directions).toHaveLength(2);
    expect(g.steps).toHaveLength(4); expect(w.plan.items).toHaveLength(0);
    expect(w.acquisition.confirmed).toBe(false);
    expect(reportV5Fixture().workspaces.emma.developmentReport!.analysis!.sections[0].paragraphs).toHaveLength(3);
  });
  it("rejects graph nodes outside the bound sources and stale graph versions", () => {
    const w=reportV6Fixture().workspaces.emma, a=w.developmentReport!.analysis!;
    const bad=structuredClone(a); bad.graphics!.practices[0].sourceIds=["other-person"];
    expect(()=>bindDevelopmentAnalysis(w,bad)).toThrow();
    w.context[0].sourceVersion++;
    expect(currentDevelopmentReport(w)).toBeUndefined();
    expect(()=>bindDevelopmentAnalysis(w,a)).toThrow();
  });
  it("keeps v6 preview persistence separate from v5 and the actual user", () => {
    const map=new Map<string,string>([["dhai-mvp-product-demo-v1","actual-user"]]);
    const storage={getItem:(k:string)=>map.get(k)??null,setItem:(k:string,v:string)=>{map.set(k,v)},removeItem:(k:string)=>{map.delete(k)}};
    const v5=fixtureStorage(storage),v6=fixtureStorage(storage,"v6",reportV6Fixture);
    expect(JSON.parse(v5.getItem("dhai-mvp-product-demo-v1")!).workspaces.emma.developmentReport.analysis.graphics).toBeUndefined();
    expect(JSON.parse(v6.getItem("dhai-mvp-product-demo-v1")!).workspaces.emma.developmentReport.analysis.graphics.practices).toHaveLength(3);
    v6.setItem("journal","only-v6"); expect(v5.getItem("journal")).toBeNull();
    expect(map.get("dhai-mvp-product-demo-v1")).toBe("actual-user");
  });
  it("does not invent illustrated career findings for ordinary users", () => {
    const r=createDevelopmentReport(seedSnapshot().workspaces.emma);
    expect(r.analysis!.mode).toBe("limited_projection");
    expect(r.analysis!.graphics).toBeUndefined();
    expect(JSON.stringify(r)).not.toContain("AI产品问题分析");
  });
});
