import { describe, expect, it } from "vitest";
import { createMockService } from "../src/domain/service";
import { currentAction, profileSections } from "../src/domain/profile";
import { nextGoalIndex } from "../src/domain/interview";

describe("confirmed context and action flow", () => {
  it("does not re-ask a goal already supplied in a longer answer", () => {
    expect(nextGoalIndex("emma", {
      "e-experience": { value: "我做过用户研究，也完成了作品案例，每周可以投入 4 小时", skipped: false },
    }, "我做过用户研究，也完成了作品案例，每周可以投入 4 小时")).not.toBe(1);
  });

  it("keeps rejected candidates out of the shared recommendation while preserving an adopted item", async () => {
    const service = createMockService();
    let n = 0;
    const run = (command: Parameters<typeof service.execute>[0]["command"]) => service.execute({ role: "emma", command, operationId: `profile-${++n}` });
    await run({ type: "saveAnswer", questionId: "e-goal", value: "找到新的工作方向", nextIndex: 1 });
    await run({ type: "saveAnswer", questionId: "e-next", value: "完成一份研究案例", nextIndex: 2 });
    await run({ type: "confirmContext", limited: true });
    const initial = currentAction(service.getSnapshot().workspaces.emma);
    expect(initial.status).toBe("candidate");
    await run({ type: "respondRecommendation", recommendationId: initial.id, decision: "rejected" });
    const alternative = currentAction(service.getSnapshot().workspaces.emma);
    expect(alternative.id).not.toBe(initial.id);
    await run({ type: "adoptRecommendation", recommendationId: alternative.id, title: alternative.title });
    await run({ type: "adoptRecommendation", recommendationId: alternative.id, title: alternative.title });
    expect(service.getSnapshot().workspaces.emma.plan.items.filter((item) => item.recommendationId === alternative.id)).toHaveLength(1);
    expect(currentAction(service.getSnapshot().workspaces.emma).status).toBe("adopted");
  });

  it("does not restore a removed fact from its unchanged onboarding source", async () => {
    const service = createMockService();
    let n = 0;
    const run = (command: Parameters<typeof service.execute>[0]["command"]) => service.execute({ role: "emma", command, operationId: `remove-${++n}` });
    await run({ type: "saveAnswer", questionId: "e-goal", value: "新的工作方向", nextIndex: 1 });
    await run({ type: "confirmContext", limited: true });
    const node = service.getSnapshot().workspaces.emma.context.find((item) => item.sourceId === "e-goal")!;
    await run({ type: "editContext", id: node.id, patch: { deleted: true } });
    await run({ type: "saveAnswer", questionId: "e-goal", value: "新的工作方向", nextIndex: 2 });
    expect(profileSections(service.getSnapshot().workspaces.emma).flatMap((section) => section.nodes)).toHaveLength(0);
  });
});
