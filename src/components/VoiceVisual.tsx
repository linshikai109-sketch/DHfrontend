import { Component, lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import './voice-visual.css';
const Corona = lazy(() => import('./voice-vendor/shdr-31-light').then(m => ({default:m.Shdr31})));
export type VisualVoiceState = 'idle'|'listening'|'thinking'|'responding';
function CssOrb({state,paused}:{state:VisualVoiceState;paused:boolean}) {
 return <span className="voice-css-orb" data-state={state} data-paused={paused}><span className="orb-body"><i className="liquid a"/><i className="liquid b"/><i className="liquid c"/><i className="orb-shine"/></span><i className="orb-shadow"/></span>;
}
class VisualBoundary extends Component<{children:ReactNode;fallback:ReactNode},{failed:boolean}> {
 state={failed:false}; static getDerivedStateFromError(){return {failed:true};}
 render(){return this.state.failed?this.props.fallback:this.props.children;}
}
export function VoiceVisual({role,state,paused=false}:{role:'emma'|'john';state:VisualVoiceState;paused?:boolean}) {
 const [mobile,setMobile]=useState(()=>typeof matchMedia!=='undefined'&&matchMedia('(max-width: 767px)').matches);
 const [reduced,setReduced]=useState(()=>typeof matchMedia!=='undefined'&&matchMedia('(prefers-reduced-motion: reduce)').matches);
 const [hidden,setHidden]=useState(typeof document!=="undefined"&&document.hidden);
 const [failed,setFailed]=useState(false);
 const root=useRef<HTMLSpanElement>(null);
 const [visible,setVisible]=useState(true);
 useEffect(()=>{if(!root.current)return;const observer=new IntersectionObserver(([entry])=>setVisible(entry.isIntersecting));observer.observe(root.current);return()=>observer.disconnect();},[]);
 useEffect(()=>{const mq=matchMedia('(max-width: 767px)'),rm=matchMedia('(prefers-reduced-motion: reduce)');const size=()=>setMobile(mq.matches),motion=()=>setReduced(rm.matches),visibility=()=>setHidden(document.hidden);mq.addEventListener('change',size);rm.addEventListener('change',motion);document.addEventListener('visibilitychange',visibility);return()=>{mq.removeEventListener('change',size);rm.removeEventListener('change',motion);document.removeEventListener('visibilitychange',visibility);};},[]);
 const large=role==='emma'&&mobile;
 const frozen=paused||hidden||reduced||!visible;
 const fallback=<CssOrb state={state} paused={frozen||failed}/>;
 return <span ref={root} className="voice-visual" data-large={large} aria-hidden="true" onContextMenu={e=>e.preventDefault()}>
 {large&&!failed&&!reduced?<VisualBoundary fallback={fallback}><Suspense fallback={fallback}><span className="voice-corona" ref={node=>{if(!node)return;const lost=()=>setFailed(true);node.addEventListener('webglcontextlost',lost,true);node.addEventListener('orb-render-error',lost,true);return()=>{node.removeEventListener('webglcontextlost',lost,true);node.removeEventListener('orb-render-error',lost,true);};}}><Corona size={250} maxDpr={1} state={state==='thinking'?'thinking':state==='responding'?'speaking':'idle'} paused={frozen} statePresets={{thinking:{alphaGain:3.1,rayGain:.66,edgeFade:.4}}}/></span></Suspense></VisualBoundary>:fallback}
 </span>;
}
