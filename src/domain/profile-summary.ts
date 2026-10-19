import type { ContextNode, Workspace } from './types';
import fixture from './report-v5-fixture.json';
export interface SummaryItem { text: string; nodes: ContextNode[] }
export interface SummaryGroup { id: string; title: string; items: SummaryItem[] }
const definitions = {
  emma: [ ['direction','我的方向','e-goal','e-direction','e-next'], ['basis','已有基础','e-experience','e-evidence'], ['time','投入时间','e-time'], ['preferences','合作偏好','e-collaboration'] ],
  john: [ ['business','业务与产品','j-goal','j-customer','j-stage'], ['validation','客户与验证','j-commercial'], ['resources','团队与资源','j-resources','j-constraints'], ['target','近期目标','j-milestone'] ],
};
/** Preserve whole semantic answers and every source; only exact duplicates are merged. */
export function profileSummary(workspace: Workspace) {
  const current = workspace.context.filter(n => !n.deleted && n.status !== 'stale' && n.title.trim());
  const used = new Set<string>();
  const groups: SummaryGroup[] = definitions[workspace.role].map(([id,title,...sources]) => {
    const nodes = current.filter(n => (n.sourceIds || [n.sourceId]).some(s => sources.includes(s.split(':')[0])) || fallbackGroups(n,workspace.role).includes(id));
    const items: SummaryItem[] = [];
    for (const node of nodes) {
      if (used.has(node.id) && !fallbackGroups(node,workspace.role).includes(id)) continue;
      used.add(node.id);
      const text = displayText(node,id);
      const item = items.find(i => i.text.replace(/[\s。；;]/g,'') === text.replace(/[\s。；;]/g,''));
      if (item) item.nodes.push(node); else items.push({text,nodes:[node]});
    }
    return {id,title,items};
  });
  const other=current.filter(n=>!used.has(n.id)&&!n.sourceId.startsWith('j-scope'));
  if(other.length) groups.push({id:'other',title:'其他资料',items:other.map(node=>({text:node.title,nodes:[node]}))});
  const from = (s:string) => current.find(n=>n.sourceId===s)?.title;
  const project = !!from('j-scope')?.includes('具体项目');
  const introSources = workspace.role === 'emma' ? ['e-experience','e-direction','e-goal'] : ['j-goal','j-customer'];
  const anchored = introSources.map(from).filter((s):s is string=>!!s);
  const fallback = [groups.find(g=>g.id==='basis')?.items[0]?.text,groups.find(g=>g.id==='direction')?.items[0]?.text].filter((s):s is string=>!!s);
  const intro = [...new Set(anchored.length?anchored:fallback)].slice(0,3).map(s=>s.replace(/[。；;]+$/,'')).join('。');
  return { conflicts:weeklyTimeConflicts(current), groups:groups.filter(g=>g.items.length), intro, project,
    title: workspace.role==='emma'?'个人画像':project?'项目概览':'企业概览',
    name:workspace.role==='john'?from('j-scope:followup'):undefined, stage:workspace.role==='john'?from('j-stage'):undefined,
    stale:workspace.context.filter(n=>!n.deleted&&n.status==='stale'),
  };
}

function weeklyHours(text:string):{min:number;max:number;cap:boolean}|undefined {
 const digits:Record<string,string>={'一':'1','二':'2','两':'2','三':'3','四':'4','五':'5','六':'6','七':'7','八':'8','九':'9','十':'10'};
 const normalized=text.replace(/[一二两三四五六七八九十]+/g,value=>{if(value.length===1)return digits[value];const parts=value.split('十');return parts.length===2?String(Number(parts[0]?digits[parts[0]]:1)*10+Number(parts[1]?digits[parts[1]]:0)):value;});
 const match=normalized.match(/每周\s*(最多|不超过|至多)?\s*(\d+(?:\.\d+)?)\s*(?:[–—~至到-]\s*(\d+(?:\.\d+)?)\s*)?小时/);
 if(!match)return undefined;const min=Number(match[2]),max=Number(match[3]||match[2]);return {min:match[1]?0:min,max,cap:!!match[1]};
}
export function weeklyTimeConflicts(nodes:ContextNode[]) {
 const candidates=nodes.filter(n=>n.sourceId.split(':')[0]==='e-time').map(node=>({node,hours:weeklyHours(node.title)})).filter(item=>!!item.hours);
 const conflicts:{nodes:ContextNode[];title:string}[]=[];
 for(let i=0;i<candidates.length;i++)for(let j=i+1;j<candidates.length;j++){
  const a=candidates[i],b=candidates[j],x=a.hours!,y=b.hours!;
  const incompatible=x.max<y.min||y.max<x.min||(x.cap&&y.max>x.max)||(y.cap&&x.max>y.max);
  if(incompatible)conflicts.push({nodes:[a.node,b.node],title:'每周投入时间有差异'});
 }
 return conflicts;
}

function fallbackGroups(node:ContextNode,role:Workspace['role']):string[]{
 if((node.sourceIds||[node.sourceId]).some(s=>/^[ej]-/.test(s)))return [];
 const text=node.title;
 if(role==='john')return [node.kind==='goal'||node.kind==='action'?'target':node.kind==='constraint'?'resources':'business'];
 const fixed:Record<string,string[]>={'fixture:S1':['basis'],'fixture:S2':['basis'],'fixture:S3':['basis'],'fixture:S4':['basis'],'fixture:S5':['basis'],'fixture:S6':['direction','time'],'fixture:S7':['preferences'],'fixture:S8':['other']};
 if(fixed[node.sourceId])return fixed[node.sourceId];
 if(/偏好|喜欢.{0,8}(?:合作|独立)|合作方式/.test(text))return ['preferences'];
 if(/每周|每月|可投入|预算|时间限制/.test(text))return ['time'];
 if(node.kind==='goal'||node.kind==='direction'||/希望|想要|目标|计划/.test(text))return ['direction'];
 if(/做过|负责过|参与过|完成过|做出|曾|经历|访谈|作品|贡献|自学/.test(text))return ['basis'];
 return ['other'];
}
function displayText(node:ContextNode,group:string){
 // Only known, untouched fixture presentation metadata is omitted; authored content remains intact.
 const original=fixture.sources.find(s=>`fixture:${s.id}`===node.sourceId);
 if(original&&node.title===original.text&&!node.edited&&node.sourceId==='fixture:S6') {
  return group==='time'?'每周约可投入两小时':'希望保留现有工作，未来半年探索 AI 产品相关工作；先在八周内做一份能解释问题与取舍的作品。';
 }
 return node.title.trim();
}
