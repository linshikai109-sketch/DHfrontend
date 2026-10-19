import { describe, expect, it } from "vitest";
import { createMockService } from "../src/domain/service";
import { enterpriseOverview } from "../src/domain/enterprise-overview";
import { overviewReturn } from "../src/domain/overview-navigation";
import type { ContextNode } from "../src/domain/types";

const fact = (sourceId: string, title: string, patch: Partial<ContextNode> = {}): ContextNode => ({
  id: sourceId, sourceId, title, kind: "fact", sourceVersion: 1, status: "confirmed", edited: false, deleted: false, x: 0, y: 0, ...patch,
});
describe("enterprise development overview", () => {
  it("uses current project facts without inventing commercial success or reintroducing removed facts", () => {
    const workspace = structuredClone(createMockService().getSnapshot().workspaces.john);
    workspace.context = [fact("j-scope", "具体项目"), fact("j-scope:followup", "访谈工具"), fact("j-customer", "小型研究团队"),
      fact("j-stage", "核心原型"), fact("j-commercial", "还没有付费客户"), fact("j-milestone", "四周内完成试用"),
      fact("j-resources", "三人", { status: "stale" }), fact("j-constraints", "过时预算", { deleted: true })];
    const report = enterpriseOverview(workspace);
    expect(report.name).toBe("访谈工具");
    expect(report.identity).toBe("小型研究团队");
    expect(report.sections.map(section => section.items.map(item => item.title))).toEqual([["还没有付费客户"], ["核心原型"], ["四周内完成试用"]]);
    workspace.context.find(node => node.sourceId === "j-stage")!.title = "开始试用";
    expect(enterpriseOverview(workspace).sections[1].items[0].title).toBe("开始试用");
    workspace.context.find(node => node.sourceId === "j-scope:followup")!.deleted = true;
    expect(enterpriseOverview(workspace).name).toBe("项目名称待补");
  });
  it("returns reopened reports to enterprise center while rejecting completed onboarding return and rejecting unrelated paths", () => {
    for (const pathname of ["/john/profile"]) {
      const origin = { pathname, search: "?canvas=full", hash: "#details" };
      expect(overviewReturn("john", origin)).toEqual(origin);
    }
    for (const pathname of ["/john/onboarding", "/emma/profile", "https://example.com", "//example.com", "/john/profile/../report"]) {
      expect(overviewReturn("john", { pathname, search: "", hash: "" })).toBeUndefined();
    }
  });
});
