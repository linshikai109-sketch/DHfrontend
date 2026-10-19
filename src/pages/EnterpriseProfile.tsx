import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import brandLogo from "../assets/darkhorse-technology-logo.png";
import { enterpriseOverview } from "../domain/enterprise-overview";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { useProduct } from "../product";
import { profileSummary } from "../domain/profile-summary";
import { ProfileSummarySections, ProfileIdentityDetails } from "../components/ProfileSummarySections";
import { ExternalMaterials, EnterpriseMembership } from "../components/ExternalMaterials";
import "./profile-v12.css";

import { Button } from "../components/ui";

import "./profile.css";

export function EnterpriseOverview({ onClose }: { onClose: () => void }) {
  const { workspace } = useProduct();
  const report = enterpriseOverview(workspace);
  const dialog = useRef<HTMLDialogElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [closing, setClosing] = useState(false);
  function requestClose() {
    if (closeTimer.current) return;
    setClosing(true);
    closeTimer.current = setTimeout(onClose, 400);
  }
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const node = dialog.current!;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    node.showModal();
    node.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
    node.scrollTop = 0;
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
      node.close();
      document.body.style.overflow = oldOverflow;
      if (opener?.isConnected) opener.focus();
    };
  }, []);
  return <dialog ref={dialog} className="development-report enterprise-development-report" aria-labelledby="enterprise-report-title" onCancel={(event) => { event.preventDefault(); requestClose(); }}>
    <div className="report-masthead"><span className="report-brand" aria-hidden="true"><span className="brand-mark"><img src={brandLogo} alt="" /></span><strong>DHAI</strong></span><h2 id="enterprise-report-title">发展分析</h2><span className="report-masthead-note">项目与下一步</span></div>
    <section className="role-story-card"><div><span className="eyebrow">企业与项目</span><h3>{report.name}</h3><p className="role-story-text">{report.identity}</p></div></section>
    <div className="report-narrative">{report.sections.map((section, index) => <section className="report-section narrative-section" key={section.id}>
      <h3><span className="report-section-number">{String(index + 1).padStart(2, "0")}</span><span>{section.title}</span></h3>
      {section.items.length ? <ul>{section.items.map((item) => <li key={item.id}>{item.title}</li>)}</ul> : <p>{section.empty}</p>}
    </section>)}</div>
    <div className="report-close-row"><Button disabled={closing} onClick={requestClose}>关闭报告</Button></div>
  </dialog>;
}

export default function EnterpriseProfile() {
  const {workspace}=useProduct();const nav=useNavigate();const location=useLocation();
  const summary=profileSummary(workspace);
  useEffect(()=>{let y=0;try{if(location.state?.restoreProfileScroll)y=Number(sessionStorage.getItem('dhai:enterprise-profile-scroll')||0);}catch{} const frame=requestAnimationFrame(()=>window.scrollTo(0,Number.isFinite(y)?y:0));return()=>cancelAnimationFrame(frame);},[]);
  return <div className="profile-page profile-v12">
    <div className="profile-page-heading"><Button variant="quiet" onClick={()=>nav('/john/workbench')}><ArrowLeft size={16}/>返回工作台</Button></div>
    <header className="profile-hero profile-summary-hero"><span className="eyebrow">{summary.title}</span><h1>{summary.name||summary.title}</h1>{summary.intro&&<p>{summary.intro}。</p>}{summary.stage&&<span className="profile-stage">{summary.stage}</span>}<ProfileIdentityDetails/></header>
    <ProfileSummarySections/>
    <ExternalMaterials owner="business"/>
    <EnterpriseMembership onOpenPersonal={()=>{try{sessionStorage.setItem('dhai:enterprise-profile-scroll',String(window.scrollY));}catch{}nav('/john/personal-profile');}}/>
    <nav className="profile-secondary-links" aria-label="企业资料入口"><button onClick={()=>nav('/john/workbench?overview=1&reopen=1',{state:{reportReturn:{pathname:location.pathname,search:location.search,hash:location.hash}}})}>发展分析 <ExternalLink size={16}/></button><button onClick={()=>nav('/john/onboarding?canvas=full')}>资料画板 <ExternalLink size={16}/></button><button onClick={()=>nav('/john/report')}>项目蓝图 <ExternalLink size={16}/></button></nav>
  </div>;
}
