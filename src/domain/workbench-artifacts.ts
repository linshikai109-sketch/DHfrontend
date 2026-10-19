import type { ContextNode, PlanItem, Quest, Snapshot, Workspace } from "./types";
import { currentAction, profileSections } from "./profile";
import { getPersonalPath } from "./personal-path";

export const artifactKinds = ["status", "compare", "path", "evidence", "timeline", "gaps", "changes", "quest"] as const;
export type ArtifactKind = typeof artifactKinds[number];
export const artifactLabels: Record<ArtifactKind, string> = {
  status: "当前状态", compare: "方案对比", path: "步骤与先后顺序", evidence: "依据与关系",
  timeline: "时间安排", gaps: "还缺哪些资料", changes: "计划变化", quest: "任务要求",
};
export function resolveIntent(prompt: string): ArtifactKind {
  if (/quest|任务要求|交付|验收|任务.*适合/i.test(prompt)) return "quest";
  if (/变化|修改计划|调整计划|提前|延期/.test(prompt)) return "changes";
  if (/缺什么|还缺|缺口|不足|待补/.test(prompt)) return "gaps";
  if (/证据|依据|为什么|来源|关系/.test(prompt)) return "evidence";
  if (/步骤|路径|流程|依赖|先后|怎么推进/.test(prompt)) return "path";
  if (/时间|安排|本周|期限|日程/.test(prompt)) return "timeline";
  if (/比较|对比|还是|方案|选择/.test(prompt)) return "compare";
  return "status";
}

export interface RouteStep {
  id: string; title: string; stage: number; status: string; dueAt?: string;
  dependencies: string[]; href: string; tentative?: boolean; lane?: string;
}
export interface ArtifactData {
  role: Workspace["role"];
  revision: string;
  facts: ContextNode[];
  relations: { id: string; from: string; to: string; label: string }[];
  sections: { id: string; title: string; nodes: ContextNode[] }[];
  action: ReturnType<typeof currentAction>;
  plan: PlanItem[];
  route: RouteStep[];
  proposal?: { id: string; title: string; rows: PlanDifference[] };
  quests: Pick<Quest, "id" | "title" | "requirements" | "deliverables" | "criteria" | "deadline" | "joinDeadline" | "timezone" | "status" | "version">[];
  feedback: { questId: string; comment: string; createdAt: string }[];
}
export interface WorkbenchTurn { id: string; prompt: string; kind: ArtifactKind; createdAt: string; data: ArtifactData; legacy?: boolean }
export interface PlanDifference { id: string; kind: "added" | "retained" | "changed" | "removed"; before?: PlanItem; after?: PlanItem }

export function planDifferences(before: PlanItem[], after: PlanItem[]): PlanDifference[] {
  return [
    ...after.map((item): PlanDifference => {
      const old = before.find((entry) => entry.id === item.id);
      return { id: item.id, kind: !old ? "added" : JSON.stringify(old) === JSON.stringify(item) ? "retained" : "changed", before: old, after: item };
    }),
    ...before.filter((item) => !after.some((entry) => entry.id === item.id)).map((item): PlanDifference => ({ id: item.id, kind: "removed", before: item })),
  ];
}

export function effectiveFact(data: Pick<ArtifactData, "facts">, source: string) {
  return data.facts.filter((node) => !node.deleted && node.status === "confirmed" &&
    (node.sourceId === source || node.sourceIds?.includes(source))).map((node) => node.title).join("；") || "尚无已确认依据";
}

/** A read projection only: never copies attachment payloads or another role's private drafts. */
export function projectArtifact(workspace: Workspace, snapshot: Snapshot): ArtifactData {
  const facts = workspace.context.filter((node) => !node.deleted && node.title.trim());
  const ids = new Set(facts.map((node) => node.id));
  const ownAttempts = snapshot.attempts.filter((attempt) => workspace.role === "emma"
    ? attempt.participant === workspace.role : attempt.questSnapshot.publisher === workspace.role);
  const available = workspace.role === "john"
    ? snapshot.quests.filter((quest) => quest.publisher === workspace.role)
    : snapshot.quests.filter((quest) => quest.status === "published");
  const quests = [...available];
  for (const attempt of ownAttempts) if (!quests.some((quest) => quest.id === attempt.questId)) quests.push(attempt.questSnapshot);
  const path = workspace.role === "emma" ? getPersonalPath(workspace, snapshot) : null;
  const route: RouteStep[] = path ? path.nodes.map((node) => ({
    id: node.id, title: node.title, stage: node.stage, status: node.status, lane: node.laneId, dueAt: node.dueAt,
    dependencies: node.dependencies, href: `/emma/path?node=${encodeURIComponent(node.id)}`, tentative: !node.planItemId && node.status === "planned",
  })) : workspace.blueprint.nodes.map((node) => ({
    id: node.id, title: node.title, stage: node.stage, status: node.status, lane: node.laneId,
    dueAt: node.kind === "hypothesis" ? undefined : node.dueAt,
    dependencies: node.dependencies, href: "/john/report", tentative: node.kind === "hypothesis",
  }));
  const proposal = [...workspace.proposals].reverse().find((item) => item.status === "ready" && item.target === "plan");
  const data: ArtifactData = {
    role: workspace.role, revision: "", facts,
    relations: workspace.edges.filter((edge) => ids.has(edge.from) && ids.has(edge.to)),
    sections: profileSections(workspace), action: currentAction(workspace), plan: workspace.plan.items,
    route, proposal: proposal ? { id: proposal.id, title: proposal.title, rows: planDifferences(workspace.plan.items, proposal.items) } : undefined,
    quests: quests.map(({ id, title, requirements, deliverables, criteria, deadline, joinDeadline, timezone, status, version }) => ({ id, title, requirements, deliverables, criteria, deadline, joinDeadline, timezone, status, version })),
    feedback: snapshot.feedback.flatMap((feedback) => {
      const attempt = ownAttempts.find((item) => item.id === feedback.attemptId);
      return attempt ? [{ questId: attempt.questId, comment: feedback.comment, createdAt: feedback.createdAt }] : [];
    }),
  };
  let hash = 2166136261;
  for (const character of JSON.stringify(data)) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  data.revision = (hash >>> 0).toString(16);
  return JSON.parse(JSON.stringify(data));
}

export const relatedArtifacts: Record<ArtifactKind, ArtifactKind[]> = {
 status: ["status", "timeline", "path"], compare: ["compare", "path", "changes"],
 path: ["path", "timeline", "gaps"], evidence: ["evidence", "gaps"],
 timeline: ["timeline", "path"], gaps: ["gaps", "evidence", "quest"],
 changes: ["changes", "compare", "timeline"], quest: ["quest", "gaps", "evidence"],
};
