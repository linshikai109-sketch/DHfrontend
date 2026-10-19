import { confirmationOverview } from "../domain/overview-navigation";
import { UpworkSource } from "../components/UpworkSource";
import { fixtureViewVersion } from "../domain/view-state";
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router";
import { ArrowLeft, Check, ChevronDown, Maximize2, X } from "lucide-react";
import { useProduct } from "../product";
import { readView, writeView } from "../domain/view-state";
import { questions } from "../domain/questions";
import { onboardingMaterialContext } from "../domain/onboarding-materials";
import { johnAcquisitionLayout } from "../domain/john-acquisition-layout";
import "../john-acquisition-layout.css";
import { pictureToken, stopRequested } from "../domain/profile-picture";
import { nextGoalIndex } from "../domain/interview";
import { ContextCanvas } from "../components/ContextCanvas";
import { ExternalMaterials, useExternalMaterials } from "../components/ExternalMaterials";
import "../components/onboarding-materials-v12.css";
import "../components/onboarding-input-boundaries.css";
import { johnSelfMembership, johnAnswerLinks, missingMembershipPrompt, needsMembershipQuestion, isMembershipQuestion, membershipQuestionId } from "../domain/john-onboarding";
import { materialStatus, type MaterialOwner } from "../domain/external-materials";
import { OnboardingVoice } from "../components/EmmaDemoVoice";
import { onboardingVoiceScript, onboardingTextDraft, onboardingVoicePaused } from "../domain/onboarding-voice";
import { Badge, Button } from "../components/ui";
import { PathPreview } from "./PersonalPath";
const needsFollowup = (value: string) => value.trim().length < 18 || /不确定|不知道|还没想好/.test(value);
const hasFollowup = (id: string, value: string) => id !== "j-scope" || value.includes("具体项目");
const splitChoiceAnswer = (value: string) => {
  const separator = value.indexOf("；");
  return separator < 0
    ? { choice: value, supplement: "" }
    : { choice: value.slice(0, separator), supplement: value.slice(separator + 1) };
};
export default function Onboarding() {
  const { workspace, role, snapshot, run, busy, pending } = useProduct();
  const external = useExternalMaterials();
  const nav = useNavigate();
  const location = useLocation();
  const [returnReview, setReturnReview] = useState(location.state?.showReview === true);
  const [params] = useSearchParams();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [linkOwners, setLinkOwners] = useState<Record<string, MaterialOwner>>({});
  const [previewTab, setPreviewTab] = useState<"canvas" | "path">("canvas");
  const pathPanel = useRef<HTMLDivElement>(null);
  const gripStart = useRef<number | null>(null);
  const ac = workspace.acquisition;
  const johnLayout = role === "john" ? johnAcquisitionLayout(workspace.context, external) : null;
  const bank = questions[role];
  const index = Math.min(ac.index, bank.length - 1);
  const anchor = bank[index];
  const answer = ac.answers[anchor.id];
  const materialContext = onboardingMaterialContext(role, anchor.id);
  const follow = editingId
    ? editingId.endsWith(":followup")
    : !!(
        answer &&
        !answer.skipped &&
        anchor.followup &&
        hasFollowup(anchor.id, answer.value) &&
        !ac.answers[anchor.id + ":followup"] &&
        needsFollowup(answer.value)
      );
  const clarify = editingId
    ? editingId.endsWith(":clarify")
    : !!(
        !follow &&
        anchor.kind === "open" &&
        answer &&
        !answer.skipped &&
        answer.value.trim().length < 8 &&
        !ac.answers[anchor.id + ":clarify"]
      );
  const selfMembership = johnSelfMembership(ac.answers, external.membership);
  const membershipQuestion = role === 'john' && ((editingId && isMembershipQuestion(editingId)) || (!editingId && !follow && !clarify && ['j-resources','j-constraints'].includes(anchor.id) && answer && !answer.skipped && needsMembershipQuestion(ac.answers, external.membership)));
  const qid = editingId || (membershipQuestion ? membershipQuestionId(anchor.id, selfMembership) : anchor.id + (follow ? ':followup' : clarify ? ':clarify' : '')); 
  const answerLinks = role === 'john' ? johnAnswerLinks(ac.answers).map(link => ({...link, owner:linkOwners[link.key] || link.owner})) : [];

  const [voiceAnswer, setVoiceAnswer] = useState<{id:string;value:string|null}>({id:"",value:null});
  const [voiceActive,setVoiceActive] = useState(false);
  const stagedAnswer = voiceAnswer.id === `${role}:${qid}` ? voiceAnswer.value : null;
  const title = membershipQuestion ? (missingMembershipPrompt(selfMembership) || '你在这个项目担任什么角色，主要负责哪些工作？') : follow
    ? (role === 'john' && anchor.id === 'j-resources' ? ['团队有哪些人，目前最缺的资源是什么？', missingMembershipPrompt(selfMembership)].filter(Boolean).join('') : anchor.followup!)
    : clarify
      ? "可以说一个具体例子吗？"
      : anchor.title;
  const kind = membershipQuestion || follow || clarify ? "open" : anchor.kind;
  const [storageError, setStorageError] = useState("");
  const cached = (id: string) => {
    const fallback = ac.drafts[id] ?? ac.answers[id]?.value ?? "";
    const v = readView(snapshot.runtimeProfile, role, "answer-" + id, fallback);
    const text = typeof v === "string" ? v : fallback;
    const question = bank.find((item) => item.id === id);
    return question && question.kind !== "open" ? splitChoiceAnswer(text).choice : text;
  };
  const [draft, setDraft] = useState({ id: qid, value: cached(qid) });
  const value = draft.id === qid ? draft.value : cached(qid);
  const cachedSupplement = (id: string) => {
    const fallback = splitChoiceAnswer(ac.answers[id]?.value ?? "").supplement;
    const v = readView(snapshot.runtimeProfile, role, "supplement-" + id, fallback);
    return typeof v === "string" ? v : fallback;
  };
  const [supplement, setSupplement] = useState({ id: qid, value: cachedSupplement(qid) });
  const supplementValue = supplement.id === qid ? supplement.value : cachedSupplement(qid);
  function changeSupplement(v: string) {
    setVoiceAnswer({id:`${role}:${qid}`,value:null});
    setSupplement({ id: qid, value: v });
    setStorageError(writeView(snapshot.runtimeProfile, role, "supplement-" + qid, v)
      ? "" : "草稿没有保存成功，请先复制输入内容，不要关闭页面。");
  }
  function changeValue(v: string) {
    setVoiceAnswer({id:`${role}:${qid}`,value:null});
    setDraft({ id: qid, value: v });
    setStorageError(
      writeView(snapshot.runtimeProfile, role, "answer-" + qid, v)
        ? ""
        : "草稿没有保存成功，请先复制输入内容，不要关闭页面。",
    );
  }
  const [sheet, setSheet] = useState<"closed" | "half" | "full">(
    params.get("canvas") === "full" ? "full" : role === "emma" || window.matchMedia("(max-width: 767px)").matches ? "closed" : "half",
  );
  const [mobileViewport,setMobileViewport]=useState(()=>window.matchMedia('(max-width: 767px)').matches);
  useEffect(()=>{const media=window.matchMedia('(max-width: 767px)');const update=()=>setMobileViewport(media.matches);media.addEventListener('change',update);return()=>media.removeEventListener('change',update);},[]);
  useEffect(() => { if (params.get("canvas") === "full") setSheet("full"); }, [params]);
  const pauseVoice=onboardingVoicePaused(mobileViewport,sheet);
  function enterText(){
    const editable=onboardingTextDraft(kind,value,supplementValue,stagedAnswer);
    changeValue(editable.value);
    setVoiceAnswer({id:`${role}:${qid}`,value:null});
  }
  const boardFingerprint=JSON.stringify([
    ...workspace.context.filter(n=>!n.deleted).map(n=>({id:n.id,title:n.title})),
    ...external.materials.filter(m=>role === "john" || m.owner === "personal").map(m=>({id:`material:${m.id}`,title:JSON.stringify(m)})),
    ...(role === "john" && external.membership ? [{id:`membership:${external.businessId}`,title:JSON.stringify(external.membership)}] : []),
  ]);
  const lastBoard=useRef({role,fingerprint:boardFingerprint});
  const [boardUnread,setBoardUnread]=useState(false);
  const [boardPulse,setBoardPulse]=useState(false);
  useEffect(()=>{
    if(lastBoard.current.role!==role){lastBoard.current={role,fingerprint:boardFingerprint};setBoardUnread(false);setBoardPulse(false);return;}
    if(lastBoard.current.fingerprint===boardFingerprint)return;
    const previous: {id:string;title:string}[]=JSON.parse(lastBoard.current.fingerprint);
    const current: {id:string;title:string}[]=JSON.parse(boardFingerprint);
    const hasNewContent=current.some(node=>!previous.some(old=>old.id===node.id&&old.title===node.title));
    lastBoard.current={role,fingerprint:boardFingerprint};
    if(sheet==='closed'&&hasNewContent){setBoardUnread(true);setBoardPulse(true);} 
  },[role,boardFingerprint,sheet]);
  useEffect(()=>{if(sheet!=='closed'){setBoardUnread(false);setBoardPulse(false);}},[sheet]);
  useEffect(()=>{if(!boardPulse)return;const timer=setTimeout(()=>setBoardPulse(false),4500);return()=>clearTimeout(timer);},[boardPulse,boardFingerprint]);
  useEffect(() => {
    setVoiceActive(false);
    setVoiceAnswer({id:`${role}:${qid}`,value:null});
    setDraft({ id: qid, value: cached(qid) });
    setSupplement({ id: qid, value: cachedSupplement(qid) });
  }, [qid,role]);
  useEffect(() => {
    if (value === (ac.drafts[qid] ?? ac.answers[qid]?.value ?? "")) return;
    const timer = setTimeout(() => {
      void run({ type: "saveDraft", questionId: qid, value });
    }, 650);
    return () => clearTimeout(timer);
  }, [value, qid]);
  const selected = (kind !== "open" && stagedAnswer !== null ? stagedAnswer : value).split("、").filter(Boolean);
  const answered = bank.filter(
    (q) => ac.answers[q.id] && !ac.answers[q.id].skipped,
  ).length;
  const total = bank.length;
  const review = role === "john" && (ac.review || returnReview);
  const showPathPreview = role === "emma" && previewTab === "path";
  useEffect(() => {
    if (!showPathPreview || sheet !== "full") return;
    const previousOverflow = document.body.style.overflow;
    const opener = document.activeElement as HTMLElement | null;
    if (matchMedia("(max-width: 767px)").matches)
      document.body.style.overflow = "hidden";
    pathPanel.current?.querySelector<HTMLElement>("button")?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (document.querySelector("dialog[open]")) return;
      if (event.key === "Escape") {
        event.preventDefault();
        setSheet("half");
      }
      if (event.key === "Tab" && matchMedia("(max-width: 767px)").matches) {
        const controls = Array.from(
          pathPanel.current
            ?.closest(".onboarding-visual")
            ?.querySelectorAll<HTMLElement>(
              'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]',
            ) || [],
        );
        if (!controls.length) return;
        if (event.shiftKey && document.activeElement === controls[0]) {
          event.preventDefault();
          controls.at(-1)?.focus();
        } else if (
          !event.shiftKey &&
          document.activeElement === controls.at(-1)
        ) {
          event.preventDefault();
          controls[0].focus();
        }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      opener?.focus();
    };
  }, [showPathPreview, sheet]);
  async function next(skip = false) {
    const submitted = stagedAnswer ?? (kind === "open" ? value.trim() : [value.trim(), supplementValue.trim()].filter(Boolean).join("；"));
    if (editingId) {
      const result = await run({
        type: "saveAnswer",
        questionId: qid,
        value: skip ? "" : submitted,
        skipped: skip,
        nextIndex: index,
        branch: follow,
        clarification: clarify,
      });
      if (result) {
        setEditingId(null);
        await run({ type: "setAcquisition", review: true });
      }
      return;
    }
    const shouldFollow =
      !skip && !stopRequested(submitted) &&
      !membershipQuestion &&
      !follow &&
      !clarify &&
      !!anchor.followup &&
      hasFollowup(anchor.id, submitted) &&
      !ac.answers[anchor.id + ":followup"] &&
      needsFollowup(submitted);
    const shouldClarify =
      !skip && !stopRequested(submitted) &&
      !membershipQuestion &&
      !follow &&
      !clarify &&
      anchor.kind === "open" &&
      submitted.length < 8 &&
      !ac.answers[anchor.id + ":clarify"];
    const nextAnswers = {...ac.answers, [qid]: {value:skip ? '' : submitted, skipped:skip}};
    const shouldAskMembership = role === 'john' && !skip && !membershipQuestion && !stopRequested(submitted) && ['j-resources','j-constraints'].includes(anchor.id) && needsMembershipQuestion(nextAnswers, external.membership);
    const target = shouldFollow || shouldClarify || shouldAskMembership
      ? index
      : nextGoalIndex(role, { ...ac.answers, [qid]: { skipped: skip, value: submitted } }, submitted) ?? index;
    const result = await run({
      type: "saveAnswer",
      questionId: qid,
      value: skip ? "" : submitted,
      skipped: skip,
      nextIndex: target,
      branch: follow,
      clarification: clarify,
    });
    if (result) {
      const committedSupplement = skip || kind === "open" ? "" : splitChoiceAnswer(submitted).supplement;
      setSupplement({ id: qid, value: committedSupplement });
      writeView(snapshot.runtimeProfile, role, "supplement-" + qid, committedSupplement);
    }
    if (result && role === "emma" && (stopRequested(submitted) || (!shouldFollow && !shouldClarify && nextGoalIndex(role, { ...ac.answers, [qid]: { skipped: skip, value: submitted } }, submitted) === null))) { await complete(result.workspaces.emma); return; }
    if (result && stopRequested(submitted)) { setEditingId(null); return; }
    if (result && nextGoalIndex(role, { ...ac.answers, [qid]: { skipped: skip, value: submitted } }, submitted) === null && !shouldFollow && !shouldClarify && !shouldAskMembership)
      await run({ type: "setAcquisition", review: true });
  }
  async function complete(current = workspace) {
    return await run({type:"completeOnboarding",pictureToken:pictureToken(current)});
  }
  async function finish() {
    const submitted = stagedAnswer ?? (kind === "open" ? value.trim() : [value.trim(),supplementValue.trim()].filter(Boolean).join("；"));
    let current = workspace;
    if (submitted && submitted !== ac.answers[qid]?.value) {
      const saved = await run({type:"saveAnswer",questionId:qid,value:submitted,nextIndex:index});
      if (!saved) return;
      current = saved.workspaces.emma;
    }
    await complete(current);
  }
  useEffect(()=>{
    if(role!=="emma" || !ac.completed || busy || pending || params.get("canvas") === "full") return;
    const shown = readView(snapshot.runtimeProfile,role,"initial-overview-shown",false);
    nav(shown?"/emma/result":"/emma/result?overview=1",{replace:true});
  },[role,ac.completed,busy,pending]);
  async function confirm() {
    if (role === 'john') {
      try { external.confirmOnboarding(selfMembership, answerLinks); setStorageError(''); }
      catch (error) { setStorageError((error as Error).message); return; }
    }
    const limited = answered < total;
    const result = await run({ type: "confirmContext", limited, pictureToken: pictureToken(workspace) });
    if (!result) return;
    const request = confirmationOverview(role, ac.confirmed, {pathname:location.pathname,search:location.search,hash:location.hash});
    nav(request.to, {replace:role === "john", state:request.state});
  }
  return (
    <div className={`onboarding-layout has-${sheet}-sheet`} data-canvas-open={sheet !== "closed"} data-board-unread={boardUnread} data-board-pulse={boardPulse}
      data-john-canvas-state={johnLayout?.state}
      data-john-canvas-content-count={johnLayout?.visibleCount}
      style={johnLayout ? { '--john-acquisition-columns': johnLayout.columns } as import('react').CSSProperties : undefined}>
      <section className="question-panel" aria-label="引导问题">
        <div className="question-content">
          {role === "emma" && <Button className="canvas-toggle" variant="quiet" aria-expanded={sheet !== "closed"} onClick={() => setSheet(sheet === "closed" ? (mobileViewport ? "full" : "half") : "closed")}>{sheet === "closed" ? "资料画板" : "收起画板"}</Button>}
          {role === "john" && fixtureViewVersion() === "upwork-v1" && <UpworkSource/>}
          {review ? (
            <>
              <p className="eyebrow">核对填写的信息</p>
              <h1>请核对你填写的信息</h1>
              <div className="summary-list">
                {bank.flatMap((q, i) =>
                  [
                    q.id,
                    ...[":followup", ":clarify", ":membership", ":membership-role", ":membership-responsibilities"]
                      .map((s) => q.id + s)
                      .filter((id) => ac.answers[id]),
                  ].filter((id) => ac.answers[id]).map((id) => (
                    <button
                      key={id}
                      className="summary-item"
                      disabled={busy || pending}
                      onClick={async () => {
                        const result = await run({
                          type: "setAcquisition",
                          index: i,
                          review: false,
                        });
                        if (result) {
                          setReturnReview(false);
                          setEditingId(id);
                        }
                      }}
                    >
                      <span>
                        {q.topic}
                        {isMembershipQuestion(id) ? " · 我的角色与职责" : id.endsWith(":followup")
                          ? " · 追问"
                          : id.endsWith(":clarify")
                            ? " · 补充"
                            : ""}
                      </span>
                      <strong>{ac.answers[id]?.value || "暂未填写"}</strong>
                    </button>
                  )),
                )}
              </div>
              <section className="summary-list john-materials-review" aria-label="角色与资料统一核对">
                <h2>我的角色与资料</h2>
                <p>以下角色与职责来自你的自述，尚未核实身份。确认后保存到当前企业／项目；可返回修改回答。</p>
                <p>角色：{selfMembership.role || '暂未提供'}<br/>主要负责：{selfMembership.responsibilities || '暂未提供'}</p>
                {answerLinks.map(link => <div className="summary-item" key={link.key}>
                  <strong>{link.name}</strong><a href={link.url} target="_blank" rel="noreferrer">{link.url}</a>
                  <label>请核对资料归属<select aria-label={`资料归属 ${link.url}`} value={link.owner} onChange={e=>setLinkOwners(owners=>({...owners,[link.key]:e.target.value as MaterialOwner}))}><option value="personal">本人资料</option><option value="business">当前企业／项目资料</option></select></label>
                  <small>{external.materials.find(m=>m.url===link.url&&m.owner===link.owner) ? materialStatus[external.materials.find(m=>m.url===link.url&&m.owner===link.owner)!.status] : '确认后关联 · 待读取'}</small>
                </div>)}
                {!!external.materials.length && <div><h3>已关联资料</h3>{external.materials.map(m=><p key={m.id}>{m.name} · {m.owner==='personal'?'本人':'当前企业／项目'} · {materialStatus[m.status]}</p>)}</div>}
                <p>链接可以稍后添加。关联链接不代表已读取、已核实或已获得授权。</p>
              </section>
              {storageError && <p className="inline-error" role="alert">{storageError}</p>}
              {!Object.keys(ac.answers).length && <p className="muted">还没有填写信息，可以返回继续填写。</p>}
              <Button
                disabled={
                  busy || pending
                }
                onClick={confirm}
              >
                确认并查看发展分析
              </Button>
              <Button variant="quiet" disabled={busy || pending} onClick={async () => { const result = await run({ type: "setAcquisition", review: false }); if (result) setReturnReview(false); }}>
                继续填写
              </Button>
            </>
          ) : (
            <>
              <div className="question-progress">
                <span>
                  {anchor.topic}
                </span>
                <Button
                  variant="quiet"
                  disabled={busy || pending || voiceActive}
                  onClick={() => {
                    setEditingId(null);
                    if(role === "emma") void finish();
                    else void run({ type: "setAcquisition", review: true });
                  }}
                >
                  {role === "emma" ? "结束并查看概览" : "核对已填信息"}
                </Button>
              </div>
              {(follow || clarify) && <Badge>{answer?.value}</Badge>}
              <h1>{title}</h1>
              {kind !== "open" && (
                <fieldset className="choices" aria-label={title}>
                  <legend className="sr-only">{title}</legend>
                  {anchor.options?.map((option) => (
                    <label
                      className={`choice ${selected.includes(option) ? "checked" : ""}`}
                      key={option}
                    >
                      <input
                        type={kind === "single" ? "radio" : "checkbox"}
                        name={qid}
                        disabled={busy || pending || voiceActive}
                        checked={selected.includes(option)}
                        onChange={() =>
                          changeValue(
                            kind === "single"
                              ? option
                              : selected.includes(option)
                                ? selected
                                    .filter((x) => x !== option)
                                    .join("、")
                                : [...selected, option].join("、"),
                          )
                        }
                      />
                      <span>{option}</span>
                      {selected.includes(option) && <Check size={18} />}
                    </label>
                  ))}
                </fieldset>
              )}
              <OnboardingVoice
                role={role}
                editable={kind === "open"}
                key={`${role}:${qid}`}
                sample={membershipQuestion ? [!selfMembership.role ? "我是产品负责人" : "", !selfMembership.responsibilities ? "我负责需求与客户访谈" : ""].filter(Boolean).join("，") || "我是产品负责人，我负责需求与客户访谈。" : onboardingVoiceScript(role,qid)}
                staged={stagedAnswer}
                onEnterText={enterText}
                paused={pauseVoice}
                value={kind === "open" ? value : supplementValue}
                onChange={kind === "open" ? changeValue : changeSupplement}
                onStage={text=>setVoiceAnswer({id:`${role}:${qid}`,value:text})}
                onActive={setVoiceActive}
                disabled={busy || pending}
                label="说说你的想法"
              />
              {materialContext.personal && (
                <details className="onboarding-materials-entry" key={`materials-${anchor.id}`}>
                  <summary>外部资料 · 添加链接</summary>
                  <ExternalMaterials owner="personal" compact />
                  <Button variant="quiet" onClick={event => { event.currentTarget.closest("details")?.removeAttribute("open"); }}>稍后添加</Button>
                </details>
              )}
              {membershipQuestion && <p className="muted">只需补充缺少的部分，例如“我是项目负责人，我负责产品和客户访谈”。也可以跳过。</p>}
              {role === 'john' && (materialContext.business || materialContext.membership) && <p className="muted">
                {materialContext.business ? '可在这次回答中附上产品介绍或验证材料链接，也可以稍后添加。' : '可在回答中附上你的主页或作品链接，也可以稍后添加。'}资料归属将在最后一起核对。
              </p>}
              {storageError && (
                <p className="inline-error" role="alert">
                  {storageError}
                </p>
              )}
              <div className="question-actions">
                <Button disabled={voiceActive || busy || pending || !(stagedAnswer?.trim() || value.trim() || supplementValue.trim())} onClick={()=>next()}>继续</Button>
                <Button
                  variant="quiet"
                  disabled={busy || pending}
                  onClick={() => next(true)}
                >
                  跳过这题
                </Button>
                {index > 0 && (
                  <Button
                    variant="quiet"
                    disabled={busy || pending || voiceActive}
                    onClick={async () => {
                      const result = await run({
                        type: "setAcquisition",
                        index: index - 1,
                        review: false,
                      });
                      if (result) setEditingId(null);
                    }}
                  >
                    <ArrowLeft size={16} />
                    上一题
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </section>
      {role === "emma" ? (
        <div
          className={`onboarding-visual preview-${previewTab} preview-sheet-${sheet}`}
        >
          <div
            className="path-preview-switch"
            role="group"
            aria-label="资料与计划视图"
          >
            <button
              aria-pressed={previewTab === "canvas"}
              onClick={() => setPreviewTab("canvas")}
            >
              我的画板
            </button>
            <button
              aria-pressed={previewTab === "path"}
              onClick={() => setPreviewTab("path")}
            >
              我的路径
            </button>
          </div>
          {showPathPreview ? (
            <>
              <div
                ref={pathPanel}
                className={`context-panel onboarding-path-panel sheet-${sheet}`}
                aria-label="个人路径预览"
              >
                <div
                  className="sheet-grip"
                  onPointerDown={(event) => {
                    gripStart.current = event.clientY;
                    event.currentTarget.setPointerCapture(event.pointerId);
                  }}
                  onPointerUp={(event) => {
                    const delta =
                      event.clientY - (gripStart.current ?? event.clientY);
                    gripStart.current = null;
                    if (delta < -35) setSheet("full");
                    if (delta > 35)
                      setSheet(sheet === "full" ? "half" : "closed");
                  }}
                />
                <header className="canvas-heading">
                  <h2>我的路径</h2>
                  <div className="row">
                    <Button
                      variant="quiet"
                      aria-label={sheet === "full" ? "半展开路径" : "展开路径"}
                      onClick={() =>
                        setSheet(sheet === "full" ? "half" : "full")
                      }
                    >
                      {sheet === "full" ? (
                        <ChevronDown size={20} />
                      ) : (
                        <Maximize2 size={20} />
                      )}
                    </Button>
                    <Button
                      className="mobile-only"
                      variant="quiet"
                      aria-label="收起路径"
                      onClick={() => setSheet("closed")}
                    >
                      <X size={20} />
                    </Button>
                  </div>
                </header>
                <div className="canvas-viewport">
                  <PathPreview />
                </div>
              </div>
              {sheet === "closed" && (
                <button
                  className="canvas-tray"
                  onClick={() => setSheet("half")}
                >
                  我的路径
                  <ChevronDown size={18} />
                </button>
              )}
            </>
          ) : (
            <ContextCanvas sheet={sheet} setSheet={setSheet} />
          )}
        </div>
      ) : (
        <ContextCanvas sheet={sheet} setSheet={setSheet} />
      )}
    </div>
  );
}
