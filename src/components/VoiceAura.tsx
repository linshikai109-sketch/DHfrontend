import { createPortal } from "react-dom";
import { useEffect, useState } from 'react';
import { VoiceBeam } from 'voice-glow';
import { ProcessingGlow, VoiceGlowBoundary, useReducedVoiceMotion } from './VoiceEffects';
/** Visual accompaniment only; the local transcript is not microphone amplitude. */
export function VoiceAura({state,screenEdge=false}:{screenEdge?:boolean;state:'idle'|'listening'|'thinking'|'responding'}) {
 const reduced=useReducedVoiceMotion();
 const [mobile,setMobile]=useState(()=>typeof matchMedia!=='undefined'&&matchMedia('(max-width:767px)').matches);
 useEffect(()=>{if(typeof matchMedia==='undefined')return;const media=matchMedia('(max-width:767px)');const change=()=>setMobile(media.matches);media.addEventListener('change',change);return()=>media.removeEventListener('change',change);},[]);
 const fullscreen=screenEdge&&mobile;
 const [hidden,setHidden]=useState(false);
 useEffect(()=>{const change=()=>setHidden(document.hidden);change();document.addEventListener('visibilitychange',change);return()=>document.removeEventListener('visibilitychange',change);},[]);
 const active=!hidden&&(state==='listening'||state==='responding');
 const visual=<div className={`voice-aura-track${fullscreen?" voice-aura-screen":""}`} data-state={hidden?'idle':state} data-reduced-motion={reduced} aria-hidden="true">
 {!reduced&&active&&<VoiceGlowBoundary><VoiceBeam className="restored-voice-aura" style={{position:'absolute',inset:0,borderRadius:8,pointerEvents:'none'}} active={active} paused={!active} level={()=>active?0.4+0.2*Math.abs(Math.sin(performance.now()/240)):0} idle={0} theme="light" staticColors colors={["#7fb6e8","#c7e4fb","#518bc7","#aacfeb","#6b9fd1","#d8ecfb","#83b3dd"]} bandColors={{core:"#eaf6ff",above:"#97c8ef",mid:"#7faedf",below:"#4d87bd"}} strength={fullscreen?1.25:0.9} reach={fullscreen?1.05:0.6}><div aria-hidden="true"/></VoiceBeam></VoiceGlowBoundary>}
 {reduced&&active&&<div className="voice-aura-static" aria-hidden="true"/>}
 <ProcessingGlow status={!hidden&&state==='thinking'?'transcribing':'idle'} reduced={reduced||hidden}/>
 </div>;
 return fullscreen?createPortal(visual,document.body):visual;
}
