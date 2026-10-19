import { describe,it,expect } from 'vitest';
import { emptyMaterials,normalizeMaterialUrl,saveMaterial,unlinkMaterial,restoreMaterial,PERSONAL_SUBJECT } from '../src/domain/external-materials';
describe('external material ownership',()=>{
 it('rejects active or credential-bearing URLs',()=>{for(const url of ['javascript:alert(1)','file:///tmp/a','ftp://example.com','https://user:pass@example.com'])expect(()=>normalizeMaterialUrl(url)).toThrow();expect(normalizeMaterialUrl('https://GITHUB.com/hoi#readme')).toBe('https://github.com/hoi');});
 it('deduplicates within one subject but separates person and businesses',()=>{const a=saveMaterial(emptyMaterials(),{owner:'personal',name:'Repo',url:'https://github.com/hoi'},'a');const dupe=saveMaterial(a.store,{owner:'personal',name:'Repo 2',url:'https://github.com/hoi#readme'},'b');expect(dupe.duplicate).toBe(true);expect(dupe.material.subjectId).toBe(PERSONAL_SUBJECT);const company=saveMaterial(a.store,{owner:'business',name:'Repo',url:'https://github.com/hoi'},'a');expect(company.store.materials).toHaveLength(2);const next=saveMaterial(company.store,{owner:'business',name:'Repo',url:'https://github.com/hoi'},'b');expect(next.store.materials).toHaveLength(3);});
 it('stores user URL pending and invalidates read contribution on URL or ownership change',()=>{const a=saveMaterial(emptyMaterials(),{owner:'personal',name:'Site',url:'https://example.com'},'a');expect(a.material.status).toBe('pending');a.material.status='read';a.material.summary='Prior source';a.material.fetchedAt='2026-01-01';a.material.references=['fact-1'];const moved=saveMaterial(a.store,{id:a.material.id,owner:'business',name:'Site',url:a.material.url},'a');expect(moved.material.status).toBe('pending');expect(moved.material.summary).toBeUndefined();expect(moved.material.fetchedAt).toBeUndefined();expect(moved.material.references).toEqual([]);expect(moved.material.subjectId).toBe('a');});
 it('supports unlink undo without duplicating re-added URLs',()=>{const a=saveMaterial(emptyMaterials(),{owner:'personal',name:'Site',url:'https://example.com'},'a');const removed=unlinkMaterial(a.store,a.material.id);expect(removed.materials).toHaveLength(0);expect(restoreMaterial(removed,a.material).materials).toHaveLength(1);expect(restoreMaterial(a.store,a.material).materials).toHaveLength(1);expect(()=>saveMaterial(removed,{id:a.material.id,owner:'personal',name:'Site',url:a.material.url},'a')).toThrow();});
});
import { materialsFixture,validMaterialsStore } from '../src/domain/external-materials';
import { readView,writeView,setFixtureViewNamespace } from '../src/domain/view-state';
import { vi,afterEach } from 'vitest';
afterEach(()=>{setFixtureViewNamespace(false);vi.unstubAllGlobals();});
it('isolates fixture and runtime material stores and surfaces failed writes',()=>{
 const data=new Map<string,string>();vi.stubGlobal('localStorage',{getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>data.set(k,v)});
 const fixture=materialsFixture('business-a');expect(validMaterialsStore(fixture)).toBe(true);expect(fixture.materials.map(m=>m.status)).toEqual(['read','authorization','failed','conflict']);
 setFixtureViewNamespace(true,'v6');writeView('demo_mock','emma','external-materials-v1',fixture);
 setFixtureViewNamespace(false);expect(readView('demo_mock','emma','external-materials-v1',emptyMaterials()).materials).toHaveLength(0);
 expect(readView('connected','emma','external-materials-v1',emptyMaterials()).materials).toHaveLength(0);
 vi.stubGlobal('localStorage',{setItem:()=>{throw new Error('quota');}});expect(writeView('demo_mock','emma','external-materials-v1',fixture)).toBe(false);
 expect(validMaterialsStore({schema:1,materials:[{id:'broken'}],memberships:{}})).toBe(false);
});
it('keeps original object unchanged when an ownership edit collides with another subject link',()=>{
 const input={name:'Site',url:'https://example.com'};const personal=saveMaterial(emptyMaterials(),{...input,owner:'personal'},'a');const business=saveMaterial(personal.store,{...input,owner:'business'},'a');const move=saveMaterial(business.store,{...input,id:personal.material.id,owner:'business'},'a');expect(move.duplicate).toBe(true);expect(move.store).toBe(business.store);expect(move.store.materials.find(m=>m.id===personal.material.id)?.owner).toBe('personal');expect(move.material.id).toBe(business.material.id);
});
import { businessSubject } from '../src/domain/external-materials';
import { createMockService } from '../src/domain/service';
it('keys business scope from live edited context without resurrecting stale or deleted answers',()=>{
 const w=structuredClone(createMockService().getSnapshot().workspaces.john);w.acquisition.answers['j-scope']={id:'j-scope',value:'企业整体方向',version:1,skipped:false};w.context=[{id:'scope',sourceId:'j-scope',title:'一个具体项目',kind:'fact',sourceVersion:1,status:'confirmed',edited:true,deleted:false,x:0,y:0}];expect(businessSubject(w)).toBe(`project:${w.blueprint.projectId}`);w.context[0].deleted=true;expect(businessSubject(w)).toBe(`enterprise:${w.blueprint.projectId}`);w.context[0].deleted=false;w.context[0].status='stale';expect(businessSubject(w)).toBe(`enterprise:${w.blueprint.projectId}`);
});
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Context } from '../src/context';
import { useExternalMaterials } from '../src/components/ExternalMaterials';
it('keeps reset fresh namespace empty and refuses corrupt stored bytes before saving',()=>{
 const data=new Map<string,string>();vi.stubGlobal('localStorage',{getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>data.set(k,v)});
 const snapshot=createMockService().getSnapshot();let api:ReturnType<typeof useExternalMaterials>|undefined;
 function Probe(){api=useExternalMaterials();return null;}
 const render=()=>renderToStaticMarkup(createElement(Context.Provider,{value:{snapshot,workspace:snapshot.workspaces.emma,role:'emma',run:async()=>null,busy:false,error:'',pending:false,clearError:()=>{},recover:async()=>{},setFault:()=>{}}},createElement(Probe)));
 setFixtureViewNamespace(true,'fresh');render();expect(api!.materials).toHaveLength(0);
 setFixtureViewNamespace(true,'v6');render();expect(api!.materials).toHaveLength(4);
 setFixtureViewNamespace(false);data.set('emma-john-v2-view:demo_mock:emma:external-materials-v1','{ broken JSON');render();expect(()=>api!.saveMaterial({owner:'personal',name:'Site',url:'https://example.com'})).toThrow('已有资料暂时无法读取');expect(data.get('emma-john-v2-view:demo_mock:emma:external-materials-v1')).toBe('{ broken JSON');
});
