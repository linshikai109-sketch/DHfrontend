export interface Recognition {
 lang: string; continuous: boolean; interimResults: boolean;
 onstart: (() => void) | null; onend: (() => void) | null;
 onerror: ((event: {error: string}) => void) | null;
 onresult: ((event: {resultIndex?: number; results: ArrayLike<{isFinal: boolean; 0: {transcript: string}}>}) => void) | null;
 onsoundstart?: (() => void) | null; onsoundend?: (() => void) | null;
 start(): void; stop(): void; abort(): void;
}
export type VoiceState = "idle" | "starting" | "listening" | "transcribing";
export function voiceError(code: string) {
 return code === "not-allowed" || code === "service-not-allowed" ? "麦克风或语音识别权限未开启，请使用文字。"
 : code === "no-speech" ? "没有识别到语音，可以重试或使用文字。"
 : code === "network" ? "语音识别服务网络不可用，请使用文字。"
 : code === "audio-capture" ? "麦克风不可用或正被占用，请使用文字。"
 : "语音识别暂不可用，请重试或使用文字。";
}
export function createVoiceSession(callbacks: {state:(s:VoiceState)=>void; result:(s:string)=>void; interim:(s:string)=>void; sound:(s:boolean)=>void; error:(s:string)=>void}) {
 let current: Recognition | null = null; let generation=0; let base=""; let stopping=false; let deadline:ReturnType<typeof setTimeout> | undefined;
 const clearDeadline=()=>{if(deadline!==undefined){clearTimeout(deadline);deadline=undefined;}};
 const detach=(rec:Recognition)=>{rec.onstart=rec.onend=rec.onresult=rec.onerror=null;rec.onsoundstart=rec.onsoundend=null;};
 function finish(rec:Recognition){clearDeadline();detach(rec);current=null;stopping=false;callbacks.state("idle");callbacks.interim("");callbacks.sound(false);}
 return {
  begin(make:()=>Recognition, original:string) {
   if(current)return;
   const token=++generation; base=original;stopping=false;
   let rec:Recognition;
   try{rec=make();}catch{callbacks.error(voiceError("unsupported"));return;}
   let receivedFinal=false;
   current=rec;const valid=()=>current===rec&&generation===token;
   const expire=()=>{if(valid()){callbacks.error("语音识别等待超时，请检查已识别文字或使用文字输入。");finish(rec);try{rec.abort();}catch{/* ended */}}};
   deadline=setTimeout(expire,30000);
   rec.lang="zh-CN";rec.continuous=false;rec.interimResults=true;
   rec.onstart=()=>{if(valid()&&!stopping){clearDeadline();deadline=setTimeout(()=>{if(valid()){callbacks.error("语音识别已结束，请检查文字或重试。");finish(rec);try{rec.abort();}catch{/* ended */}}},90000);callbacks.state("listening");}};
   rec.onsoundstart=()=>{if(valid()&&!stopping)callbacks.sound(true);};
   rec.onsoundend=()=>{if(valid())callbacks.sound(false);};
   rec.onresult=e=>{if(!valid())return;let final="",interim="";for(let i=0;i<e.results.length;i++){if(e.results[i].isFinal)final+=e.results[i][0].transcript;else interim+=e.results[i][0].transcript;}callbacks.interim(interim);if(final.trim()){receivedFinal=true;callbacks.result([base,final].filter(Boolean).join(" "));}};
   rec.onerror=e=>{if(!valid())return;callbacks.error(voiceError(e.error));finish(rec);try{rec.abort();}catch{/* already ended */}};
   rec.onend=()=>{if(valid()){if(!receivedFinal)callbacks.error("未收到最终识别文字，请重试或使用文字。");finish(rec);}};
   callbacks.state("starting");
   try{rec.start();}catch{if(valid()){callbacks.error("语音启动失败，请使用文字。");finish(rec);try{rec.abort();}catch{/* no session */}}}
  },
  stop(){if(!current||stopping)return;stopping=true;clearDeadline();const waiting=current;deadline=setTimeout(()=>{if(current===waiting){callbacks.error("未收到识别完成结果，请检查文字或重试。");finish(waiting);try{waiting.abort();}catch{/* ended */}}},10000);callbacks.state("transcribing");callbacks.sound(false);try{current.stop();}catch{const rec=current;callbacks.error("语音停止失败，请检查已识别文字。");finish(rec);try{rec.abort();}catch{/* ended */}}},
  cancel(){clearDeadline();generation++;const rec=current;current=null;stopping=false;if(rec){detach(rec);try{rec.abort();}catch{/* ended */}}callbacks.state("idle");callbacks.interim("");callbacks.sound(false);return base;},
  dispose(){clearDeadline();generation++;const rec=current;current=null;if(rec){detach(rec);try{rec.abort();}catch{/* ended */}}},
 };
}
