import { describe, expect, it } from "vitest";
import { uiError } from "../src/domain/ui-copy";
import { limitedAnalysis } from "../src/domain/development-analysis";
import { createMockService } from "../src/domain/service";
import { pictureEntries } from "../src/domain/profile-picture";
import { seedSnapshot } from "../src/domain/fixtures";

describe("readable copy retains uncertainty and complete user content", () => {
  it("keeps unknown outcomes uncertain and prevents duplicate submission wording", () => {
    const text = uiError("结果尚未确认，请查询原操作");
    expect(text).toContain("还不能确定");
    expect(text).toContain("查询结果");
    expect(text).toContain("不要重复提交");
    expect(text).not.toContain("已保存");
    expect(uiError("未映射的具体错误")).toBe("未映射的具体错误");
  });
  it("retains every long Chinese source without using it as a lead heading", async () => {
    const service = createMockService({ getItem: () => null, setItem: () => {} });
    const answer = "我想先了解岗位要求，再整理以前做过的项目。".repeat(60);
    await service.execute({ role: "emma", operationId: "long-copy", command: { type: "saveAnswer", questionId: "e-goal", value: answer, nextIndex: 1 } });
    const w = service.getSnapshot().workspaces.emma;
    const analysis = limitedAnalysis(w);
    expect(analysis.sections.map(s => s.title)).toEqual(["过去", "现在", "未来"]);
    expect(analysis.sections[1].paragraphs[0].length).toBeLessThan(40);
    expect(w.acquisition.answers["e-goal"].value).toBe(answer);
    for (const fact of pictureEntries(w).filter(e => e.node.status !== "stale")) {
      expect(analysis.sections.flatMap(s => s.paragraphs).join("\n")).toContain(fact.text);
    }
    expect(analysis.sections[2].paragraphs.join("")).toContain("还没有加入计划");
    expect(analysis.sections[1].paragraphs.length).toBeLessThan(10);
    expect(w.plan.items).toHaveLength(0);
  });
  it("explains missing experience without inventing history or adopting an action", () => {
    const analysis = limitedAnalysis(seedSnapshot().workspaces.emma);
    expect(analysis.sections[0].paragraphs.join("")).toContain("还没有足够的经历资料");
    expect(analysis.sections[2].paragraphs.join("")).toContain("没有替你选择行动");
  });
});
