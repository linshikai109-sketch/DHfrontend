import { PlanReviewStatus } from "../components/PlanReviewStatus";
import { isProposalCurrent } from "../domain/service";
import { MobilePlanReview } from "../components/MobilePlanReview";
import { MobilePlanChangeList } from "../components/MobilePlanChangeList";
import { groupConversationTopics } from "../domain/conversation-topics";
import { createPortal } from "react-dom";
import { ResponsiveVoiceSceneResult as VoiceSceneResult } from "../components/ResponsiveResult";
import "./workbench-no-sidebar.css";
import { overviewReturn } from "../domain/overview-navigation";
import { UpworkSource } from "../components/UpworkSource";
import { fixtureViewVersion } from "../domain/view-state";
import { pictureEntries, pictureFocus } from "../domain/profile-picture";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { ArrowRight, Check, Undo2, X, FileText } from "lucide-react";
import { useProduct } from "../product";
import { WorkbenchVoice } from "../components/WorkbenchVoice";
import { resolveWorkbenchView, type VoiceScene } from "../domain/workbench-voice";
import { Badge, Button, Empty, Dialog } from "../components/ui";
import { readView, writeView } from "../domain/view-state";
import { getPersonalPath } from "../domain/personal-path";
import { CurrentAction } from "../components/CurrentAction";
import { currentAction, enterpriseScope } from "../domain/profile";
import { ProfileOverview } from "./Profile";
import type { PlanItem, Proposal } from "../domain/types";
import { relatedArtifacts, artifactLabels, projectArtifact, resolveIntent, planDifferences, type ArtifactKind as Kind, type WorkbenchTurn } from "../domain/workbench-artifacts";
import { WorkbenchArtifact, PlanChangeRows } from "../components/WorkbenchArtifact";
interface PlanUndo {
  id: string;
  baseVersion: number;
  items: PlanItem[];
}
type Presentation = {id:string;createdAt:string;prompt:string} & ({type:'voice';scene:VoiceScene}|{type:'inline';view:'task'|'plan'});
interface Conversation {
  presentations?: Presentation[];
  presentationId?: string;
  id: string;
  title: string;
  prompt: string;
  input: string;
  kind: Kind;
  ready: boolean;
  history?: WorkbenchTurn[];
}
const initial: Conversation = {
  id: "start",
  title: "下一步的方向",
  prompt: "",
  input: "",
  kind: "compare",
  ready: false,
};
export default function Workbench() {
  const { workspace, role, snapshot, run, busy, pending, error } = useProduct();
  const nav = useNavigate();
  const location = useLocation();
  const [showOverview, setShowOverview] = useState(() =>
    new URLSearchParams(window.location.search).get("overview") === "1" &&
    (new URLSearchParams(window.location.search).get("reopen") === "1" || !readView(snapshot.runtimeProfile, role, "initial-overview-shown", false)),
  );
  useEffect(() => {
    if (showOverview && role === "john") writeView(snapshot.runtimeProfile, role, "initial-overview-shown", true);
  }, [showOverview, snapshot.runtimeProfile, role]);
  const personalPath =
    role === "emma" ? getPersonalPath(workspace, snapshot) : null;
  const currentPathNode = personalPath?.nodes.find(
    (node) => node.stage === 0 && node.status !== "completed",
  );
  const nextPathNode = personalPath?.nodes.find(
    (node) => node.stage === 1 && node.status !== "completed",
  );
  const recentPlanItems = role === "emma"
    ? workspace.plan.items.filter((item) => {
        const node = personalPath?.nodes.find((entry) => entry.planItemId === item.id);
        return !!item.attemptId || !node || node.stage === 0;
      })
    : workspace.plan.items;
  const recommendation = currentAction(workspace);
  const conditions = pictureEntries(workspace).filter(entry => entry.field === "conditions");
  const polished = role === "john";
  const [historyOpen,setHistoryOpen]=useState(false);
  useEffect(()=>{const params=new URLSearchParams(location.search);if(params.get('conversations')==='1'){setHistoryOpen(true);params.delete('conversations');nav({pathname:location.pathname,search:params.toString(),hash:location.hash},{replace:true});}},[location.search,location.pathname,location.hash,nav]);
  useEffect(()=>{const open=()=>setHistoryOpen(true);window.addEventListener("dhai-open-conversations",open);return()=>window.removeEventListener("dhai-open-conversations",open);},[]);
  const [navSlot,setNavSlot]=useState<HTMLElement|null>(null);
  useEffect(()=>{setNavSlot(document.getElementById("john-conversation-slot"));},[role]);
  const [mainView, setMainView] = useState<'discussion'|'task'|'plan'>(location.hash === '#current-action' ? 'task' : 'discussion');
  const discussionRef = useRef<HTMLElement>(null);
  const scrollPosition = useRef({container:0,window:0});
  function changeView(view: 'discussion'|'task'|'plan') {
    if (mainView === 'discussion') scrollPosition.current = {container: discussionRef.current?.querySelector(".discussion-content")?.scrollTop || 0, window: window.scrollY};
    setMainView(view);
    if (view === 'discussion') requestAnimationFrame(() => { const content=discussionRef.current?.querySelector(".discussion-content"); if (content) content.scrollTop = scrollPosition.current.container; window.scrollTo({top:scrollPosition.current.window, behavior:'instant'}); });
  }
  useEffect(() => { if (location.hash === '#current-action') setMainView('task'); }, [location.hash]);
  const [selectedTurnId, setSelectedTurnId] = useState<string | null>(null);
  const [artifactView, setArtifactView] = useState<Kind | null>(null);
  const [historyError, setHistoryError] = useState("");
  const [changedIds, setChangedIds] = useState<string[]>([]);
  const proposalRef = useRef<HTMLDivElement>(null);
  const proposalTriggerRef = useRef<HTMLElement | null>(null);
  const [mobileReview, setMobileReview] = useState(() => window.matchMedia('(max-width: 767px)').matches);
  const [reviewError, setReviewError] = useState('');
  const [refreshingProposal, setRefreshingProposal] = useState<Proposal | null>(null);
  useLayoutEffect(() => {
    const media = window.matchMedia('(max-width: 767px)');
    const update = () => setMobileReview(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    if (!changedIds.length) return;
    const timeout = setTimeout(() => setChangedIds([]), 2200);
    return () => clearTimeout(timeout);
  }, [changedIds]);
  const [showAllPlanItems, setShowAllPlanItems] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>(() =>
    readView(snapshot.runtimeProfile, role, "conversations", [initial]),
  );
  const [current, setCurrent] = useState(() => {
    const saved = readView<string>(
      snapshot.runtimeProfile,
      role,
      "current-conversation",
      "",
    );
    return conversations.some((c) => c.id === saved)
      ? saved
      : conversations[0]?.id || "start";
  });
  useEffect(() => { setSelectedTurnId(null); setArtifactView(null); }, [current, role]);
  const active =
    conversations.find((x) => x.id === current) || conversations[0] || initial;
  const presentation = active.presentations?.find(entry => entry.id === active.presentationId);
  const voiceResult = presentation?.type === 'voice' ? presentation.scene : null;
  const inlineRequest = presentation?.type === 'inline' ? presentation : null;
  const liveArtifact = projectArtifact(workspace, snapshot);
  const turns = active.history || [];
  const shownTurn = turns.find((turn) => turn.id === selectedTurnId) || turns.at(-1);
  const artifactData = shownTurn?.data || liveArtifact;
  const artifactStale = artifactData.revision !== liveArtifact.revision;
  const viewKind = artifactView || shownTurn?.kind || active.kind;
  const shownPrompt = shownTurn?.prompt || active.prompt;
  const topicEntries = [...turns.map(turn=>({id:turn.id,createdAt:turn.createdAt,prompt:turn.prompt,turn})),...(active.presentations||[]).map(entry=>({id:entry.id,createdAt:entry.createdAt,prompt:entry.prompt,entry}))].sort((a,b)=>a.createdAt.localeCompare(b.createdAt));
  const topicGroups = groupConversationTopics(topicEntries);
  const currentTopic = topicGroups.at(-1);
  const [expandedTopics,setExpandedTopics]=useState<string[]>([]);
  useEffect(()=>setExpandedTopics([]),[current, currentTopic?.id]);
  const latestAnchor=useRef<HTMLDivElement>(null);
  const latestResultKey=presentation?.id || shownTurn?.id || (active.ready?'legacy':'');
  useLayoutEffect(()=>{
    if(!latestResultKey)return;
    let second=0;
    const first=requestAnimationFrame(()=>{second=requestAnimationFrame(()=>latestAnchor.current?.scrollIntoView({block:'start',behavior:'instant'}));});
    return()=>{cancelAnimationFrame(first);cancelAnimationFrame(second);};
  },[current,role,latestResultKey]);

  const [generating, setGenerating] = useState(false);
  const generationLock = useRef(false);
  const [generationError, setGenerationError] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [mobileTab, setMobileTab] = useState(location.hash === "#current-action" ? "plan" : "discussion");
  useEffect(() => {
    if (location.hash === "#current-action") setMobileTab("plan");
  }, [location.hash]);
  const [undo, setUndo] = useState<PlanUndo | null>(() => {
    const saved = readView<PlanUndo | null>(
      snapshot.runtimeProfile,
      role,
      "plan-undo",
      null,
    );
    return saved &&
      typeof saved.id === "string" &&
      Number.isFinite(saved.baseVersion) &&
      Array.isArray(saved.items) &&
      saved.baseVersion === workspace.plan.version &&
      workspace.proposals.some(
        (p) => p.id === saved.id && p.status === "adopted",
      )
      ? saved
      : null;
  });
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  useEffect(() => {
    setHistoryError(writeView(snapshot.runtimeProfile, role, "conversations", conversations)
      ? "" : "这次讨论没有保存成功，请先复制需要的内容，不要关闭页面。");
  }, [conversations, role, snapshot.runtimeProfile]);
  useEffect(() => {
    writeView(snapshot.runtimeProfile, role, "current-conversation", current);
  }, [current, role, snapshot.runtimeProfile]);
  useEffect(() => {
    if (
      undo &&
      (undo.baseVersion !== workspace.plan.version ||
        !workspace.proposals.some(
          (p) => p.id === undo.id && p.status === "adopted",
        ))
    ) {
      setUndo(null);
      writeView(snapshot.runtimeProfile, role, "plan-undo", null);
    } else {
      writeView(snapshot.runtimeProfile, role, "plan-undo", undo);
    }
  }, [
    undo,
    workspace.plan.version,
    workspace.proposals,
    role,
    snapshot.runtimeProfile,
  ]);
  function rememberUndo(value: PlanUndo | null) {
    writeView(snapshot.runtimeProfile, role, "plan-undo", value);
    setUndo(value);
  }
  function newConversation() {
    stop();
    const c = {
      ...initial,
      id: crypto.randomUUID(),
      title: `新的讨论 ${conversations.length + 1}`,
    };
    setConversations((list) => [...list, c]);
    setCurrent(c.id);
    setMobileTab("discussion");
    setMainView("discussion");
  }
  function chooseConversation(id: string) {
    stop();
    setCurrent(id);
    setMobileTab("discussion");
    setMainView("discussion");
  }
  function update(patch: Partial<Conversation>) {
    setConversations((list) =>
      list.map((x) => (x.id === active.id ? { ...x, ...patch } : x)),
    );
  }
  function recordPresentation(entry: Presentation, clearInput=false) {
    setConversations(list => list.map(conversation => conversation.id === active.id ? {...conversation, presentations:[...(conversation.presentations || []),entry], presentationId:entry.id, input:clearInput ? '' : conversation.input} : conversation));
  }
  function start(kind?: Kind, promptOverride?: string) {
    if (generationLock.current || generating || busy || pending) return;
    const requestedView = !kind && resolveWorkbenchView(promptOverride || active.input.trim());
    if (requestedView) { recordPresentation({id:crypto.randomUUID(),createdAt:new Date().toISOString(),type:'inline',view:requestedView,prompt:promptOverride || active.input.trim()},true); return; }
    if (snapshot.runtimeProfile === "connected") {
      setGenerationError("暂时不能生成建议，服务还未接入。你可以继续编辑输入。");
      return;
    }
    setGenerationError("");
    generationLock.current = true;
    setGenerating(true);
    const prompt = promptOverride || active.input.trim() || artifactLabels[kind || "status"];
    const selected = kind || resolveIntent(prompt);
    const id = active.id;
    const data = projectArtifact(workspace, snapshot);
    const turn: WorkbenchTurn = { id: crypto.randomUUID(), prompt, kind: selected, createdAt: new Date().toISOString(), data };
    timer.current = setTimeout(() => {
      setConversations((list) => list.map((conversation) => {
        if (conversation.id !== id) return conversation;
        const history = conversation.history || (conversation.ready ? [{
          id: crypto.randomUUID(), prompt: conversation.prompt, kind: conversation.kind,
          createdAt: new Date().toISOString(), data, legacy: true,
        }] : []);
        return { ...conversation, prompt, input: promptOverride || conversation.input !== active.input ? conversation.input : "", presentationId:undefined, kind: selected, ready: true, history: [...history, turn] };
      }));
      setSelectedTurnId(null);
      setArtifactView(null);
      generationLock.current = false;
      setGenerating(false);
      timer.current = null;
    }, 650);
  }
  function stop() {
    generationLock.current = false;
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setGenerating(false);
  }
  async function propose(title: string, refresh = false) {
    if ((!refresh && (artifactStale || proposal)) || busy || pending) return;
    const goal =
      workspace.context.find((n) => !n.deleted && n.status === "confirmed" && n.kind === "goal")?.title ||
      "完成一个小型实践";
    const items: PlanItem[] = role === "john" && fixtureViewVersion() === "upwork-v1" ? [
      { id: crypto.randomUUID(), title: "建议：核对客户报表的指标、来源和审核人", status: "planned" },
      { id: crypto.randomUUID(), title: "建议：用合成数据制作客户报表草稿", status: "planned" },
      { id: crypto.randomUUID(), title: "建议：人工审核草稿并检查交接文档", status: "planned" },
    ] : [
      { id: crypto.randomUUID(), title: title.includes("研究") ? "列出访谈提纲" : "明确要验证的问题", status: "planned" },
      {
        id: crypto.randomUUID(),
        title: title.includes("研究") ? "完成一次用户访谈" : title.includes("原型") ? "完成可测试的交互原型" : goal,
        status: "planned",
      },
      { id: crypto.randomUUID(), title: "整理证据与下一步", status: "planned" },
    ];
    if (!refresh) proposalTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const result = await run({ type: "createProposal", title, items: [...workspace.plan.items, ...items] });
    if (result) {
      setReviewError("");
      setMobileTab("plan");
      requestAnimationFrame(() => {
        proposalRef.current?.focus({ preventScroll: true });
        proposalRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      });
    }
  }
  const proposal = [...workspace.proposals]
    .reverse()
    .find((p) => p.status === "ready" && p.target === "plan");
  const proposalStale = !!proposal && !isProposalCurrent(workspace, proposal);
  async function cancelProposal() {
    if (!proposal || busy || pending || refreshingProposal) return false;
    const result = await run({ type: "cancelProposal", id: proposal.id });
    if (result) setReviewError('');
    else setReviewError('取消未完成，请重试。');
    return !!result;
  }
  async function applyProposal() {
    if (!proposal || proposalStale || busy || pending) return;
    const before = workspace.plan.items;
    const result = await run({ type: "adoptProposal", id: proposal.id });
    if (result) {
      setChangedIds(proposal.items.map(p => p.id));
      rememberUndo({ id: proposal.id, items: before, baseVersion: result.workspaces[role].plan.version });
      setReviewError('');
    } else setReviewError('应用未完成，请重试。');
  }
  async function refreshProposal() {
    if (!proposal || busy || pending) return;
    const title = proposal.title;
    setRefreshingProposal(proposal);
    try {
      if (await run({ type: "cancelProposal", id: proposal.id })) await propose(title, true);
    } finally {
      setRefreshingProposal(null);
      requestAnimationFrame(() => {
        if (mobileReview) document.querySelector<HTMLElement>(".mobile-plan-review[open] .mobile-review-body")?.focus({ preventScroll: true });
      });
    }
  }
  const reviewedProposal = proposal || refreshingProposal;
  const reviewRows = reviewedProposal ? <><PlanChangeRows rows={planDifferences(workspace.plan.items, reviewedProposal.items)}/>{proposalStale && <div role="alert"><p>计划或依据已变化，请更新预览后再应用。</p><Button variant="secondary" disabled={busy || pending} onClick={() => void refreshProposal()}>更新预览</Button></div>}{reviewError && !proposalStale && <p role="alert">{error || reviewError}</p>}</> : null;
  const goal =
    pictureFocus(workspace);
  const latestResults = snapshot.results.filter((r) => {
    const attempt = snapshot.attempts.find((a) => a.id === r.attemptId);
    return role === "john"
      ? attempt?.questSnapshot.publisher === role
      : attempt?.participant === role;
  });
  return (
    <div className={polished ? "workbench-shell workbench-studio" : "workbench-shell"} data-plan-review={!!reviewedProposal && mobileReview} data-view={mainView} data-has-result={!!(active.ready || voiceResult || inlineRequest)}>
      {mainView !== 'discussion' && <Button className="return-discussion" variant="quiet" onClick={() => changeView('discussion')}>← 返回讨论</Button>}
      {historyOpen&&<Dialog title="会话" onClose={()=>setHistoryOpen(false)}><div className="conversation-picker"><Button onClick={()=>{newConversation();setHistoryOpen(false);}}>＋ 新对话</Button>{conversations.map(c=><Button key={c.id} variant="quiet" onClick={()=>{chooseConversation(c.id);setHistoryOpen(false);}}>{c.title}</Button>)}</div></Dialog>}
      <div className={`workbench-layout without-plan-panel mobile-discussion `}>
        {role==='john'&&navSlot&&createPortal(<div className="john-conversations"><span>最近会话</span>{conversations.map(c=><button key={c.id} aria-current={current===c.id?'true':undefined} onClick={()=>chooseConversation(c.id)}>{c.title}</button>)}<button onClick={newConversation}>＋ 新对话</button></div>,navSlot)}
        {mainView !== 'discussion' && <section className="wb-context-view" aria-label={mainView === 'task' ? '当前任务' : '计划'}>
          <h1>{mainView === 'task' ? '当前任务' : '计划'}</h1>
          {mainView === 'task' ? <CurrentAction/> : <>
            <WorkbenchPlan items={workspace.plan.items}/>
            <Button variant="secondary" onClick={() => nav(role === 'emma' ? '/emma/path' : '/john/report')}>{role === 'emma' ? '查看我的路径' : '查看企业蓝图'} <ArrowRight size={16}/></Button>
          </>}
        </section>}
        <section ref={discussionRef} className="discussion" style={mainView !== 'discussion' ? {display:'none'} : undefined}>
          <div className="discussion-content">
            <div className="page-heading">
              {role === "john" && (
                <span className="eyebrow">
                  {enterpriseScope(workspace)}
                </span>
              )}
              <h1>{voiceResult ? "一起理清下一步" : active.ready ? artifactLabels[viewKind] : "你想先做哪件事？"}</h1>
              {!polished && <p className="muted">{goal || "先确定一个当前目标"}</p>}
              {polished && <div className="workspace-context"><span className="context-dot" />{goal || "当前目标待补充"}</div>}
            </div>
            {role === "john" && fixtureViewVersion() === "upwork-v1" && <UpworkSource task/>}
            <div className="conversation-past" aria-label="话题记录">{topicGroups.map((topic,index)=>{
              const isCurrent=index===topicGroups.length-1;
              const expanded=isCurrent||expandedTopics.includes(topic.id);
              const items=topic.items.filter(item=>item.id!==(presentation?.id || (active.ready?shownTurn?.id:undefined)));
              return <section className={isCurrent?'current-topic-history':'history-topic'} key={topic.id}>
                {!isCurrent&&<button className="history-topic-toggle" aria-expanded={expanded} aria-controls={`topic-${topic.id}`} onClick={()=>setExpandedTopics(ids=>expanded?ids.filter(id=>id!==topic.id):[...ids,topic.id])}><span>{topic.title}</span><small>{topic.items.length} 轮讨论</small><span aria-hidden="true">{expanded?'−':'+'}</span></button>}
                {expanded&&<div id={`topic-${topic.id}`} className="topic-turns">{items.map(item=><section className="past-turn" key={item.id}>
              {'turn' in item?<><div className="user-message">{item.turn.prompt}</div><article className="artifact reusable-artifact"><h2>{artifactLabels[item.turn.kind]}</h2><WorkbenchArtifact kind={item.turn.kind} data={item.turn.data} disabled onPropose={()=>{}} onOpenPlan={()=>changeView('plan')}/></article></>:<><div className="user-message">{item.entry.prompt}</div>{item.entry.type==='voice'?<VoiceSceneResult scene={item.entry.scene}/>:<article className="wb-scene-result"><h2>{item.entry.view==='task'?'当前任务':'计划'}</h2><Button variant="quiet" onClick={()=>changeView(item.entry.type==='inline'?item.entry.view:'task')}>查看当前内容 →</Button></article>}</>}
                </section>)}</div>}
              </section>;
            })}</div>
            <div ref={latestAnchor} className="latest-result-anchor" aria-hidden="true"/>
            {shownPrompt && !voiceResult && !inlineRequest && <div className="user-message">{shownPrompt}</div>}
            {historyError && <p className="inline-error" role="alert">{historyError}</p>}
            {!active.ready && !generating && !voiceResult && !inlineRequest && <div className="welcome-discussion"><div className="welcome-emblem" aria-hidden="true"><span/><span/><span/></div></div>}
            {inlineRequest && <><div className="user-message">{inlineRequest.prompt}</div><article className="wb-scene-result"><h2>{inlineRequest.view === 'task' ? '当前任务' : '计划'}</h2>{inlineRequest.view === 'task' ? <CurrentAction compact/> : <WorkbenchPlan items={workspace.plan.items}/>}</article></>}
            {voiceResult && <><div className="user-message">{voiceResult.prompt}</div>{voiceResult.id === 'action' ? <article className="wb-scene-result"><h2>当前任务</h2><CurrentAction compact/></article> : <VoiceSceneResult scene={voiceResult}/>}</>}
            {generating && (
              <div className="generation-state" role="status">
                <div className="shimmer-line" />
                <div className="shimmer-line short" />
                <Button variant="quiet" onClick={stop}>
                  <X size={16} />
                  停止生成
                </Button>
              </div>
            )}
            {generationError && (
              <p className="inline-error" role="alert">
                {generationError}
              </p>
            )}
            {active.ready && !voiceResult && !inlineRequest && <article className="artifact reusable-artifact" aria-label="结构化方案">
              <div className="artifact-source-state"><span>{shownTurn?.legacy || !shownTurn ? "旧讨论 · 当前资料" : `结果记录 · ${new Date(shownTurn.createdAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`}</span>{artifactStale && <Badge tone="pending">历史结果 · 状态已更新</Badge>}<Button variant="quiet" disabled={generating || busy || pending} onClick={() => start(viewKind, shownPrompt)}>更新这份结果</Button></div>
              <nav className="artifact-tabs" aria-label="成果视图">{relatedArtifacts[shownTurn?.kind || active.kind].map((kind) => <button key={kind} aria-pressed={viewKind === kind} className={viewKind === kind ? "active" : ""} onClick={() => setArtifactView(kind)}>{artifactLabels[kind]}</button>)}</nav>
              <WorkbenchArtifact key={`${shownTurn?.id || "legacy"}:${viewKind}`} kind={viewKind} data={artifactData} disabled={artifactStale || busy || pending || !!proposal} onPropose={(title) => void propose(title)} onOpenPlan={() => changeView("plan")}/>
            </article>}
            {(active.ready||voiceResult)&&<button className="context-task-link" onClick={()=>changeView('task')}><span>当前任务</span><strong>{recommendation.title}</strong><span aria-hidden="true">↗</span></button>}
          </div>
          <div className="discussion-dock">
            <div className="discussion-context" aria-label="当前条件"><span><FileText size={20} aria-hidden="true"/>已有条件</span>{conditions.length ? conditions.map(entry => <p key={entry.id}>{entry.text}{entry.node.status !== "confirmed" && <small> · 待核对</small>}</p>) : <p>还没有填写可投入的时间或其他限制。</p>}</div>

          {proposal && !mobileReview && (
            <div ref={proposalRef} tabIndex={-1} id="workbench-plan-change" className="plan-proposal" aria-live="polite" aria-label="计划变化预览">
              <Badge tone="pending">{polished ? "变更预览" : "待采纳"}</Badge>
              <h3>{proposal.title}</h3>
              <PlanReviewStatus stale={proposalStale} refreshing={!!refreshingProposal}/>
              {reviewRows}
              <div className="row">
                <Button disabled={busy || pending || proposalStale} onClick={() => void applyProposal()}>{polished ? "应用到计划" : "加入计划"}</Button>
                <Button variant="quiet" disabled={busy || pending} onClick={() => void cancelProposal()}>取消</Button>
              </div>
            </div>
          )}
          {polished && changedIds.length > 0 && <p className="plan-update-status" role="status"><Check size={14} />计划已更新</p>}
          {undo && (
            <Button
              variant="quiet"
              disabled={busy || pending}
              onClick={async () => {
                if (
                  await run({
                    type: "undoPlan",
                    proposalId: undo.id,
                    baseVersion: undo.baseVersion,
                    items: undo.items,
                  })
                )
                  { rememberUndo(null); setChangedIds([]); }
              }}
            >
              <Undo2 size={16} />
              撤销计划修改
            </Button>
          )}
            <WorkbenchVoice conversations={conversations} currentConversationId={current} onChooseConversation={chooseConversation} onNewConversation={newConversation} hasResult={!!(active.ready || voiceResult || inlineRequest)} key={`${role}:${current}:${mainView}`}
              role={role}
              onResult={(scene) => { recordPresentation({id:crypto.randomUUID(),createdAt:new Date().toISOString(),prompt:scene.prompt,type:"voice",scene}); setSelectedTurnId(null); }}
              value={active.input}
              onChange={(input) => update({ input })}
              onSubmit={() => start()}
              disabled={generating || busy || pending}
            />
          </div>
        </section>

      </div>
      {reviewedProposal && mobileReview && <MobilePlanReview returnFocus={proposalTriggerRef.current} title={reviewedProposal.title} onCancel={cancelProposal} footer={<>
        <Button variant="secondary" disabled={busy || pending || !!refreshingProposal} onClick={() => void cancelProposal()}>取消</Button>
        <Button disabled={busy || pending || proposalStale || !!refreshingProposal} onClick={() => void applyProposal()}>应用更改</Button>
      </>}><PlanReviewStatus stale={proposalStale} refreshing={!!refreshingProposal}/>{proposalStale && <div className="mobile-review-stale" role="alert"><p>计划或依据已变化，请更新预览后再应用。</p><Button variant="secondary" disabled={busy || pending} onClick={() => void refreshProposal()}>更新预览</Button></div>}{reviewError && !proposalStale && <p role="alert">{error || reviewError}</p>}<MobilePlanChangeList rows={planDifferences(workspace.plan.items, reviewedProposal.items)}/></MobilePlanReview>}
      {showOverview && <ProfileOverview onClose={() => { setShowOverview(false); if(role === "emma") writeView(snapshot.runtimeProfile,role,"initial-overview-shown",true); const reportReturn = overviewReturn(role, location.state?.reportReturn); if (reportReturn) { nav(reportReturn, { replace: true, state: role === "john" ? {showReview:true} : undefined }); return; } const params = new URLSearchParams(location.search); params.delete("overview"); params.delete("reopen"); nav({pathname:location.pathname, search:params.toString(), hash:location.hash}, { replace: true }); }} />}
    </div>
  );
}

function WorkbenchPlan({items}:{items:PlanItem[]}) { return items.length ? <ol className="wb-plan-list">{items.map(item => <li key={item.id}><span className={`wb-plan-status ${item.status}`}>{({planned:'待开始',in_progress:'进行中',completed:'已完成'})[item.status]}</span><strong>{item.title}</strong>{item.dueAt && <time>{new Date(item.dueAt).toLocaleDateString('zh-CN')}</time>}</li>)}</ol> : <Empty>还没有安排任务</Empty>; }
