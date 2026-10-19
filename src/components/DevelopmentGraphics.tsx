import { FileText, GitBranch, Compass, CircleHelp } from "lucide-react";
import type { DevelopmentGraphics as Graphics } from "../domain/development-analysis";

/** These connectors display only the supplied graph's ordered nodes and explicit pairs. */
function RelationConnector() {
  return <span className="relation-arrow" aria-hidden="true">
    <svg className="arrow-horizontal" viewBox="0 0 96 36" focusable="false"><path d="M3 18 C29 18 63 18 88 18 M80 11 L88 18 L80 25"/></svg>
    <svg className="arrow-vertical" viewBox="0 0 36 42" focusable="false"><path d="M18 3 L18 36 M11 28 L18 36 L25 28"/></svg>
  </span>;
}
export function DevelopmentGraphics({ graphics: g, section }: { graphics: Graphics; section: "过去" | "现在" | "未来" }) {
  if (section === "过去") return <div className="report-past-graphic">
    <p className="graphic-legend"><GitBranch size={18} aria-hidden="true"/>经历与线索</p>
    <ol className={`experience-timeline ${g.timeline.length<=2?"compact-timeline":""}`} aria-label="按你提供的资料排列经历先后">
      {g.timeline.map((n, i) => <li key={i}><span className="timeline-mark" aria-hidden="true"><i />{i < g.timeline.length - 1 && <span><svg className="timeline-horizontal" viewBox="0 0 96 24" focusable="false"><path d="M2 12 L89 12 M81 5 L89 12 L81 19"/></svg><svg className="timeline-vertical" viewBox="0 0 28 80" focusable="false"><path d="M14 2 L14 71 M8 63 L14 71 L20 63"/></svg></span>}</span><article className="graphic-node"><h4>{n.label}：{n.title}</h4><p>{n.contribution}</p></article></li>)}
    </ol>
    <div className="undated-contributions" aria-label="未说明时间的其他经历">{g.undated.map((n, i) => <article className="graphic-node" key={i}><h4>{n.label}：{n.title}</h4><p>{n.contribution}</p></article>)}</div>
  </div>;
  if (section === "现在") return <div className="report-present-graphic">
    <p className="graphic-legend">你做过的事 → 其中的做法</p>
    <ul className="practice-relations" aria-label="根据你提供的资料关联经历与做法，不代表评分或能力认证">{g.practices.map((n, i) => <li key={i}><div className="graphic-node"><FileText size={22} aria-hidden="true"/><span>{n.practice}</span></div><RelationConnector/><div className="graphic-node approach-node"><GitBranch size={22} aria-hidden="true"/><span>{n.approach}</span></div></li>)}</ul>
    <div className="report-conditions" aria-label="现实条件与偏好">{g.conditions.map((n, i) => <p key={i}>{n.text}</p>)}</div>
    <p className="report-unknown"><CircleHelp size={18} aria-hidden="true"/><span>还需了解：{g.unknown.map(n => n.text).join("、")}</span></p>
  </div>;
  return <div className="report-future-graphic">
    <p className="graphic-legend"><Compass size={18} aria-hidden="true"/>可选方向 · 还未加入计划</p>
    <ul className="direction-options" aria-label="还未加入计划的可选方向">{g.directions.map((n, i) => <li className="graphic-node approach-node" key={i}><h4>{n.title}</h4><p>{n.reason}</p></li>)}</ul>
    <p className="graphic-legend">{g.stepsTitle}</p>
    <ol className="suggested-steps" aria-label="建议的步骤顺序，还未加入计划或完成">{g.steps.map((text, i) => <li key={i}><span className="step-mark" aria-hidden="true"><b>{i + 1}</b>{i < g.steps.length - 1 && <span>↓</span>}</span><div className="graphic-node">{text}</div></li>)}</ol>
  </div>;
}
