import { agencyQuestId } from "../domain/upwork-cases";
import { questCopy } from "../domain/ui-copy";
import { useState } from "react";
import { useNavigate } from "react-router";
import { ArrowRight, ArrowUpRight, Clock3 } from "lucide-react";
import { Badge, Button, Empty, formatDate } from "./ui";
import { effectiveFact, type ArtifactData, type ArtifactKind, type PlanDifference } from "../domain/workbench-artifacts";
import { questions } from "../domain/questions";
import "./workbench-artifact.css";
import { MobileFold } from "./ResponsiveResult";
import { MatrixView, RelationDiagram, SwimlaneView, TimelineView, BoardView } from "./VisualTemplates";

const statuses: Record<string, string> = { planned: "待开始", in_progress: "进行中", completed: "已完成" };

export function ComparisonTable({ columns, rows }: { columns: string[]; rows: { label: string; cells: string[] }[] }) {
  return <><div className="compare-table artifact-table responsive-desktop" tabIndex={0} aria-label="方案逐项对比"><table><thead><tr><th scope="col">比较内容</th>{columns.map((column) => <th scope="col" key={column}>{column}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.label}><th scope="row">{row.label}</th>{row.cells.map((cell, index) => <td key={index}>{cell}</td>)}</tr>)}</tbody></table></div><div className="responsive-mobile"><MobileFold count={rows.length} label="查看完整对比">{rows.map(row=><section className="responsive-comparison-card" key={row.label}><h4>{row.label}</h4><dl>{row.cells.map((cell,index)=><div key={index}><dt>{columns[index]}</dt><dd>{cell}</dd></div>)}</dl></section>)}</MobileFold></div></>;
}

export function PlanChangeRows({ rows }: { rows: PlanDifference[] }) {
  return <div className="plan-diff-table"><div className="plan-diff-head"><span>变化</span><span>原计划</span><span>调整后</span></div>{rows.map(row=><div className={`plan-diff-row diff-${row.kind}`} key={row.id}><Badge>{({added:"新增",retained:"保留",changed:"调整",removed:"移除"})[row.kind]}</Badge><div><small>原计划</small>{row.before?.title||"—"}{row.before?.dueAt&&<time>{formatDate(row.before.dueAt)}</time>}</div><div><small>调整后</small>{row.after?.title||"移除"}{row.after?.dueAt&&<time>{formatDate(row.after.dueAt)}</time>}</div></div>)}</div>;

}

function EvidenceView({ data }: { data: ArtifactData }) {
  if (!data.facts.length) return <Empty>还没有可查看的依据</Empty>;
  return <RelationDiagram nodes={data.facts.map(fact => {
    const source = questions[data.role].find(q => fact.sourceId === q.id || fact.sourceId.startsWith(`${q.id}:`));
    return { id: fact.id, title: fact.title, label: fact.status === "confirmed" ? "已确认" : fact.status === "stale" ? "来源已变化" : "待确认", detail: `${fact.edited ? "用户修改" : source ? `引导回答 · ${source.topic}` : "手动补充"} · 来源版本 ${fact.sourceVersion}` };
  })} edges={data.relations}/>;
}

export function WorkbenchArtifact({ kind, data, disabled, onPropose, onOpenPlan }: {
  kind: ArtifactKind; data: ArtifactData; disabled: boolean;
  onPropose: (title: string) => void; onOpenPlan: () => void;
}) {
  const nav = useNavigate();
  const [scheme, setScheme] = useState("prototype");
  const [questId, setQuestId] = useState(data.quests[0]?.id);
  const [showAll, setShowAll] = useState(false);
  const [pathView, setPathView] = useState(data.route.some(n=>n.dependencies.length) ? "flow" : "lanes");
  const role = data.role;
  if (kind === "status") return <div className="artifact-status"><h3>{data.action.title}</h3><p>{data.action.reason}</p><div className="artifact-metrics"><div><strong>{data.plan.filter((item) => item.status === "in_progress").length}</strong><span>进行中</span></div><div><strong>{data.plan.filter((item) => item.status === "planned").length}</strong><span>待开始</span></div><div><strong>{data.plan.filter((item) => item.status === "completed").length}</strong><span>已完成</span></div></div><Button variant="secondary" onClick={onOpenPlan}>查看当前计划 <ArrowUpRight size={16}/></Button></div>;
  if (kind === "compare" && data.role === "john" && data.quests.some(q => q.id === agencyQuestId)) return <div>
    <p className="muted">平台建议 · 尚未获买方批准。先比较怎样开始，不代表已连接客户账号。</p>
    <ComparisonTable columns={["先做报表草稿", "先核对数据连接"]} rows={[
      {label:"第一份产出", cells:["合成数据报表与人工审核记录", "数据来源、权限与连接清单"]},
      {label:"范围", cells:["先验证指标、文案与可复现步骤", "先确认可访问的数据、缺失项与 NDA"]},
      {label:"待确认", cells:["报表频次、指标和审核人", "真实账号授权与最小权限"]},
    ]}/>
    <Button disabled={disabled} onClick={() => onPropose("建议：客户报表草稿与人工审核")}>预览报表计划 <ArrowRight size={16}/></Button>
  </div>;
  if (kind === "compare") return <div><ComparisonTable columns={["先做原型", "先做研究"]} rows={[
    { label: "第一份产出", cells: ["可测试的交互原型", "有依据的需求结论"] },
    { label: "投入方式", cells: ["设计、搭建与测试", "招募、访谈与整理"] },
    { label: "已有依据", cells: [effectiveFact(data, role === "john" ? "j-resources" : "e-experience"), effectiveFact(data, role === "john" ? "j-customer" : "e-evidence")] },
    { label: "第一步", cells: ["明确要验证的问题", "列出访谈提纲"] },
  ]}/><div className="artifact-choice" role="group" aria-label="选择推进方案">{[["prototype", "原型路径"], ["research", "研究路径"]].map(([id, label]) => <button key={id} aria-pressed={scheme === id} onClick={() => setScheme(id)}>{label}</button>)}</div><Button disabled={disabled} onClick={() => onPropose(scheme === "research" ? "用户研究路径" : "原型验证路径")}>预览计划变化 <ArrowRight size={16}/></Button></div>;
  if (kind === "gaps") return <div><MatrixView columns={["已知", "待验证", "缺失"]} rows={data.sections.map(section => {
    const known = section.nodes.filter(n=>n.status==="confirmed"); const pending = section.nodes.filter(n=>n.status!=="confirmed");
    return {label: section.title, cells: [
      {value: known.length ? `${known.length} 项依据` : "暂无", state: known.length ? "yes" as const : "unknown" as const, detail: known.map(n=>n.title).join("；") || "尚无已确认资料"},
      {value: pending.length ? `${pending.length} 项待确认` : "暂无", state: "unknown" as const, detail: pending.map(n=>`${n.title} · ${n.status==="stale"?"来源已变化":"待确认"}`).join("；") || "没有待确认资料"},
      {value: section.nodes.length ? "未判定" : "待补充", state: section.nodes.length ? "unknown" as const : "gap" as const, detail: section.nodes.length ? "有资料不等于已满足全部要求，需结合具体目标判断。" : `补充${section.title}的相关资料。`},
    ]};
  })}/><Button variant="secondary" onClick={() => nav(`/${role}/profile`)}>补充或修改资料</Button></div>;
  if (kind === "evidence") return <><EvidenceView data={data}/><Button variant="quiet" onClick={() => nav(`/${role}/onboarding?canvas=full`)}>打开完整画板 <ArrowUpRight size={16}/></Button></>;
  if (kind === "path") {
    const routeNodes=data.route.map(n=>({id:n.id,title:n.title,group:n.stage,label:n.tentative ? (role==="emma"?"建议步骤":"待验证假设") : statuses[n.status],detail:`${n.dependencies.length ? "前置："+n.dependencies.map(id=>data.route.find(r=>r.id===id)?.title||"待补充事项").join("；") : "还没有说明开始前需要做什么"}${n.dueAt ? " · "+formatDate(n.dueAt) : ""}`}));
    const edges=data.route.flatMap(n=>n.dependencies.filter(id=>data.route.some(r=>r.id===id)).map(id=>({from:id,to:n.id,label:"前置条件"})));
    const labels:Record<string,string>={direction:"方向验证",capability:"能力建设",practice:"实践协作",portfolio:"作品积累",opportunity:"机会推进",customer:"客户洞察",product:"产品开发",marketing:"市场推广",sales:"销售增长",operations:"运营交付",team:"团队协作",finance:"财务与融资",governance:"治理与风险"};
    return <div><div className="artifact-choice"><button aria-pressed={pathView==="flow"} onClick={()=>setPathView("flow")}>先后关系</button><button aria-pressed={pathView==="lanes"} onClick={()=>setPathView("lanes")}>按阶段查看</button></div>{!routeNodes.length?<Empty>当前尚无行动路径</Empty>:pathView==="flow"?<>{!edges.length&&<p className="muted">还没有说明哪些步骤需要先完成。</p>}<RelationDiagram nodes={routeNodes} edges={edges}/></>:<SwimlaneView lanes={[...new Set(data.route.map(n=>n.lane||"other"))].map(lane=>({title:labels[lane]||"其他行动",nodes:routeNodes.filter(n=>(data.route.find(r=>r.id===n.id)?.lane||"other")===lane)}))}/>}<Button variant="secondary" onClick={() => nav(role === "emma" ? "/emma/path" : "/john/report")}>{role === "emma" ? "打开我的路径" : "打开企业蓝图"} <ArrowUpRight size={16}/></Button></div>;
  }
  if (kind === "timeline") {
    const items = [...data.plan].sort((a, b) => (a.dueAt ? Date.parse(a.dueAt) : Infinity) - (b.dueAt ? Date.parse(b.dueAt) : Infinity));
    return items.length ? <TimelineView nodes={items.map(item=>({id:item.id,title:item.title,label:item.dueAt?formatDate(item.dueAt):"日期待定",detail:statuses[item.status]}))}/> : <Empty>当前没有已安排的行动</Empty>;
  }
  if (kind === "changes") return data.proposal ? <div><h3>{data.proposal.title}</h3><PlanChangeRows rows={data.proposal.rows}/><Button variant="secondary" onClick={onOpenPlan}>查看当前变更预览</Button></div> : <Empty>当前没有待采纳的计划变化</Empty>;
  const quest = data.quests.find((item) => item.id === questId) || data.quests[0];
  if (!quest) return <Empty>当前没有可查看的任务</Empty>;
  return <div className="artifact-quest"><label htmlFor="artifact-quest-select">选择任务</label><select id="artifact-quest-select" value={quest.id} onChange={(event) => setQuestId(event.target.value)}>{data.quests.map((item) => <option value={item.id} key={item.id}>{item.title}</option>)}</select><h3>{quest.title}</h3>{quest.id === agencyQuestId && <p className="muted">平台建议的本地任务，日期为建议安排；不是原帖买方任务。</p>}<div className="artifact-quest-dates"><span>接取截止<strong>{formatDate(quest.joinDeadline)}</strong></span><span>交付截止<strong>{formatDate(quest.deadline)}</strong></span></div><small>{quest.timezone}</small><p>{quest.requirements || "要求待补充"}</p><div className="artifact-gap-list">{[["交付内容", quest.deliverables], ["验收要求", quest.criteria]].map(([title, values]) => <section key={String(title)}><h3>{title}</h3><ul>{(values as string[]).map((value, index) => <li key={index}>{questCopy(value)}</li>)}</ul></section>)}</div>{data.feedback.filter((item) => item.questId === quest.id).map((item, index) => <blockquote key={index}>{item.comment}<small>{formatDate(item.createdAt)}</small></blockquote>)}<Button variant="secondary" onClick={() => nav(`/${role}/quest?quest=${encodeURIComponent(quest.id)}&view=detail`)}>打开任务 <ArrowUpRight size={16}/></Button></div>;
}
