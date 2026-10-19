import { describe, expect, it } from 'vitest';
import { seedSnapshot } from '../src/domain/fixtures';
import { effectiveFact, planDifferences, projectArtifact, resolveIntent } from '../src/domain/workbench-artifacts';
import type { ContextNode, PlanItem } from '../src/domain/types';

describe('workbench artifact projection', () => {
  const fact = (patch: Partial<ContextNode> = {}): ContextNode => ({ id:'fact', title:'用户修改后的经验',kind:'fact',sourceId:'e-experience',sourceVersion:1,status:'confirmed',edited:true,deleted:false,x:0,y:0,...patch });
  it('uses effective confirmed facts and excludes removed and stale facts', () => {
    expect(effectiveFact({facts:[fact(),fact({id:'stale',title:'旧资料',status:'stale'}),fact({id:'removed',title:'已删除',deleted:true})]},'e-experience')).toBe('用户修改后的经验');
    expect(effectiveFact({facts:[fact({status:'candidate'})]},'e-experience')).toBe('尚无已确认依据');
  });
  it('keeps immutable historical data and ignores unrelated draft typing', () => {
    const snapshot=seedSnapshot(); const workspace=snapshot.workspaces.emma;
    workspace.context=[fact()];
    const original=projectArtifact(workspace,snapshot);
    workspace.acquisition.drafts['e-goal']='正在输入';
    expect(projectArtifact(workspace,snapshot).revision).toBe(original.revision);
    workspace.context[0].title='新的经验';
    expect(projectArtifact(workspace,snapshot).revision).not.toBe(original.revision);
    expect(original.facts[0].title).toBe('用户修改后的经验');
  });
  it('keeps publisher drafts out of the participant projection', () => {
    const snapshot=seedSnapshot();snapshot.quests[0].status='draft';
    expect(projectArtifact(snapshot.workspaces.emma,snapshot).quests.some(q=>q.id===snapshot.quests[0].id)).toBe(false);
    expect(projectArtifact(snapshot.workspaces.john,snapshot).quests.some(q=>q.id===snapshot.quests[0].id)).toBe(true);
  });
  it('identifies retained, changed, added and removed plan items', () => {
    const item=(id:string):PlanItem=>({id,title:id,status:'planned'});
    const rows=planDifferences([item('keep'),item('change'),item('remove')],[item('keep'),{...item('change'),status:'completed'},item('add')]);
    expect(rows.map(row=>row.kind)).toEqual(['retained','changed','added','removed']);
  });
  it.each([['还缺什么','gaps'],['对比两个方案','compare'],['Quest验收要求','quest'],['计划有什么变化','changes'],['步骤依赖','path'],['依据是什么','evidence'],['本周安排','timeline'],['现在怎么样','status']])('routes %s to %s',(prompt,kind)=>expect(resolveIntent(prompt)).toBe(kind));
});
