import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createWorkbenchVoiceSession } from '../src/domain/workbench-voice-session';
import { workbenchScene } from '../src/domain/workbench-voice';

describe('workbench transcript submission', () => {
 beforeEach(() => vi.useFakeTimers());
 afterEach(() => vi.useRealTimers());
 const make = () => {
  const callbacks = { phase: vi.fn(), transcript: vi.fn(), submit: vi.fn() };
  return { ...callbacks, controller: createWorkbenchVoiceSession(callbacks) };
 };
 const chosen = workbenchScene('emma', 'comparison');
 it('finishes playback in an editable stage without sending', () => {
  const { controller, phase, transcript, submit } = make();
  controller.begin(chosen);
  vi.advanceTimersByTime(10000);
  expect(phase).toHaveBeenLastCalledWith('staged');
  expect(transcript).toHaveBeenLastCalledWith(chosen.prompt);
  expect(submit).not.toHaveBeenCalled();
  controller.send(); controller.send();
  vi.advanceTimersByTime(650);
  expect(submit).toHaveBeenCalledExactlyOnceWith(chosen.prompt, chosen);
 });
 it('stops at the actual transcript and sends edited content through the ordinary request path', () => {
  const { controller, transcript, submit } = make();
  controller.begin(chosen);
  vi.advanceTimersByTime(150);
  controller.stop();
  expect(transcript).toHaveBeenLastCalledWith(chosen.prompt.slice(0, 4));
  controller.edit('查看当前任务');
  controller.send();
  expect(submit).toHaveBeenCalledExactlyOnceWith('查看当前任务', null);
  vi.advanceTimersByTime(10000);
  expect(submit).toHaveBeenCalledTimes(1);
 });
 it('cancels a pending result and keeps later sessions isolated', () => {
  const { controller, submit } = make();
  controller.begin(chosen);
  vi.advanceTimersByTime(10000);
  controller.send();
  controller.cancel();
  const next = workbenchScene('john', 'comparison');
  controller.begin(next);
  vi.advanceTimersByTime(10000);
  expect(submit).not.toHaveBeenCalled();
  controller.send();
  vi.advanceTimersByTime(650);
  expect(submit).toHaveBeenCalledExactlyOnceWith(next.prompt, next);
 });
 it('blocks empty submissions and emits nothing after disposal', () => {
  const { controller, submit, phase } = make();
  controller.begin(chosen);
  vi.advanceTimersByTime(10000);
  controller.edit('   '); controller.send();
  expect(phase).toHaveBeenLastCalledWith('staged');
  expect(submit).not.toHaveBeenCalled();
  controller.edit(chosen.prompt); controller.send();
  controller.dispose();
  vi.advanceTimersByTime(10000);
  expect(submit).not.toHaveBeenCalled();
 });
});

describe('automatic voice response',()=>{
 beforeEach(()=>vi.useFakeTimers());
 afterEach(()=>vi.useRealTimers());
 const scene=workbenchScene('emma','comparison');
 it('responds once without confirmation and retains the subtitle',()=>{
  const phase=vi.fn(),transcript=vi.fn(),submit=vi.fn();
  const session=createWorkbenchVoiceSession({phase,transcript,submit},{autoSend:true});
  session.begin(scene);vi.advanceTimersByTime(10000);
  expect(submit).toHaveBeenCalledExactlyOnceWith(scene.prompt,scene);
  expect(transcript).toHaveBeenLastCalledWith(scene.prompt);
  expect(phase).toHaveBeenLastCalledWith('idle');
 });
 it('can interrupt processing, retain text and edit without a stale response',()=>{
  const phase=vi.fn(),transcript=vi.fn(),submit=vi.fn();
  const session=createWorkbenchVoiceSession({phase,transcript,submit},{autoSend:true});
  session.begin(scene);vi.advanceTimersByTime(900);session.stop();session.cancel(true);
  vi.advanceTimersByTime(10000);expect(submit).not.toHaveBeenCalled();
  expect(transcript.mock.lastCall?.[0]).not.toBe('');
  session.edit('查看当前任务');session.send();vi.advanceTimersByTime(650);expect(submit).toHaveBeenCalledExactlyOnceWith('查看当前任务',null);
 });
});
