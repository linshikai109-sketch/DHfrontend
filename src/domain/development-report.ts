import { limitedAnalysis, type DevelopmentAnalysis } from "./development-analysis";
import { pictureEntries,pictureToken,type PictureField } from "./profile-picture";
import type { Workspace } from "./types";
export interface RoleStory { title:string; story:string; basis:string; evidenceCaption:string; sourceIds:string[]; hidden:boolean }
export interface DevelopmentReport { version:number; sourceToken:string; createdAt:string; mode:"demo_projection"; story:RoleStory; sections:{field:PictureField; title:string; lines:string[]}[]; suggestion:string; analysis?:DevelopmentAnalysis }
export const roleCandidates = ["硅基建筑师","问题破译者","边界探险家","体验编织者","知识炼金师","增长实验家","协作织网者"];
export function onboardingComplete(w:Workspace) {return w.role === "emma" ? w.acquisition.completed === true || (w.acquisition.completed === undefined && w.acquisition.confirmed) : w.acquisition.confirmed;}
export function reportToken(w:Workspace) {return JSON.stringify([pictureToken(w),w.roleExpression || null]);}
/** Exact current self-report excerpts only. This mock is not an independent semantic reviewer. */
export function roleStory(w:Workspace):RoleStory {
 const saved=w.developmentReport;
 if(saved?.analysis && saved.sourceToken===reportToken(w) && saved.analysis.sourceToken===reportToken(w) && saved.analysis.mode!=="limited_projection") return {...saved.story,hidden:w.roleExpression?.hidden||false,title:w.roleExpression?.title||saved.story.title};
 const entries=pictureEntries(w).filter(e=>e.node.status!=="stale"&&!e.node.id.startsWith("skip:")&&e.field!=="unknown");
 const selected=entries.filter(e=>e.field==="experience"||e.field==="focus").slice(0,3);
 return {title:w.roleExpression?.title||"还需要了解你的经历",hidden:w.roleExpression?.hidden||false,
  story:selected.length?selected.map(e=>`${e.field==="experience"?"你分享的经历":"你当前的关注"}：${e.text}。`).join(""):"还没有足够的经历资料。你可以以后再补充做过什么、怎么做的，以及结果如何。",
  basis:selected.length?"根据你自己提供的资料":"还没有足够的经历资料",
  evidenceCaption:w.roleExpression?.title?"自选称号，不代表能力认证；资料由你提供，尚未向其他来源核实":"你自己提供的资料，尚未向其他来源核实",
  sourceIds:[...new Set(selected.map(e=>e.node.sourceId))]};
}
export function createDevelopmentReport(w:Workspace,now=new Date().toISOString()):DevelopmentReport {
 const entries=pictureEntries(w);const fields:PictureField[]=["state","focus","experience","unknown"];
 return {version:(w.developmentReport?.version||0)+1,sourceToken:reportToken(w),createdAt:now,mode:"demo_projection",story:roleStory(w),analysis:limitedAnalysis(w),
 sections:fields.map(field=>({field,title:({state:"当前状态",focus:"当前关注",experience:"已有基础",unknown:"已有观察与待了解",conditions:"资源与限制"})[field],
 lines:entries.filter(e=>e.field===field||field==="focus"&&e.field==="conditions").map(e=>`${e.text}${e.withheld?"（自述，待核对）":"（用户资料，未外部核验）"}`)})),
 suggestion:entries.some(e=>e.field==="focus")?"可以先选一项当前关注，核对现实投入与已有经历，再记录一次范围清楚的尝试。此建议尚未采纳。":"可以先明确一件想推进的事；信息不足时保留探索，不必完成 Quest。"};
}
export function currentDevelopmentReport(w:Workspace) {const r=w.developmentReport;return r&&r.sourceToken===reportToken(w)?r:undefined;}
export type ShareFields={avatar:boolean;title:boolean;story:boolean};
/** Never include raw answers, basis, private memories or full profile in exports. */
export function shareCard(story:RoleStory,fields:ShareFields) {return { ...(fields.avatar?{avatar:"中性角色形象占位"}:{}),...(fields.title?{title:story.title}:{}),...(fields.story?{story:story.story}:{}),notice:"本地分享预览；内容由本人提供，尚未向其他来源核实，不代表能力认证" };}

export function cardSvg(story:RoleStory,fields:ShareFields,fixture=false) {
 const data=shareCard(story,fields);const escape=(text:string)=>text.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
 const body=(fields.avatar?'<div style="font-size:44px;color:#527780">◎</div>':'')+(fields.title?`<h1>${escape(story.title)}</h1>`:'')+(fields.story?`<p>${escape(story.story)}</p>`:'');
 return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="700" viewBox="0 0 1000 700"><rect width="1000" height="700" rx="24" fill="#edf5f7"/><foreignObject x="48" y="40" width="904" height="620"><div xmlns="http://www.w3.org/1999/xhtml" style="font-family:system-ui,sans-serif;color:#172b46;font-size:25px;line-height:1.8;overflow-wrap:anywhere">${body}<p style="font-size:18px;color:#617586">${fixture?'虚构示例 · ':''}${escape(data.notice)}</p></div></foreignObject></svg>`;
}
