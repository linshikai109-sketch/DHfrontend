import { pictureEntries, pictureToken } from "./profile-picture";
import type { ContextNode, Role, Workspace } from "./types";

export interface ProfileSection {
  id: string;
  title: string;
  nodes: ContextNode[];
}

export function enterpriseScope(workspace: Workspace) {
  const scope = workspace.context.find(n => !n.deleted && n.sourceId === "j-scope")?.title || workspace.acquisition.answers["j-scope"]?.value || "";
  const project = workspace.context.find(n => !n.deleted && n.status !== "stale" && n.sourceId === "j-scope:followup")?.title;
  if (scope.includes("具体项目")) return project || "项目名称待补";
  if (scope.includes("企业整体")) return "企业整体";
  if (workspace.blueprint.title && workspace.blueprint.title !== "待确认的项目") return workspace.blueprint.title;
  return "企业整体";
}

const groups: Record<Role, { id: string; title: string; sources: string[] }[]> = {
  emma: [
    { id: "direction", title: "方向与目标", sources: ["e-goal", "e-direction", "e-next"] },
    { id: "experience", title: "经历与依据", sources: ["e-experience", "e-evidence"] },
    { id: "conditions", title: "时间与条件", sources: ["e-time", "e-collaboration"] },
  ],
  john: [
    { id: "business", title: "企业与业务", sources: ["j-scope", "j-goal", "j-customer", "j-stage"] },
    { id: "resources", title: "团队与资源", sources: ["j-resources", "j-constraints"] },
    { id: "progress", title: "验证与下一步", sources: ["j-commercial", "j-milestone"] },
  ],
};

export function profileSections(workspace: Workspace): ProfileSection[] {
  const current = workspace.context.filter((node) => !node.deleted && node.title.trim());
  const used = new Set<string>();
  const sections = groups[workspace.role].map(({ id, title, sources }) => {
    const nodes = current.filter((node) => {
      const match = sources.some((source) => node.sourceId === source || node.sourceId.startsWith(`${source}:`));
      if (match) used.add(node.id);
      return match;
    });
    return { id, title, nodes };
  });
  const other = current.filter((node) => !used.has(node.id));
  if (other.length) sections.push({ id: "other", title: "其他已知信息", nodes: other });
  return sections;
}

export interface CurrentAction {
  id: string;
  title: string;
  reason: string;
  status: "candidate" | "adopted" | "in_progress" | "none";
  planItemId?: string;
  alternativeCount?: number;
}

function candidateId(workspace: Workspace, node: ContextNode) {
  let hash = 2166136261;
  for (const character of pictureToken(workspace) + node.title) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return `${workspace.role}:${node.id}:${node.sourceVersion}:${hash >>> 0}`;
}

export function currentAction(workspace: Workspace): CurrentAction {
  const active = workspace.plan.items.find((item) => item.status === "in_progress")
    || workspace.plan.items.find((item) => item.status === "planned");
  if (active) return {
    id: active.recommendationId || `plan:${active.id}`,
    title: active.title,
    reason: active.dueAt ? "已有计划与期限" : "继续当前计划",
    status: active.status === "in_progress" ? "in_progress" : "adopted",
    planItemId: active.id,
  };
  const candidates = pictureEntries(workspace).filter(entry => entry.field === "focus" && (!entry.withheld || workspace.role === "emma" && entry.node.status === "candidate")).map(entry => ({
    id: candidateId(workspace, { ...entry.node, title: entry.text }),
    title: `梳理「${entry.text}」的下一步`,
    reason: entry.withheld ? "这是根据你自己提供的方向提出的建议，还需要核对资料、可投入的时间和其他限制。" : "这是根据你确认的方向提出的建议，还需要核对可投入的时间和其他限制。",
    status: "candidate" as const,
  })).filter(candidate => !workspace.recommendationFeedback?.[candidate.id]);
  if (candidates.length) return { ...candidates[0], alternativeCount: candidates.length - 1 };
  if (Object.keys(workspace.recommendationFeedback || {}).length) return {
    id: `${workspace.role}:no-new-action`,
    title: "暂无新的优先建议",
    reason: "可以继续补充情况或重新查看建议",
    status: "none",
  };
  return {
    id: `${workspace.role}:clarify`,
    title: workspace.role === "emma" ? "先确定你想推进什么" : "先明确当前业务问题",
    reason: "还不知道你想做什么，可以先补充一个目标。",
    status: "candidate",
  };
}
