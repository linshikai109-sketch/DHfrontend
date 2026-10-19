export const voiceIntents = ['action', 'comparison', 'matrix', 'diff', 'flow', 'relationships', 'roadmap', 'timeline', 'checklist', 'experiment', 'evidence', 'statistics'] as const;
export type VoiceIntent = typeof voiceIntents[number];
export type VoiceScene = { id: VoiceIntent; prompt: string; title: string; answer: string; columns?: string[]; rows: string[][]; };
const prompts: Record<'emma'|'john', string[]> = {
 emma: ['看看我当前的任务，现在最值得先做哪件事？','先做原型还是先做访谈？帮我对比一下。','时间有限，帮我从投入和收获两个角度选一个方向。','这周只有三小时，原来的六小时计划应该怎么调整？','从整理访谈到做出作品，先后步骤是什么？','我现有的经历和用户研究方向有什么联系？','把方向验证、能力和作品积累放在一起，看看接下来怎么走。','每周六小时，帮我安排一下接下来两周。','整理一下这次用户研究需要完成的事项。','怎么用一个小尝试判断我适不适合用户研究？','你建议我先做访谈，依据是什么？','假设六小时分给访谈、整理和复盘，时间占比会是什么样？'],
 john: ['看看我当前的任务，下一步优先做什么？','先优化原型还是先找用户试用？帮我对比一下。','团队只有两个人，从投入和验证价值上怎么选？','如果四周试用窗口缩短到两周，范围怎么调整？','从现有原型到小范围试用，哪些步骤有前后依赖？','客户问题、产品能力和收入假设有什么联系？','把产品、市场和资金的路线放在一起看看。','帮我们排一下四周试用的时间安排。','开始试用前，还有哪些事情需要完成？','用什么小实验验证团队愿不愿意使用访谈整理工具？','为什么建议先验证整理效率，有什么依据？','假设两万元按开发、招募和预留分配，占比是什么样？'],
};
export function workbenchScene(role:'emma'|'john', id:VoiceIntent):VoiceScene {
 const john=role==='john';
 const rows: Record<VoiceIntent,string[][]> = {
 action: [[john?'邀请 3 个产品团队试用':'整理一次访谈小练习',john?'先约定使用场景和完成标准':'围绕一个熟悉的问题完成访谈与归纳'],['第一步',john?'准备一份真实访谈记录':'列出 5 个访谈问题'],['完成标准',john?'得到整理耗时与修改意见':'形成 3 条有原话支撑的发现']],
 comparison: john ? [['第一份产出','优化后的核心流程','真实使用记录'],['主要投入','工程搭建与测试','邀请、观察与归纳'],['适用条件','已有明确的使用问题','尚未验证真实使用'],['下一步','修复一个阻断问题','邀请 3 个团队试用']] : [['第一份产出','可测试的交互原型','有依据的需求结论'],['主要投入','搭建与测试','招募、访谈与整理'],['适用条件','问题相对明确','需求仍待验证'],['下一步','确定一个关键流程','准备访谈提纲']],
 matrix: john ? [['时间投入','较高','较低'],['验证使用价值','间接','直接'],['技术准备','进一步打磨','核心流程可用即可'],['当前优先级','按反馈迭代','优先']] : [['时间投入','较高','较低'],['验证需求','间接','直接'],['呈现能力','强','中'],['当前优先级','后续','优先']],
 diff: [[john?'试用周期':'每周投入',john?'4 周':'6 小时',john?'2 周':'3 小时'],['保留',john?'完整整理流程':'访谈与整理',john?'核心摘要流程':'1 次访谈与关键发现'],['延后',john?'高级导出、多人协作':'作品排版',john?'下一轮再验证':'下周完成']],
 flow: (john?['明确试用目标','准备访谈记录','完成核心流程','邀请团队试用','整理反馈']:['明确研究问题','准备访谈提纲','完成访谈','归纳关键发现','整理作品']).map((s,i)=>[String(i+1),s]),
 relationships: john?[['客户问题','访谈整理耗时'],['产品能力','摘要与原话溯源'],['价值假设','减少整理与核对时间'],['验证方式','观察团队完成一次整理']]:[['已有经历','产品运营与内容整理'],['可迁移能力','提问、归纳与表达'],['发展方向','用户研究'],['下一份依据','带原话记录的访谈总结']],
 roadmap: john?[['产品','核心流程','试用反馈','迭代范围'],['市场','目标团队','邀请试用','总结价值主张'],['资金','预算分配','记录成本','评估下一阶段']]:[['方向','访谈练习','复盘感受','确认研究方向'],['能力','练习提问','归纳发现','研究方法补充'],['作品','保留过程','整理案例','形成作品页']],
 timeline: john?[['第 1 周','确定场景与试用标准'],['第 2 周','完成核心流程检查'],['第 3 周','邀请团队并观察使用'],['第 4 周','归纳反馈与下一轮范围']]:[['第 1 周 · 2 小时','提纲与招募'],['第 1 周 · 4 小时','访谈与记录'],['第 2 周 · 3 小时','归纳发现'],['第 2 周 · 3 小时','案例与复盘']],
 checklist: (john?['确定试用团队与联系人','准备原始访谈记录','检查摘要与溯源流程','约定反馈时间']:['确定研究问题','完成访谈提纲','约好访谈对象','准备记录方式']).map(s=>[s,'待开始']),
 experiment: [['假设',john?'产品团队愿意用工具减少访谈整理时间':'我愿意持续做访谈与归纳工作'],['做法',john?'邀请 3 个团队各整理 1 份访谈':'完成 2 次访谈和 1 份发现总结'],['观察',john?'完成耗时、修改次数和继续使用意愿':'提问质量、整理投入和持续意愿'],['下一步','记录结果后再决定是否扩大范围']],
 evidence: john?[['已有条件','核心原型；产品负责人和工程师各 1 人'],['约束','4 周试用窗口；预算上限 2 万元'],['尚待验证','暂无付费客户，不能据此判断付费意愿']]:[['已有经历','产品运营、访谈归纳和引导内容整理'],['时间条件','每周可投入 6 小时'],['尚待验证','对长期访谈与研究工作的兴趣']],
 statistics: john?[['开发','60','12,000 元'],['招募','20','4,000 元'],['预留','20','4,000 元']]:[['访谈','50','3 小时'],['整理','33','2 小时'],['复盘','17','1 小时']],
 };
 const titles:Record<VoiceIntent,string>={action:'先完成一件具体的事',comparison:'两条推进路径',matrix:'投入与价值',diff:'缩小范围，保留核心',flow:'步骤与先后顺序',relationships:'条件与目标的联系',roadmap:john?'项目路线图':'个人发展路径',timeline:'时间安排',checklist:'开始前的清单',experiment:'用一次尝试验证',evidence:'建议的依据',statistics:john?'预算分配':'时间分配'};
 const answers:Record<VoiceIntent,string>={action:john?'先观察真实团队如何使用核心流程。':'先完成一次小型研究，获得可复盘的经历。',comparison:john?'先观察试用，更有助于找到值得优化的流程。':'先做访谈更有助于明确需求，再决定原型范围。',matrix:john?'现有原型已具备核心能力，先试用可以更直接验证使用价值。':'当前信息下，研究路径的投入更小，也更直接验证需求。',diff:'这是范围调整的建议，还没有更改当前计划。',flow:'先明确问题，再推进依赖它的步骤。',relationships:'把已有条件连接到待验证的目标。',roadmap:'不同方向并行推进，在阶段节点汇总结果。',timeline:'为执行和复盘分别留出时间。',checklist:'先完成准备项，再进入实际执行。',experiment:'提前约定观察内容，用结果决定下一步。',evidence:'建议基于这些条件；未验证部分继续保留为问题。',statistics:'按你提出的假设计算，各项占比如下。'};
 return {id,prompt:prompts[role][voiceIntents.indexOf(id)],title:titles[id],answer:answers[id],rows:rows[id],columns:['comparison','matrix'].includes(id)?(john?['比较内容','先优化原型','先找用户试用']:['比较内容','先做原型','先做研究']):id==='diff'?['事项','原安排','调整后']:id==='roadmap'?['方向','当前','下一阶段','后续']:undefined};
}
/** A refillable shuffle bag guarantees each intent appears once before repetition. */
export function createIntentBag(random:()=>number=Math.random){let bag:VoiceIntent[]=[];let last:VoiceIntent|undefined;return {next(){if(!bag.length){bag=[...voiceIntents];for(let i=bag.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[bag[i],bag[j]]=[bag[j],bag[i]];}if(bag.at(-1)===last)[bag[0],bag[bag.length-1]]=[bag[bag.length-1],bag[0]];}last=bag.pop()!;return last;}};}
export function resolveWorkbenchView(text:string):'task'|'plan'|null {if(/调整|修改|变化|缩短|延后/.test(text))return null;if(/当前任务|现在.*做什么|接下来.*做什么|当前行动/.test(text))return 'task';if(/当前计划|我的计划|查看计划|展开计划|看看计划|计划进度/.test(text))return 'plan';return null;}
