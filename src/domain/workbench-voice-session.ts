import type { VoiceScene } from './workbench-voice';

export type WorkbenchVoicePhase = 'idle' | 'listening' | 'staged' | 'processing' | 'responding';

/** Local transcript playback, kept separate from explicit user submission. */
export function createWorkbenchVoiceSession(callbacks: {
  phase: (phase: WorkbenchVoicePhase) => void;
  transcript: (text: string) => void;
  submit: (text: string, scene: VoiceScene | null) => void;
}, options: {autoSend?:boolean} = {}) {
  let phase: WorkbenchVoicePhase = 'idle';
  let scene: VoiceScene | null = null;
  let transcript = '';
  let generation = 0;
  let disposed = false;
  let ticker: ReturnType<typeof setInterval> | undefined;
  let ending: ReturnType<typeof setTimeout> | undefined;
  const clear = () => {
    if (ticker !== undefined) clearInterval(ticker);
    if (ending !== undefined) clearTimeout(ending);
    ticker = ending = undefined;
  };
  const setPhase = (next: WorkbenchVoicePhase) => { phase = next; callbacks.phase(next); };
  const stage = () => {
    if (disposed || phase !== 'listening') return;
    clear();
    if (transcript) { setPhase('staged'); if(options.autoSend) controller.send(); }
    else { scene = null; setPhase('idle'); }
  };
  const controller = {
    begin(chosen: VoiceScene) {
      if (disposed || phase === 'listening' || phase === 'processing' || phase === 'staged') return;
      clear();
      const token = ++generation;
      scene = chosen;
      transcript = '';
      callbacks.transcript('');
      setPhase('listening');
      let index = 0;
      const chunks=chosen.prompt.match(/[^，。！？；]+[，。！？；]?/g)||[chosen.prompt];
      ticker = setInterval(() => {
        if (disposed || generation !== token || phase !== 'listening') return;
        index += options.autoSend ? 1 : 2;
        transcript = options.autoSend ? chunks.slice(0,index).join('') : chosen.prompt.slice(0, index);
        callbacks.transcript(transcript);
        if (options.autoSend ? index >= chunks.length : index >= chosen.prompt.length) stage();
      }, options.autoSend ? 900 : 75);
    },
    stop: stage,
    edit(text: string) {
      if (disposed || phase === 'listening') return;
      ++generation; clear(); setPhase('staged');
      transcript = text;
      callbacks.transcript(text);
    },
    send() {
      if (disposed || phase !== 'staged' || !transcript.trim()) return;
      const text = transcript.trim();
      const selected = text === scene?.prompt ? scene : null;
      const token = ++generation;
      setPhase('processing');
      // A changed request must go through the ordinary input handler.
      const finish = () => {
        if (disposed || generation !== token || phase !== 'processing') return;
        clear();
        scene = null;
        if(!options.autoSend){transcript = '';callbacks.transcript('');}
        setPhase('responding');
        callbacks.submit(text, selected);
        ending=setTimeout(()=>{if(!disposed&&generation===token&&phase==='responding')setPhase('idle');},900);
      };
      if (selected || options.autoSend) ending = setTimeout(finish, 650);
      else finish();
    },
    cancel(preserve=false) {
      if (disposed) return;
      ++generation;
      clear();
      scene = null;
      if(!preserve){transcript = '';callbacks.transcript('');}
      setPhase('idle');
    },
    dispose() { disposed = true; ++generation; clear(); scene = null; },
  };
  return controller;
}
