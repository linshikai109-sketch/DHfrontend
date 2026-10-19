import { VoiceAura } from "./VoiceAura";
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { Dialog } from './ui';
import { flushSync } from 'react-dom';
import { ArrowUp, Keyboard, X, Grid2X2, Plus, Map, Layers, MessageSquare } from 'lucide-react';
import { createIntentBag, workbenchScene, type VoiceScene } from '../domain/workbench-voice';
import { createWorkbenchVoiceSession, type WorkbenchVoicePhase } from '../domain/workbench-voice-session';
import { VoiceVisual } from './VoiceVisual';
import './workbench-voice.css';
import './workbench-input-boundaries.css';
import './voice-first-hint.css';

export function WorkbenchVoice({role,value,onChange,onSubmit,onResult,disabled,hasResult=false,conversations=[],currentConversationId,onChooseConversation,onNewConversation}:{role:'emma'|'john';value:string;onChange:(value:string)=>void;onSubmit:()=>void;onResult:(scene:VoiceScene)=>void;disabled:boolean;hasResult?:boolean;conversations?:{id:string;title:string}[];currentConversationId?:string;onChooseConversation?:(id:string)=>void;onNewConversation?:()=>void}) {
 const navigate=useNavigate();
 const [panel,setPanel]=useState(false);
 const [showHistory,setShowHistory]=useState(false);
 const openPanel=()=>{
  // Keep any in-progress words as an editable draft before cancelling timers.
  if((phase==='listening'||phase==='staged'||phase==='processing')&&transcript){onChange(transcript);setTyping(true);}
  session.current?.cancel();setShowHistory(false);setPanel(true);
 };
 const [phase,setPhase]=useState<WorkbenchVoicePhase>('idle');
 const [transcript,setTranscript]=useState('');
 const [typing,setTyping]=useState(false);
 const [hasStarted,setHasStarted]=useState(false);
 const [expandedCaption,setExpandedCaption]=useState(false);
 const orbRef=useRef<HTMLButtonElement>(null);
 const previousOrb=useRef<DOMRect|null>(null);
 useLayoutEffect(()=>{
  const el=orbRef.current;if(!el)return;
  const rect=el.getBoundingClientRect(),before=previousOrb.current;
  if(before&&hasResult&&!matchMedia('(prefers-reduced-motion: reduce)').matches&&before.width>rect.width*1.5){
   el.animate([{transform:`translate(${before.x-rect.x}px,${before.y-rect.y}px) scale(${before.width/rect.width})`},{transform:'none'}],{duration:500,easing:'cubic-bezier(.22,1,.36,1)'});
  }
  previousOrb.current=rect;
 },[hasResult]);
 const bag=useRef(createIntentBag());
 const callbacks=useRef({onChange,onSubmit,onResult});
 callbacks.current={onChange,onSubmit,onResult};
 const session=useRef<ReturnType<typeof createWorkbenchVoiceSession>|null>(null);
 useEffect(()=>{
  const current=createWorkbenchVoiceSession({
   phase:setPhase,transcript:setTranscript,
   submit:(text,scene)=>{
    previousOrb.current=orbRef.current?.getBoundingClientRect()??null;
    if(scene) callbacks.current.onResult(scene);
    else {
     flushSync(()=>callbacks.current.onChange(text));
     callbacks.current.onSubmit();
    }
   },
  },{autoSend:true});
  setTranscript('');setPhase('idle');setTyping(false);
  session.current=current;
  const hide=()=>{if(document.hidden)current.cancel();};
  document.addEventListener('visibilitychange',hide);
  return()=>{current.dispose();session.current=null;document.removeEventListener('visibilitychange',hide);};
 },[role,currentConversationId]);
 useEffect(()=>{if(disabled)session.current?.cancel(true);},[disabled]);
 const live=phase==='listening'||phase==='processing';
 const staged=phase==='staged';
 const visualState=disabled||phase==='processing'?'thinking':phase==='listening'?'listening':phase==='responding'?'responding':'idle';
 function begin(){if(disabled)return;setHasStarted(true);setTyping(false);setExpandedCaption(false);session.current?.begin(workbenchScene(role,bag.current.next()));}
 return <div className="wb-voice" data-role={role} data-compact={hasResult} data-state={phase} data-text-open={typing||staged}>
  <div className="wb-voice-row">
   {role==='emma'&&<VoiceAura state={visualState} screenEdge/>}
   {role==='emma'&&<button type="button" className="emma-functions-trigger" aria-label="打开功能面板" aria-haspopup="dialog" aria-expanded={panel} onClick={openPanel}><Grid2X2 size={21}/></button>}
   <button type="button" ref={orbRef} className="voice-visual-trigger" aria-label={phase==='listening'?'停止语音':phase==='processing'?'取消语音':'开始语音'} disabled={disabled||staged} onClick={()=>phase==='listening'?session.current?.stop():phase==='processing'?session.current?.cancel(true):begin()}>
    <VoiceVisual role={role} state={visualState}/>

   </button>
   <span role="status"><span className="voice-desktop-status">{disabled||phase==='processing'?'正在整理':phase==='listening'?'正在聆听':staged?'修改内容':'说说你的想法'}</span><span className="voice-mobile-status">{disabled||phase==='processing'?'正在整理':phase==='listening'?'正在聆听 · 点击停止':staged?'修改内容':typing?'文字输入':phase==='responding'?'正在回应':hasStarted?'点击继续说话':'点击开始说话'}</span></span>
   {live||staged?<button type="button" aria-label="取消语音" onClick={()=>session.current?.cancel(true)}><X size={20}/></button>:<button type="button" aria-label="文字输入" aria-expanded={typing} onClick={()=>setTyping(!typing)}><Keyboard size={21}/></button>}
  </div>
  <button type="button" className="voice-mobile-text-alternative" aria-label="文字输入" aria-expanded={typing||staged} disabled={disabled} onClick={()=>{if(live||staged){if(transcript)onChange(transcript);session.current?.cancel(true);setTyping(true);}else setTyping(!typing);}}><Keyboard size={18}/>{typing?'收起文字输入':'文字输入'}</button>
  {transcript&&!staged&&!typing&&<div className="wb-caption" data-expanded={expandedCaption}>
   <button className="wb-caption-text" aria-label="修改语音文字" disabled={phase==='listening'||disabled} onClick={()=>session.current?.edit(transcript)}><span className="wb-caption-copy">{transcript}</span></button>
   {transcript.length>42&&<button className="wb-caption-expand" onClick={()=>setExpandedCaption(!expandedCaption)}>{expandedCaption?'收起':'展开'}</button>}
  </div>}
  {staged&&<form className="wb-text wb-voice-draft" onSubmit={event=>{event.preventDefault();session.current?.send();}}>
   <textarea aria-label="语音内容" value={transcript} onChange={event=>session.current?.edit(event.target.value)} rows={3}/>
   <button className="wb-send" aria-label="重新生成" disabled={disabled||!transcript.trim()}><ArrowUp size={19}/></button>
  </form>}
  {typing&&!live&&!staged&&<form className="wb-text" onSubmit={event=>{event.preventDefault();if(!disabled&&value.trim())onSubmit();}}><textarea disabled={disabled} aria-label="输入内容" placeholder="输入你的想法" value={value} onChange={event=>onChange(event.target.value)} rows={2}/><button className="wb-send" aria-label="发送" disabled={disabled||!value.trim()}><ArrowUp size={19}/></button></form>}
  {role==='john'&&<VoiceAura state={visualState}/>}
  {panel&&<Dialog title="我的空间" onClose={()=>setPanel(false)}>
   <div className="emma-function-panel">
    <div className="emma-function-grid">
     <button onClick={()=>{setPanel(false);navigate('/emma/path');}}><Map size={22}/><span>我的路径</span></button>
     <button onClick={()=>{setPanel(false);navigate('/emma/quest');}}><Layers size={22}/><span>Quest</span></button>
     <button aria-expanded={showHistory} onClick={()=>setShowHistory(!showHistory)}><MessageSquare size={22}/><span>历史会话</span></button>
     <button disabled={!onNewConversation||disabled} onClick={()=>{setPanel(false);onNewConversation?.();}}><Plus size={22}/><span>新对话</span></button>
    </div>
    {showHistory&&<div className="emma-panel-history" aria-label="历史会话">
     {conversations.length?conversations.map(conversation=><button key={conversation.id} aria-current={conversation.id===currentConversationId?'true':undefined} onClick={()=>{setPanel(false);onChooseConversation?.(conversation.id);}}>{conversation.title}</button>):<p>还没有历史会话</p>}
    </div>}
   </div>
  </Dialog>}
 </div>;
}
export function VoiceSceneResult({scene}:{scene:VoiceScene}){return <article className="wb-scene-result"><h2>{scene.title}</h2><p>{scene.answer}</p>{scene.columns?<div className="wb-scene-table"><table><thead><tr>{scene.columns.map(c=><th key={c}>{c}</th>)}</tr></thead><tbody>{scene.rows.map((row,i)=><tr key={i}>{row.map((cell,j)=>j===0?<th scope="row" key={j}>{cell}</th>:<td key={j}>{cell}</td>)}</tr>)}</tbody></table></div>:scene.id==='statistics'?<div className="wb-bars">{scene.rows.map(([title,value,detail])=><div key={title}><span>{title}</span><div className="wb-bar-track"><i style={{width:`${value}%`}}/></div><strong>{value}%</strong><small>{detail}</small></div>)}</div>:<div className={`wb-scene-items wb-scene-${scene.id}`}>{scene.rows.map((row,i)=><section key={i}>{scene.id==='checklist'&&<span className="wb-check-square" aria-hidden="true"/>}<span className="wb-item-label">{row[0]}</span><strong>{row[1]}</strong>{scene.id==='flow'&&i<scene.rows.length-1&&<span className="wb-flow-arrow" aria-hidden="true">↓</span>}</section>)}</div>}</article>;}
