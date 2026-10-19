import { fixtureViewVersion } from "../domain/view-state";
import { agencyQuestId } from "../domain/upwork-cases";
import { useLocation, useNavigate } from "react-router";
import { ArrowRight } from "lucide-react";
import { useProduct } from "../product";
import { pictureToken } from "../domain/profile-picture";
import { currentAction } from "../domain/profile";
import { Button } from "./ui";

export function CurrentAction({ compact = false }: { compact?: boolean }) {
  const { workspace, role, run, busy, pending } = useProduct();
  const nav = useNavigate();
  const location = useLocation();
  const action = currentAction(workspace);
  const workbench = role === "emma" ? "/emma/result" : "/john/workbench";
  return <article className={`current-action ${compact ? "current-action-compact" : ""}`} aria-label="当前任务">
    <span className="eyebrow">当前任务</span>
    <h3>{action.title}</h3>
    <p>{action.reason}</p>
    {workspace.profileImpact && <p className="profile-impact" role="status">{workspace.profileImpact}</p>}
    {fixtureViewVersion() === "upwork-v1" && <><p>{role === "emma" ? "可了解的机会：客户报表草稿与审核。是否适合仍需核对经验和任务要求，不表示已符合原帖资格。" : "平台建议：先查看报表草稿任务，再确认样本范围与审核方式。"}</p><Button variant="secondary" onClick={() => nav(`/${role}/quest?quest=${agencyQuestId}&view=detail`)}>查看客户报表任务 <ArrowRight size={16}/></Button></>}
    <div className="row">
      {action.status === "candidate" ? <Button disabled={busy || pending} onClick={async () => {
        if (action.id.endsWith(":clarify")) nav(role === "emma" && workspace.acquisition.completed ? "/emma/result" : `/${role}/onboarding`);
        else await run({ type: "adoptRecommendation", recommendationId: action.id, title: action.title, pictureToken: pictureToken(workspace) });
      }}>{action.id.endsWith(":clarify") ? "补充资料" : "加入计划"}</Button> :
        action.status === "none" ? <Button variant="secondary" disabled={busy || pending} onClick={() => void run({ type: "resetRecommendationFeedback" })}>重新查看建议</Button> :
        <Button variant="secondary" onClick={() => nav(`${workbench}#current-action`)}>查看进度 <ArrowRight size={16} /></Button>}
      {action.status === "candidate" && !action.id.endsWith(":clarify") && <>
        {!!action.alternativeCount && <Button variant="quiet" disabled={busy || pending} onClick={() => void run({ type: "respondRecommendation", recommendationId: action.id, decision: "later" })}>换一个</Button>}
        <Button variant="quiet" disabled={busy || pending} onClick={() => void run({ type: "respondRecommendation", recommendationId: action.id, decision: "later" })}>稍后</Button>
        {!compact && <Button variant="quiet" disabled={busy || pending} onClick={() => void run({ type: "respondRecommendation", recommendationId: action.id, decision: "rejected" })}>不适合</Button>}
      </>}
      {!compact && location.pathname !== workbench && <Button variant="quiet" onClick={() => nav(workbench)}>打开工作台</Button>}
    </div>
  </article>;
}
