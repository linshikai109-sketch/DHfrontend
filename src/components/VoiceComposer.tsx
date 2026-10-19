import { ProcessingGlow, useReducedVoiceMotion } from "./VoiceEffects";
import { createVoiceStream } from "../domain/voice-stream";
import { EmmaDemoVoice } from "./EmmaDemoVoice";
import { EmmaInlineVoice } from "./EmmaInlineVoice";
import { EmmaVoiceExperience } from "./EmmaVoiceExperience";
import { useEffect, useRef, useState, type ComponentProps } from "react";
import { AudioLines, Keyboard, Square, X, ArrowUp } from "lucide-react";
import { Button } from "./ui";
import { getAudioContext, VoiceBeam } from "voice-glow";
import { createVoiceSession, type Recognition, type VoiceState } from "../domain/voice-session";
function VoiceSurface({enabled, ...props}: ComponentProps<typeof VoiceBeam> & {enabled: boolean}) {
  return enabled ? <VoiceBeam {...props}/> : <>{props.children}</>;
}
function localVoiceAllowed(): boolean { return false; }
type RecognitionConstructor = new () => Recognition;
function LiveVoiceComposer({
  value,
  onChange,
  onSubmit,
  disabled = false,
  label = "说说你的想法",
  variant = "default",
  glow = false,
  responding = false,
  inline = false,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  disabled?: boolean;
  label?: string;
  variant?: "default" | "studio";
  glow?: boolean;
  responding?: boolean;
  inline?: boolean;
}) {
  const reduced=useReducedVoiceMotion();
  const [textMode, setTextMode] = useState(!!value);
  const [status, setStatus] = useState<VoiceState>("idle");
  const [error, setError] = useState("");
  const [interim, setInterim] = useState("");
  const [sound, setSound] = useState(false);
  const [stream, setStream] = useState<MediaStream|null>(null);
  const [streamNotice, setStreamNotice] = useState("");
  const meter = useRef<ReturnType<typeof createVoiceStream>|null>(null);
  if(!meter.current)meter.current=createVoiceStream({stream:setStream,notice:setStreamNotice,request:()=>navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false})});
  const [recognized, setRecognized] = useState(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const onValue = useRef(onChange); onValue.current = onChange;
  const session = useRef<ReturnType<typeof createVoiceSession> | null>(null);
  if (!session.current) session.current=createVoiceSession({state:s=>{if(s==="idle"||s==="transcribing")meter.current?.stop();setStatus(s);},interim:setInterim,sound:setSound,
    result:text=>{onValue.current(text);setTextMode(true);setRecognized(true);},
    error:text=>{meter.current?.stop();setError(text);setTextMode(true);}});
  useEffect(() => {
    const hide=()=>{if(document.hidden){session.current?.cancel();meter.current?.stop();}};
    const leave=()=>{session.current?.dispose();meter.current?.stop();};
    document.addEventListener("visibilitychange",hide);window.addEventListener("pagehide",leave);
    return ()=>{document.removeEventListener("visibilitychange",hide);window.removeEventListener("pagehide",leave);session.current?.dispose();meter.current?.stop();};
  }, []);
  useEffect(()=>{if(disabled){session.current?.cancel();meter.current?.stop();}},[disabled]);
  useEffect(()=>{if(status=== "idle" || status=== "transcribing")meter.current?.stop();},[status]);
  useEffect(()=>{if(reduced&&!inline)meter.current?.stop();},[reduced,inline]);
  function begin() {
    if (!localVoiceAllowed()) {setError("真实语音暂未启用，请使用文字或演示语音。");setTextMode(true);return;}
    setError("");setRecognized(false);
    const win=window as unknown as {SpeechRecognition?:RecognitionConstructor;webkitSpeechRecognition?:RecognitionConstructor};
    const Constructor=win.SpeechRecognition||win.webkitSpeechRecognition;
    if(!Constructor){setError("此浏览器暂不支持语音识别，请使用文字。");setTextMode(true);return;}
    if(inline||(glow&&!reduced)){try{getAudioContext();}catch{/* Capture and recognition can still report their own failures. */}void meter.current?.start();}
    session.current?.begin(()=>new Constructor(),value);
  }
  function stop(){meter.current?.stop();session.current?.stop();}
  function abort(){meter.current?.stop();const original=session.current?.cancel();if(original!==undefined)onChange(original);setRecognized(false);}
  if(inline)return <EmmaInlineVoice value={value} onChange={onChange} onSubmit={onSubmit} disabled={disabled} label={label} status={status} error={error} interim={interim} recognized={recognized} stream={stream} streamNotice={streamNotice} reduced={reduced} begin={begin} stop={stop} abort={abort}/>;
  if(glow)return <EmmaVoiceExperience value={value} onChange={onChange} onSubmit={onSubmit} disabled={disabled} status={status} error={error} interim={interim} sound={sound} recognized={recognized} stream={stream} streamNotice={streamNotice} reduced={reduced} begin={begin} stop={stop} abort={abort}/>;
  return (
    <div className={`composer-wrap ${variant === "studio" ? "studio-composer" : ""}`} data-voice-state={status} data-text-open={textMode}>
      <VoiceSurface enabled={glow} active={glow && status === "listening"} paused={!glow || status !== "listening"} level={sound ? 0.35 : 0} idle={0} flow={0} theme="light" colorVariant="ocean" strength={glow ? 0.6 : 0}>
      <div
        className={`voice-composer ${status === "listening" ? "listening" : ""}`}
      >
        <button
          type="button"
          className="voice-orb"
          aria-label={status === "idle" ? "开始语音" : "结束语音"}
          disabled={
            disabled || status === "starting" || status === "transcribing"
          }
          onClick={status === "idle" ? begin : stop}
        >
          {variant === "studio" ? <span className="voice-core" aria-hidden="true"><span className="voice-core-light" /><span className="voice-core-wave"><i /><i /><i /><i /><i /></span>{status === "listening" && <Square size={14} className="voice-stop" />}</span> : status === "listening" ? (
            <Square size={18} />
          ) : (
            <AudioLines size={24} />
          )}
        </button>
        <span className="voice-label" aria-live="polite">
          {responding ? "正在生成" : status === "starting"
            ? "正在开启麦克风"
            : status === "listening"
              ? "正在录音"
              : status === "transcribing"
                ? "正在转成文字"
                : label}
        </span>
        {status !== "idle" ? (
          <Button variant="quiet" aria-label="取消录音" onClick={abort}>
            <X size={20} />
          </Button>
        ) : (
          <Button
            variant="quiet"
            aria-label="文字输入"
            aria-expanded={textMode}
            onClick={() => {
              setTextMode(!textMode);
              requestAnimationFrame(() => textarea.current?.focus());
            }}
          >
            <Keyboard size={22} />
          </Button>
        )}
      </div>
      </VoiceSurface>
      {glow && <p className="muted voice-disclosure">点击后由浏览器识别语音，可能使用远端服务。光效响应声音检测，不表示音量大小。</p>}
      {recognized && <p className="muted" role="status">已识别为文字，请检查或编辑后再提交。</p>}
      {interim && (
        <p className="interim" aria-live="polite">
          {interim}
        </p>
      )}
      {textMode && (
        <div className="text-composer">
          <textarea
            ref={textarea}
            aria-label="输入内容"
            value={value}
            rows={variant === "studio" ? 2 : 3}
            disabled={status !== "idle" || disabled}
            onChange={(e) => onChange(e.target.value)}
          />
          {onSubmit && (
            <Button
              aria-label="确认并提交文字"
              disabled={disabled || !value.trim() || status !== "idle"}
              onClick={onSubmit}
            >
              <ArrowUp size={20} />
            </Button>
          )}
        </div>
      )}
      <ProcessingGlow status={status} responding={responding} reduced={reduced}/>
      {error && (
        <p className="inline-error" role="status">
          {error}
        </p>
      )}
    </div>
  );
}

/** Keep the demo boundary outside live hooks, so it cannot acquire a microphone. */
export function VoiceComposer({demo=true,demoText,...props}:ComponentProps<typeof LiveVoiceComposer>&{demo?:boolean;demoText?:string}) {
 return demo?<EmmaDemoVoice value={props.value} onChange={props.onChange} onSubmit={props.onSubmit} disabled={props.disabled} label={props.label} inline={props.inline ?? false} variant={props.variant} sample={demoText}/>:<LiveVoiceComposer {...props}/>;
}
