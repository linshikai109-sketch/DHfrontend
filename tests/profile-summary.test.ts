import {describe,it,expect} from 'vitest';
import {createMockService} from '../src/domain/service';
import {reportV6Fixture} from '../src/domain/report-v6-fixture';
import {profileSummary} from '../src/domain/profile-summary';
import type {ContextNode} from '../src/domain/types';
const fact=(sourceId:string,title:string,patch:Partial<ContextNode>={}):ContextNode=>({id:sourceId,sourceId,title,kind:'fact',sourceVersion:1,status:'candidate',edited:false,deleted:false,x:0,y:0,...patch});
describe('profile semantic summaries',()=>{
 it('keeps complete statements and deduplicates with sources retained',()=>{
 const w=structuredClone(createMockService().getSnapshot().workspaces.emma);
 w.context=[fact('e-experience','做过运营；负责过访谈，整理了反馈。'),fact('e-evidence','做过运营；负责过访谈，整理了反馈。'),fact('e-time','每周六小时'),fact('e-collaboration','希望先交流再独立完成')];
 const s=profileSummary(w);expect(s.groups[0].items).toHaveLength(1);expect(s.groups[0].items[0].nodes).toHaveLength(2);expect(s.groups[0].items[0].text).toContain('；');expect(s.groups.map(g=>g.title)).toEqual(['已有基础','投入时间','合作偏好']);
 });
 it('does not reintroduce stale or deleted answers or invent facts',()=>{
 const w=structuredClone(createMockService().getSnapshot().workspaces.emma);w.context=[fact('e-experience','丰富经历',{deleted:true}),fact('e-goal','旧目标',{status:'stale'})];
 const s=profileSummary(w);expect(s.intro).toBe('');expect(s.groups).toEqual([]);expect(s.stale).toHaveLength(1);
 });
 it('keeps prospective trials in targets and never treats them as customers',()=>{
 const w=structuredClone(createMockService().getSnapshot().workspaces.john);w.context=[fact('j-scope','具体项目'),fact('j-scope:followup','访谈助手'),fact('j-commercial','尚无付费客户'),fact('j-milestone','希望四周内让三个团队试用'),fact('j-stage','核心原型')];
 const s=profileSummary(w);expect(s.title).toBe('项目概览');expect(s.name).toBe('访谈助手');expect(s.groups.find(g=>g.id==='validation')?.items.map(i=>i.text)).toEqual(['尚无付费客户']);expect(s.groups.find(g=>g.id==='target')?.items[0].text).toContain('希望');
 w.context[1].deleted=true;expect(profileSummary(w).name).toBeUndefined();
 });
 it('uses the business proposition even without a customer question',()=>{
 const w=structuredClone(createMockService().getSnapshot().workspaces.john);w.context=[fact('j-goal','我们想减少整理客户访谈的时间')];const s=profileSummary(w);expect(s.intro).toContain('客户访谈');expect(s.groups[0].id).toBe('business');
 });
 it('flags a weekly limit mismatch but not a compatible schedule',()=>{
 const w=structuredClone(createMockService().getSnapshot().workspaces.emma);w.context=[fact('e-time','每周 6–10 小时'),fact('e-time:followup','每周最多六小时，工作日晚间两次各一小时，周末四小时。')];expect(profileSummary(w).conflicts).toHaveLength(1);w.context[0].title='每周 3–6 小时';expect(profileSummary(w).conflicts).toHaveLength(0);w.context[1].title='工作日晚间两次各一小时';expect(profileSummary(w).conflicts).toHaveLength(0);
 });

 it('groups legacy fixture facts with source-preserving mixed time and direction',()=>{
 const w=reportV6Fixture().workspaces.emma;const s=profileSummary(w);expect(s.groups.map(g=>g.id)).toEqual(['direction','basis','time','preferences','other']);expect(s.intro).toContain('客户研究');expect(s.intro).toContain('AI 产品');expect(s.groups.find(g=>g.id==='time')?.items[0].text).toBe('每周约可投入两小时');expect(s.groups.find(g=>g.id==='time')?.items[0].nodes[0].title).toContain('未来半年');
 });

 it('retains an enterprise name without treating it as a project',()=>{
 const w=structuredClone(createMockService().getSnapshot().workspaces.john);w.context=[fact('j-scope','企业整体'),fact('j-scope:followup','星河科技')];expect(profileSummary(w).name).toBe('星河科技');expect(profileSummary(w).title).toBe('企业概览');
 });

});
