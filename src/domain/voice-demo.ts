import type { VoiceState } from './voice-session';
export const JOHN_VOICE_DEMO_TEXT='我们帮助中小企业整理项目需求，先邀请三位客户试用。';
export const VOICE_DEMO_TEXT='我想学习数据分析，做一个小项目，每周可以投入五小时。';
/** A silent local animation. No audio or recognition APIs are involved. */
export function createVoiceDemo(callbacks:{state:(state:VoiceState)=>void;interim:(text:string)=>void;result:(text:string)=>void}, sample=VOICE_DEMO_TEXT) {
 let active=false,original='',started=0,text='';
 let ticker:ReturnType<typeof setInterval>|undefined,ending:ReturnType<typeof setTimeout>|undefined;
 const clear=()=>{if(ticker!==undefined)clearInterval(ticker);if(ending!==undefined)clearTimeout(ending);ticker=ending=undefined;};
 const settle=()=>{if(!active)return;clear();callbacks.state('transcribing');ending=setTimeout(()=>{if(!active)return;clear();active=false;callbacks.interim('');if(text)callbacks.result(text);callbacks.state('idle');},350);};
 return {
  begin(value:string){if(active)return;clear();original=value;text='';started=Date.now();active=true;callbacks.interim('');callbacks.state('listening');ticker=setInterval(()=>{if(!active)return;text=sample.slice(0,Math.floor((Date.now()-started)/90));callbacks.interim(text);if(text===sample)settle();},45);},
  stop(){if(active&&ticker!==undefined)settle();},
  cancel(){const value=original;clear();active=false;callbacks.interim('');callbacks.state('idle');return value;},
  dispose(){clear();active=false;},
  level(){if(!active||ticker===undefined)return 0;const t=Date.now()-started;return Math.floor(t/650)%4===3?0.03:0.15+0.7*Math.abs(Math.sin(t/145));},
 };
}
