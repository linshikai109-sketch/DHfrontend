import { enterpriseScope, profileSections } from "./profile";
import type { Workspace } from "./types";

/** Project facts remain verbatim; this view does not infer revenue, customers or outcomes. */
export function enterpriseOverview(workspace: Workspace) {
  const current = profileSections(workspace).flatMap(section => section.nodes)
    .filter(node => node.status !== "stale");
  const from = (sources: string[]) => current.filter(node => sources.some(source =>
    node.sourceId === source || node.sourceId.startsWith(`${source}:`)));
  // Resolve scope only from live facts; deleted or stale names must not reappear via answer fallbacks.
  const scopeWorkspace = { ...workspace, context: current, acquisition: { ...workspace.acquisition, answers: {} },
    blueprint: { ...workspace.blueprint, title: "待确认的项目" } };
  return {
    name: enterpriseScope(scopeWorkspace),
    identity: from(["j-customer"])[0]?.title || "业务对象待补充",
    sections: [
      { id: "past", title: "过去 · 已有基础", items: from(["j-commercial", "j-stage:followup"]), empty: "已有进展待补充" },
      { id: "present", title: "现在 · 阶段与条件", items: from(["j-stage", "j-resources", "j-constraints"]).filter(node => !node.sourceId.startsWith("j-stage:")), empty: "当前阶段与资源待补充" },
      { id: "future", title: "未来 · 目标与下一步", items: from(["j-goal", "j-milestone"]), empty: "下一步目标待补充" },
    ],
  };
}
