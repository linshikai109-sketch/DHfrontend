import {describe,it,expect,vi,afterEach} from "vitest";
import {createVoiceSession,type Recognition} from "../src/domain/voice-session";
import {createMockService} from "../src/domain/service";
function setup(){
 const events={state:vi.fn(),result:vi.fn(),interim:vi.fn(),sound:vi.fn(),error:vi.fn()};
 const rec:Recognition={lang:"",continuous:false,interimResults:false,onstart:null,onend:null,onerror:null,onresult:null,start:vi.fn(),stop:vi.fn(),abort:vi.fn()};
 const session=createVoiceSession(events);return {events,rec,session};
}
const result=(text:string,isFinal=true)=>({results:[{isFinal,0:{transcript:text}}]});
afterEach(()=>{vi.clearAllTimers();vi.useRealTimers();});
describe("real recognition event lifecycle without a microphone",()=>{
 it("hung permission/start and stop without end fall back; disposed timeout cannot fire",()=>{
  vi.useFakeTimers();const t=setup();t.session.begin(()=>t.rec,"");vi.advanceTimersByTime(30000);expect(t.events.state).toHaveBeenLastCalledWith("idle");expect(t.rec.abort).toHaveBeenCalled();
  t.session.begin(()=>t.rec,"");t.rec.onstart?.();t.session.stop();vi.advanceTimersByTime(10000);expect(t.events.error).toHaveBeenLastCalledWith(expect.stringContaining("未收到"));
  t.session.begin(()=>t.rec,"");t.session.dispose();const n=t.events.error.mock.calls.length;vi.advanceTimersByTime(100000);expect(t.events.error).toHaveBeenCalledTimes(n);
 });
 it("resultIndex with cumulative final and interim results merges each final exactly once",()=>{
  const t=setup();t.session.begin(()=>t.rec,"草稿");t.rec.onresult?.({resultIndex:0,results:[{isFinal:true,0:{transcript:"第一句"}},{isFinal:false,0:{transcript:"临时"}}]});
  t.rec.onresult?.({resultIndex:1,results:[{isFinal:true,0:{transcript:"第一句"}},{isFinal:true,0:{transcript:"第二句"}}]});expect(t.events.result).toHaveBeenLastCalledWith("草稿 第一句第二句");t.session.dispose();
 });
 it("final text goes to editable draft, not automatic submission; cumulative finals do not duplicate",()=>{
  const t=setup();t.session.begin(()=>t.rec,"已有草稿");t.rec.onstart?.();t.rec.onresult?.(result("新内容",false));expect(t.events.result).not.toHaveBeenCalled();
  t.rec.onresult?.(result("新内容"));t.rec.onresult?.(result("新内容"));expect(t.events.result.mock.calls).toEqual([["已有草稿 新内容"],["已有草稿 新内容"]]);
  t.rec.onend?.();expect(t.events.state).toHaveBeenLastCalledWith("idle");
 });
 it("repeated starts/stops are ignored; stop still accepts final result",()=>{
  const t=setup();t.session.begin(()=>t.rec,"");t.session.begin(()=>t.rec,"");expect(t.rec.start).toHaveBeenCalledTimes(1);
  t.session.stop();t.session.stop();expect(t.rec.stop).toHaveBeenCalledTimes(1);t.rec.onstart?.();expect(t.events.state).toHaveBeenLastCalledWith("transcribing");
  t.rec.onresult?.(result("完成"));expect(t.events.result).toHaveBeenCalledWith("完成");t.rec.onend?.();
 });
 it("cancel restores original text and invalidates saved late handlers",()=>{
  const t=setup();t.session.begin(()=>t.rec,"原草稿");const late=t.rec.onresult!;const end=t.rec.onend!;
  expect(t.session.cancel()).toBe("原草稿");late(result("迟到"));end();expect(t.events.result).not.toHaveBeenCalled();expect(t.rec.abort).toHaveBeenCalledTimes(1);
  t.session.begin(()=>t.rec,"重新开始");late(result("旧请求"));expect(t.events.result).not.toHaveBeenCalled();t.rec.onresult?.(result("新请求"));expect(t.events.result).toHaveBeenCalledWith("重新开始 新请求");
 });
 it.each(["not-allowed","service-not-allowed","no-speech","network","audio-capture"])("%s ends session with text fallback",code=>{
  const t=setup();t.session.begin(()=>t.rec,"");const late=t.rec.onresult!;t.rec.onerror?.({error:code});expect(t.events.error).toHaveBeenCalled();expect(t.events.state).toHaveBeenLastCalledWith("idle");late(result("迟到"));expect(t.events.result).not.toHaveBeenCalled();
 });
 it("unmount detaches and aborts; sound response requires actual sound event",()=>{
  const t=setup();t.session.begin(()=>t.rec,"");expect(t.events.sound).not.toHaveBeenCalledWith(true);t.rec.onsoundstart?.();expect(t.events.sound).toHaveBeenLastCalledWith(true);t.rec.onsoundend?.();expect(t.events.sound).toHaveBeenLastCalledWith(false);
  const late=t.rec.onresult!;t.session.dispose();late(result("迟到"));expect(t.events.result).not.toHaveBeenCalled();expect(t.rec.abort).toHaveBeenCalled();
 });
 it("empty end and startup failure are explicit, and can retry",()=>{
  const t=setup();t.session.begin(()=>t.rec,"");t.rec.onend?.();expect(t.events.error).toHaveBeenCalledWith(expect.stringContaining("未收到最终"));
  vi.mocked(t.rec.start).mockImplementationOnce(()=>{throw Error("blocked");});t.session.begin(()=>t.rec,"");expect(t.events.state).toHaveBeenLastCalledWith("idle");t.session.begin(()=>t.rec,"");expect(t.events.state).toHaveBeenLastCalledWith("starting");
 });
 it("recognized draft survives service reload and becomes an answer only on explicit saveAnswer",async()=>{
  const map=new Map<string,string>();const storage={getItem:(k:string)=>map.get(k)??null,setItem:(k:string,v:string)=>{map.set(k,v);}};
  let draft="";const service=createMockService(storage);const t=setup();const session=createVoiceSession({...t.events,result:text=>{draft=text;}});
  session.begin(()=>t.rec,"原内容");t.rec.onresult?.(result("识别内容"));t.rec.onend?.();
  await service.execute({role:"emma",operationId:"draft",command:{type:"saveDraft",questionId:"test-voice",value:draft}});
  const loaded=createMockService(storage);expect(loaded.getSnapshot().workspaces.emma.acquisition.drafts["test-voice"]).toBe("原内容 识别内容");expect(loaded.getSnapshot().workspaces.emma.acquisition.answers["test-voice"]).toBeUndefined();
  await loaded.execute({role:"emma",operationId:"confirm",command:{type:"saveAnswer",questionId:"test-voice",value:draft+" 用户编辑",nextIndex:0}});
  expect(loaded.getSnapshot().workspaces.emma.acquisition.answers["test-voice"].value).toContain("用户编辑");
 });
 it('keeps progressive interim separate and cumulative finals never append twice',()=>{
  const t=setup();t.session.begin(()=>t.rec,'已有草稿');t.rec.onstart?.();
  t.rec.onresult?.(result('第一',false));t.rec.onresult?.(result('第一句',false));expect(t.events.result).not.toHaveBeenCalled();expect(t.events.interim).toHaveBeenLastCalledWith('第一句');
  const mixed={results:[{isFinal:true,0:{transcript:'第一句'}},{isFinal:false,0:{transcript:'第二'}}]};t.rec.onresult?.(mixed);expect(t.events.result).toHaveBeenLastCalledWith('已有草稿 第一句');expect(t.events.interim).toHaveBeenLastCalledWith('第二');
  const finals={results:[{isFinal:true,0:{transcript:'第一句'}},{isFinal:true,0:{transcript:'第二句'}}]};t.rec.onresult?.(finals);t.rec.onresult?.(finals);expect(t.events.result).toHaveBeenLastCalledWith('已有草稿 第一句第二句');expect(t.events.interim).toHaveBeenLastCalledWith('');t.session.dispose();
 });
 it('whitespace final results do not masquerade as successful transcription',()=>{const t=setup();t.session.begin(()=>t.rec,'原草稿');t.rec.onstart?.();t.rec.onresult?.(result('  '));t.rec.onend?.();expect(t.events.result).not.toHaveBeenCalled();expect(t.events.error).toHaveBeenLastCalledWith(expect.stringContaining('未收到最终'));});
 it('ends listening after ninety seconds and rejects late text',()=>{vi.useFakeTimers();const t=setup();t.session.begin(()=>t.rec,'');t.rec.onstart?.();const late=t.rec.onresult!;vi.advanceTimersByTime(90000);expect(t.events.state).toHaveBeenLastCalledWith('idle');expect(t.rec.abort).toHaveBeenCalled();late(result('迟到'));expect(t.events.result).not.toHaveBeenCalled();});

});
