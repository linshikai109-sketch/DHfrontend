import { VoiceAura } from "./VoiceAura";
import { createPortal } from 'react-dom';
import { useEmmaMobileOrb } from './EmmaMobileOnboarding';
import { VoiceVisual } from './VoiceVisual';
import { useEffect, useRef, useState } from 'react';
import { AudioLines, Keyboard, Square, X, ArrowUp } from 'lucide-react';
import { Button } from './ui';
import { flushSync } from 'react-dom';
import { EmmaInlineVoice } from './EmmaInlineVoice';
import './simulated-voice-glow.css';
import './onboarding-voice.css';
import './voice-first-hint.css';
import { useReducedVoiceMotion } from './VoiceEffects';
import { createVoiceDemo } from '../domain/voice-demo';
import type { VoiceState } from '../domain/voice-session';
export function EmmaDemoVoice({value,onChange,onSubmit,disabled=false,label='说说你的想法',inline=true,variant='default',sample}:{value:string;onChange:(value:string)=>void;onSubmit?:()=>void;disabled?:boolean;label?:string;inline?:boolean;variant?:"default"|"studio";sample?:string}) {
 const [status,setStatus]=useState<VoiceState>('idle'),[interim,setInterim]=useState(''),[recognized,setRecognized]=useState(false),[draft,setDraft]=useState<string|null>(null),[textMode,setTextMode]=useState(!!value);
 const reduced=useReducedVoiceMotion();
 const submit=useRef(onSubmit);submit.current=onSubmit;
 const demo=useRef<ReturnType<typeof createVoiceDemo>|null>(null);
 if(!demo.current)demo.current=createVoiceDemo({state:setStatus,interim:setInterim,result:text=>{setRecognized(true);setDraft(text);setTextMode(true);}},sample);
 useEffect(()=>{const leave=()=>{demo.current?.cancel();setDraft(null);setRecognized(false);};const hide=()=>{if(document.hidden)leave();};document.addEventListener('visibilitychange',hide);window.addEventListener('pagehide',leave);return()=>{document.removeEventListener('visibilitychange',hide);window.removeEventListener('pagehide',leave);demo.current?.dispose();};},[]);
 useEffect(()=>{if(disabled)demo.current?.cancel();},[disabled]);
 const displayed=draft??value;
 function confirm(){flushSync(()=>{if(draft!==null)onChange(draft);setDraft(null);});submit.current?.();}
 const begin=()=>{setRecognized(false);demo.current?.begin(displayed);};
 const stop=()=>demo.current?.stop();
 const abort=()=>{const original=demo.current?.cancel();if(original!==undefined)setDraft(original);setRecognized(false);};
 if(!inline)return <div className={`composer-wrap simulated-voice-composer ${variant==='studio'?'studio-composer':''}`} data-voice-state={status} data-text-open={textMode} data-reduced-motion={reduced}>
  <VoiceAura state={status==='listening'?'listening':status==='transcribing'?'thinking':'idle'}/>
  <div className={`voice-composer ${status==='listening'?'listening':''}`}>
   <button type="button" className="voice-orb" aria-label={status==='idle'?'开始语音':'结束语音'} disabled={disabled||status==='transcribing'} onClick={status==='idle'?begin:stop}>
    {variant==='studio'?<span className="voice-core" aria-hidden="true"><span className="voice-core-light"/><span className="voice-core-wave"><i/><i/><i/><i/><i/></span>{status==='listening'&&<Square size={14} className="voice-stop"/>}</span>:status==='listening'?<Square size={18}/>:<AudioLines size={24}/>}
   </button>
   <span className="voice-label" aria-live="polite">{status==='listening'?'正在聆听':status==='transcribing'?'正在转成文字':label}</span>
   {status!=='idle'?<Button variant="quiet" aria-label="取消录音" onClick={abort}><X size={20}/></Button>:<Button variant="quiet" aria-label="文字输入" aria-expanded={textMode} onClick={()=>setTextMode(!textMode)}><Keyboard size={22}/></Button>}
  </div>
  {interim&&<p className="interim" aria-live="polite">{interim}</p>}
  {recognized&&status==='idle'&&<p className="muted" role="status">已识别为文字，请检查或编辑后再提交。</p>}
  {textMode&&status==='idle'&&<div className="text-composer"><textarea aria-label="输入内容" rows={variant==='studio'?2:3} value={displayed} disabled={disabled} onChange={e=>setDraft(e.target.value)}/><Button aria-label={onSubmit?'确认并提交文字':'确认输入'} disabled={disabled||!displayed.trim()} onClick={confirm}><ArrowUp size={20}/></Button></div>}
 </div>;
 return <EmmaInlineVoice value={displayed} onChange={setDraft} onSubmit={confirm} confirmLabel={onSubmit?"确认并提交文字":"确认输入"} disabled={disabled} label={label} status={status} error="" interim={interim} recognized={recognized} stream={null} streamNotice="" reduced={reduced} demo level={()=>demo.current?.level()??0} begin={()=>{setRecognized(false);demo.current?.begin(displayed);}} stop={()=>demo.current?.stop()} abort={()=>{const original=demo.current?.cancel();if(original!==undefined)setDraft(original);setRecognized(false);}}/>;
}


/** A question-bound voice surface: completed text is staged, never auto-submitted. */
export function OnboardingVoice({role,editable=true,value,staged,onEnterText,paused=false,onChange,onStage,onActive,sample,disabled=false,label='说说你的想法'}:{role:'emma'|'john';editable?:boolean;value:string;staged:string|null;onEnterText:()=>void;paused?:boolean;onChange:(text:string)=>void;onStage:(text:string|null)=>void;onActive:(active:boolean)=>void;sample:string;disabled?:boolean;label?:string}) {
 const mobileOrb = useEmmaMobileOrb();
 const [status,setStatus]=useState<VoiceState>('idle');
 const [interim,setInterim]=useState('');
 const [hasStarted,setHasStarted]=useState(false);

 const [textMode,setTextMode]=useState(!!value);

 const callbacks=useRef({onStage,onActive,paused});callbacks.current={onStage,onActive,paused};
 const controller=useRef<ReturnType<typeof createVoiceDemo>|null>(null);
 useEffect(()=>{
  const session=createVoiceDemo({state:state=>{setStatus(state);callbacks.current.onActive(state!=='idle');},interim:setInterim,result:text=>{if(!callbacks.current.paused)callbacks.current.onStage(text);}},sample);
  controller.current=session;
  const cancel=()=>{session.cancel();setInterim('');};
  const hide=()=>{if(document.hidden)cancel();};
  document.addEventListener('visibilitychange',hide);window.addEventListener('pagehide',cancel);
  return()=>{session.dispose();controller.current=null;document.removeEventListener('visibilitychange',hide);window.removeEventListener('pagehide',cancel);};
 },[sample]);
 useEffect(()=>{if(disabled||paused)controller.current?.cancel();},[disabled,paused]);
 const live=status!=='idle';
 const cancel=()=>{controller.current?.cancel();};
 const orbControl=<button type="button" className="voice-visual-trigger" disabled={disabled||paused||mobileOrb?.preparing||status==='transcribing'||!sample} aria-label={status==='listening'?'停止语音':status==='transcribing'?'正在整理语音':'开始语音'} onClick={()=>{if(status==='listening')controller.current?.stop();else {setHasStarted(true);setTextMode(false);controller.current?.begin(staged??value);}}}><VoiceVisual role={role} state={status==='transcribing'?'thinking':status==='listening'?'listening':'idle'} paused={!!mobileOrb?.preparing||paused||(!live&&(textMode||staged!==null))}/>{mobileOrb&&<span className="voice-orb-hint" role="status">{status==='listening'?'正在聆听 · 点击停止':status==='transcribing'?'正在整理':hasStarted?'点击继续说话':'点击开始说话'}</span>}</button>;
 return <section className="onboarding-answer-voice" data-voice-state={status} data-role={role} data-text-open={textMode||(editable&&staged!==null)} aria-label={label} onKeyDown={e=>{if(e.key==='Escape'&&live){e.preventDefault();cancel();}}}>
  <div className="onboarding-voice-controls">
   {!mobileOrb&&<VoiceAura screenEdge={role==='emma'} state={status==='listening'?'listening':status==='transcribing'?'thinking':'idle'}/>}
   {mobileOrb ? (mobileOrb.anchor ? createPortal(orbControl,mobileOrb.anchor) : null) : orbControl}
   {!mobileOrb&&<span role="status">{status==='listening'?'正在聆听':status==='transcribing'?'正在整理':label}</span>}
   {mobileOrb&&live&&<Button variant="quiet" disabled={status==='transcribing'} onClick={()=>controller.current?.stop()}><Square size={16}/>停止</Button>}
   {live&&!mobileOrb?<Button variant="quiet" aria-label="取消语音" onClick={cancel}><X size={20}/></Button>:<Button variant="quiet" aria-label="文字输入" aria-expanded={textMode} disabled={disabled||paused} onClick={()=>{if(live)cancel();if(!textMode)onEnterText();setTextMode(!textMode);}}><Keyboard size={20}/>{mobileOrb&&'文字输入'}</Button>}
  </div>
  {interim&&live&&!textMode&&<p className="onboarding-subtitle" aria-label="回答内容" aria-live="polite">{interim}</p>}
  {!editable&&staged!==null&&staged!==sample&&!live&&!textMode&&<p className="onboarding-subtitle" aria-label="回答内容">{staged}</p>}
  {(textMode||(editable&&staged!==null))&&!live&&<textarea aria-label="输入内容" rows={3} value={editable?(staged??value):value} disabled={disabled} onChange={e=>{if(editable&&staged!==null)callbacks.current.onStage(e.target.value);else onChange(e.target.value);}}/>}
  {mobileOrb&&<VoiceAura screenEdge state={status==='listening'?'listening':status==='transcribing'?'thinking':'idle'}/>}
 </section>;
}
