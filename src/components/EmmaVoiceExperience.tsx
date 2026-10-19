import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AudioLines, CheckCircle2, LoaderCircle, Keyboard, Square, X } from "lucide-react";
import { VoiceGlowBoundary, ProcessingGlow, voicePresentationPhase } from "./VoiceEffects";
import { VoiceBeam } from "voice-glow";
import { Button } from "./ui";
import type { VoiceState } from "../domain/voice-session";
import "./emma-voice-experience.css";

export function EmmaVoiceExperience({value,onChange,onSubmit,disabled,status,error,interim,sound,recognized,stream,streamNotice,reduced,begin,stop,abort}: {
 value:string;onChange:(v:string)=>void;onSubmit?:()=>void;disabled:boolean;
 stream:MediaStream|null;streamNotice:string;reduced:boolean;
 status:VoiceState;error:string;interim:string;sound:boolean;recognized:boolean;
 begin:()=>void;stop:()=>void;abort:()=>void;
}) {
 const [open,setOpen]=useState(false),[textMode,setTextMode]=useState(false);
 const screen=useRef<HTMLDivElement>(null);
 const close=()=>{if(status!=="idle")abort();setOpen(false);};
 const currentClose=useRef(close);currentClose.current=close;
 useEffect(()=>{
  if(!open)return;
  const previous=document.activeElement as HTMLElement|null;
  const overflow=document.body.style.overflow;document.body.style.overflow="hidden";
  screen.current?.querySelector<HTMLButtonElement>("button")?.focus();
  const key=(e:KeyboardEvent)=>{
   if(e.key==="Escape"){e.preventDefault();currentClose.current();}
   if(e.key==="Tab"){
    const nodes=[...screen.current?.querySelectorAll<HTMLElement>("button:not(:disabled),textarea:not(:disabled)")??[]];
    const first=nodes[0],last=nodes.at(-1);if(!first)return;
    if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
   }
  };document.addEventListener("keydown",key);
  return ()=>{document.body.style.overflow=overflow;document.removeEventListener("keydown",key);previous?.focus();};
 },[open]);
 const editing=textMode||recognized||!!error;
 const live=status!=="idle";
 const phase=voicePresentationPhase(status,recognized,value,error);
 const complete=phase==="complete";
 return <div className="emma-voice-entry" data-voice-state={status}>
  <AudioLines size={34} aria-hidden="true"/>
  <h2>用语音说说你的想法</h2>
  <p>打开白底语音输入，识别后检查文字，再确认提交。</p>
  <div className="row">
   <Button disabled={disabled} onClick={()=>{setTextMode(false);setOpen(true);}}>打开语音输入</Button>
   <Button variant="quiet" disabled={disabled} onClick={()=>{setTextMode(true);setOpen(true);}}><Keyboard size={17}/>改用文字</Button>
  </div>
  {value&&<p className="emma-voice-saved">已保留：{value}</p>}
  <small>语音由浏览器识别服务处理，可能发送至服务提供方。</small>
  {open&&createPortal(<div className="emma-voice-screen" data-reduced-motion={reduced} data-voice-phase={phase}>
   {reduced?<div className="emma-voice-static-band" aria-hidden="true"/>:<VoiceGlowBoundary>
   <VoiceBeam
   className="emma-voice-beam" style={{position:"absolute",left:0,bottom:0,width:"100%",height:280,pointerEvents:"none",borderRadius:0}}
   type="mobile" theme="light" colorVariant="colorful" strength={1}
   active stream={stream??undefined} level={0} idle={0.23}
  ><div className="emma-voice-beam-stage" aria-hidden="true"/></VoiceBeam></VoiceGlowBoundary>}
   <ProcessingGlow status={status} reduced={reduced}/>
  <div ref={screen} className="emma-voice-screen-content" role="dialog" aria-modal="true" aria-labelledby="emma-voice-title" data-voice-state={status}>
   <header><span>Emma · 语音输入</span><Button variant="quiet" aria-label="关闭语音输入" onClick={close}><X size={24}/></Button></header>
   <main className="emma-voice-main">
    <span className="emma-voice-phase-icon" data-phase={phase} key={phase} aria-hidden="true">{complete?<CheckCircle2 size={56}/>:status==="transcribing"?<LoaderCircle size={56}/>:<AudioLines size={56}/>}</span>
    <p className="eyebrow">{status==="listening"?"浏览器正在识别":status==="starting"?"等待浏览器权限":status==="transcribing"?"等待最终识别文字":complete?"转写已完成 · 由你确认后提交":"由你确认后提交"}</p>
    <h1 id="emma-voice-title">{status==="listening"?"正在聆听":status==="starting"?"正在启动语音":status==="transcribing"?"正在整理识别文字":complete?"文字已准备好":editing?"检查你的文字":"说说你的想法"}</h1>
    <p className="emma-voice-instruction">{status==="transcribing"?"正在等待最终文字，收到后可检查和编辑。":status==="starting"?"请允许浏览器使用麦克风，或取消后改用文字。":status==="listening"?(stream||reduced?"麦克风已开启，说完后停止并检查文字。":"浏览器正在识别，可随时取消本次输入。"):complete?"检查内容后确认，文字不会自动提交。":"开始后再说话，也可以直接使用文字输入。"}</p>
    {live&&<section className="emma-live-transcript" aria-label="实时语音字幕" aria-live="polite" aria-atomic="false">
     {recognized&&value.trim()&&<div className="emma-transcript-final"><span>已识别</span><p>{value}</p></div>}
     {interim?<div className="emma-transcript-interim"><span>正在识别 · 文字可能调整</span><p>{interim}</p></div>:!recognized&&<p className="emma-transcript-placeholder">{status==="transcribing"?"等待识别结果，不会自动提交。":"开始说话后，识别文字会显示在这里。"}</p>}
    </section>}
    {editing&&!live&&<div className="emma-voice-editor"><label htmlFor="emma-voice-text">{recognized?"已识别文字 · 可编辑":"输入内容"}</label><textarea id="emma-voice-text" value={value} rows={4} disabled={live||disabled} onChange={e=>onChange(e.target.value)}/></div>}
    {live&&!stream&&streamNotice&&<p className="emma-voice-instruction" role="status">{streamNotice}</p>}
    {error&&<p className="inline-error" role="alert">{error}</p>}
    <div className="emma-voice-controls">
     {status==="listening"?<Button onClick={stop}><Square size={18}/>停止并检查文字</Button>:<Button disabled={disabled||live} onClick={()=>{setTextMode(false);begin();}}><AudioLines size={20}/>{recognized?"再说一段":"开始语音"}</Button>}
     {live?<Button variant="quiet" onClick={()=>{abort();setTextMode(false);}}>取消本次识别</Button>:<Button variant="quiet" onClick={()=>setTextMode(true)}><Keyboard size={18}/>改用文字</Button>}
     {editing&&!live&&<Button disabled={disabled||live||!value.trim()} onClick={()=>{setOpen(false);onSubmit?.();}}>{onSubmit?"确认并提交文字":"保留文字并返回"}</Button>}
    </div>
   </main>
   <footer>浏览器可能使用远端语音识别服务。不支持或识别失败时，可改用文字。</footer>
  </div></div>,document.body)}
 </div>;
}
