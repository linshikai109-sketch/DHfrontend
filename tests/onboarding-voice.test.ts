import { afterEach, describe, expect, it, vi } from 'vitest';
import { questions } from '../src/domain/questions';
import { onboardingVoiceScript, onboardingTextDraft, onboardingVoicePaused } from '../src/domain/onboarding-voice';
import { createVoiceDemo } from '../src/domain/voice-demo';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { OnboardingVoice } from '../src/components/EmmaDemoVoice';
afterEach(()=>vi.useRealTimers());
describe('question-bound onboarding voice',()=>{
 it('covers all current main, followup and reachable clarification questions with role-bound scripts',()=>{
  for(const role of ['emma','john'] as const)for(const q of questions[role]){
   expect(onboardingVoiceScript(role,q.id).length,q.id).toBeGreaterThan(0);
   if(q.followup)expect(onboardingVoiceScript(role,q.id+':followup').length,q.id).toBeGreaterThan(0);
   if(q.kind==='open')expect(onboardingVoiceScript(role,q.id+':clarify').length,q.id).toBeGreaterThan(0);
   if(q.kind!=='open')for(const choice of onboardingVoiceScript(role,q.id).split('、'))expect(q.options).toContain(choice);
  }
  expect(onboardingVoiceScript('john','e-goal')).toBe('');
 });
 it('a disposed question cannot deliver an answer into the next question',()=>{
  vi.useFakeTimers();const old=vi.fn(),next=vi.fn();
  const a=createVoiceDemo({state:()=>{},interim:()=>{},result:old},onboardingVoiceScript('emma','e-goal'));
  a.begin('保留草稿');vi.advanceTimersByTime(300);a.stop();a.dispose();
  const b=createVoiceDemo({state:()=>{},interim:()=>{},result:next},onboardingVoiceScript('emma','e-experience'));
  b.begin('另一份草稿');vi.advanceTimersByTime(10000);
  expect(old).not.toHaveBeenCalled();expect(next).toHaveBeenCalledWith(onboardingVoiceScript('emma','e-experience'));
 });
 it('renders an editable completed answer without a duplicate submit action or implementation labels',()=>{
  const html=renderToStaticMarkup(createElement(OnboardingVoice,{role:'emma',value:'',staged:'我做过产品运营',sample:onboardingVoiceScript('emma','e-experience'),onEnterText:()=>{},onChange:()=>{},onStage:()=>{},onActive:()=>{}}));
  expect(html).toContain('我做过产品运营');expect(html).toContain('<textarea');
  expect(html).not.toMatch(/模拟|示例|演示|确认输入|确认并提交/);
  expect(html).toContain('开始语音');
 });
});

it('switching to typing transfers staged open text and choice selections, preserving supplements',()=>{
 expect(onboardingTextDraft('open','旧草稿','','完整语音回答')).toEqual({value:'完整语音回答',supplement:'',staged:null});
 expect(onboardingTextDraft('single','找到新的工作方向','已有补充','获得真实项目经验')).toEqual({value:'获得真实项目经验',supplement:'已有补充',staged:null});
 expect(onboardingTextDraft('multi','用户研究','保留补充',null)).toEqual({value:'用户研究',supplement:'保留补充',staged:null});
});
it('opening the mobile board cancels pending results, but the desktop default panel does not',()=>{
 vi.useFakeTimers();const result=vi.fn();
 const session=createVoiceDemo({state:()=>{},interim:()=>{},result},onboardingVoiceScript('emma','e-experience'));
 session.begin('保留原草稿');vi.advanceTimersByTime(400);session.stop();
 expect(onboardingVoicePaused(false,'half')).toBe(false);
 expect(onboardingVoicePaused(true,'closed')).toBe(false);
 for(const sheet of ['half','full'] as const)expect(onboardingVoicePaused(true,sheet)).toBe(true);
 if(onboardingVoicePaused(true,'half'))session.cancel();
 vi.advanceTimersByTime(10000);expect(result).not.toHaveBeenCalled();expect(vi.getTimerCount()).toBe(0);
});

it('keeps a stopped partial choice answer visible without duplicating a complete option',()=>{
 const render=(staged:string)=>renderToStaticMarkup(createElement(OnboardingVoice,{role:'emma',editable:false,value:'',staged,sample:'找到新的工作方向',onEnterText:()=>{},onChange:()=>{},onStage:()=>{},onActive:()=>{}}));
 expect(render('找到新')).toContain('回答内容');
 expect(render('找到新')).toContain('找到新');
 expect(render('找到新的工作方向')).not.toContain('<textarea');
});
