import {afterEach,describe,expect,it,vi} from 'vitest';
import {createVoiceDemo,VOICE_DEMO_TEXT,JOHN_VOICE_DEMO_TEXT} from '../src/domain/voice-demo';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {VoiceComposer} from '../src/components/VoiceComposer';
afterEach(()=>vi.useRealTimers());
function setup(){vi.useFakeTimers();const state=vi.fn(),interim=vi.fn(),result=vi.fn();return {state,interim,result,demo:createVoiceDemo({state,interim,result})};}
describe('silent local voice demonstration',()=>{
 it('progresses captions and deterministic amplitude then finishes without submission',()=>{const t=setup();t.demo.begin('原草稿');vi.advanceTimersByTime(450);expect(t.interim).toHaveBeenLastCalledWith(VOICE_DEMO_TEXT.slice(0,5));expect(t.demo.level()).toBeGreaterThan(0);expect(t.result).not.toHaveBeenCalled();vi.advanceTimersByTime(5000);expect(t.result).toHaveBeenCalledOnce();expect(t.result).toHaveBeenCalledWith(VOICE_DEMO_TEXT);expect(t.state).toHaveBeenLastCalledWith('idle');expect(t.demo.level()).toBe(0);expect(vi.getTimerCount()).toBe(0);});
 it('stop returns the partial transcript and replay starts from the beginning',()=>{const t=setup();t.demo.begin('');vi.advanceTimersByTime(450);t.demo.stop();expect(t.state).toHaveBeenLastCalledWith('transcribing');vi.advanceTimersByTime(350);expect(t.result).toHaveBeenLastCalledWith(VOICE_DEMO_TEXT.slice(0,5));t.demo.begin('编辑的草稿');vi.advanceTimersByTime(90);expect(t.interim).toHaveBeenLastCalledWith(VOICE_DEMO_TEXT.slice(0,1));expect(t.demo.cancel()).toBe('编辑的草稿');});
 it('cancel during playback or settling clears timers, protects original and rejects late completion',()=>{const t=setup();t.demo.begin('原草稿');vi.advanceTimersByTime(450);t.demo.stop();expect(t.demo.cancel()).toBe('原草稿');vi.advanceTimersByTime(10000);expect(t.result).not.toHaveBeenCalled();expect(vi.getTimerCount()).toBe(0);t.demo.begin('原草稿');t.demo.dispose();vi.advanceTimersByTime(10000);expect(t.result).not.toHaveBeenCalled();});
 it('routes Emma demo outside live capture and removes the upload disclosure',()=>{const html=renderToStaticMarkup(createElement(VoiceComposer,{demo:true,inline:true,value:'',onChange:()=>{}}));expect(html).not.toContain('模拟');expect(html).toContain('开始语音');expect(html).not.toContain('播放演示');expect(html).not.toContain('发送至浏览器');expect(html).not.toContain('role="dialog"');});
});

it('uses a John-specific local transcript without submitting',()=>{vi.useFakeTimers();const result=vi.fn();const demo=createVoiceDemo({state:()=>{},interim:()=>{},result},JOHN_VOICE_DEMO_TEXT);demo.begin('');vi.advanceTimersByTime(5000);expect(result).toHaveBeenCalledWith(JOHN_VOICE_DEMO_TEXT);});
it('keeps the original studio orb for John and shared default callers',()=>{const html=renderToStaticMarkup(createElement(VoiceComposer,{inline:false,variant:'studio',value:'',onChange:()=>{}}));expect(html).toContain('voice-orb');expect(html).toContain('voice-core');expect(html).toContain('开始语音');expect(html).not.toContain('emma-inline-voice');expect(html).not.toContain('播放演示');});

it('does not claim active capture or processing while waiting for explicit start',()=>{const html=renderToStaticMarkup(createElement(VoiceComposer,{inline:false,variant:'studio',value:'',onChange:()=>{}}));expect(html).toContain('aria-label="开始语音"');expect(html).toContain('data-voice-state="idle"');expect(html).not.toContain('data-active=');expect(html).not.toContain('data-processing="transcribing"');});
