import { createDevelopmentReport } from "./development-report";
// Demo role checks model the UI contract only; real authentication/authorization belongs to the connected backend.
import type {
  Snapshot,
  ProductService,
  Request,
  ProductError,
  Fault,
  Quest,
  PlanItem,
  Workspace,
  Proposal,
  Operation,
  Decision,
  BlueprintNode,
} from "./types";
import { fragments, pictureToken, stopRequested } from "./profile-picture";
import { seedSnapshot } from "./fixtures";
import {
  getPersonalPath,
  persistPersonalPath,
  validatePersonalPath,
} from "./personal-path";
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
const KEY = "dhai-mvp-product-demo-v1";
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
function freeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(freeze);
  }
  return value;
}
let fault: Fault = "none";
export function setDemoFault(value: Fault) {
  fault = value;
}
function fail(code: string, message: string, operationId?: string): never {
  throw Object.assign(new Error(message), {
    code,
    operationId,
  }) as ProductError;
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
const hash = (s: string) => {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
};
function sources(w: Workspace) {
  const nodes = w.context
    .map((n) => ({
      id: n.id,
      title: n.title,
      kind: n.kind,
      sourceId: n.sourceId,
      sourceIds: n.sourceIds,
      sourceVersion: n.sourceVersion,
      status: n.status,
      edited: n.edited,
      deleted: n.deleted,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
  const edges = w.edges
    .map((e) => ({ from: e.from, to: e.to, label: e.label }))
    .sort((a, b) => canonical(a).localeCompare(canonical(b)));
  return Object.fromEntries([
    ...Object.entries(w.acquisition.answers).map(([k, v]) => [
      `answer:${k}`,
      v.version,
    ]),
    ["context", hash(canonical(nodes))],
    ["relationships", hash(canonical(edges))],
    ["blueprint", w.blueprint.version],
  ]) as Record<string, number>;
}
/** Read-only projection of the same plan/source checks enforced on adoption. */
export function isProposalCurrent(workspace: Workspace, proposal: Proposal): boolean {
  return proposal.status === "ready" && workspace.plan.version === proposal.baseVersion &&
    canonical(proposal.sourceVersions) === canonical(sources(workspace));
}
function version(current: number, base: number) {
  if (current !== base) fail("VERSION_CONFLICT", "内容已更新，请重新查看改动");
}
function requireText(v: string) {
  if (!v.trim()) fail("VALIDATION_FAILED", "请补齐内容");
}
const minuteTime = (value: string) =>
  Math.floor(Date.parse(value) / 60000) * 60000;
function validDate(v: string) {
  return Number.isFinite(Date.parse(v));
}
function commitments(items: PlanItem[], old: PlanItem[]) {
  const committed = old.filter((i) => i.attemptId);
  const ids = new Set(committed.map((i) => i.id));
  return [
    ...clone(items.filter((i) => !i.attemptId && !ids.has(i.id))),
    ...committed.map(clone),
  ];
}
function publishValidation(q: Quest) {
  if (
    !q.title.trim() ||
    !q.requirements.trim() ||
    !q.deliverables.length ||
    q.deliverables.some((x) => !x.trim()) ||
    !q.criteria.length ||
    q.criteria.some((x) => !x.trim()) ||
    !q.effort.trim() ||
    !q.reward.trim() ||
    !validDate(q.deadline) ||
    !validDate(q.joinDeadline)
  )
    fail("VALIDATION_FAILED", "请补齐任务要求、产出、标准、投入、回报与期限");
  if (
    Date.parse(q.joinDeadline) <= Date.now() ||
    Date.parse(q.deadline) < Date.parse(q.joinDeadline)
  )
    fail("DEADLINE_PASSED", "请检查接取与交付期限");
}
const decisionLabels: Record<Decision, string> = {
  revision_requested: "需要修订",
  accepted: "已验收",
  practice_completed: "练习已完成",
  continue_conversation: "继续沟通",
  not_proceeding: "暂不继续",
};
function freePosition(w: Workspace, origin = { x: 40, y: 40 }) {
  for (let slot = 0; ; slot++) {
    const point = {
      x: origin.x + (slot % 3) * 260,
      y: origin.y + Math.floor(slot / 3) * 176,
    };
    if (
      !w.context.some(
        (n) =>
          !n.deleted &&
          Math.abs(n.x - point.x) < 260 &&
          Math.abs(n.y - point.y) < 176,
      )
    )
      return point;
  }
}
function assertAcyclic(
  nodes: BlueprintNode[],
  editedId: string,
  dependencies: string[],
) {
  const graph = new Map(
    nodes.map((n) => [n.id, n.id === editedId ? dependencies : n.dependencies]),
  );
  const visiting = new Set<string>(),
    visited = new Set<string>();
  const visit = (id: string) => {
    if (visiting.has(id))
      fail("DEPENDENCY_CYCLE", "依赖形成了循环，请调整先后关系");
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dependency of graph.get(id) || []) visit(dependency);
    visiting.delete(id);
    visited.add(id);
  };
  for (const node of nodes) visit(node.id);
}
function transition(s: Snapshot, r: Request) {
  const w = s.workspaces[r.role],
    c = r.command,
    now = new Date().toISOString();
  let seq = 0;
  const id = (prefix: string) => `${prefix}-${r.operationId}-${++seq}`;
  const quest = (key: string) => {
    const q = s.quests.find((x) => x.id === key);
    if (!q) fail("NOT_FOUND", "任务不存在");
    return q;
  };
  const attempt = (key: string) => {
    const a = s.attempts.find((x) => x.id === key);
    if (!a) fail("NOT_FOUND", "参与记录不存在");
    return a;
  };
  const owner = (q: Quest) => {
    if (q.publisher !== r.role) fail("FORBIDDEN", "当前演示身份无此操作权限");
  };
  const participant = (a: ReturnType<typeof attempt>) => {
    if (a.participant !== r.role) fail("FORBIDDEN", "无法修改其他参与者的内容");
  };
  const addProposal = (
    title: string,
    items: PlanItem[],
    target: Proposal["target"] = "plan",
    changes?: Proposal["changes"],
  ) => {
    const p: Proposal = {
      id: id("proposal"),
      title,
      baseVersion: w.plan.version,
      items: clone(items),
      sourceVersions: sources(w),
      status: "ready",
      target,
      changes,
    };
    w.proposals.push(p);
    return p;
  };
  const invalidate = (sourceIds: string[], except?: string) => {
    for (const memory of w.memories) if (memory.sourceIds.some(source => sourceIds.includes(source))) memory.status = "stale";
    for (const node of w.context) if (node.id !== except && node.sourceIds?.some(source => sourceIds.includes(source))) node.status = "stale";
    if (w.role === "john" && w.acquisition.confirmed) w.acquisition.review = true;
    if (w.plan.items.length) w.profileImpact = "资料已变化；已加入计划的行动与实际进度保留，请复核时间、条件与依据是否仍适用。";
  };
  switch (c.type) {
    case "saveDraft":
      w.acquisition.drafts[c.questionId] = c.value;
      break;
    case "setAcquisition":
      if (c.index !== undefined) {
        if (c.index < 0 || c.index > (r.role === "emma" ? 6 : 7))
          fail("VALIDATION_FAILED", "题目位置无效");
        w.acquisition.index = c.index;
      }
      if (c.review !== undefined) w.acquisition.review = c.review;
      break;
    case "saveAnswer": {
      if (!c.skipped) requireText(c.value);
      if (c.nextIndex < 0 || c.nextIndex > (r.role === "emma" ? 7 : 8))
        fail("VALIDATION_FAILED", "题目位置无效");
      const old = w.acquisition.answers[c.questionId];
      if (old && old.value === c.value && old.skipped === !!c.skipped) {
        w.acquisition.drafts[c.questionId] = c.value;
        w.acquisition.index = c.nextIndex;
        if (/:(followup|clarify)$/.test(c.questionId))
          for (const node of w.context)
            if (
              node.status === "stale" &&
              (node.sourceId === c.questionId ||
                node.sourceIds?.includes(c.questionId))
            )
              node.status = "candidate";
        break;
      }
      if (c.branch && !old) w.acquisition.branches++;
      if (c.clarification && !old) w.acquisition.clarifications++;
      const v = (old?.version || 0) + 1;
      w.acquisition.answers[c.questionId] = {
        id: c.questionId,
        value: c.value,
        skipped: !!c.skipped,
        version: v,
      };
      w.acquisition.drafts[c.questionId] = c.value;
      w.acquisition.index = c.nextIndex;
      if (old) invalidate([c.questionId]);
      if (stopRequested(c.value)) w.acquisition.review = true;
      // A later correction keeps B available; affected observations become stale.
      const related = w.context.filter(
        (n) =>
          n.sourceId === c.questionId || n.sourceIds?.includes(c.questionId),
      );
      for (const n of related) {
        n.status = !n.edited && (!n.sourceIds || n.sourceIds.length === 1) ? "candidate" : "stale";
        if (c.skipped) n.deleted = true;
        n.sourceVersion = v;
        if (
          !n.edited &&
          !c.skipped &&
          (!n.sourceIds || n.sourceIds.length === 1)
        )
          n.title = c.value;
      }
      if (!related.length && !c.skipped) {
        const newId = id("context"),
          isFollowup = /:(followup|clarify)$/.test(c.questionId),
          anchorId = c.questionId.split(":")[0];
        const parent = isFollowup
          ? w.context.find(
              (n) =>
                !n.deleted &&
                (n.sourceId === anchorId || n.sourceIds?.includes(anchorId)),
            )
          : w.context.find((n) => !n.deleted && n.kind === "goal");
        w.context.push({
          id: newId,
          title: c.value,
          kind: c.questionId.includes("goal") ? "goal" : "fact",
          sourceId: c.questionId,
          sourceVersion: v,
          status: "candidate",
          edited: false,
          deleted: false,
          ...freePosition(w),
        });
        if (parent)
          w.edges.push({
            id: id("edge"),
            from: parent.id,
            to: newId,
            label: isFollowup ? "补充" : "关联",
          });
      }
      if (old) {
        const childIds = new Set([
          `${c.questionId}:followup`,
          `${c.questionId}:clarify`,
        ]);
        for (const node of w.context)
          if (
            childIds.has(node.sourceId) ||
            node.sourceIds?.some((source) => childIds.has(source))
          )
            node.status = "stale";
        for (const memory of w.memories)
          if (
            memory.sourceIds.some(
              (source) => source === c.questionId || childIds.has(source),
            )
          )
            memory.status = "stale";
      }
      break;
    }
    case "completeOnboarding": {
      if (r.role !== "emma") fail("FORBIDDEN", "企业端保留原确认流程");
      if (w.acquisition.completed) break;
      if (c.pictureToken !== pictureToken(w)) fail("VERSION_CONFLICT", "资料已变化，请使用当前对话结束");
      w.acquisition.completed = true;
      w.acquisition.completionOperationId = r.operationId;
      w.acquisition.review = false;
      w.acquisition.limited = Object.keys(w.acquisition.answers).length < 7;
      w.developmentReport = createDevelopmentReport(w, now);
      break;
    }
    case "saveRoleExpression": {
      if (r.role !== "emma") fail("FORBIDDEN", "仅个人端提供此表达");
      if (c.baseToken !== pictureToken(w)) fail("VERSION_CONFLICT", "资料已更新，请重新查看角色卡");
      if (c.title.length > 40) fail("VALIDATION_FAILED", "称号请控制在40字以内");
      w.roleExpression = {title:c.title.trim(),hidden:c.hidden};
      break;
    }
    case "confirmContext": {
      if (c.pictureToken !== undefined && c.pictureToken !== pictureToken(w)) fail("VERSION_CONFLICT", "摘要已更新，请查看当前资料后再确认");
      w.context.forEach((n) => {
        if (!n.deleted && n.status === "candidate" && n.sourceId in w.acquisition.answers)
          n.status = "confirmed";
      });
      w.acquisition.confirmed = true;
      w.acquisition.limited = c.limited;
      w.acquisition.review = false;
      const goal =
        w.context.find((n) => !n.deleted && n.kind === "goal") ||
        w.context.find((n) => !n.deleted);
      if (r.role === "john" && goal) {
        const projectName = w.context.find(
          (n) =>
            !n.deleted &&
            n.status === "confirmed" &&
            (n.sourceId === "j-scope:followup" ||
              n.sourceIds?.includes("j-scope:followup")),
        );
        if (projectName) {
          w.blueprint.title = projectName.title;
          w.blueprint.version++;
        }
      }
      break;
    }
    case "editContext": {
      const n = w.context.find((n) => n.id === c.id);
      if (!n) fail("NOT_FOUND", "内容不存在");
      if (n.status === "stale" && c.patch.status === "confirmed")
        fail("STALE_SOURCE", "请先保存复核后的内容");
      if (c.patch.title !== undefined) requireText(c.patch.title);
      if (c.patch.title !== undefined || c.patch.deleted !== undefined || c.patch.kind !== undefined) invalidate(n.sourceIds || [n.sourceId], n.id);
      Object.assign(n, c.patch);
      if (c.patch.title !== undefined) {
        n.edited = true;
        n.status = "candidate";
      }
      break;
    }
    case "excludeProfileFact": {
      if (c.baseToken !== pictureToken(w)) fail("VERSION_CONFLICT", "资料已变化，请重新查看");
      const node = w.context.find(n => n.id === c.id && !n.deleted);
      if (!node) fail("NOT_FOUND", "内容不存在");
      const parts = fragments(node.title);
      if (!Number.isInteger(c.segment) || c.segment < 0 || c.segment >= parts.length) fail("VERSION_CONFLICT", "字段已变化，请重新查看");
      parts.splice(c.segment, 1);
      invalidate(node.sourceIds || [node.sourceId], node.id);
      if (!parts.length) node.deleted = true;
      else node.title = parts.join("；");
      node.edited = true;
      node.sourceVersion++;
      break;
    }
    case "saveProfileFact": {
      requireText(c.title);
      const node = w.context.find((item) => item.id === c.id && !item.deleted);
      if (!node) fail("NOT_FOUND", "内容不存在");
      if (c.baseToken !== undefined && c.baseToken !== pictureToken(w)) fail("VERSION_CONFLICT", "资料已更新，请重新打开当前字段");
      if (c.segment !== undefined) {
        const parts = fragments(node.title);
        if (!Number.isInteger(c.segment) || c.segment < 0 || c.segment >= parts.length) fail("VERSION_CONFLICT", "字段已变化，请重新查看");
        parts[c.segment] = c.title.trim();
        node.title = parts.join("；");
      } else node.title = c.title.trim();
      invalidate(node.sourceIds || [node.sourceId], node.id);
      node.sourceVersion++;
      node.edited = true;
      node.status = "confirmed";
      break;
    }
    case "mergeContext": {
      requireText(c.title);
      const selected = w.context.filter(
        (n) => c.ids.includes(n.id) && !n.deleted,
      );
      if (selected.length < 2 || selected.length !== new Set(c.ids).size)
        fail("VALIDATION_FAILED", "请选择至少两个有效节点");
      const sid = id("context"),
        sourceIds = [
          ...new Set(selected.flatMap((n) => n.sourceIds || [n.sourceId])),
        ];
      w.context.push({
        ...clone(selected[0]),
        id: sid,
        title: c.title,
        sourceId: sourceIds[0],
        sourceIds,
        edited: true,
        deleted: false,
        status: "candidate",
      });
      selected.forEach((n) => (n.deleted = true));
      const replaced = w.edges
        .map((e) => ({
          ...e,
          from: c.ids.includes(e.from) ? sid : e.from,
          to: c.ids.includes(e.to) ? sid : e.to,
        }))
        .filter((e) => e.from !== e.to);
      const seen = new Set<string>();
      w.edges = replaced.filter((e) => {
        const key = `${e.from}:${e.to}:${e.label}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      break;
    }
    case "splitContext": {
      const n = w.context.find((n) => n.id === c.id && !n.deleted);
      if (!n) fail("NOT_FOUND", "节点不存在");
      if (c.titles.length < 2 || c.titles.some((t) => !t.trim()))
        fail("VALIDATION_FAILED", "请填写至少两个拆分内容");
      n.deleted = true;
      c.titles.forEach((title) =>
        w.context.push({
          ...clone(n),
          id: id("context"),
          title,
          status: "candidate",
          edited: true,
          deleted: false,
          ...freePosition(w, { x: n.x, y: n.y }),
        }),
      );
      w.edges = w.edges.filter((e) => e.from !== n.id && e.to !== n.id);
      break;
    }
    case "addContext":
      requireText(c.title);
      w.context.push({
        id: id("context"),
        title: c.title,
        kind: c.kind,
        sourceId: "manual",
        sourceVersion: 1,
        status: "candidate",
        edited: true,
        deleted: false,
        ...freePosition(w),
      });
      break;
    case "setEdges": {
      const ids = new Set(w.context.filter((n) => !n.deleted).map((n) => n.id));
      if (
        c.edges.some(
          (e) => !ids.has(e.from) || !ids.has(e.to) || e.from === e.to,
        ) ||
        new Set(c.edges.map((e) => e.id)).size !== c.edges.length
      )
        fail("VALIDATION_FAILED", "请选择有效的连接对象");
      w.edges = clone(c.edges);
      break;
    }
    case "saveMemory": {
      requireText(c.text);
      const m = c.id ? w.memories.find((m) => m.id === c.id) : undefined;
      if (c.id && !m) fail("NOT_FOUND", "记忆不存在");
      if (m)
        Object.assign(m, {
          text: c.text,
          status: c.status,
          sourceIds: c.sourceIds ?? m.sourceIds,
          updatedAt: now,
        });
      else
        w.memories.push({
          id: id("memory"),
          text: c.text,
          status: c.status,
          sourceIds: c.sourceIds || [],
          updatedAt: now,
        });
      break;
    }
    case "createProposal":
      requireText(c.title);
      addProposal(c.title, c.items);
      break;
    case "adoptProposal": {
      const p = w.proposals.find((p) => p.id === c.id);
      if (!p) fail("NOT_FOUND", "方案不存在");
      if (p.status !== "ready") fail("INVALID_TRANSITION", "该方案已处理");
      version(w.plan.version, p.baseVersion);
      if (canonical(p.sourceVersions) !== canonical(sources(w)))
        fail("STALE_SOURCE", "依据已变化，请重新生成方案");
      if (p.target === "blueprint") {
        for (const change of p.changes || []) {
          const n = w.blueprint.nodes.find((n) => n.id === change.nodeId);
          if (!n || n.dueAt !== change.before)
            fail("VERSION_CONFLICT", "节点日期已变化");
          n.dueAt = change.after;
        }
        w.blueprint.version++;
      }
      w.plan.items = commitments(p.items, w.plan.items);
      w.plan.adoptedTitle = p.title;
      w.plan.version++;
      p.status = "adopted";
      break;
    }
    case "cancelProposal": {
      const p = w.proposals.find((p) => p.id === c.id);
      if (!p || p.status !== "ready") fail("INVALID_TRANSITION", "方案已处理");
      p.status = "cancelled";
      break;
    }
    case "undoPlan": {
      version(w.plan.version, c.baseVersion);
      const p = w.proposals.find((p) => p.id === c.proposalId);
      if (!p || p.status !== "adopted")
        fail("INVALID_TRANSITION", "方案无法撤销");
      if (p.target === "blueprint") {
        for (const change of p.changes || []) {
          const node = w.blueprint.nodes.find((n) => n.id === change.nodeId);
          if (!node || node.dueAt !== change.after)
            fail("VERSION_CONFLICT", "节点已有后续变化");
          node.dueAt = change.before;
        }
        w.blueprint.version++;
      }
      w.plan.items = commitments(c.items, w.plan.items);
      w.plan.version++;
      p.status = "cancelled";
      break;
    }
    case "adoptRecommendation": {
      if (c.pictureToken !== undefined && c.pictureToken !== pictureToken(w)) fail("STALE_SOURCE", "建议依据已变化，请重新查看当前建议");
      requireText(c.recommendationId);
      requireText(c.title);
      if (!w.plan.items.some((item) => item.recommendationId === c.recommendationId)) {
        w.plan.items.push({
          id: id("plan"),
          title: c.title.trim(),
          status: "planned",
          recommendationId: c.recommendationId,
        });
        w.plan.version++;
      }
      break;
    }
    case "respondRecommendation": {
      requireText(c.recommendationId);
      w.recommendationFeedback = {
        ...w.recommendationFeedback,
        [c.recommendationId]: c.decision,
      };
      break;
    }
    case "resetRecommendationFeedback": {
      w.recommendationFeedback = {};
      break;
    }
    case "setPlanItem": {
      const item = w.plan.items.find((i) => i.id === c.id);
      if (!item) fail("NOT_FOUND", "计划不存在");
      if (item.attemptId) {
        const a = attempt(item.attemptId);
        if (c.status === "completed" && a.status !== "completed")
          fail("INVALID_TRANSITION", "任务尚未完成");
      }
      item.status = c.status;
      w.plan.version++;
      break;
    }
    case "ensurePersonalPath": {
      if (r.role !== "emma") fail("FORBIDDEN", "个人路径仅适用于 Emma");
      if (!w.personalPath) persistPersonalPath(w, s, getPersonalPath(w, s));
      break;
    }
    case "savePersonalPath": {
      if (r.role !== "emma") fail("FORBIDDEN", "个人路径仅适用于 Emma");
      const current = getPersonalPath(w, s);
      version(current.version, c.baseVersion);
      version(current.version, c.path.version);
      if (
        c.path.sourcePlanVersion !== w.plan.version ||
        canonical(c.path.sourceAttemptVersions) !==
          canonical(current.sourceAttemptVersions)
      )
        fail("VERSION_CONFLICT", "计划或任务已更新，请重新查看路径");
      validatePersonalPath(c.path);
      for (const node of c.path.nodes) {
        const old = current.nodes.find((n) => n.id === node.id);
        const item = w.plan.items.find((i) => i.id === node.planItemId);
        const linkedAttempt = item?.attemptId
          ? attempt(item.attemptId)
          : undefined;
        if (linkedAttempt && linkedAttempt.participant !== r.role)
          fail("FORBIDDEN", "不能关联其他参与者的任务");
        const questId = linkedAttempt?.questId || node.questId;
        if (old?.questId && old.questId !== questId)
          fail(
            "INVALID_TRANSITION",
            "已关联任务的节点可移出路径，不能替换任务",
          );
        if (questId) {
          const q = quest(questId);
          const a =
            linkedAttempt ||
            s.attempts.find(
              (a) => a.questId === questId && a.participant === r.role,
            );
          const status = a
            ? a.status === "completed"
              ? "completed"
              : "in_progress"
            : "planned";
          if (
            node.status !== status ||
            node.dueAt !== (a?.questSnapshot || q).deadline
          )
            fail("INVALID_TRANSITION", "任务状态和期限请在 Quest 中查看");
          if (
            node.questId &&
            linkedAttempt &&
            node.questId !== linkedAttempt.questId
          )
            fail("VALIDATION_FAILED", "任务与计划关联不一致");
        }
        if (node.planItemId && !item && old?.planItemId !== node.planItemId)
          fail("NOT_FOUND", "关联计划不存在");
      }
      persistPersonalPath(w, s, {
        ...clone(c.path),
        version: current.version + 1,
      });
      break;
    }
    case "saveBlueprintNode": {
      version(w.blueprint.version, c.baseVersion);
      const n = w.blueprint.nodes.find((n) => n.id === c.id);
      if (!n) fail("NOT_FOUND", "节点不存在");
      if (c.patch.id && c.patch.id !== c.id)
        fail("VALIDATION_FAILED", "不能修改节点标识");
      if (c.patch.title !== undefined) requireText(c.patch.title);
      if (c.patch.dueAt && !validDate(c.patch.dueAt))
        fail("VALIDATION_FAILED", "日期无效");
      if (
        c.patch.dependencies?.some(
          (dep) => dep === n.id || !w.blueprint.nodes.some((x) => x.id === dep),
        )
      )
        fail("VALIDATION_FAILED", "依赖节点无效");
      if (c.patch.dependencies)
        assertAcyclic(w.blueprint.nodes, n.id, c.patch.dependencies);
      Object.assign(n, c.patch, { id: n.id });
      w.blueprint.version++;
      break;
    }
    case "setBlueprint":
      if (c.title !== undefined) {
        requireText(c.title);
        w.blueprint.title = c.title;
      }
      if (c.fundingEnabled !== undefined)
        w.blueprint.fundingEnabled = c.fundingEnabled;
      w.blueprint.version++;
      break;
    case "proposeDelay": {
      const n = w.blueprint.nodes.find((n) => n.id === c.id);
      if (!n) fail("NOT_FOUND", "节点不存在");
      if (n.id === "finance-2" && !w.blueprint.fundingEnabled)
        fail("INVALID_TRANSITION", "融资维度尚未启用");
      if (!validDate(c.dueAt) || !validDate(n.dueAt))
        fail("VALIDATION_FAILED", "请先确认有效的原日期与新日期");
      const delta = minuteTime(c.dueAt) - minuteTime(n.dueAt),
        ids = new Set([n.id]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const x of w.blueprint.nodes)
          if (
            !ids.has(x.id) &&
            (x.id !== "finance-2" || w.blueprint.fundingEnabled) &&
            x.dependencies.some((d) => ids.has(d))
          ) {
            ids.add(x.id);
            changed = true;
          }
      }
      if (w.blueprint.nodes.some((x) => ids.has(x.id) && !validDate(x.dueAt)))
        fail("VALIDATION_FAILED", "请先确认受影响节点的日期");
      const changes = w.blueprint.nodes
        .filter((x) => ids.has(x.id))
        .map((x) => ({
          nodeId: x.id,
          before: x.dueAt,
          after: new Date(minuteTime(x.dueAt) + delta).toISOString(),
        }));
      addProposal(
        `调整「${n.title}」的时间`,
        w.plan.items,
        "blueprint",
        changes,
      );
      break;
    }
    case "createQuestDraft": {
      if (r.role !== "john") fail("FORBIDDEN", "请由项目方创建任务");
      const n = c.sourceNodeId
        ? w.blueprint.nodes.find((n) => n.id === c.sourceNodeId)
        : undefined;
      if (c.sourceNodeId && !n) fail("NOT_FOUND", "节点不存在");
      if (
        c.sourceNodeId &&
        s.quests.some(
          (q) =>
            q.status === "draft" &&
            q.publisher === r.role &&
            q.sourceNodeId === c.sourceNodeId,
        )
      )
        break;
      s.quests.push({
        id: id("quest"),
        version: 1,
        type: "project_outsourcing",
        title: n?.title || "新的协作任务",
        summary: "",
        status: "draft",
        publisher: r.role,
        sourceNodeId: c.sourceNodeId,
        deadline: new Date(Date.now() + 60 * 86400000).toISOString(),
        joinDeadline: new Date(Date.now() + 30 * 86400000).toISOString(),
        timezone: "Asia/Shanghai",
        effort: "",
        reward: "",
        deliverables: [],
        criteria: [],
        requirements: "",
        materials: [],
      });
      break;
    }
    case "saveQuestDraft": {
      const q = quest(c.quest.id);
      owner(q);
      version(q.version, c.baseVersion);
      if (q.status !== "draft")
        fail("INVALID_TRANSITION", "已发布版本不能编辑");
      if (
        c.quest.publisher !== q.publisher ||
        c.quest.status !== "draft" ||
        c.quest.sourceNodeId !== q.sourceNodeId
      )
        fail("VALIDATION_FAILED", "不能修改任务来源或发布状态");
      Object.assign(q, clone(c.quest), { id: q.id, version: q.version + 1 });
      break;
    }
    case "publishQuest": {
      const q = quest(c.id);
      owner(q);
      version(q.version, c.baseVersion);
      if (q.status !== "draft") fail("INVALID_TRANSITION", "任务已发布");
      publishValidation(q);
      q.status = "published";
      q.version++;
      break;
    }
    case "setQuestAvailability": {
      const q = quest(c.id);
      owner(q);
      version(q.version, c.baseVersion);
      if (
        q.status === "draft" ||
        q.status === "closed" ||
        q.status === c.status
      )
        fail("INVALID_TRANSITION", "无法切换至该状态");
      if (c.status === "published") publishValidation(q);
      q.status = c.status;
      q.version++;
      break;
    }
    case "joinQuest": {
      const q = quest(c.id);
      if (q.type === "neutral_assessment")
        fail("CAPABILITY_UNAVAILABLE", "NT-01 尚未接入");
      if (r.role === q.publisher) fail("FORBIDDEN", "不能参与自己发布的任务");
      if (q.status !== "published")
        fail("QUEST_UNAVAILABLE", "任务当前不可接取");
      if (q.version !== c.questVersion)
        fail("QUEST_VERSION_CHANGED", "任务条件已变化");
      if (Date.parse(q.joinDeadline) <= Date.now())
        fail("DEADLINE_PASSED", "接取期限已过");
      if (
        s.attempts.some((a) => a.questId === q.id && a.participant === r.role)
      )
        break;
      const aid = id("attempt");
      s.attempts.push({
        id: aid,
        questId: q.id,
        questVersion: q.version,
        questSnapshot: clone(q),
        version: 1,
        participant: r.role,
        status: "joined",
        text: "",
        materials: [],
        submissionIds: [],
        feedbackIds: [],
        resultIds: [],
      });
      w.plan.items.push({
        id: id("plan"),
        title: q.title,
        status: "in_progress",
        dueAt: q.deadline,
        attemptId: aid,
      });
      w.plan.version++;
      break;
    }
    case "saveAttempt": {
      const a = attempt(c.id);
      participant(a);
      version(a.version, c.baseVersion);
      if (!["joined", "in_progress", "revision_requested"].includes(a.status))
        fail("INVALID_TRANSITION", "当前任务不能编辑");
      if (
        c.materials.some(
          (m) =>
            m.status !== "finalized" ||
            !m.name ||
            !Number.isFinite(m.size) ||
            m.size < 0,
        )
      )
        fail("UPLOAD_INCOMPLETE", "材料尚未准备好");
      const mimeTypes = [
        "image/png",
        "image/jpeg",
        "image/webp",
        "image/gif",
        "text/plain",
        "text/csv",
        "application/pdf",
      ];
      if (
        c.materials.some(
          (m) =>
            !mimeTypes.includes(m.mime) ||
            !m.dataUrl.startsWith(`data:${m.mime};base64,`),
        ) ||
        c.materials.reduce((sum, m) => sum + m.size, 0) > 5 * 1024 * 1024 ||
        new Set(c.materials.map((m) => m.id)).size !== c.materials.length
      )
        fail("UPLOAD_REJECTED", "材料格式不支持或总大小超过 5 MiB");
      a.text = c.text;
      a.materials = clone(c.materials);
      a.status = "in_progress";
      a.version++;
      break;
    }
    case "submitAttempt": {
      const a = attempt(c.id);
      participant(a);
      version(a.version, c.baseVersion);
      if (a.questSnapshot.type === "neutral_assessment")
        fail("CAPABILITY_UNAVAILABLE", "NT-01 尚未接入");
      if (!["in_progress", "revision_requested"].includes(a.status))
        fail("INVALID_TRANSITION", "当前状态不能提交");
      if (!a.text.trim() && !a.materials.length)
        fail("VALIDATION_FAILED", "请先补充产物");
      if (Date.parse(a.questSnapshot.deadline) <= Date.now())
        fail("DEADLINE_PASSED", "交付期限已过");
      if (c.disclosure.some((mid) => !a.materials.some((m) => m.id === mid)))
        fail("VALIDATION_FAILED", "材料选择无效");
      const sid = id("submission");
      s.submissions.push({
        id: sid,
        attemptId: a.id,
        version: a.submissionIds.length + 1,
        text: a.text,
        materials: clone(
          a.materials.filter((m) => c.disclosure.includes(m.id)),
        ),
        createdAt: now,
        disclosure: [...c.disclosure],
      });
      a.submissionIds.push(sid);
      a.status = "awaiting_feedback";
      a.version++;
      break;
    }
    case "reviewSubmission": {
      const sub = s.submissions.find((x) => x.id === c.submissionId);
      if (!sub) fail("NOT_FOUND", "提交不存在");
      const a = attempt(sub.attemptId);
      owner(a.questSnapshot);
      if (
        a.status !== "awaiting_feedback" ||
        a.submissionIds.at(-1) !== sub.id ||
        s.feedback.some((f) => f.submissionId === sub.id)
      )
        fail("INVALID_TRANSITION", "该提交已处理或不是最新版本");
      const type = a.questSnapshot.type;
      const allowed =
        type === "project_outsourcing"
          ? ["revision_requested", "accepted"]
          : type === "role_matching"
            ? ["revision_requested", "continue_conversation", "not_proceeding"]
            : type === "capability_growth"
              ? ["revision_requested", "practice_completed"]
              : [];
      if (!allowed.includes(c.decision))
        fail("INVALID_TRANSITION", "反馈类型与任务不一致");
      if (c.criteria.length !== a.questSnapshot.criteria.length)
        fail("VALIDATION_FAILED", "请逐项检查标准");
      if (
        ["accepted", "practice_completed"].includes(c.decision) &&
        c.criteria.some((v) => v !== true)
      )
        fail("CRITERIA_UNMET", "尚有标准未通过");
      if (c.decision === "revision_requested") requireText(c.comment);
      const fid = id("feedback");
      s.feedback.push({
        id: fid,
        submissionId: sub.id,
        attemptId: a.id,
        decision: c.decision,
        comment: c.comment,
        criteria: [...c.criteria],
        createdAt: now,
      });
      a.feedbackIds.push(fid);
      a.version++;
      if (c.decision === "revision_requested") a.status = "revision_requested";
      else {
        a.status = "completed";
        const rid = id("result");
        s.results.push({
          id: rid,
          attemptId: a.id,
          questType: type,
          decision: c.decision,
          createdAt: now,
          applied: false,
        });
        a.resultIds.push(rid);
      }
      break;
    }
    case "applyResult": {
      const result = s.results.find((x) => x.id === c.id);
      if (!result) fail("NOT_FOUND", "结果不存在");
      const a = attempt(result.attemptId);
      if (r.role !== a.participant && r.role !== a.questSnapshot.publisher)
        fail("FORBIDDEN", "无法访问该结果");
      if (result.applied) break;
      const target = s.workspaces[a.participant],
        title = a.questSnapshot.title;
      target.memories.push({
        id: `memory-${result.id}`,
        text: `「${title}」的任务结果：${decisionLabels[result.decision]}`,
        status: "candidate",
        sourceIds: [result.id],
        updatedAt: now,
      });
      const item = target.plan.items.find((i) => i.attemptId === a.id);
      if (item) item.status = "completed";
      target.plan.version++;
      target.proposals.push({
        id: `proposal-${result.id}`,
        title: `复盘「${title}」并决定下一步`,
        baseVersion: target.plan.version,
        items: [
          ...clone(target.plan.items),
          {
            id: `next-${result.id}`,
            title: `复盘「${title}」的反馈`,
            status: "planned",
          },
        ],
        sourceVersions: sources(target),
        status: "ready",
        target: "plan",
      });
      const publisher = s.workspaces[a.questSnapshot.publisher],
        node = publisher.blueprint.nodes.find(
          (n) => n.id === a.questSnapshot.sourceNodeId,
        );
      if (node && !node.resultIds.includes(result.id)) {
        node.resultIds.push(result.id);
        publisher.blueprint.version++;
        publisher.version++;
      }
      result.applied = true;
      if (target !== w) target.version++;
      break;
    }
    case "rememberPath":
      if (!c.path.startsWith(`/${r.role}`))
        fail("VALIDATION_FAILED", "页面与当前身份不符");
      w.lastPath = c.path;
      break;
    default: {
      const unreachable: never = c;
      return unreachable;
    }
  }
  w.version++;
}
// Validate every persisted render-facing field before exposing a snapshot. Invalid data is never reset.
export function isPersistedSnapshot(value: unknown, profile: "demo_mock" | "connected" = "demo_mock"): value is Snapshot {
  type Check = (v: unknown) => boolean;
  const record = (v: unknown): v is Record<string, unknown> =>
    !!v && typeof v === "object" && !Array.isArray(v);
  const string: Check = (v) => typeof v === "string",
    bool: Check = (v) => typeof v === "boolean",
    number: Check = (v) => typeof v === "number" && Number.isFinite(v);
  const integer: Check = (v) =>
      number(v) && Number.isInteger(v) && Number(v) >= 0,
    version: Check = (v) => integer(v) && Number(v) >= 1;
  const one =
    (...values: unknown[]): Check =>
    (v) =>
      values.includes(v);
  const optional =
    (check: Check): Check =>
    (v) =>
      v === undefined || check(v);
  const list =
    (check: Check): Check =>
    (v) =>
      Array.isArray(v) && v.every(check);
  const dictionary =
    (check: Check): Check =>
    (v) =>
      record(v) && Object.values(v).every(check);
  const shape =
    (fields: Record<string, Check>): Check =>
    (v) =>
      record(v) &&
      Object.entries(fields).every(([key, check]) => check(v[key]));
  const strings = list(string),
    role = one("emma", "john"),
    status = one("planned", "in_progress", "completed"),
    confirmation = one("candidate", "confirmed", "stale");
  const questType = one(
      "capability_growth",
      "neutral_assessment",
      "role_matching",
      "project_outsourcing",
    ),
    decision = one(
      "revision_requested",
      "accepted",
      "practice_completed",
      "continue_conversation",
      "not_proceeding",
    );
  const identified =
    (check: Check): Check =>
    (v) =>
      list(check)(v) &&
      new Set((v as { id: string }[]).map((x) => x.id)).size ===
        (v as unknown[]).length;
  const item = shape({
    id: string,
    title: string,
    status,
    dueAt: optional(string),
    attemptId: optional(string),
    recommendationId: optional(string),
  });
  const material = shape({
    id: string,
    name: string,
    mime: string,
    size: integer,
    dataUrl: string,
    status: one("finalized"),
  });
  const quest = shape({
    id: string,
    version,
    type: questType,
    title: string,
    summary: string,
    status: one("draft", "published", "paused", "closed"),
    publisher: role,
    sourceNodeId: optional(string),
    deadline: string,
    joinDeadline: string,
    timezone: string,
    effort: string,
    reward: string,
    deliverables: strings,
    criteria: strings,
    requirements: string,
    materials: strings,
  });
  const workspace = shape({
    role,
    version,
    lastPath: string,
    acquisition: shape({
      index: integer,
      answers: dictionary(
        shape({ id: string, value: string, version, skipped: bool }),
      ),
      drafts: dictionary(string),
      review: bool,
      confirmed: bool,
      completed: optional(bool),
      completionOperationId: optional(string),
      limited: bool,
      branches: integer,
      clarifications: integer,
    }),
    context: identified(
      shape({
        id: string,
        title: string,
        kind: one("fact", "goal", "constraint", "direction", "action"),
        sourceId: string,
        sourceIds: optional(strings),
        sourceVersion: version,
        status: confirmation,
        edited: bool,
        deleted: bool,
        x: number,
        y: number,
      }),
    ),
    edges: identified(
      shape({ id: string, from: string, to: string, label: string }),
    ),
    memories: identified(
      shape({
        id: string,
        text: string,
        status: confirmation,
        sourceIds: strings,
        updatedAt: string,
      }),
    ),
    plan: shape({
      version,
      items: identified(item),
      adoptedTitle: optional(string),
    }),
    roleExpression: optional(shape({title:string,hidden:bool})),
    developmentReport: optional(shape({version,sourceToken:string,createdAt:string,mode:one("demo_projection"),story:shape({title:string,story:string,basis:string,evidenceCaption:string,sourceIds:strings,hidden:bool}),sections:list(shape({field:one("state","focus","experience","conditions","unknown"),title:string,lines:strings})),suggestion:string,analysis:optional(shape({version:one(1),mode:one("limited_projection","synthetic_fixture","supplied_analysis"),sourceToken:string,sourceIds:strings,sections:list(shape({title:one("过去","现在","未来"),paragraphs:strings}))}))})),
    profileImpact: optional(string),
    recommendationFeedback: optional(dictionary(one("later", "rejected"))),
    personalPath: optional(
      shape({
        version,
        title: string,
        targetDate: optional(string),
        sourcePlanVersion: optional(version),
        sourceAttemptVersions: optional(dictionary(version)),
        nodes: identified(
          shape({
            id: string,
            title: string,
            laneId: one(
              "direction",
              "capability",
              "practice",
              "portfolio",
              "opportunity",
            ),
            stage: one(0, 1, 2),
            status,
            dueAt: optional(string),
            outcome: string,
            criteria: string,
            dependencies: strings,
            planItemId: optional(string),
            questId: optional(string),
          }),
        ),
      }),
    ),
    proposals: identified(
      shape({
        id: string,
        title: string,
        baseVersion: version,
        items: identified(item),
        sourceVersions: dictionary(number),
        status: one("ready", "adopted", "cancelled"),
        target: one("plan", "blueprint"),
        changes: optional(
          list(shape({ nodeId: string, before: string, after: string })),
        ),
      }),
    ),
    blueprint: shape({
      version,
      projectId: string,
      title: string,
      fundingEnabled: bool,
      nodes: identified(
        shape({
          id: string,
          laneId: string,
          title: string,
          stage: one(0, 1, 2),
          status,
          dueAt: string,
          owner: string,
          criteria: string,
          dependencies: strings,
          kind: one("fact", "hypothesis", "action"),
          resultIds: strings,
        }),
      ),
    }),
  });
  const valid = shape({
    schema: one(1),
    runtimeProfile: one(profile),
    revision: version,
    workspaces: shape({ emma: workspace, john: workspace }),
    quests: identified(quest),
    attempts: identified(
      shape({
        id: string,
        questId: string,
        questVersion: version,
        questSnapshot: quest,
        version,
        participant: role,
        status: one(
          "joined",
          "in_progress",
          "awaiting_feedback",
          "revision_requested",
          "completed",
        ),
        text: string,
        materials: identified(material),
        submissionIds: strings,
        feedbackIds: strings,
        resultIds: strings,
      }),
    ),
    submissions: identified(
      shape({
        id: string,
        attemptId: string,
        version,
        text: string,
        materials: identified(material),
        createdAt: string,
        disclosure: strings,
      }),
    ),
    feedback: identified(
      shape({
        id: string,
        submissionId: string,
        attemptId: string,
        decision,
        comment: string,
        criteria: list(bool),
        createdAt: string,
      }),
    ),
    results: identified(
      shape({
        id: string,
        attemptId: string,
        questType,
        decision,
        createdAt: string,
        applied: bool,
      }),
    ),
    operations: dictionary(
      shape({
        id: string,
        signature: string,
        state: one("succeeded", "failed"),
        createdAt: string,
        error: optional(string),
      }),
    ),
  })(value);
  if (!valid) return false;
  const s = value as Snapshot;
  if (s.workspaces.emma.role !== "emma" || s.workspaces.john.role !== "john")
    return false;
  for (const w of Object.values(s.workspaces)) {
    if (
      w.acquisition.index > (w.role === "emma" ? 7 : 8)
    )
      return false;
    if (w.personalPath) {
      if (w.role !== "emma") return false;
      try {
        validatePersonalPath(w.personalPath);
      } catch {
        return false;
      }
    }
    const nodes = new Set(w.blueprint.nodes.map((n) => n.id));
    if (
      w.blueprint.nodes.some((n) => n.dependencies.some((d) => !nodes.has(d)))
    )
      return false;
  }
  const attempts = new Set(s.attempts.map((a) => a.id)),
    submissions = new Set(s.submissions.map((x) => x.id));
  return (
    s.attempts.every(
      (a) =>
        a.questSnapshot.id === a.questId &&
        a.questSnapshot.version === a.questVersion,
    ) &&
    s.submissions.every((x) => attempts.has(x.attemptId)) &&
    s.feedback.every(
      (x) => attempts.has(x.attemptId) && submissions.has(x.submissionId),
    ) &&
    s.results.every((x) => attempts.has(x.attemptId)) &&
    Object.entries(s.operations).every(([key, op]) => key === op.id)
  );
}

export function createMockService(storage?: StorageLike): ProductService {
  let snapshot = seedSnapshot();
  if (storage) {
    let raw: string | null;
    try {
      raw = storage.getItem(KEY);
    } catch {
      fail("STORAGE_FAILED", "无法读取本机草稿");
    }
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (!isPersistedSnapshot(parsed)) throw Error();
        snapshot = parsed;
      } catch {
        fail("STORAGE_INVALID", "本机数据无法读取，请保留原数据后重试");
      }
    }
  }
  snapshot = freeze(snapshot);
  const listeners = new Set<() => void>();
  let queue: Promise<unknown> = Promise.resolve();
  const commit = (next: Snapshot, operationId: string) => {
    if (storage)
      try {
        storage.setItem(KEY, JSON.stringify(next));
      } catch {
        fail("STORAGE_FAILED", "保存失败，修改尚未生效", operationId);
      }
    snapshot = freeze(next);
    listeners.forEach((fn) => {
      try {
        fn();
      } catch {
        /* Subscriber errors do not undo committed business state. */
      }
    });
  };
  return {
    profile: "demo_mock",
    getSnapshot: () => snapshot,
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    async getOperation(id) {
      return snapshot.operations[id]
        ? clone(snapshot.operations[id])
        : undefined;
    },
    execute(request) {
      const queuedRequest = clone(request);
      const execute = async () => {
        const r = queuedRequest;
        if (!r.operationId?.trim()) fail("VALIDATION_FAILED", "操作标识缺失");
        const signature = canonical({ role: r.role, command: r.command }),
          prior = snapshot.operations[r.operationId];
        if (prior) {
          if (prior.signature !== signature)
            fail(
              "IDEMPOTENCY_KEY_REUSED",
              "该操作标识已用于其他内容",
              r.operationId,
            );
          if (prior.state === "failed")
            fail(
              prior.error || "SERVICE_UNAVAILABLE",
              "原操作未成功，请修正后创建新操作",
              r.operationId,
            );
          return clone(snapshot);
        }
        const nextFault = fault;
        fault = "none";
        const next = clone(snapshot);
        try {
          if (nextFault === "failure")
            fail("SERVICE_UNAVAILABLE", "模拟服务暂时不可用", r.operationId);
          transition(next, r);
        } catch (error) {
          const problem = error as ProductError;
          const failed = clone(snapshot);
          failed.revision++;
          failed.operations[r.operationId] = {
            id: r.operationId,
            signature,
            state: "failed",
            createdAt: new Date().toISOString(),
            error: problem.code || "VALIDATION_FAILED",
          };
          commit(failed, r.operationId);
          problem.operationId = r.operationId;
          throw problem;
        }
        next.revision++;
        next.operations[r.operationId] = {
          id: r.operationId,
          signature,
          state: "succeeded",
          createdAt: new Date().toISOString(),
        };
        commit(next, r.operationId);
        if (nextFault === "lost_response")
          fail("OUTCOME_UNKNOWN", "结果尚未确认，请查询原操作", r.operationId);
        return clone(snapshot);
      };
      const pending = queue.then(execute, execute);
      queue = pending.catch(() => {});
      return pending;
    },
  };
}
export interface ConnectedTransport {
  getSnapshot(): Snapshot;
  subscribe(fn: () => void): () => void;
  execute(request: Request): Promise<Snapshot>;
  getOperation(id: string): Promise<Operation | undefined>;
}
export function createConnectedService(
  transport?: ConnectedTransport,
): ProductService {
  const empty = seedSnapshot();
  empty.runtimeProfile = "connected";
  empty.quests = [];
  for (const w of Object.values(empty.workspaces)) w.blueprint.nodes = [];
  let last: Snapshot | undefined, cached: Snapshot | undefined;
  const verify = (s: Snapshot) => {
    if (s.runtimeProfile !== "connected")
      fail("RUNTIME_MISMATCH", "真实连接不能使用演示回执");
    if (s !== last) {
      last = s;
      cached = freeze(clone(s));
    }
    return cached!;
  };
  freeze(empty);
  return {
    profile: "connected",
    getSnapshot: () => (transport ? verify(transport.getSnapshot()) : empty),
    subscribe: (fn) => (transport ? transport.subscribe(fn) : () => {}),
    execute: async (r) => {
      if (!transport)
        fail("CAPABILITY_UNAVAILABLE", "真实服务尚未配置", r.operationId);
      return verify(await transport.execute(r));
    },
    getOperation: async (id) => {
      if (!transport) fail("CAPABILITY_UNAVAILABLE", "真实服务尚未配置", id);
      verify(transport.getSnapshot());
      return transport.getOperation(id);
    },
  };
}
