import { watchRestoredPage } from "../src/domain/restored-page";
import { describe, expect, it } from "vitest";
import { resetDemo } from "../src/domain/reset-demo";
import { createMockService } from "../src/domain/service";
import { fixtureStorage } from "../src/domain/report-v5-fixture";
import { upworkFixture } from "../src/domain/upwork-fixture";
import { onboardingComplete } from "../src/domain/development-report";
import { pictureToken } from "../src/domain/profile-picture";
function setup() {
 const data = new Map<string,string>();
 const storage = { get length(){return data.size;}, key:(i:number)=>[...data.keys()][i]??null,
 getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>{data.set(k,v);},removeItem:(k:string)=>{data.delete(k);} };
 return {data,storage};
}
describe("confirmed demo reset with isolated storage",()=>{
 it("Back cache reloads the frozen document; normal load and cleaned-up listener do not",()=>{
  const target=new EventTarget();let reloads=0;const stop=watchRestoredPage(target,()=>reloads++);
  target.dispatchEvent(new Event("pageshow"));expect(reloads).toBe(0);
  const cached=Object.assign(new Event("pageshow"),{persisted:true});target.dispatchEvent(cached);expect(reloads).toBe(1);
  stop();target.dispatchEvent(cached);expect(reloads).toBe(1);
 });
 for(const role of ["emma","john"] as const) it(`${role}: completed → reset → refresh → repeat`,async()=>{
  const {data,storage}=setup(); const service=createMockService(storage);
  await service.execute({role,operationId:"finish",command:role==="emma"?{type:"completeOnboarding",pictureToken:pictureToken(service.getSnapshot().workspaces.emma)}:{type:"confirmContext",limited:true,pictureToken:pictureToken(service.getSnapshot().workspaces.john)}});
  expect(onboardingComplete(service.getSnapshot().workspaces[role])).toBe(true);
   data.set("unrelated-app","keep");data.set("emma-john-v2-view:demo_mock:emma:answer-e-goal","draft");data.set("emma-john-v2-pending-demo_mock","pending");
  const url=resetDemo(storage,role,null); expect(url).toBe(`/mvp-ui/v2/${role}/onboarding?fixture=fresh`);
  expect(data.has("dhai-mvp-product-demo-v1")).toBe(false);expect(data.has("emma-john-v2-pending-demo_mock")).toBe(false);
  expect(data.get("unrelated-app")).toBe("keep");
  for(let n=0;n<2;n++){
   const fresh=createMockService(fixtureStorage(storage,"fresh",()=>{throw Error("must read saved blank seed");}));
   for(const w of Object.values(fresh.getSnapshot().workspaces)){expect(w.acquisition.index).toBe(0);expect(w.acquisition.answers).toEqual({});expect(onboardingComplete(w)).toBe(false);}
   resetDemo(storage,role,"fresh");
  }
 });
 it("Upwork history cannot recreate completed Emma; other fixture and normal data stay intact",()=>{
  const {data,storage}=setup();fixtureStorage(storage,"upwork-v1",upworkFixture);
  data.set("dhai-mvp-product-demo-v1","normal"); data.set("dhai-mvp-product-demo-v1:explicit-report-v6-fixture","v6");
  data.set("emma-john-v2-view:explicit-report-upwork-v1-fixture:demo_mock:john:answer-j-scope","old");
  resetDemo(storage,"emma","upwork-v1");
  const back=createMockService(fixtureStorage(storage,"upwork-v1",upworkFixture));
  expect(onboardingComplete(back.getSnapshot().workspaces.emma)).toBe(false);expect(back.getSnapshot().workspaces.john.acquisition.review).toBe(false);
  expect(data.get("dhai-mvp-product-demo-v1")).toBe("normal");expect(data.get("dhai-mvp-product-demo-v1:explicit-report-v6-fixture")).toBe("v6");
  expect([...data.keys()].some(k=>k.startsWith("emma-john-v2-view:explicit-report-upwork-v1-fixture:"))).toBe(false);
 });
 it("failed write restores original records",()=>{
  const {data,storage}=setup();data.set("dhai-mvp-product-demo-v1","original");
  const before=new Map(data);let fail=true;
  expect(()=>resetDemo({...storage,get length(){return data.size;},setItem(k,v){if(fail){fail=false;throw Error("quota");}storage.setItem(k,v);}},"john",null)).toThrow();
  expect(data).toEqual(before);
 });
});
