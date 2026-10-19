import { beforeEach, describe, it, expect } from "vitest";
import {
  createMockService,
  createConnectedService,
  setDemoFault,
} from "../src/domain/service";
import { seedSnapshot } from "../src/domain/fixtures";
import type { Command, Role, ProductService } from "../src/domain/types";
let n = 0;
const run = (
  s: ProductService,
  command: Command,
  role: Role = "emma",
  operationId = `op-${++n}`,
) => s.execute({ role, command, operationId });
beforeEach(() => {
  n = 0;
  setDemoFault("none");
});
describe("service atomicity and recovery", () => {
  it("commits a lost response once; recovery is read-only and payload changes are rejected", async () => {
    const s = createMockService();
    setDemoFault("lost_response");
    const command: Command = {
      type: "saveDraft",
      questionId: "goal",
      value: "A",
    };
    await expect(run(s, command, "emma", "same")).rejects.toMatchObject({
      code: "OUTCOME_UNKNOWN",
    });
    const revision = s.getSnapshot().revision;
    expect((await s.getOperation("same"))?.state).toBe("succeeded");
    expect(s.getSnapshot().revision).toBe(revision);
    await run(s, command, "emma", "same");
    expect(s.getSnapshot().revision).toBe(revision);
    await expect(
      run(s, { ...command, value: "B" }, "emma", "same"),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_KEY_REUSED" });
  });
  it("records failure receipts without changing business state and binds failed operation payloads", async () => {
    const s = createMockService();
    const before = s.getSnapshot().workspaces.emma;
    setDemoFault("failure");
    const cmd: Command = {
      type: "saveDraft",
      questionId: "goal",
      value: "Draft",
    };
    await expect(run(s, cmd, "emma", "failure")).rejects.toMatchObject({
      code: "SERVICE_UNAVAILABLE",
    });
    expect(s.getSnapshot().workspaces.emma).toEqual(before);
    expect((await s.getOperation("failure"))?.state).toBe("failed");
    await expect(
      run(s, { ...cmd, value: "Different" }, "emma", "failure"),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_KEY_REUSED" });
  });
  it("serializes conflicting saves and refuses unavailable connected services", async () => {
    const s = createMockService();
    const q = s
      .getSnapshot()
      .quests.find((q) => q.type === "project_outsourcing")!;
    const results = await Promise.allSettled([
      run(
        s,
        {
          type: "setQuestAvailability",
          id: q.id,
          baseVersion: q.version,
          status: "paused",
        },
        "john",
      ),
      run(
        s,
        {
          type: "setQuestAvailability",
          id: q.id,
          baseVersion: q.version,
          status: "closed",
        },
        "john",
      ),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    await expect(
      run(createConnectedService(), {
        type: "saveDraft",
        questionId: "goal",
        value: "x",
      }),
    ).rejects.toMatchObject({ code: "CAPABILITY_UNAVAILABLE" });
  });
  it("rejects malformed persisted nested data without replacing it", () => {
    for (const mutate of [
      (s: ReturnType<typeof seedSnapshot>) => {
        (s.workspaces.emma as unknown as Record<string, unknown>).context =
          null;
      },
      (s: ReturnType<typeof seedSnapshot>) => {
        (
          s.workspaces.john.blueprint.nodes[0] as unknown as Record<
            string,
            unknown
          >
        ).dependencies = {};
      },
      (s: ReturnType<typeof seedSnapshot>) => {
        (s.quests[0] as unknown as Record<string, unknown>).criteria = 1;
      },
    ]) {
      const bad = seedSnapshot();
      mutate(bad);
      const raw = JSON.stringify(bad);
      let writes = 0;
      expect(() =>
        createMockService({
          getItem: () => raw,
          setItem: () => {
            writes++;
          },
        }),
      ).toThrowError(expect.objectContaining({ code: "STORAGE_INVALID" }));
      expect(writes).toBe(0);
    }
  });
  it("does not notify or mutate on failed persistence and restores a saved snapshot", async () => {
    let value: string | null = null,
      fail = false;
    const storage = {
      getItem: () => value,
      setItem: (_k: string, v: string) => {
        if (fail) throw Error("quota");
        value = v;
      },
    };
    const s = createMockService(storage);
    await run(s, { type: "saveDraft", questionId: "a", value: "saved" });
    expect(
      createMockService(storage).getSnapshot().workspaces.emma.acquisition
        .drafts.a,
    ).toBe("saved");
    let calls = 0;
    s.subscribe(() => calls++);
    fail = true;
    const before = s.getSnapshot();
    await expect(
      run(s, { type: "saveDraft", questionId: "a", value: "bad" }),
    ).rejects.toMatchObject({ code: "STORAGE_FAILED" });
    expect(s.getSnapshot()).toEqual(before);
    expect(calls).toBe(0);
  });
});
describe("context and proposal integrity", () => {
  it("accepts a limited empty summary and preserves edited nodes without a global follow-up cap", async () => {
    const s = createMockService();
    await run(s, { type: "confirmContext", limited: true });
    expect(s.getSnapshot().workspaces.emma.acquisition.confirmed).toBe(true);
    expect(s.getSnapshot().workspaces.emma.plan.items).toHaveLength(0);
    await run(s, {
      type: "saveAnswer",
      questionId: "goal",
      value: "Build a team",
      nextIndex: 1,
    });
    await run(s, {
      type: "saveAnswer",
      questionId: "resources",
      value: "Two people",
      nextIndex: 2,
    });
    const node = s.getSnapshot().workspaces.emma.context[0];
    await run(s, {
      type: "editContext",
      id: node.id,
      patch: { title: "My edited goal", x: 333, deleted: true },
    });
    await run(s, {
      type: "saveAnswer",
      questionId: "goal",
      value: "Build a product",
      nextIndex: 1,
    });
    const [changed, other] = s.getSnapshot().workspaces.emma.context;
    expect(changed).toMatchObject({
      title: "My edited goal",
      x: 333,
      deleted: true,
      status: "stale",
    });
    expect(other.status).toBe("candidate");
    for (let i = 0; i < 3; i++)
      await run(s, {
        type: "saveAnswer",
        questionId: `b${i}`,
        value: "branch",
        nextIndex: 2,
        branch: true,
      });
    await run(s, {
      type: "saveAnswer",
      questionId: "b4",
      value: "branch",
      nextIndex: 2,
      branch: true,
    });
    expect(s.getSnapshot().workspaces.emma.acquisition.branches).toBe(4);
    expect(s.getSnapshot().workspaces.emma.acquisition.confirmed).toBe(true);
  });
  it("adopts a recommendation once and leaves other accepted actions intact", async () => {
    const s = createMockService();
    await run(s, { type: "adoptRecommendation", recommendationId: "goal:v1", title: "整理问题" });
    await run(s, { type: "adoptRecommendation", recommendationId: "goal:v1", title: "整理问题" });
    await run(s, { type: "adoptRecommendation", recommendationId: "goal:v2", title: "联系用户" });
    expect(s.getSnapshot().workspaces.emma.plan.items.map((item) => item.title)).toEqual(["整理问题", "联系用户"]);
  });
  it("keeps a user's profile correction confirmed while preserving the original answer", async () => {
    const s = createMockService();
    await run(s, { type: "saveAnswer", questionId: "e-goal", value: "原方向", nextIndex: 1 });
    await run(s, { type: "confirmContext", limited: true });
    const node = s.getSnapshot().workspaces.emma.context[0];
    await run(s, { type: "saveProfileFact", id: node.id, title: "新方向" });
    const workspace = s.getSnapshot().workspaces.emma;
    expect(workspace.context[0]).toMatchObject({ title: "新方向", status: "confirmed", edited: true });
    expect(workspace.acquisition.answers["e-goal"].value).toBe("原方向");
    expect(workspace.acquisition.confirmed).toBe(true);
  });
  it("keeps stable immutable snapshots and tracks merged/split sources without reviving originals", async () => {
    const s = createMockService();
    expect(s.getSnapshot()).toBe(s.getSnapshot());
    await run(s, {
      type: "saveAnswer",
      questionId: "a",
      value: "First",
      nextIndex: 1,
    });
    await run(s, {
      type: "saveAnswer",
      questionId: "b",
      value: "Second",
      nextIndex: 2,
    });
    const ids = s.getSnapshot().workspaces.emma.context.map((n) => n.id);
    await run(s, { type: "mergeContext", ids, title: "Combined" });
    const merged = s.getSnapshot().workspaces.emma.context.at(-1)!;
    expect(merged.sourceIds).toEqual(["a", "b"]);
    await run(s, {
      type: "saveAnswer",
      questionId: "b",
      value: "Changed",
      nextIndex: 2,
    });
    expect(
      s.getSnapshot().workspaces.emma.context.find((n) => n.id === merged.id)
        ?.status,
    ).toBe("stale");
    await expect(
      run(s, {
        type: "editContext",
        id: merged.id,
        patch: { status: "confirmed" },
      }),
    ).rejects.toMatchObject({ code: "STALE_SOURCE" });
    await run(s, {
      type: "editContext",
      id: merged.id,
      patch: { title: "Reviewed combined" },
    });
    await run(s, {
      type: "editContext",
      id: merged.id,
      patch: { status: "confirmed" },
    });
    await run(s, {
      type: "splitContext",
      id: merged.id,
      titles: ["One", "Two"],
    });
    const nodes = s.getSnapshot().workspaces.emma.context;
    expect(
      nodes.filter((n) => ids.includes(n.id)).every((n) => n.deleted),
    ).toBe(true);
    expect(
      nodes
        .slice(-2)
        .every((n) => n.sourceIds?.includes("b") && n.status === "candidate"),
    ).toBe(true);
  });
  it("resaving an unchanged answer preserves confirmation and source version; John title uses project name", async () => {
    const s = createMockService();
    await run(
      s,
      {
        type: "saveAnswer",
        questionId: "j-goal",
        value: "A long project objective",
        nextIndex: 1,
      },
      "john",
    );
    await run(
      s,
      {
        type: "saveAnswer",
        questionId: "j-scope:followup",
        value: "Harbor",
        nextIndex: 2,
      },
      "john",
    );
    await run(s, { type: "confirmContext", limited: true }, "john");
    const before = s.getSnapshot().workspaces.john;
    expect(before.blueprint.title).toBe("Harbor");
    await run(
      s,
      {
        type: "saveAnswer",
        questionId: "j-goal",
        value: "A long project objective",
        nextIndex: 3,
      },
      "john",
    );
    const after = s.getSnapshot().workspaces.john;
    expect(after.acquisition.answers["j-goal"].version).toBe(
      before.acquisition.answers["j-goal"].version,
    );
    expect(after.acquisition.confirmed).toBe(true);
    expect(after.context).toEqual(before.context);
    expect(after.acquisition.index).toBe(3);
  });
  it("links new follow-ups to their anchor and never recreates user-deleted relationships", async () => {
    const s = createMockService();
    await run(s, {
      type: "saveAnswer",
      questionId: "e-goal",
      value: "My goal",
      nextIndex: 1,
    });
    await run(s, {
      type: "saveAnswer",
      questionId: "e-resources",
      value: "My resources",
      nextIndex: 2,
    });
    await run(s, {
      type: "saveAnswer",
      questionId: "e-resources:followup",
      value: "Resource details",
      nextIndex: 2,
      branch: true,
    });
    const w = s.getSnapshot().workspaces.emma;
    const goal = w.context.find((n) => n.sourceId === "e-goal")!,
      resources = w.context.find((n) => n.sourceId === "e-resources")!,
      followup = w.context.find((n) => n.sourceId === "e-resources:followup")!;
    expect(w.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          from: goal.id,
          to: resources.id,
          label: "关联",
        }),
        expect.objectContaining({
          from: resources.id,
          to: followup.id,
          label: "补充",
        }),
      ]),
    );
    await run(s, { type: "setEdges", edges: [] });
    await run(s, {
      type: "saveAnswer",
      questionId: "e-resources:followup",
      value: "Changed details",
      nextIndex: 2,
      branch: true,
    });
    expect(s.getSnapshot().workspaces.emma.edges).toEqual([]);
    await run(s, {
      type: "saveAnswer",
      questionId: "e-resources:clarify",
      value: "Clarification",
      nextIndex: 2,
      clarification: true,
    });
    expect(s.getSnapshot().workspaces.emma.edges).toHaveLength(1);
    expect(s.getSnapshot().workspaces.emma.edges[0]).toMatchObject({
      from: resources.id,
      label: "补充",
    });
  });
  it("ignores node movement in proposal sources but invalidates changed edge semantics", async () => {
    const s = createMockService();
    await run(s, {
      type: "saveAnswer",
      questionId: "e-goal",
      value: "Goal",
      nextIndex: 1,
    });
    await run(s, {
      type: "saveAnswer",
      questionId: "e-resource",
      value: "Team",
      nextIndex: 2,
    });
    await run(s, { type: "createProposal", title: "First", items: [] });
    let w = s.getSnapshot().workspaces.emma;
    const p = w.proposals.at(-1)!;
    await run(s, {
      type: "editContext",
      id: w.context[0].id,
      patch: { x: 900, y: 800 },
    });
    await run(s, { type: "adoptProposal", id: p.id });
    await run(s, { type: "createProposal", title: "Second", items: [] });
    w = s.getSnapshot().workspaces.emma;
    const next = w.proposals.at(-1)!;
    await run(s, {
      type: "setEdges",
      edges: w.edges.map((e) => ({ ...e, label: "支持" })),
    });
    await expect(
      run(s, { type: "adoptProposal", id: next.id }),
    ).rejects.toMatchObject({ code: "STALE_SOURCE" });
  });
  it("invalidates dependent follow-up and clarification without losing edits, then permits explicit same-answer review", async () => {
    const s = createMockService();
    for (const [id, value] of [
      ["e-goal", "Goal"],
      ["e-goal:followup", "Detail"],
      ["e-goal:clarify", "Clarify"],
      ["e-time", "Three hours"],
    ])
      await run(s, { type: "saveAnswer", questionId: id, value, nextIndex: 1 });
    await run(s, { type: "confirmContext", limited: true });
    let w = s.getSnapshot().workspaces.emma;
    const followup = w.context.find((n) => n.sourceId === "e-goal:followup")!;
    await run(s, {
      type: "editContext",
      id: followup.id,
      patch: { title: "Manual detailed wording", x: 660 },
    });
    await run(s, {
      type: "editContext",
      id: followup.id,
      patch: { status: "confirmed" },
    });
    const answerVersion = w.acquisition.answers["e-goal:followup"].version;
    await run(s, {
      type: "saveAnswer",
      questionId: "e-goal",
      value: "Changed goal",
      nextIndex: 1,
    });
    w = s.getSnapshot().workspaces.emma;
    expect(w.context.find((n) => n.id === followup.id)).toMatchObject({
      title: "Manual detailed wording",
      x: 660,
      status: "stale",
    });
    expect(w.context.find((n) => n.sourceId === "e-goal:clarify")?.status).toBe(
      "stale",
    );
    expect(w.context.find((n) => n.sourceId === "e-time")?.status).toBe(
      "confirmed",
    );
    await run(s, {
      type: "saveAnswer",
      questionId: "e-goal:followup",
      value: "Detail",
      nextIndex: 2,
    });
    w = s.getSnapshot().workspaces.emma;
    expect(w.context.find((n) => n.id === followup.id)).toMatchObject({
      title: "Manual detailed wording",
      x: 660,
      status: "candidate",
    });
    expect(w.acquisition.answers["e-goal:followup"].version).toBe(
      answerVersion,
    );
    expect(w.context.find((n) => n.sourceId === "e-goal:clarify")?.status).toBe(
      "stale",
    );
  });
  it("places generated, manual and split nodes without overlapping occupied slots", async () => {
    const s = createMockService();
    for (let i = 0; i < 5; i++)
      await run(s, {
        type: "saveAnswer",
        questionId: `position-${i}`,
        value: `Node ${i}`,
        nextIndex: i,
      });
    await run(s, { type: "addContext", title: "Manual", kind: "fact" });
    const first = s.getSnapshot().workspaces.emma.context[0];
    await run(s, {
      type: "splitContext",
      id: first.id,
      titles: ["First half", "Second half", "Third half"],
    });
    const visible = s
      .getSnapshot()
      .workspaces.emma.context.filter((n) => !n.deleted);
    for (let i = 0; i < visible.length; i++)
      for (let j = i + 1; j < visible.length; j++)
        expect(
          Math.abs(visible[i].x - visible[j].x) >= 260 ||
            Math.abs(visible[i].y - visible[j].y) >= 176,
        ).toBe(true);
  });
  it("rejects direct and transitive dependency cycles atomically", async () => {
    const s = createMockService();
    const [a, b, c] = s.getSnapshot().workspaces.john.blueprint.nodes;
    const save = (id: string, dependencies: string[]) =>
      run(
        s,
        {
          type: "saveBlueprintNode",
          id,
          patch: { dependencies },
          baseVersion: s.getSnapshot().workspaces.john.blueprint.version,
        },
        "john",
      );
    await save(a.id, [b.id]);
    const before = s.getSnapshot().workspaces.john.blueprint;
    await expect(save(b.id, [a.id])).rejects.toMatchObject({
      code: "DEPENDENCY_CYCLE",
    });
    expect(s.getSnapshot().workspaces.john.blueprint).toEqual(before);
    await save(b.id, [c.id]);
    const beforeTransitive = s.getSnapshot().workspaces.john.blueprint;
    await expect(save(c.id, [a.id])).rejects.toMatchObject({
      code: "DEPENDENCY_CYCLE",
    });
    expect(s.getSnapshot().workspaces.john.blueprint).toEqual(beforeTransitive);
    await save(c.id, []);
  });
  it("propagates delay at minute precision without losing a minute from hidden seconds", async () => {
    const s = createMockService();
    const [a, b] = s.getSnapshot().workspaces.john.blueprint.nodes;
    await run(
      s,
      {
        type: "saveBlueprintNode",
        id: a.id,
        baseVersion: s.getSnapshot().workspaces.john.blueprint.version,
        patch: { dueAt: "2026-10-26T08:27:51.123Z" },
      },
      "john",
    );
    await run(
      s,
      {
        type: "saveBlueprintNode",
        id: b.id,
        baseVersion: s.getSnapshot().workspaces.john.blueprint.version,
        patch: { dueAt: "2026-11-02T08:27:10.456Z", dependencies: [a.id] },
      },
      "john",
    );
    await run(
      s,
      { type: "proposeDelay", id: a.id, dueAt: "2026-11-09T08:27:00.000Z" },
      "john",
    );
    const p = s.getSnapshot().workspaces.john.proposals.at(-1)!;
    expect(p.changes?.find((c) => c.nodeId === a.id)?.after).toBe(
      "2026-11-09T08:27:00.000Z",
    );
    expect(p.changes?.find((c) => c.nodeId === b.id)?.after).toBe(
      "2026-11-16T08:27:00.000Z",
    );
    await run(s, { type: "adoptProposal", id: p.id }, "john");
    expect(
      s.getSnapshot().workspaces.john.blueprint.nodes.find((n) => n.id === b.id)
        ?.dueAt,
    ).toBe("2026-11-16T08:27:00.000Z");
  });
  it("rejects source-stale proposals and preserves commitments during adoption and undo", async () => {
    const s = createMockService();
    await run(s, {
      type: "saveAnswer",
      questionId: "goal",
      value: "Goal",
      nextIndex: 1,
    });
    await run(s, {
      type: "createProposal",
      title: "Change",
      items: [{ id: "new", title: "Next", status: "planned" }],
    });
    const proposal = s.getSnapshot().workspaces.emma.proposals[0];
    await run(s, {
      type: "editContext",
      id: s.getSnapshot().workspaces.emma.context[0].id,
      patch: { title: "Changed" },
    });
    await expect(
      run(s, { type: "adoptProposal", id: proposal.id }),
    ).rejects.toMatchObject({ code: "STALE_SOURCE" });
    const q = s
      .getSnapshot()
      .quests.find((q) => q.type === "capability_growth")!;
    await run(s, { type: "joinQuest", id: q.id, questVersion: q.version });
    await run(s, { type: "createProposal", title: "New", items: [] });
    const ws = s.getSnapshot().workspaces.emma;
    const p = ws.proposals.at(-1)!;
    await run(s, { type: "adoptProposal", id: p.id });
    expect(
      s.getSnapshot().workspaces.emma.plan.items.some((i) => i.attemptId),
    ).toBe(true);
    const commitment = s
      .getSnapshot()
      .workspaces.emma.plan.items.find((i) => i.attemptId)!;
    await run(s, {
      type: "undoPlan",
      proposalId: p.id,
      baseVersion: s.getSnapshot().workspaces.emma.plan.version,
      items: [{ ...commitment, status: "completed" }],
    });
    expect(
      s.getSnapshot().workspaces.emma.plan.items.find((i) => i.attemptId)
        ?.status,
    ).toBe("in_progress");
  });
});
describe("Quest lifecycle", () => {
  it("reuses source draft, validates publication, and keeps attempts independent from publication", async () => {
    const s = createMockService(),
      node = s.getSnapshot().workspaces.john.blueprint.nodes[0];
    await run(s, { type: "createQuestDraft", sourceNodeId: node.id }, "john");
    await run(s, { type: "createQuestDraft", sourceNodeId: node.id }, "john");
    expect(
      s.getSnapshot().quests.filter((q) => q.sourceNodeId === node.id),
    ).toHaveLength(1);
    const draft = s
      .getSnapshot()
      .quests.find((q) => q.sourceNodeId === node.id)!;
    await expect(
      run(
        s,
        { type: "publishQuest", id: draft.id, baseVersion: draft.version },
        "john",
      ),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    await run(
      s,
      {
        type: "saveQuestDraft",
        quest: {
          ...draft,
          requirements: "A collaborator",
          criteria: ["A complete file"],
          deliverables: ["A file"],
          effort: "2h",
          reward: "Volunteer",
        },
        baseVersion: draft.version,
      },
      "john",
    );
    await run(
      s,
      {
        type: "publishQuest",
        id: draft.id,
        baseVersion: s.getSnapshot().quests.find((q) => q.id === draft.id)!
          .version,
      },
      "john",
    );
    const q = s.getSnapshot().quests.find((q) => q.id === draft.id)!;
    await run(s, { type: "joinQuest", id: q.id, questVersion: q.version });
    await run(
      s,
      {
        type: "setQuestAvailability",
        id: q.id,
        baseVersion: q.version,
        status: "closed",
      },
      "john",
    );
    expect(s.getSnapshot().attempts[0].status).toBe("joined");
  });
  it("rejects unsafe material types before saving the attempt", async () => {
    const s = createMockService(),
      q = s.getSnapshot().quests.find((q) => q.type === "capability_growth")!;
    await run(s, { type: "joinQuest", id: q.id, questVersion: q.version });
    const a = s.getSnapshot().attempts[0];
    await expect(
      run(s, {
        type: "saveAttempt",
        id: a.id,
        baseVersion: a.version,
        text: "Evidence",
        materials: [
          {
            id: "bad",
            name: "payload.svg",
            mime: "image/svg+xml",
            size: 20,
            dataUrl: "data:image/svg+xml;base64,AAAA",
            status: "finalized",
          },
        ],
      }),
    ).rejects.toMatchObject({ code: "UPLOAD_REJECTED" });
    expect(s.getSnapshot().attempts[0].materials).toHaveLength(0);
  });
  it("supports revision → new immutable submission → acceptance → deduped candidate-only return", async () => {
    const s = createMockService(),
      q = s.getSnapshot().quests.find((q) => q.type === "project_outsourcing")!;
    await run(s, { type: "joinQuest", id: q.id, questVersion: q.version });
    let a = s.getSnapshot().attempts[0];
    await run(s, {
      type: "saveAttempt",
      id: a.id,
      baseVersion: a.version,
      text: "First evidence",
      materials: [],
    });
    a = s.getSnapshot().attempts[0];
    await run(s, {
      type: "submitAttempt",
      id: a.id,
      baseVersion: a.version,
      disclosure: [],
    });
    const sub = s.getSnapshot().submissions[0];
    await expect(
      run(
        s,
        {
          type: "reviewSubmission",
          submissionId: sub.id,
          decision: "accepted",
          comment: "",
          criteria: q.criteria.map(() => false),
        },
        "john",
      ),
    ).rejects.toMatchObject({ code: "CRITERIA_UNMET" });
    await run(
      s,
      {
        type: "reviewSubmission",
        submissionId: sub.id,
        decision: "revision_requested",
        comment: "Add evidence",
        criteria: q.criteria.map(() => false),
      },
      "john",
    );
    a = s.getSnapshot().attempts[0];
    await run(s, {
      type: "saveAttempt",
      id: a.id,
      baseVersion: a.version,
      text: "Revised evidence",
      materials: [],
    });
    a = s.getSnapshot().attempts[0];
    await run(s, {
      type: "submitAttempt",
      id: a.id,
      baseVersion: a.version,
      disclosure: [],
    });
    const sub2 = s.getSnapshot().submissions[1];
    expect(sub2.id).not.toBe(sub.id);
    expect(s.getSnapshot().submissions[0].text).toBe("First evidence");
    await run(
      s,
      {
        type: "reviewSubmission",
        submissionId: sub2.id,
        decision: "accepted",
        comment: "Meets criteria",
        criteria: q.criteria.map(() => true),
      },
      "john",
    );
    const result = s.getSnapshot().results[0];
    await run(s, { type: "applyResult", id: result.id });
    const first = s.getSnapshot();
    await run(s, { type: "applyResult", id: result.id });
    const again = s.getSnapshot();
    expect(again.workspaces.emma.memories).toEqual(
      first.workspaces.emma.memories,
    );
    expect(again.workspaces.emma.proposals).toEqual(
      first.workspaces.emma.proposals,
    );
    expect(again.workspaces.emma.memories[0].status).toBe("candidate");
    expect(again.workspaces.emma.memories[0].text).toContain("已验收");
    expect(again.workspaces.emma.memories[0].text).not.toContain("accepted");
    expect(again.attempts[0].status).toBe("completed");
  });
  it("enforces type-specific results and keeps neutral unavailable", async () => {
    const s = createMockService();
    for (const type of ["capability_growth", "role_matching"] as const) {
      const q = s.getSnapshot().quests.find((q) => q.type === type)!;
      await run(s, { type: "joinQuest", id: q.id, questVersion: q.version });
      let a = s.getSnapshot().attempts.find((a) => a.questId === q.id)!;
      await run(s, {
        type: "saveAttempt",
        id: a.id,
        baseVersion: a.version,
        text: "My evidence",
        materials: [],
      });
      a = s.getSnapshot().attempts.find((x) => x.id === a.id)!;
      await run(s, {
        type: "submitAttempt",
        id: a.id,
        baseVersion: a.version,
        disclosure: [],
      });
      const sub = s.getSnapshot().submissions.at(-1)!;
      await expect(
        run(
          s,
          {
            type: "reviewSubmission",
            submissionId: sub.id,
            decision: "accepted",
            comment: "",
            criteria: q.criteria.map(() => true),
          },
          "john",
        ),
      ).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
      await run(
        s,
        {
          type: "reviewSubmission",
          submissionId: sub.id,
          decision:
            type === "capability_growth"
              ? "practice_completed"
              : "continue_conversation",
          comment: "Reviewed",
          criteria: q.criteria.map(() => true),
        },
        "john",
      );
      const result = s.getSnapshot().results.at(-1)!;
      await run(s, { type: "applyResult", id: result.id });
      expect(s.getSnapshot().workspaces.emma.memories.at(-1)?.text).toContain(
        type === "capability_growth" ? "练习已完成" : "继续沟通",
      );
    }
    const neutral = s
      .getSnapshot()
      .quests.find((q) => q.type === "neutral_assessment")!;
    await expect(
      run(s, {
        type: "joinQuest",
        id: neutral.id,
        questVersion: neutral.version,
      }),
    ).rejects.toMatchObject({ code: "CAPABILITY_UNAVAILABLE" });
  });
});
