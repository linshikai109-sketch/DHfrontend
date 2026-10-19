import {describe,it,expect,vi} from "vitest";
import {createVoiceStream} from "../src/domain/voice-stream";
function audio(){const track=Object.assign(new EventTarget(),{readyState:"live",muted:false,stop:vi.fn()});const stream={getTracks:()=>[track],getAudioTracks:()=>[track]} as unknown as MediaStream;return {track,stream};}
function setup(request:()=>Promise<MediaStream>){const stream=vi.fn(),notice=vi.fn();return {stream,notice,owner:createVoiceStream({request,stream,notice})};}
describe("owned real MediaStream capture lifecycle (mock tracks)",()=>{
 it("publishes live stream, handles muted tracks, and releases only owned tracks",async()=>{
  const a=audio(),t=setup(async()=>a.stream);await t.owner.start();expect(t.stream).toHaveBeenLastCalledWith(a.stream);
  a.track.muted=true;a.track.dispatchEvent(new Event("mute"));expect(t.stream).toHaveBeenLastCalledWith(null);expect(t.notice).toHaveBeenLastCalledWith(expect.stringContaining("静音"));
  a.track.muted=false;a.track.dispatchEvent(new Event("unmute"));expect(t.stream).toHaveBeenLastCalledWith(a.stream);
  t.owner.stop();expect(a.track.stop).toHaveBeenCalledTimes(1);expect(t.stream).toHaveBeenLastCalledWith(null);
 });
 it("late permission result after stop is immediately released",async()=>{
  const a=audio();let resolve!:(s:MediaStream)=>void;const t=setup(()=>new Promise(r=>resolve=r));const pending=t.owner.start();t.owner.stop();resolve(a.stream);await pending;expect(a.track.stop).toHaveBeenCalledOnce();expect(t.stream).not.toHaveBeenCalledWith(a.stream);
 });
 it("repeated start replaces prior ownership and ignores stale capture",async()=>{
  const a=audio(),b=audio();let first!:(s:MediaStream)=>void;let n=0;const t=setup(()=>++n===1?new Promise(r=>first=r):Promise.resolve(b.stream));const old=t.owner.start();await t.owner.start();first(a.stream);await old;expect(a.track.stop).toHaveBeenCalledOnce();expect(t.stream).toHaveBeenLastCalledWith(b.stream);t.owner.stop();expect(b.track.stop).toHaveBeenCalledOnce();
 });
 it("capture denial and ended tracks clearly disable meter without pretending amplitude",async()=>{
  const t=setup(async()=>{throw Error("not allowed");});await t.owner.start();expect(t.stream).toHaveBeenLastCalledWith(null);expect(t.notice).toHaveBeenLastCalledWith(expect.stringContaining("可继续"));
  const a=audio(),u=setup(async()=>a.stream);await u.owner.start();a.track.readyState="ended";a.track.dispatchEvent(new Event("ended"));expect(u.stream).toHaveBeenLastCalledWith(null);u.owner.stop();
 });
});
