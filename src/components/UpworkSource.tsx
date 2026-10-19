import { agencyCase, sourceCheckedAt, upworkCaseById } from "../domain/upwork-cases";
export function UpworkSource({ caseId = "agency", task = false }: { caseId?: string; task?: boolean }) {
  const item = upworkCaseById(caseId) || agencyCase;
  return <div className="case-source-note">
    <p><strong>{task ? "平台建议 · 任务" : caseId === "agency" ? "真实需求来源 · 角色资料" : "真实需求来源 · 独立案例"}</strong> · <a href={item.url} target="_blank" rel="noreferrer">查看 Upwork 原帖</a></p>
    <p className="muted">{item.price} · 核对日 {sourceCheckedAt} · 当前是否仍招未核实</p>
    <details><summary>来源与范围</summary><p>价格是发布标价，不是成交金额，货币种类未确认。{item.boundaries}</p><p>{task ? "报名、提交、审核、进度和结果只保存在本机记录中，不会联系原帖买方或产生真实客户交付。任务日期为建议安排，原帖没有提供这些日期。" : caseId === "agency" ? "John 是当前项目角色，当前营销机构不是原帖买方身份。人物资料、能力匹配、平台计划和交付结果仅保存在本机。" : "这是独立需求预览，不属于当前营销机构。没有真实客户资料、报名、付款或交付结果。"}</p></details>
  </div>;
}
