import { beforeEach, describe, expect, it } from "vitest";
import { createMockService, setDemoFault } from "../src/domain/service";
import {
  createPathSuggestion,
  getPersonalPath,
} from "../src/domain/personal-path";
import { seedSnapshot } from "../src/domain/fixtures";
import type {
  Command,
  PersonalPath,
  ProductService,
  Role,
} from "../src/domain/types";
let seq = 0;
const run = (
  service: ProductService,
  command: Command,
  role: Role = "emma",
  operationId = `path-op-${++seq}`,
) => service.execute({ role, command, operationId });
const read = (service: ProductService) =>
  getPersonalPath(service.getSnapshot().workspaces.emma, service.getSnapshot());
const save = (service: ProductService, path: PersonalPath) =>
  run(service, { type: "savePersonalPath", baseVersion: path.version, path });
beforeEach(() => {
  seq = 0;
  setDemoFault("none");
});

describe("Emma personal path", () => {
  it("reads old saves without writes, initializes once, and restores edits after reload", async () => {
    let raw = JSON.stringify(seedSnapshot()),
      writes = 0;
    const storage = {
      getItem: () => raw,
      setItem: (_: string, value: string) => {
        raw = value;
        writes++;
      },
    };
    const service = createMockService(storage);
    expect(service.getSnapshot().workspaces.emma.personalPath).toBeUndefined();
    expect(read(service).nodes).toHaveLength(9);
    expect(writes).toBe(0);
    await run(service, { type: "ensurePersonalPath" });
    const original = service.getSnapshot().workspaces.emma.personalPath;
    await run(service, { type: "ensurePersonalPath" });
    expect(service.getSnapshot().workspaces.emma.personalPath).toEqual(
      original,
    );
    const path = read(service);
    path.title = "探索自己的协作方向";
    path.nodes[0].title = "准备访谈提纲";
    await save(service, path);
    expect(read(createMockService(storage))).toEqual(read(service));
    expect(read(service).title).toBe("探索自己的协作方向");
  });

  it("uses stated context goals and never writes seeded demo nodes into connected reads", () => {
    const s = seedSnapshot();
    s.workspaces.emma.context.push({
      id: "goal",
      title: "探索设计研究",
      kind: "goal",
      sourceId: "manual",
      sourceVersion: 1,
      status: "candidate",
      edited: true,
      deleted: false,
      x: 0,
      y: 0,
    });
    expect(getPersonalPath(s.workspaces.emma, s).title).toBe("探索设计研究");
    s.runtimeProfile = "connected";
    expect(getPersonalPath(s.workspaces.emma, s).nodes).toEqual([]);
  });

  it("reuses existing plans, projects subsequent updates, and syncs edited nodes without removing unassigned actions", async () => {
    const seeded = seedSnapshot();
    seeded.workspaces.emma.plan.items = [0, 1, 2].map((n) => ({
      id: `old-${n}`,
      title: `已有行动${n}`,
      status: "planned",
    }));
    const service = createMockService({
      getItem: () => JSON.stringify(seeded),
      setItem: () => {},
    });
    await run(service, { type: "ensurePersonalPath" });
    expect(read(service).nodes[0].planItemId).toBe("old-0");
    await run(service, {
      type: "setPlanItem",
      id: "old-0",
      status: "in_progress",
    });
    expect(read(service).nodes[0].status).toBe("in_progress");
    const path = read(service);
    path.nodes[0].title = "新的行动标题";
    path.nodes[0].dueAt = "2027-02-10";
    path.nodes.push({
      id: "new",
      title: "额外行动",
      laneId: "capability",
      stage: 0,
      status: "planned",
      outcome: "产物",
      criteria: "标准",
      dependencies: [],
    });
    await save(service, path);
    expect(
      service
        .getSnapshot()
        .workspaces.emma.plan.items.find((i) => i.id === "old-0"),
    ).toMatchObject({
      title: "新的行动标题",
      dueAt: "2027-02-10",
      status: "in_progress",
    });
    expect(
      service
        .getSnapshot()
        .workspaces.emma.plan.items.some((i) => i.id === "old-2"),
    ).toBe(true);
    expect(
      service
        .getSnapshot()
        .workspaces.emma.plan.items.some((i) => i.title === "额外行动"),
    ).toBe(true);
  });

  it("rejects stale path, plan, and attempt source versions without overwriting business state", async () => {
    const service = createMockService();
    await run(service, { type: "ensurePersonalPath" });
    const first = read(service),
      stale = read(service);
    first.title = "更新后的目标";
    await save(service, first);
    await expect(save(service, stale)).rejects.toMatchObject({
      code: "VERSION_CONFLICT",
    });
    const beforePlan = read(service);
    await run(service, {
      type: "setPlanItem",
      id: beforePlan.nodes[0].planItemId!,
      status: "in_progress",
    });
    await expect(save(service, beforePlan)).rejects.toMatchObject({
      code: "VERSION_CONFLICT",
    });
    const beforeAttempt = read(service);
    const quest = service.getSnapshot().quests[0];
    await run(service, {
      type: "joinQuest",
      id: quest.id,
      questVersion: quest.version,
    });
    await expect(save(service, beforeAttempt)).rejects.toMatchObject({
      code: "VERSION_CONFLICT",
    });
    expect(read(service).title).toBe("更新后的目标");
    expect(read(service).nodes[0].status).toBe("in_progress");
  });

  it("projects Quest progress and refuses direct completion or deadline edits", async () => {
    const service = createMockService();
    await run(service, { type: "ensurePersonalPath" });
    const quest = service.getSnapshot().quests[0];
    const before = read(service);
    expect(before.nodes.find((n) => n.questId === quest.id)?.status).toBe(
      "planned",
    );
    expect(service.getSnapshot().workspaces.emma.plan.items).toHaveLength(2);
    await run(service, {
      type: "joinQuest",
      id: quest.id,
      questVersion: quest.version,
    });
    const path = read(service),
      node = path.nodes.find((n) => n.questId === quest.id)!;
    expect(node.status).toBe("in_progress");
    expect(node.planItemId).toBeTruthy();
    const attempt = service.getSnapshot().attempts[0];
    node.status = "completed";
    await expect(save(service, path)).rejects.toMatchObject({
      code: "INVALID_TRANSITION",
    });
    const dates = read(service);
    dates.nodes.find((n) => n.questId === quest.id)!.dueAt = "2027-01-01";
    await expect(save(service, dates)).rejects.toMatchObject({
      code: "INVALID_TRANSITION",
    });
    expect(service.getSnapshot().attempts[0]).toEqual(attempt);
  });

  it("preserves accepted commitments when removing a node and prevents unlinking to bypass Quest status", async () => {
    const service = createMockService();
    await run(service, { type: "ensurePersonalPath" });
    const q = service.getSnapshot().quests[0];
    await run(service, {
      type: "joinQuest",
      id: q.id,
      questVersion: q.version,
    });
    const detached = read(service),
      questNode = detached.nodes.find((n) => n.questId === q.id)!;
    delete questNode.questId;
    delete questNode.planItemId;
    questNode.status = "completed";
    await expect(save(service, detached)).rejects.toMatchObject({
      code: "INVALID_TRANSITION",
    });
    const path = read(service),
      node = path.nodes.find((n) => n.questId === q.id)!;
    path.nodes = path.nodes
      .filter((n) => n.id !== node.id)
      .map((n) => ({
        ...n,
        dependencies: n.dependencies.filter((id) => id !== node.id),
      }));
    await save(service, path);
    expect(
      service.getSnapshot().workspaces.emma.plan.items.find((i) => i.attemptId),
    ).toMatchObject({ status: "in_progress" });
    expect(service.getSnapshot().attempts).toHaveLength(1);
  });

  it("rejects missing dependencies, cycles, duplicate ids and impossible dates atomically", async () => {
    const service = createMockService();
    await run(service, { type: "ensurePersonalPath" });
    const original = service.getSnapshot().workspaces.emma;
    for (const [edit, code] of [
      [
        (p: PersonalPath) => {
          p.nodes[0].dependencies = ["missing"];
        },
        "VALIDATION_FAILED",
      ],
      [
        (p: PersonalPath) => {
          p.nodes[0].dependencies = [p.nodes[1].id];
          p.nodes[1].dependencies = [p.nodes[0].id];
        },
        "DEPENDENCY_CYCLE",
      ],
      [
        (p: PersonalPath) => {
          p.nodes.push({ ...p.nodes[0] });
        },
        "VALIDATION_FAILED",
      ],
      [
        (p: PersonalPath) => {
          p.nodes[0].dueAt = "2027-02-30";
        },
        "VALIDATION_FAILED",
      ],
    ] as const) {
      const path = read(service);
      edit(path);
      await expect(save(service, path)).rejects.toMatchObject({ code });
      expect(service.getSnapshot().workspaces.emma).toEqual(original);
    }
  });

  it("rejects duplicate Quest links before they can create duplicate projected plan links", async () => {
    const service = createMockService();
    const path = read(service);
    const node = path.nodes.find((n) => n.questId)!;
    path.nodes.push({ ...node, id: "duplicate-quest", dependencies: [] });
    await expect(save(service, path)).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
    });
    expect(service.getSnapshot().workspaces.emma.personalPath).toBeUndefined();
  });

  it("does not let John initialize or edit an Emma path", async () => {
    const service = createMockService(),
      original = service.getSnapshot().workspaces.john;
    await expect(
      run(service, { type: "ensurePersonalPath" }, "john"),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      run(
        service,
        { type: "savePersonalPath", baseVersion: 1, path: read(service) },
        "john",
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(service.getSnapshot().workspaces.john).toEqual(original);
  });

  it("validates malformed optional persisted paths without replacing old data", () => {
    const seeded = seedSnapshot();
    const path = getPersonalPath(seeded.workspaces.emma, seeded);
    path.nodes[0].dependencies = ["missing"];
    seeded.workspaces.emma.personalPath = path;
    let writes = 0;
    expect(() =>
      createMockService({
        getItem: () => JSON.stringify(seeded),
        setItem: () => {
          writes++;
        },
      }),
    ).toThrowError(expect.objectContaining({ code: "STORAGE_INVALID" }));
    expect(writes).toBe(0);
  });

  it("stages delay/split suggestions without mutating source and preserves dependency ordering", async () => {
    const service = createMockService();
    await run(service, { type: "ensurePersonalPath" });
    const path = read(service),
      json = JSON.stringify(path);
    const delayed = createPathSuggestion(path, "delay", "path-direction");
    expect(delayed.path.nodes[0].dueAt).toBeTruthy();
    const split = createPathSuggestion(path, "split", "path-capability");
    expect(split.path.nodes).toHaveLength(path.nodes.length + 1);
    const next = split.path.nodes.at(-1)!;
    expect(next.dependencies).toEqual(["path-capability"]);
    expect(
      split.path.nodes.find((n) => n.id === "path-practice")!.dependencies,
    ).toContain(next.id);
    expect(JSON.stringify(path)).toBe(json);
    await save(service, split.path);
    expect(read(service).nodes).toHaveLength(10);
  });

  it("recovers an unknown save outcome once without duplicating actions", async () => {
    const service = createMockService();
    const path = read(service);
    const command: Command = {
      type: "savePersonalPath",
      path,
      baseVersion: path.version,
    };
    setDemoFault("lost_response");
    await expect(
      run(service, command, "emma", "save-once"),
    ).rejects.toMatchObject({ code: "OUTCOME_UNKNOWN" });
    expect((await service.getOperation("save-once"))?.state).toBe("succeeded");
    const after = service.getSnapshot();
    await run(service, command, "emma", "save-once");
    expect(service.getSnapshot()).toEqual(after);
    expect(service.getSnapshot().workspaces.emma.plan.items).toHaveLength(2);
  });
});
