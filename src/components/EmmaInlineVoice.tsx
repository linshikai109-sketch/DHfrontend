import { useState } from 'react';
import { AudioLines, Keyboard, LoaderCircle, Square } from 'lucide-react';
import { VoiceBeam } from 'voice-glow';
import { ProcessingGlow, VoiceGlowBoundary, voicePresentationPhase } from './VoiceEffects';
import { Button } from './ui';
import type { VoiceState } from '../domain/voice-session';
import './emma-inline-voice.css';

export function EmmaInlineVoice({ value, onChange, onSubmit, disabled, label, status, error, interim, recognized, stream, streamNotice, reduced, demo=false, level=0, confirmLabel="确认并提交文字", begin, stop, abort }: {
 value:string;onChange:(value:string)=>void;onSubmit?:()=>void;disabled:boolean;label:string;
 status:VoiceState;error:string;interim:string;recognized:boolean;stream:MediaStream|null;streamNotice:string;reduced:boolean;
 demo?:boolean;level?:number|(()=>number);confirmLabel?:string;
 begin:()=>void;stop:()=>void;abort:()=>void;
}) {
 const [textMode,setTextMode]=useState(!!value);
 const live=status!=='idle';
 const phase=voicePresentationPhase(status,recognized,value,error);
 const editing=textMode||recognized||!!error;
 const accessibleStatus=demo&&status==='listening'?'正在聆听':status==='starting'?'等待麦克风权限':status==='listening'?'正在录音':status==='transcribing'?'正在转写':phase==='complete'?'文字已准备好':'';
 const notice=inlineCaptureNotice(streamNotice);
 return <section className="emma-inline-voice" data-voice-state={status} data-voice-phase={phase} data-reduced-motion={reduced} aria-label={label} onKeyDown={e=>{if(e.key==='Escape'&&live){e.preventDefault();abort();setTextMode(true);}}}>
  {!reduced&&<VoiceGlowBoundary><VoiceBeam className="emma-inline-beam" style={{position:'absolute',inset:0,pointerEvents:'none',borderRadius:20}} active={status==='listening'&&(demo||!!stream)} stream={stream??undefined} level={level} idle={0.08} theme="light" colorVariant="colorful" reach={0.8} strength={0.8}><div aria-hidden="true" className="emma-inline-beam-stage"/></VoiceBeam></VoiceGlowBoundary>}
  <ProcessingGlow status={status} reduced={reduced}/>
  <div className="emma-inline-content">
   <span className="sr-only" role="status">{accessibleStatus}</span>
   {live&&(interim||(recognized&&value.trim()))&&<section className="emma-inline-transcript" aria-label="实时语音字幕" aria-live="polite">
    {recognized&&value.trim()&&<div className="emma-inline-final"><p>{value}</p></div>}
    {interim?<div className="emma-inline-interim"><p>{interim}</p></div>:null}
   </section>}
   {live&&notice&&<p className="emma-inline-notice" role="status">{notice}</p>}
   {error&&<p className="inline-error" role="alert">{error}</p>}
   {editing&&!live&&<label className="emma-inline-editor"><span className="sr-only">{recognized?'编辑识别文字':'输入内容'}</span><textarea aria-label="输入内容" rows={3} value={value} disabled={disabled} onChange={e=>onChange(e.target.value)}/></label>}
   <div className="emma-inline-controls">
    {status==='listening'?<Button aria-label="停止并检查文字" onClick={stop}><Square size={17}/>停止</Button>:<Button disabled={disabled||live} onClick={begin}>{live?<LoaderCircle className="emma-inline-spinner" size={18}/>:<AudioLines size={18}/>} {recognized?'再说一段':'开始语音'}</Button>}
    {live?<Button variant="quiet" aria-label="取消本次识别" onClick={()=>{abort();setTextMode(true);}}>取消</Button>:<Button variant="quiet" disabled={disabled} onClick={()=>setTextMode(true)}><Keyboard size={17}/>改用文字</Button>}
    {editing&&!live&&onSubmit&&<Button disabled={disabled||!value.trim()} onClick={onSubmit}>{confirmLabel}</Button>}
   </div>
   {!demo&&<p className="emma-inline-disclosure">语音可能发送至浏览器服务提供方。</p>}
  </div>
 </section>;
}

/** Present capture problems only; routine setup and success stay implicit. */
export function inlineCaptureNotice(notice:string) {
 if(notice.includes('权限'))return '麦克风权限未开启，请检查网站或系统权限。';
 if(notice.includes('没有找到'))return '未找到麦克风，请检查输入设备。';
 if(notice.includes('占用')||notice.includes('无法读取'))return '麦克风无法读取，请检查是否被占用。';
 if(notice.includes('页面无法访问'))return '无法访问麦克风，请使用本机预览入口。';
 if(notice.includes('静音'))return '麦克风暂时静音，可重试或改用文字。';
 if(notice.includes('不可用'))return '麦克风不可用，可重试或改用文字。';
 return '';
}
