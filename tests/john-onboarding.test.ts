import { describe, expect, it } from 'vitest';
import { emptyMaterials, saveMaterial } from '../src/domain/external-materials';
import { confirmJohnMaterials, johnAnswerLinks, johnSelfMembership, missingMembershipPrompt, needsMembershipQuestion } from '../src/domain/john-onboarding';

const answer = (value:string, skipped=false) => ({value,skipped});
describe('John answers and final materials review', () => {
  it('reuses explicit self statements from earlier questions without asking twice', () => {
    const answers = {'j-goal':answer('我是产品负责人，我负责需求访谈和试用。团队有两人。')};
    expect(johnSelfMembership(answers)).toEqual({role:'产品负责人',responsibilities:'需求访谈和试用'});
    expect(needsMembershipQuestion(answers)).toBe(false);
  });
  it('asks only the missing part and preserves an already supplied role', () => {
    const candidate = johnSelfMembership({'j-resources':answer('我是创始人。团队有工程师。')});
    expect(missingMembershipPrompt(candidate)).toBe('你在这个项目主要负责哪些工作？');
    expect(needsMembershipQuestion({'j-resources':answer('团队两人')} , {role:'创始人',responsibilities:'产品'})).toBe(false);
  });
  it('does not convert team claims, negation or skipped answers to personal identity', () => {
    expect(johnSelfMembership({'j-resources':answer('团队的工程师负责开发，我不是工程师。')})).toEqual({role:'',responsibilities:''});
    expect(johnSelfMembership({'j-goal':answer('我是创始人，我负责客户。',true)})).toEqual({role:'',responsibilities:''});
  });
  it('allows one missing-field question to be skipped without another fallback', () => {
    expect(needsMembershipQuestion({'j-resources:membership':answer('',true)})).toBe(false);
    expect(needsMembershipQuestion({'j-constraints:membership':answer('',true)})).toBe(false);
  });
  it('understands a direct reply to the missing-duties question without rewriting the original answer', () => {
    const answers={'j-resources':answer('我是创始人。'), 'j-resources:membership':answer('产品需求和客户访谈')};
    expect(johnSelfMembership(answers)).toEqual({role:'创始人',responsibilities:'产品需求和客户访谈'});
    expect(answers['j-resources:membership'].value).toBe('产品需求和客户访谈');
    expect(johnSelfMembership({...answers,'j-resources:membership':answer('暂未确定')})).toEqual({role:'创始人',responsibilities:''});
  });
  it('revises a direct missing-field answer even when a prior confirmation already saved the old value', () => {
    expect(johnSelfMembership({'j-resources:membership-responsibilities':answer('交付管理')}, {role:'负责人',responsibilities:'旧职责'})).toEqual({role:'负责人',responsibilities:'交付管理'});
    expect(johnSelfMembership({'j-constraints:membership-role':answer('设计师')}, {role:'旧角色',responsibilities:'设计'})).toEqual({role:'设计师',responsibilities:'设计'});
    expect(needsMembershipQuestion({'j-resources:membership-responsibilities':answer('',true)})).toBe(false);
  });
  it('keeps links optional, normalized and contextual until ownership review', () => {
    expect(johnAnswerLinks({'j-goal':answer('暂无资料')})).toEqual([]);
    const links = johnAnswerLinks({'j-goal':answer('产品 https://example.com/#overview。'), 'j-stage':answer('https://example.com/'), 'j-resources:membership':answer('作品 https://portfolio.example.com/me。')});
    expect(links.map(l=>[l.url,l.owner])).toEqual([['https://example.com/','business'],['https://portfolio.example.com/me','personal']]);
    expect(johnAnswerLinks({'j-goal':answer('https://user:password@example.com/')})).toEqual([]);
  });
  it('final confirmation retains authorization and other projects while saving self-report and new pending links', () => {
    const store = saveMaterial(emptyMaterials(),{owner:'business',name:'受限资料',url:'https://private.example.com'},'enterprise:a').store;
    store.materials[0].status='authorization';
    store.memberships['enterprise:b']={subjectId:'enterprise:b',personId:'current-person',role:'设计师',responsibilities:'设计',updatedAt:'old'};
    const links=johnAnswerLinks({'j-goal':answer('https://private.example.com'), 'j-resources':answer('https://mine.example.com')});
    const final=confirmJohnMaterials(store,'enterprise:a',{role:'负责人',responsibilities:'访谈'},links,'now');
    expect(final.materials[0].status).toBe('authorization');
    expect(final.materials[0].name).toBe('受限资料');
    expect(final.materials[1]).toMatchObject({owner:'personal',subjectId:'current-person',status:'pending'});
    expect(final.memberships['enterprise:b']).toEqual(store.memberships['enterprise:b']);
    expect(final.memberships['enterprise:a']).toMatchObject({role:'负责人',responsibilities:'访谈'});
    expect(store.memberships['enterprise:a']).toBeUndefined();
  });
  it('honors the reviewed link ownership rather than assuming team context is personal', () => {
    const links=johnAnswerLinks({'j-resources':answer('https://company.example.com')}).map(l=>({...l,owner:'business' as const}));
    expect(confirmJohnMaterials(emptyMaterials(),'project:a',{role:'',responsibilities:''},links).materials[0].subjectId).toBe('project:a');
  });
});
