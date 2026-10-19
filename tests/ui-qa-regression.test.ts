import { describe, expect, it } from "vitest";
import { classify, pictureEntries } from "../src/domain/profile-picture";
import { reportV6Fixture } from "../src/domain/report-v6-fixture";
import { currentDevelopmentReport } from "../src/domain/development-report";
import { questCopy } from "../src/domain/ui-copy";

describe("QA goal classification and task display regression", () => {
  it("keeps the real fictional goal in focus, with time constraints separate", () => {
    const w = reportV6Fixture().workspaces.emma;
    const before = JSON.stringify(w);
    const entries = pictureEntries(w).filter(e => e.node.sourceId === "fixture:S6");
    const intended = entries.find(e => e.text.startsWith("先在八周内做一份"));
    expect(intended?.field).toBe("focus");
    expect(entries.find(e => e.text.includes("每周约可投入"))?.field).toBe("conditions");
    expect(JSON.stringify(w)).toBe(before);
    expect(currentDevelopmentReport(w)).toBeDefined();
  });
  it("uses a goal source for intended outputs, without overriding completed experience", () => {
    expect(classify("完成一份研究作品", "e-next")).toBe("focus");
    expect(classify("完成一份研究作品", "custom-goal", {}, "goal")).toBe("focus");
    expect(classify("完成过一份研究作品", "e-next")).toBe("experience");
    expect(classify("上周做过访谈", "e-goal")).toBe("experience");
    expect(classify("完成一份研究作品", "e-experience")).toBe("experience");
  });
  it("recognizes future plans before generic experience nouns", () => {
    for (const text of ["先在八周内做一份作品", "在两个月内完成一个原型", "打算完成一次访谈", "将要准备项目成果"])
      expect(classify(text, "manual")).toBe("focus");
    expect(classify("不知道能不能完成作品", "e-next")).toBe("unknown");
    expect(classify("每周最多投入两小时", "e-next")).toBe("conditions");
  });
  it("maps legacy demo phrases only and leaves supplied task text unchanged", () => {
    expect(questCopy("既有 NT-01 情境，接入后开放。")).toBe("任务准备中，开放后可参加");
    expect(questCopy("结构化产物与材料来源")).toBe("你需要提交的内容与参考资料");
    expect(questCopy("提交三张照片和一份记录")).toBe("提交三张照片和一份记录");
  });
});
