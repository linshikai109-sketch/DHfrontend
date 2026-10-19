/** Conservative local topic grouping. Presentation/template kinds never define a topic. */
export interface TopicEntry { id:string; prompt:string }
const subjects: [string,string,RegExp][] = [
 ['funding','资金与预算',/融资|投融资|预算|两万元|资金/],
 ['market','市场与客户',/市场推广|获客|营销|社交媒体|销售渠道/],
 ['schedule','时间与安排',/时间|小时|周|日程|排期|安排|计划/],
 ['direction','方向与选择',/对比|比较|还是|选一个|方向|投入和收获|投入和验证价值/],
 ['background','经历与能力',/经历|能力|背景|履历|关系|联系/],
 ['execution','任务与推进',/任务|步骤|先后|依赖|事项|清单|试用|小尝试|小实验|验证|需要完成/],
];
export function groupConversationTopics<T extends TopicEntry>(entries:T[]) {
 const groups:{id:string;subject:string;title:string;items:T[]}[]=[];
 for(const item of entries){
  const previous=groups.at(-1);
  const explicit=/换个话题|另外谈|另一个问题|接下来聊/.test(item.prompt);
  const followup=!explicit&&/^(为什么|为何|那|这个|这项|上面|刚才|继续|补充|再|把它|能不能|可以更)|你建议|依据是什么|原来.*调整/.test(item.prompt);
  const match=subjects.find(([, ,pattern])=>pattern.test(item.prompt));
  const subject=followup&&previous?previous.subject:match?.[0]??previous?.subject??'discussion';
  if(previous&&!explicit&&subject===previous.subject)previous.items.push(item);
  else groups.push({id:item.id,subject,title:match?.[1]??item.prompt.slice(0,24)??'讨论',items:[item]});
 }
 return groups;
}
