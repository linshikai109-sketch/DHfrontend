import type { Role } from './types';
/** Question-bound local scripts. These are never treated as microphone input. */
const scripts: Record<string,string> = {
 'e-goal':'找到新的工作方向',
 'e-goal:followup':'我做过产品运营，想用一次真实的用户研究项目，判断是否适合转向用户研究。',
 'e-experience':'我做过产品运营，参与过新用户引导优化，负责整理访谈记录和改写引导内容。',
 'e-direction':'用户研究、产品运营',
 'e-direction:followup':'我喜欢从访谈里找到用户遇到的问题，也想看看研究结论怎样改变产品。',
 'e-evidence':'我有一份访谈整理和一版新用户引导文案，可以隐去客户信息后展示。',
 'e-time':'每周 3–6 小时',
 'e-time:followup':'每周最多六小时，工作日晚间两次各一小时，周末可以集中投入四小时。',
 'e-collaboration':'有人一起讨论、希望得到反馈',
 'e-next':'我想完成一次小型用户访谈，把发现整理成有依据的改进建议。',
 'j-scope':'一个具体项目',
 'j-scope:followup':'项目叫访谈助手，帮助小团队把客户访谈整理成可以追踪的需求。',
 'j-goal':'我们想减少整理客户访谈的时间，让产品团队更容易找到反复出现的需求。',
 'j-customer':'首先面向每周都做客户访谈的小型产品团队，使用者是产品经理，购买者是团队负责人。',
 'j-stage':'核心原型',
 'j-stage:followup':'目前能跑通录入访谈和整理需求，但还没有真实付费客户，准确性需要试用验证。',
 'j-resources':'产品与技术、交付团队、项目预算',
 'j-resources:followup':'团队有我和一位工程师，最缺三位愿意持续试用并反馈的目标客户。',
 'j-commercial':'目前还没有付费客户，准备在试用结束后访谈团队负责人，验证付费意愿。',
 'j-constraints':'计划四周内完成试用，预算上限两万元，产品和工程各一人。',
 'j-milestone':'四周内让三个团队完成访谈整理，记录整理耗时、结果准确性和付费反馈。',
 'e-experience:clarify':'在新用户引导项目中，我负责整理五次访谈，把高频问题归类，再改写对应文案。',
 'e-evidence:clarify':'可以展示去掉客户姓名的访谈摘要和引导文案前后版本。',
 'e-next:clarify':'先约一次访谈，整理三个具体发现，并请同事对建议提供反馈。',
 'j-goal:clarify':'例如把一次四十分钟访谈整理成需求清单，并保留每条需求对应的原话。',
 'j-customer:clarify':'例如一支五人的软件团队，产品经理每周访谈客户，负责人决定是否付费。',
 'j-commercial:clarify':'试用后请负责人评估是否愿意付费，现在尚未收到真实订单。',
 'j-constraints:clarify':'两个人在四周内完成试用，支出控制在两万元以内。',
 'j-milestone:clarify':'让三个团队各完成一次真实访谈整理，收集耗时、准确性和付费反馈。',
};
export function onboardingVoiceScript(role: Role, questionId: string): string {
 if(!questionId.startsWith(role==='emma'?'e-':'j-')) return '';
 return scripts[questionId] ?? '';
}

/** Entering text mode makes the visible fields the single source for submission. */
export function onboardingTextDraft(kind:'single'|'multi'|'open', value:string, supplement:string, staged:string|null) {
 return {value:staged ?? value,supplement:kind==='open'?'':supplement,staged:null};
}
export function onboardingVoicePaused(mobile:boolean,sheet:'closed'|'half'|'full') {
 return mobile && sheet!=='closed';
}
