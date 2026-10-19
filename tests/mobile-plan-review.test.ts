import { describe, expect, it } from 'vitest';
import { reviewViewport, shouldRearmReviewHistory, canRestoreReviewFocus, scheduleReviewFocusRestore } from '../src/components/MobilePlanReview';
import { createMockService, isProposalCurrent } from '../src/domain/service';
import type { Command } from '../src/domain/types';

describe('mobile plan review', () => {
  it('restores after the current commit without waiting for an animation frame', async () => {
    let focused = false;
    scheduleReviewFocusRestore(() => { focused = true; });
    expect(focused).toBe(false);
    await Promise.resolve();
    expect(focused).toBe(true);
  });
  it('rechecks the post-Back focus guard when its microtask executes', async () => {
    let documentFocused = true;
    let restored = false;
    scheduleReviewFocusRestore(() => { restored = true; }, () => documentFocused);
    documentFocused = false;
    await Promise.resolve();
    expect(restored).toBe(false);
  });
  it('keeps its frame inside the visible viewport when the keyboard opens, pans, and closes', () => {
    expect(reviewViewport(null, 844)).toEqual({height:844,top:0});
    expect(reviewViewport({height:390,offsetTop:75},844)).toEqual({height:390,top:75});
    expect(reviewViewport({height:844,offsetTop:0},844)).toEqual({height:844,top:0});
  });
  it('restores an enabled visible trigger and falls back when adoption disabled or detached it', () => {
    const candidate={tagName:'BUTTON',connected:true,disabled:false,visible:true};
    expect(canRestoreReviewFocus(candidate)).toBe(true);
    expect(canRestoreReviewFocus({...candidate,disabled:true})).toBe(false);
    expect(canRestoreReviewFocus({...candidate,connected:false})).toBe(false);
    expect(canRestoreReviewFocus({...candidate,visible:false})).toBe(false);
    expect(canRestoreReviewFocus({...candidate,tagName:'BODY'})).toBe(false);
    expect(canRestoreReviewFocus({...candidate,tagName:'TEXTAREA'})).toBe(false);
  });
  it('rearms Back only when failed cancellation leaves the same review open', () => {
    expect(shouldRearmReviewHistory(false,true,true,'/emma/workbench','/emma/workbench')).toBe(true);
    expect(shouldRearmReviewHistory(true,true,true,'/emma/workbench','/emma/workbench')).toBe(false);
    expect(shouldRearmReviewHistory(false,false,true,'/emma/workbench','/emma/workbench')).toBe(false);
    expect(shouldRearmReviewHistory(false,true,false,'/emma/workbench','/emma/workbench')).toBe(false);
    expect(shouldRearmReviewHistory(false,true,true,'/emma/path','/emma/workbench')).toBe(false);
  });
  it('disables a source-only outdated preview before adoption and retains valid preview after a write failure', async () => {
    const service=createMockService();
    let count=0;
    const run=(command:Command)=>service.execute({role:'emma',command,operationId:`sources-${++count}`});
    await run({type:'saveAnswer',questionId:'goal',value:'Goal',nextIndex:1});
    await run({type:'createProposal',title:'预览',items:[]});
    let workspace=service.getSnapshot().workspaces.emma;
    const proposal=workspace.proposals.at(-1)!;
    expect(isProposalCurrent(workspace,proposal)).toBe(true);
    await expect(run({type:'adoptProposal',id:'missing'})).rejects.toMatchObject({code:'NOT_FOUND'});
    expect(isProposalCurrent(service.getSnapshot().workspaces.emma,proposal)).toBe(true);
    await run({type:'editContext',id:workspace.context[0].id,patch:{title:'新的依据'}});
    workspace=service.getSnapshot().workspaces.emma;
    expect(workspace.plan.version).toBe(proposal.baseVersion);
    expect(isProposalCurrent(workspace,proposal)).toBe(false);
    await expect(run({type:'adoptProposal',id:proposal.id})).rejects.toMatchObject({code:'STALE_SOURCE'});
  });
  it('rejects an outdated plan, refreshes its preview, and supports undo after application', async () => {
    const service=createMockService();
    let count=0;
    const run=(command:Command)=>service.execute({role:'emma',command,operationId:`review-${++count}`});
    const before=service.getSnapshot().workspaces.emma.plan.items;
    await run({type:'createProposal',title:'旧预览',items:[...before,{id:'review-added',title:'验证下一步',status:'planned'}]});
    const old=service.getSnapshot().workspaces.emma.proposals.at(-1)!;
    await run({type:'createProposal',title:'另一项变更',items:before});
    const other=service.getSnapshot().workspaces.emma.proposals.at(-1)!;
    await run({type:'adoptProposal',id:other.id});
    await expect(run({type:'adoptProposal',id:old.id})).rejects.toMatchObject({code:'VERSION_CONFLICT'});
    expect(service.getSnapshot().workspaces.emma.plan.items.some(item=>item.id==='review-added')).toBe(false);
    await run({type:'cancelProposal',id:old.id});
    await run({type:'createProposal',title:'更新预览',items:old.items});
    const fresh=service.getSnapshot().workspaces.emma.proposals.at(-1)!;
    await run({type:'adoptProposal',id:fresh.id});
    const applied=service.getSnapshot().workspaces.emma.plan;
    expect(applied.items.some(item=>item.id==='review-added')).toBe(true);
    await run({type:'undoPlan',proposalId:fresh.id,baseVersion:applied.version,items:before});
    expect(service.getSnapshot().workspaces.emma.plan.items).toEqual(before);
  });
});
