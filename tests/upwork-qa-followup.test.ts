import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { confirmationOverview, overviewReturn } from "../src/domain/overview-navigation";
import { feedbackPreviewCopy, taskResultCopy } from "../src/domain/ui-copy";
import { LocalSendNotice } from "../src/components/LocalSendNotice";

describe("Upwork QA outcome scope and explicit overview return", () => {
  it("opens first and repeated John confirmation, keeping repeat Close in the workbench", () => {
    const source={pathname:"/john/onboarding",search:"?fixture=upwork-v1",hash:""};
    const first=confirmationOverview("john",false,source);
    expect(first.to).toBe("/john/workbench?overview=1&reopen=1");expect(first.state).toBeUndefined();
    const repeat=confirmationOverview("john",true,source);
    expect(repeat.to).toContain("reopen=1");expect(repeat.state).toBeUndefined();expect(overviewReturn("john",source)).toBeUndefined();
  });
  it("keeps Emma profile Close and rejects cross-role or external returns", () => {
    const source={pathname:"/emma/profile",search:"?fixture=upwork-v1",hash:""};
    expect(overviewReturn("emma",source)).toEqual(source);expect(overviewReturn("john",source)).toBeUndefined();
    expect(overviewReturn("john",{...source,pathname:"https://upwork.com"})).toBeUndefined();
    expect(overviewReturn("john",{pathname:"/john/onboarding"})).toBeUndefined();
  });
  it("scopes committed acceptance to the report task, without technical mode labels", () => {
    expect(taskResultCopy("accepted",true,true)).toBe("报表任务已验收");
    expect(taskResultCopy("accepted",false,false)).toBe("任务已验收");
    expect(taskResultCopy("revision_requested",true,true)).not.toContain("已验收");
  });
  it("does not present an unsent review preview as an accepted result", () => {
    const text=feedbackPreviewCopy("accepted",true,true);
    expect(text).toContain("拟通过报表任务验收");expect(text).not.toMatch(/演示|示例|模拟/);expect(text).not.toContain("已验收");
  });
  it("states destination and local-only behavior inside both standalone confirmations", () => {
    for(const action of ["submission","feedback"] as const){
      const html=renderToStaticMarkup(createElement(LocalSendNotice,{action,taskTitle:"客户报表草稿与人工审核",profile:"demo_mock"}));
      expect(html).not.toMatch(/模拟|示例|演示/);expect(html).toContain("目的：客户报表草稿与人工审核");
      expect(html).toContain("不会发送到 Upwork");expect(html).toContain("不会联系原帖客户");
      expect(html).toContain(action==="submission"?"John":"Emma");
    }
    expect(renderToStaticMarkup(createElement(LocalSendNotice,{action:"submission",taskTitle:"客户报表",profile:"connected"}))).toBe("");
  });
});
