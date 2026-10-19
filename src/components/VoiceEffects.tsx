import { Component, useEffect, useState, type ReactNode } from 'react';
import type { VoiceState } from '../domain/voice-session';
import './voice-effects.css';
/** Decoration failures must never replace the editor, controls or transcript. */
export class VoiceGlowBoundary extends Component<{children:ReactNode},{failed:boolean}> {
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true};}
 render(){return this.state.failed?<div className="voice-glow-fallback" data-glow-fallback aria-hidden="true"/>:this.props.children;}
}
export function useReducedVoiceMotion(){
 const [reduced,setReduced]=useState(()=>typeof matchMedia!=='undefined'&&matchMedia('(prefers-reduced-motion: reduce)').matches);
 useEffect(()=>{if(typeof matchMedia==='undefined')return;const media=matchMedia('(prefers-reduced-motion: reduce)');const change=()=>setReduced(media.matches);change();media.addEventListener('change',change);return()=>media.removeEventListener('change',change);},[]);
 return reduced;
}
export function voicePresentationPhase(status:VoiceState,recognized:boolean,value:string,error:string){
 if(status!=='idle')return status;
 if(error)return 'error';
 return recognized&&value.trim()?'complete':'ready';
}
export function voiceProcessingState(status:VoiceState,responding:boolean){return status==='transcribing'?'transcribing':responding?'generating':'idle';}
export function ProcessingGlow({status,responding=false,reduced=false}:{status:VoiceState;responding?:boolean;reduced?:boolean}){
 const state=voiceProcessingState(status,responding);
 return <div className="voice-processing-light" data-processing={state} data-reduced-motion={reduced} aria-hidden="true"><i/></div>;
}
