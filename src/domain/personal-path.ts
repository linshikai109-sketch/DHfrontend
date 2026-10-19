import type { PathNode, PersonalPath, Snapshot, Workspace } from "./types";

export const pathLanes = [
  ["direction", "方向验证"],
  ["capability", "能力建设"],
  ["practice", "实践协作"],
  ["portfolio", "作品积累"],
  ["opportunity", "机会推进"],
] as const;
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));
function problem(code: string, message: string): never {
  throw Object.assign(new Error(message), { code });
}
function initialPath(w: Workspace, s: Snapshot): PersonalPath {
  const goal = w.context.find((n) => !n.deleted && n.kind === "goal")?.title;
  const path: PersonalPath = {
    version: 1,
    title: goal || "探索下一步方向",
    nodes: [],
  };
  if (s.runtimeProfile !== "demo_mock") return path;
  const node = (
    id: string,
    title: string,
    laneId: PathNode["laneId"],
    stage: PathNode["stage"],
    outcome: string,
    dependencies: string[] = [],
  ): PathNode => ({
    id,
    title,
    laneId,
    stage,
    outcome,
    dependencies,
    status: "planned",
    criteria: "完成产物并记录自己的判断与依据",
  });
  const practice = s.quests.find(
    (q) => q.type === "capability_growth" && q.status === "published",
  );
  path.nodes = [
    node(
      "path-direction",
      "明确想验证的方向",
      "direction",
      0,
      "一个待验证的方向与判断标准",
    ),
    node(
      "path-capability",
      "梳理已有经历与能力",
      "capability",
      0,
      "一份有材料依据的经历清单",
    ),
    node(
      "path-practice",
      practice?.title || "完成一次小型实践",
      "practice",
      0,
      "一份可复核的实践产物",
      ["path-capability"],
    ),
    node(
      "path-direction-review",
      "判断是否继续深入",
      "direction",
      1,
      "结合实践反馈作出方向选择",
      ["path-practice", "path-direction"],
    ),
    node(
      "path-capability-next",
      "练习一个待补能力",
      "capability",
      1,
      "一份练习记录与前后对照",
      ["path-practice"],
    ),
    node(
      "path-collaboration",
      "参与一次有限协作",
      "practice",
      1,
      "一份明确个人贡献的协作成果",
      ["path-capability-next"],
    ),
    node(
      "path-portfolio",
      "整理首个作品案例",
      "portfolio",
      1,
      "包含背景、行动、结果与依据的案例",
      ["path-practice"],
    ),
    node(
      "path-portfolio-review",
      "完善作品呈现",
      "portfolio",
      2,
      "一份由自己确认展示范围的作品",
      ["path-portfolio", "path-collaboration"],
    ),
    node(
      "path-opportunity",
      "选择下一次合作机会",
      "opportunity",
      2,
      "一项与方向及可投入时间匹配的机会",
      ["path-direction-review", "path-portfolio-review"],
    ),
  ];
  if (practice) {
    path.nodes[2].questId = practice.id;
    path.nodes[2].dueAt = practice.deadline;
  }
  // Reuse existing ordinary actions without claiming they evidence a particular skill.
  const ordinary = w.plan.items.filter((i) => !i.attemptId).slice(0, 2);
  ordinary.forEach((item, index) =>
    Object.assign(path.nodes[index], {
      title: item.title,
      status: item.status,
      dueAt: item.dueAt,
      planItemId: item.id,
    }),
  );
  return path;
}

/** Read-only projection: existing saves need no destructive schema migration. */
export function getPersonalPath(w: Workspace, s: Snapshot): PersonalPath {
  const path = copy(w.personalPath || initialPath(w, s));
  path.sourcePlanVersion = w.plan.version;
  path.sourceAttemptVersions = Object.fromEntries(
    s.attempts
      .filter((a) => a.participant === w.role)
      .map((a) => [a.id, a.version]),
  );
  path.nodes = path.nodes.map((node) => {
    const item = w.plan.items.find((i) => i.id === node.planItemId);
    const linkedAttempt = item?.attemptId
      ? s.attempts.find(
          (a) => a.id === item.attemptId && a.participant === w.role,
        )
      : undefined;
    const questId = linkedAttempt?.questId || node.questId;
    const attempt =
      linkedAttempt ||
      s.attempts.find((a) => a.questId === questId && a.participant === w.role);
    const quest =
      attempt?.questSnapshot || s.quests.find((q) => q.id === questId);
    const questItem =
      attempt && w.plan.items.find((i) => i.attemptId === attempt.id);
    return {
      ...node,
      ...(item
        ? { title: item.title, status: item.status, dueAt: item.dueAt }
        : {}),
      ...(questId
        ? {
            questId,
            status: attempt
              ? attempt.status === "completed"
                ? ("completed" as const)
                : ("in_progress" as const)
              : ("planned" as const),
            ...(quest ? { dueAt: quest.deadline } : {}),
            ...(questItem ? { planItemId: questItem.id } : {}),
          }
        : {}),
    };
  });
  return path;
}

/** Also used when validating persisted optional data. */
export function validatePersonalPath(path: PersonalPath) {
  const validDate = (value?: string) =>
    value === undefined ||
    (!!value.trim() &&
      Number.isFinite(Date.parse(value)) &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(value) ||
        new Date(value).toISOString().slice(0, 10) === value));
  if (
    !Number.isInteger(path.version) ||
    path.version < 1 ||
    !path.title.trim() ||
    !validDate(path.targetDate)
  )
    problem("VALIDATION_FAILED", "请填写有效的目标与日期");
  const ids = new Set(path.nodes.map((n) => n.id));
  const planLinks = path.nodes.flatMap((n) =>
    n.planItemId ? [n.planItemId] : [],
  );
  const questLinks = path.nodes.flatMap((n) => (n.questId ? [n.questId] : []));
  if (
    ids.size !== path.nodes.length ||
    new Set(planLinks).size !== planLinks.length ||
    new Set(questLinks).size !== questLinks.length
  )
    problem("VALIDATION_FAILED", "节点或任务关联不能重复");
  for (const node of path.nodes) {
    if (
      !node.id.trim() ||
      !node.title.trim() ||
      !pathLanes.some(([id]) => id === node.laneId) ||
      ![0, 1, 2].includes(node.stage) ||
      !["planned", "in_progress", "completed"].includes(node.status) ||
      !validDate(node.dueAt)
    )
      problem("VALIDATION_FAILED", "请检查节点标题、阶段与日期");
    if (
      node.dependencies.some((id) => !ids.has(id)) ||
      new Set(node.dependencies).size !== node.dependencies.length
    )
      problem("VALIDATION_FAILED", "前置节点不存在或重复");
  }
  const visiting = new Set<string>(),
    visited = new Set<string>();
  const graph = new Map(path.nodes.map((n) => [n.id, n.dependencies]));
  const visit = (id: string) => {
    if (visiting.has(id))
      problem("DEPENDENCY_CYCLE", "依赖形成了循环，请调整先后关系");
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dependency of graph.get(id) || []) visit(dependency);
    visiting.delete(id);
    visited.add(id);
  };
  for (const id of ids) visit(id);
}

/** Synchronize path actions while preserving unassigned items and accepted Quest commitments. */
export function persistPersonalPath(
  w: Workspace,
  s: Snapshot,
  input: PersonalPath,
) {
  const path = copy(input);
  const before = JSON.stringify(w.plan.items);
  for (const node of path.nodes) {
    const item = w.plan.items.find((i) => i.id === node.planItemId);
    if (node.questId) {
      const attempt = s.attempts.find(
        (a) => a.participant === w.role && a.questId === node.questId,
      );
      const questItem =
        attempt && w.plan.items.find((i) => i.attemptId === attempt.id);
      if (questItem) node.planItemId = questItem.id;
      // Unaccepted Quest suggestions must not create phantom commitments in the plan.
      continue;
    }
    if (item?.attemptId) continue;
    if (item)
      Object.assign(item, {
        title: node.title,
        status: node.status,
        dueAt: node.dueAt,
      });
    else if (node.stage === 0) {
      let itemId = `path-action-${node.id}`;
      for (let suffix = 1; w.plan.items.some((i) => i.id === itemId); suffix++)
        itemId = `path-action-${node.id}-${suffix}`;
      node.planItemId = itemId;
      w.plan.items.push({
        id: itemId,
        title: node.title,
        status: node.status,
        dueAt: node.dueAt,
      });
    } else if (node.planItemId) delete node.planItemId;
  }
  if (before !== JSON.stringify(w.plan.items)) w.plan.version++;
  path.sourcePlanVersion = w.plan.version;
  path.sourceAttemptVersions = Object.fromEntries(
    s.attempts
      .filter((a) => a.participant === w.role)
      .map((a) => [a.id, a.version]),
  );
  w.personalPath = path;
}

export function createPathSuggestion(
  path: PersonalPath,
  kind: "delay" | "split",
  nodeId?: string,
): { path: PersonalPath; summary: string } {
  const next = copy(path);
  const node = nodeId
    ? next.nodes.find((n) => n.id === nodeId)
    : next.nodes.find((n) => !n.questId && n.status !== "completed");
  if (!node) problem("NOT_FOUND", "请选择一个行动");
  if (node.questId || node.status === "completed")
    problem("INVALID_TRANSITION", "请选择尚未完成的自主行动");
  if (kind === "delay") {
    const date = node.dueAt ? new Date(node.dueAt) : new Date();
    date.setUTCDate(date.getUTCDate() + 7);
    node.dueAt = date.toISOString().slice(0, 10);
    return { path: next, summary: `将「${node.title}」延后 7 天` };
  }
  let splitId = `${node.id}-next`;
  for (let suffix = 2; next.nodes.some((n) => n.id === splitId); suffix++)
    splitId = `${node.id}-next-${suffix}`;
  const title = node.title;
  for (const dependent of next.nodes)
    dependent.dependencies = dependent.dependencies.map((id) =>
      id === node.id ? splitId : id,
    );
  next.nodes.push({
    ...node,
    id: splitId,
    title: `完成${title}`,
    status: "planned",
    dependencies: [node.id],
    planItemId: undefined,
    questId: undefined,
  });
  node.title = `准备${title}`;
  node.outcome = `为「${title}」整理所需材料与步骤`;
  return { path: next, summary: `将「${title}」拆成准备与完成两步` };
}
