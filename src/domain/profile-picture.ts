import type { ContextNode, Workspace } from "./types";
export type PictureField = "state" | "focus" | "experience" | "conditions" | "unknown";
export interface PictureEntry { id: string; node: ContextNode; segment: number; text: string; field: PictureField; withheld: boolean }
/** Integration point for approved question mappings; no ability or character labels inferred. */
export interface PictureMapping { questionFields?: Record<string, PictureField> }
export const pictureTitles: Record<PictureField, string> = {state:"当前状态",focus:"当前关注",experience:"已有基础",conditions:"资源与限制",unknown:"已有观察与待了解"};
export function fragments(text: string) { return text.split(/[；;。，\n]/).map(s=>s.trim()).filter(Boolean); }
export function classify(text: string, source: string, mapping: PictureMapping = {}, sourceKind?: ContextNode["kind"]): PictureField {
 if (/不知道|未知|不确定|不愿|不想透露|拒绝|跳过|尚未|未做过|没做过|撤回|冲突|矛盾|停止提问|停问|先看摘要/.test(text)) return "unknown";
 if (/每周|每月|可投入|只能投入|最多投入|预算|时间限制|资源限制|两人|团队规模/.test(text)) return "conditions";
 if (/希望|想|计划|准备|打算|将要|申请.{0,12}岗位|工作方向|下一步|先完成|(?:先在|在).{0,8}(?:周|月|年|天)内.{0,12}(?:做|完成)/.test(text)) return "focus";
 // A completed action in a mixed goal answer stays evidence; an intended output
 // without a past-tense marker follows its actual goal source, not the noun 作品.
 const anchor=source.split(":")[0];
 const sourceField=mapping.questionFields?.[source] || mapping.questionFields?.[anchor] ||
   (sourceKind === "goal" || ["e-goal","e-direction","e-next","j-goal","j-milestone"].includes(anchor) ? "focus" : undefined);
 if (sourceField === "focus" && !/做过|负责过|参与过|完成过|已完成|曾经|上周|去年/.test(text)) return "focus";
 if (/做过|负责过|参与过|完成过|访谈|作品|成果|经历/.test(text)) return "experience";
 if (/目前|当前|阶段|已立项|已有客户|原型|试点/.test(text)) return "state";
 return mapping.questionFields?.[anchor] || ({"e-goal":"focus","e-direction":"focus","e-next":"focus","e-experience":"experience","e-evidence":"experience","e-time":"conditions","e-collaboration":"conditions","j-goal":"focus","j-milestone":"focus","j-stage":"state","j-resources":"conditions","j-constraints":"conditions"} as Record<string,PictureField>)[anchor] || "unknown";
}
export function pictureEntries(workspace: Workspace, mapping: PictureMapping = {}): PictureEntry[] {
 const result=workspace.context.filter(n=>!n.deleted).flatMap(node=>fragments(node.title).map((text,segment)=>({id:`${node.id}:${segment}`,node,segment,text,field:node.status==="stale"?"unknown" as const:classify(text,node.sourceId,mapping,node.kind),withheld:node.status!=="confirmed"})));
 for(const answer of Object.values(workspace.acquisition.answers).filter(a=>a.skipped)) {
  if(workspace.context.some(n=>n.sourceId===answer.id)) continue;
  const node:ContextNode={id:`skip:${answer.id}`,title:"已跳过",sourceId:answer.id,sourceVersion:answer.version,kind:"fact",status:"candidate",edited:false,deleted:false,x:0,y:0};
  result.push({id:node.id,node,segment:0,text:"已跳过",field:"unknown",withheld:true});
 }
 return result;
}
export function pictureToken(workspace:Workspace) {return JSON.stringify({nodes:workspace.context.map(n=>[n.id,n.title,n.kind,n.sourceVersion,n.status,n.deleted]),answers:Object.values(workspace.acquisition.answers).map(a=>[a.id,a.version,a.skipped])});}
export function pictureFocus(workspace:Workspace) {return pictureEntries(workspace).find(e=>e.field==="focus"&&(!e.withheld||workspace.role==="emma"&&e.node.status==="candidate"))?.text;}
export function stopRequested(text:string) {return /(?:停止|别再|不要再|不再|先别|暂停).{0,4}(?:提问|问)|停问|先看摘要|先看总结/.test(text);}
