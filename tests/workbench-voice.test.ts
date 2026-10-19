import { describe, expect, it } from 'vitest';
import {createIntentBag, resolveWorkbenchView, voiceIntents, workbenchScene} from '../src/domain/workbench-voice';
describe('workbench voice intent catalogue',()=>{
 it('covers each graphic intent with distinct role-specific prompts and usable output',()=>{
  for(const role of ['emma','john'] as const){const scenes=voiceIntents.map(id=>workbenchScene(role,id));expect(new Set(scenes.map(s=>s.prompt)).size).toBe(12);for(const scene of scenes){expect(scene.rows.length).toBeGreaterThan(1);expect(scene.prompt.length).toBeGreaterThan(10);expect(JSON.stringify(scene)).not.toMatch(/模拟|示例|演示/);if(scene.columns)for(const row of scene.rows)expect(row).toHaveLength(scene.columns.length);}}
  for(const id of voiceIntents)expect(workbenchScene('emma',id).prompt).not.toBe(workbenchScene('john',id).prompt);
 });
 it('draws each intent once per cycle and avoids boundary duplicates',()=>{
  for(const random of [()=>0,()=>0.5,()=>0.9999]){const bag=createIntentBag(random);const draws=Array.from({length:36},()=>bag.next());for(let i=0;i<36;i+=12)expect(new Set(draws.slice(i,i+12)).size).toBe(12);expect(draws[11]).not.toBe(draws[12]);expect(draws[23]).not.toBe(draws[24]);}
 });
 it('routes explicit task/plan inspection but keeps proposed plan edits in discussion',()=>{
 expect(resolveWorkbenchView('看看我的当前任务')).toBe('task');expect(resolveWorkbenchView('查看当前计划')).toBe('plan');expect(resolveWorkbenchView('调整当前计划')).toBeNull();expect(resolveWorkbenchView('先做原型还是访谈')).toBeNull();
 });
});
