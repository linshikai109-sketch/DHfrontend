import type { Workspace } from './types';
export type MaterialOwner = 'personal' | 'business';
export type MaterialStatus = 'pending' | 'reading' | 'read' | 'authorization' | 'failed' | 'updated' | 'conflict';
export interface ExternalMaterial { id:string; owner:MaterialOwner; subjectId:string; url:string; name:string; platform:string; status:MaterialStatus; updatedAt:string; sourceVersion:number; fetchedAt?:string; summary?:string; references:string[] }
export interface Membership { subjectId:string; personId:string; role:string; responsibilities:string; updatedAt:string }
export interface MaterialsStore { schema:1; materials:ExternalMaterial[]; memberships:Record<string,Membership> }
export const PERSONAL_SUBJECT = 'current-person';
export const emptyMaterials = ():MaterialsStore => ({schema:1,materials:[],memberships:{}});
export function businessSubject(workspace:Workspace) { const scope=workspace.context.find(n=>n.sourceId==='j-scope'&&!n.deleted&&n.status!=='stale')?.title || '';return `${scope.includes('具体项目')?'project':'enterprise'}:${workspace.blueprint.projectId}`; }
export function normalizeMaterialUrl(raw:string) { const url=new URL(raw.trim());if(!['http:','https:'].includes(url.protocol)||!url.hostname||url.username||url.password)throw new Error('请输入完整的 HTTP 或 HTTPS 链接');url.hash='';if(url.pathname==='/')url.pathname='';return url.href; }
export function materialPlatform(url:string) {const host=new URL(url).hostname.replace(/^www\./,'');return host==='github.com'?'GitHub':host==='linkedin.com'||host.endsWith('.linkedin.com')?'领英':['x.com','twitter.com'].includes(host)?'X / 推特':host;}
export function saveMaterial(store:MaterialsStore,input:{id?:string;owner:MaterialOwner;name:string;url:string},businessId:string,now=new Date().toISOString()):{store:MaterialsStore;material:ExternalMaterial;duplicate:boolean} {
 const url=normalizeMaterialUrl(input.url);if(!input.name.trim())throw new Error('请填写资料名称');
 const subjectId=input.owner==='personal'?PERSONAL_SUBJECT:businessId;
 const duplicate=store.materials.find(m=>m.subjectId===subjectId&&m.url===url&&m.id!==input.id);if(duplicate)return {store,material:duplicate,duplicate:true};
 const old=input.id?store.materials.find(m=>m.id===input.id):undefined;
 if(input.id&&!old)throw new Error('这份资料已解除关联，请重新添加');
 const changedSource=old?.url!==url||old?.subjectId!==subjectId;
 const material:ExternalMaterial={id:old?.id||crypto.randomUUID(),owner:input.owner,subjectId,url,name:input.name.trim(),platform:materialPlatform(url),status:changedSource?'pending':old!.status,updatedAt:now,sourceVersion:(old?.sourceVersion||0)+1,references:changedSource?[]:old!.references,...(!changedSource&&old?.summary?{summary:old.summary}:{}),...(!changedSource&&old?.fetchedAt?{fetchedAt:old.fetchedAt}:{})};
 return {store:{...store,materials:[...store.materials.filter(m=>m.id!==material.id),material]},material,duplicate:false};
}
export function unlinkMaterial(store:MaterialsStore,id:string):MaterialsStore{return {...store,materials:store.materials.filter(m=>m.id!==id)};}
export function restoreMaterial(store:MaterialsStore,material:ExternalMaterial):MaterialsStore {if(store.materials.some(m=>m.id===material.id||(m.subjectId===material.subjectId&&m.url===material.url)))return store;return {...store,materials:[...store.materials,material]};}
export const materialStatus:Record<MaterialStatus,string>={pending:'已关联 · 待读取',reading:'读取中',read:'已读取',authorization:'需要授权',failed:'读取失败',updated:'已更新',conflict:'有差异'};
export function validMaterialsStore(value:unknown):value is MaterialsStore {
 if(!value||typeof value!=='object')return false;
 const v=value as MaterialsStore;
 return v.schema===1&&Array.isArray(v.materials)&&!!v.memberships&&typeof v.memberships==='object'&&v.materials.every(m=>m&&typeof m.id==='string'&&['personal','business'].includes(m.owner)&&typeof m.subjectId==='string'&&typeof m.url==='string'&&typeof m.name==='string'&&typeof m.platform==='string'&&m.status in materialStatus&&typeof m.updatedAt==='string'&&typeof m.sourceVersion==='number'&&Array.isArray(m.references))&&Object.values(v.memberships).every(m=>m&&typeof m.subjectId==='string'&&typeof m.personId==='string'&&typeof m.role==='string'&&typeof m.responsibilities==='string');
}
/** Only supplied to explicitly isolated fixture namespaces; ordinary profiles start empty. */
export function materialsFixture(businessId:string):MaterialsStore {
 const statuses:MaterialStatus[]=['read','authorization','failed','conflict'];
 return {schema:1,memberships:{},materials:statuses.map((status,i)=>({id:`external-fixture-${i}`,owner:i%2?'business':'personal',subjectId:i%2?businessId:PERSONAL_SUBJECT,url:`https://example.com/material/${i}`,name:['访谈整理笔记','企业社交主页','个人作品集','产品介绍'][i],platform:'网站',status,updatedAt:'2026-10-10T00:00:00Z',sourceVersion:1,references:[],...(status==='read'?{summary:'内容包含访谈记录整理方法与项目过程。',fetchedAt:'2026-10-10T00:00:00Z'}:{}),...(status==='conflict'?{summary:'网页标注产品已正式上线；当前资料记录为试点阶段。'}:{})}))};
}
