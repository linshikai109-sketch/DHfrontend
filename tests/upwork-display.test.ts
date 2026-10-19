import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it } from "vitest";
import { Context } from "../src/context";
import Quests from "../src/pages/Quests";
import { upworkFixture } from "../src/domain/upwork-fixture";
import { agencyQuestId, upworkCases } from "../src/domain/upwork-cases";
import { setFixtureViewNamespace } from "../src/domain/view-state";
import { fixtureStorage } from "../src/domain/report-v5-fixture";
import { createMockService } from "../src/domain/service";
import type { Snapshot } from "../src/domain/types";
import { setDemoFault } from "../src/domain/service";
import type { Role } from "../src/domain/types";

beforeEach(()=>setFixtureViewNamespace(true,"upwork-v1"));
function page(route:string,role:Role="emma", override?:Snapshot) {
  const snapshot=override||upworkFixture();
  return renderToStaticMarkup(createElement(MemoryRouter,{initialEntries:[route]},
    createElement(Context.Provider,{value:{snapshot,workspace:snapshot.workspaces[role],role,
      run:async()=>null,busy:false,error:"",pending:false,clearError:()=>{},recover:async()=>{},setFault:setDemoFault}},
      createElement(Quests))));
}
describe("actual server-rendered case copy, not a browser or viewport test",()=>{
  it("puts local recipient and purpose inside the actual submission confirmation",async()=>{
    const map=new Map<string,string>();
    const storage={getItem:(k:string)=>map.get(k)??null,setItem:(k:string,v:string)=>{map.set(k,v);},removeItem:(k:string)=>{map.delete(k);}};
    const service=createMockService(fixtureStorage(storage,"upwork-v1",upworkFixture));
    await service.execute({role:"emma",operationId:"display-join",command:{type:"joinQuest",id:agencyQuestId,questVersion:1}});
    const snapshot=service.getSnapshot();
    const html=page(`/emma/quest?fixture=upwork-v1&quest=${agencyQuestId}&view=submit`,"emma",snapshot);
    expect(html).toContain("确认提交");expect(html).toContain("目的：客户报表草稿与人工审核");
    expect(html).toContain("供 John 查看");expect(html).toContain("不会发送到 Upwork");
    expect(html).toContain("不会联系原帖客户");expect(snapshot.attempts[0].status).toBe("joined");
    expect(snapshot.submissions).toHaveLength(0);
  });
  it("lists the agency task and three independent preview actions",()=>{
    const html=page("/emma/quest?fixture=upwork-v1");
    expect(html).toContain("客户报表草稿与人工审核");
    for(const item of upworkCases.slice(1))expect(html).toContain(item.title);
    expect(html.match(/>查看案例/g)).toHaveLength(3);
    expect(html).toContain("只读预览，不能报名");
  });
  it("shows source, first-stage price and privacy restrictions in read-only COI preview",()=>{
    const html=page("/emma/quest?fixture=upwork-v1&case=coi");
    expect(html).toContain("仅第一阶段");expect(html).toContain("不存税号");
    expect(html).toContain(upworkCases[1].url);expect(html).toContain("2026-10-05");
    expect(html).toContain("只读预览");expect(html).not.toContain("确认报名");expect(html).not.toContain("接取任务");
  });
  it("labels source scope and task dates as local suggestions rather than real buyer deadlines",()=>{
    const html=page(`/emma/quest?fixture=upwork-v1&quest=${agencyQuestId}&view=detail`);
    expect(html).toContain("平台建议 · 任务");
    expect(html).toContain("报名截止 · 建议安排");
    expect(html).toContain("本任务未定价");
    expect(html).toContain("只用合成数据");
    expect(html).toContain("原帖没有提供这些日期");
  });
});
