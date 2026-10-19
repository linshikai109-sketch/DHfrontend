import {describe,it,expect} from 'vitest';
import {groupConversationTopics} from '../src/domain/conversation-topics';
const group=(...prompts:string[])=>groupConversationTopics(prompts.map((prompt,i)=>({id:String(i),prompt})));
describe('conversation topics',()=>{
 it('keeps a follow-up and format changes in the same topic',()=>{expect(group('先做原型还是先做访谈？','为什么这么建议？','把它画成流程图').map(g=>g.items.length)).toEqual([3]);});
 it('archives only on a topic change',()=>{expect(group('帮我对比两个方向','每周六小时怎么安排','这周只有三小时，原来的计划怎么调整？').map(g=>g.items.length)).toEqual([1,2]);});
 it('preserves every turn in chronological contiguous groups',()=>{const gs=group('每周时间安排','预算怎么分配','每周时间安排');expect(gs.map(g=>g.id)).toEqual(['0','1','2']);expect(gs.flatMap(g=>g.items).length).toBe(3);});
 it('unknown supplementary text stays with current topic',()=>{expect(group('预算怎么分配','我还想补一点信息').length).toBe(1);});
 it('explicit topic switch starts a new group',()=>{expect(group('帮我安排计划','换个话题，接下来聊计划').length).toBe(2);});
 it('supports empty history',()=>expect(group()).toEqual([]));
});
