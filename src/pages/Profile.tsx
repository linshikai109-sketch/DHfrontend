import brandLogo from "../assets/darkhorse-technology-logo.png";
import { DevelopmentGraphics } from "../components/DevelopmentGraphics";
import { ContextCanvas } from "../components/ContextCanvas";
import { Dialog } from "../components/ui";
import EnterpriseProfile, { EnterpriseOverview } from "./EnterpriseProfile";
import { currentDevelopmentReport } from "../domain/development-report";
import { RoleIdentity,RoleStoryCard } from "../components/RoleStoryCard";
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { useProduct } from "../product";
import { profileSummary } from "../domain/profile-summary";
import { ProfileSummarySections } from "../components/ProfileSummarySections";
import { ExternalMaterials, useExternalMaterials } from "../components/ExternalMaterials";
import "./profile-v12.css";

import { Badge, Button } from "../components/ui";
import { pictureEntries, pictureTitles, pictureToken, type PictureEntry, type PictureField } from "../domain/profile-picture";
import "./profile.css";

export function ProfileOverview({ onClose }: { onClose: () => void }) {
  const {role}=useProduct();
  if(role==="john") return <EnterpriseOverview onClose={onClose}/>;
  return <DevelopmentOverview onClose={onClose} />;
}
function DevelopmentOverview({onClose}:{onClose:()=>void}) {
  const {workspace}=useProduct();const report=currentDevelopmentReport(workspace);
  const dialog=useRef<HTMLDialogElement>(null);
  const [closing,setClosing]=useState(false);
  const closeTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  function requestClose(){
    if(closeTimer.current) return;
    setClosing(true);
    // Keep the modal shield through the second click of a native double-click.
    closeTimer.current=setTimeout(onClose,400);
  }
  useEffect(()=>{const opener=document.activeElement as HTMLElement|null;const node=dialog.current!;const old=document.body.style.overflow;document.body.style.overflow="hidden";node.showModal();node.querySelector<HTMLButtonElement>('button')?.focus({preventScroll:true});node.scrollTop=0;return()=>{if(closeTimer.current) clearTimeout(closeTimer.current);node.close();document.body.style.overflow=old;if(opener?.isConnected) opener.focus();};},[]);
  return <dialog ref={dialog} className="development-report" aria-labelledby="development-report-title" onCancel={e=>{e.preventDefault();requestClose();}}>
    <div className="report-masthead"><span className="report-brand" aria-hidden="true"><span className="brand-mark"><img src={brandLogo} alt=""/></span><strong>DHAI</strong></span><h2 id="development-report-title">你的发展分析</h2><span className="report-masthead-note">经历与下一步</span></div>
    {report?<>
      {!report.story.hidden&&<RoleStoryCard story={report.story}/>}
      {report.analysis && report.analysis.sourceToken===report.sourceToken ? <>
        <div className={`report-narrative ${report.analysis.graphics?"report-illustrated":""}`}>{report.analysis.sections.map((section,index)=><section className="report-section narrative-section" key={section.title}><h3><span className="report-section-number">{String(index+1).padStart(2,"0")}</span><span>{section.title}</span></h3><div className="section-interpretation">{section.paragraphs.map((paragraph,i)=>{const end=i===0?paragraph.indexOf("。"): -1;return end>=0?<div key={i}><h4 className="analysis-lead">{paragraph.slice(0,end+1)}</h4>{paragraph.slice(end+1).trim()&&<p>{paragraph.slice(end+1)}</p>}</div>:<p key={i}>{paragraph}</p>;})}</div>{report.analysis!.graphics && <DevelopmentGraphics graphics={report.analysis!.graphics} section={section.title}/>}</section>)}</div>
      </> : <section className="report-section" role="status"><h3>分析待更新</h3><p>你的资料仍保留，目前还没有可用的分析。</p></section>}
      <p className="report-source">{report.analysis?.graphics?"根据你提供的经历和安排整理，尚未向其他来源核实。这里的建议还没有加入计划。":report.analysis?.mode==="synthetic_fixture"?"来源：同一虚构人物提供的经历、目标和安排。尚未向其他来源核实，建议还没有加入计划。":"来源：本次对话和你自己提供的资料，尚未向其他来源核实。"}</p>
    </>:<section className="report-section" role="status"><h3>{workspace.developmentReport?"分析待更新":"暂没有可用的发展分析"}</h3><p>{workspace.developmentReport?"你修改过资料或称号，旧分析已不再适用。目前还没有更新后的分析。":"你填写的资料和确认记录仍保留，目前还没有生成发展分析。"}</p></section>}
    <div className="report-close-row"><Button disabled={closing} onClick={requestClose}>关闭报告</Button></div>
  </dialog>;
}

export function PictureSections({ compact = false }: { compact?: boolean }) {
  const { workspace } = useProduct();
  const entries = pictureEntries(workspace);
  const fields: PictureField[] = ["state", "focus", "experience", "unknown"];
  return <div className={compact ? "profile-picture-compact" : "profile-picture-sections"}>
    {fields.map(field => {
      const values = entries.filter(entry => entry.field === field || field === "focus" && entry.field === "conditions");
      return <section className="profile-section" key={field} aria-label={pictureTitles[field]}><h2>{pictureTitles[field]}</h2>
        {field === "unknown" && <p className="muted">不清楚、不想回答或前后不一致的内容会按原话保留，不据此判断你的能力或性格。</p>}
        <ul>{values.map(entry => <ProfileEntry key={entry.id} entry={entry} compact={compact} />)}</ul>
        {!values.length && <p className="muted">这里还没有资料，你可以以后再补充。</p>}
      </section>;
    })}
  </div>;
}
function ProfileEntry({ entry, compact }: { entry: PictureEntry; compact: boolean }) {
  const { workspace, run, busy, pending } = useProduct();
  const { node } = entry;
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(entry.text);
  const [baseToken, setBaseToken] = useState("");
  const answer = workspace.acquisition.answers[node.sourceId];
  const syntheticSkip = node.id.startsWith("skip:");
  return <li className="profile-entry">
    {editing ? <form onSubmit={async event => {
      event.preventDefault();
      if (await run({ type: "saveProfileFact", id: node.id, title: value.trim(), segment: entry.segment, baseToken })) setEditing(false);
    }}>
      <label htmlFor={`profile-edit-${entry.id}`}>修改这条资料</label>
      <textarea id={`profile-edit-${entry.id}`} autoFocus value={value} onChange={event => setValue(event.target.value)} />
      <div className="row"><Button disabled={!value.trim() || busy || pending}>保存</Button><Button type="button" variant="quiet" onClick={() => setEditing(false)}>取消</Button></div>
    </form> : <>
      <div className="profile-entry-main"><p>{entry.field === "conditions" && <span className="profile-field-label">资源与限制 · </span>}{entry.text}</p></div>
      {node.status !== "confirmed" && <Badge tone="pending">{node.status === "stale" ? "原回答已修改，请重新核对" : "需要你核对"}</Badge>}
      <details><summary>查看依据</summary><p>{node.edited ? "你修改后的资料" : answer ? `来自你填写的回答 · 版本 ${answer.version}` : "当前资料"}</p>{answer && <blockquote>{answer.value || "用户跳过"}</blockquote>}{node.edited && answer && <p>原回答仍保留，当前以你修改后的内容为准。</p>}</details>
      <div className="profile-entry-actions">{!compact && !syntheticSkip && <div className="row"><Button variant="quiet" disabled={busy || pending} onClick={() => { setValue(entry.text); setBaseToken(pictureToken(workspace)); setEditing(true); }}>修改</Button><Button variant="quiet" disabled={busy || pending} onClick={() => void run({ type: "excludeProfileFact", id:node.id, segment:entry.segment, baseToken:pictureToken(workspace) })}>移除</Button></div>}</div>
    </>}
  </li>;
}

export function PersonalProfile({enterpriseView=false}:{enterpriseView?:boolean}) {
  const {workspace,error,pending,busy,recover,clearError}=useProduct();const nav=useNavigate();const location=useLocation();
  const [canvasOpen,setCanvasOpen]=useState(false),[roleOpen,setRoleOpen]=useState(false);
  const summary=profileSummary(workspace);const {membership}=useExternalMaterials();
  useEffect(()=>{window.scrollTo(0,0);},[enterpriseView]);
  return <div className="profile-page profile-v12">
    <div className="profile-page-heading"><Button variant="quiet" onClick={()=>nav(enterpriseView?"/john/profile":"/emma/result",{state:{restoreProfileScroll:true}})}><ArrowLeft size={16}/>{enterpriseView?"返回企业概览":"返回工作台"}</Button></div>
    <header className="profile-hero profile-summary-hero"><span className="eyebrow">{enterpriseView?"我的个人资料":"个人中心"}</span><h1>{enterpriseView?"我的经历与资料":"个人画像"}</h1>{!enterpriseView&&summary.intro&&<p>{summary.intro}。</p>}{enterpriseView&&membership&&<div className="profile-person-membership"><h2>{membership.role}</h2>{membership.responsibilities&&<p>{membership.responsibilities}</p>}</div>}</header>
    {enterpriseView&&(error||pending)&&<div className="operation-banner" role="alert"><span>{pending?"还不能确定上次操作是否成功，请先查询结果。":error}</span>{pending?<Button variant="secondary" disabled={busy} onClick={recover}>查询结果</Button>:<Button variant="quiet" aria-label="关闭错误" onClick={clearError}>关闭</Button>}</div>}
    <ProfileSummarySections groupIds={enterpriseView?["basis"]:undefined}/>
    <ExternalMaterials owner="personal"/>
    {!enterpriseView&&<nav className="profile-secondary-links" aria-label="个人资料入口"><button onClick={()=>nav("/emma/result?overview=1&reopen=1",{state:{reportReturn:{pathname:location.pathname,search:location.search,hash:location.hash}}})}>发展分析 <ExternalLink size={16}/></button><button onClick={()=>setCanvasOpen(true)}>资料画板 <ExternalLink size={16}/></button><button onClick={()=>setRoleOpen(true)}>角色卡 <ExternalLink size={16}/></button><button onClick={()=>nav("/emma/path")}>我的路径 <ExternalLink size={16}/></button></nav>}
    {canvasOpen&&<Dialog title="资料画板" onClose={()=>setCanvasOpen(false)} wide><ContextCanvas sheet="full"/></Dialog>}
    {roleOpen&&<Dialog title="角色卡" onClose={()=>setRoleOpen(false)}><RoleIdentity/></Dialog>}
  </div>;
}

export default function Profile(){const {role}=useProduct();return role==="john"?<EnterpriseProfile/>:<PersonalProfile/>;}
