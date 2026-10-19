import { describe, it, expect, vi } from 'vitest';
import { createHttpTransport } from '../src/domain/http-transport';
import { createConnectedService, createMockService, setDemoFault } from '../src/domain/service';
import { createClient } from '../src/domain/client';
import { seedSnapshot } from '../src/domain/fixtures';
import type { Request } from '../src/domain/types';
const connected = () => ({...seedSnapshot(), runtimeProfile:'connected' as const});
function harness() {
 const mock=createMockService(); let lost=false;
 const fetcher=vi.fn(async (url: URL | RequestInfo, init?: RequestInit) => {
  const path=new URL(String(url)).pathname;
  if(path.endsWith('/commands')) {
   const r=JSON.parse(String(init?.body)) as Request;
   const snapshot=await mock.execute(r);
   if(lost){lost=false;throw new Error('connection lost after commit');}
   return Response.json({...snapshot,runtimeProfile:'connected'});
  }
  if(path.includes('/operations/')) {
   const op=await mock.getOperation(decodeURIComponent(path.split('/').pop()!));
   return op ? Response.json(op) : new Response(null,{status:404});
  }
  return Response.json({...mock.getSnapshot(),runtimeProfile:'connected'});
 });
 const transport=createHttpTransport({baseUrl:'http://127.0.0.1:8933/api/',fetch:fetcher as typeof fetch});
 return {mock,transport,fetcher,lose:()=>{lost=true;}};
}
describe('local HTTP handoff contract (synthetic only)',()=>{
 it('blocks remote egress including URL credentials',()=>{
  for(const baseUrl of ['https://example.com/api','http://example.com','http://u:p@localhost/api'])expect(()=>createHttpTransport({baseUrl})).toThrow();
 });
 it('loads, submits original envelope and receives stable snapshot',async()=>{
  const h=harness();await h.transport.refresh();const service=createConnectedService(h.transport);
  const r:Request={operationId:'synthetic-1',role:'emma',command:{type:'saveDraft',questionId:'goal',value:'synthetic'}};
  const result=await service.execute(r);expect(result.runtimeProfile).toBe('connected');
  expect(JSON.parse(String(h.fetcher.mock.calls[1][1]?.body))).toEqual(r);
  expect(h.fetcher.mock.calls[1][1]).toMatchObject({redirect:'error',credentials:'omit',headers:{'Idempotency-Key':r.operationId}});
  expect(await service.getOperation(r.operationId)).toMatchObject({id:r.operationId,state:'succeeded'});
 });
 it('retains original operation through lost response, reload and read-only recovery',async()=>{
  const h=harness();await h.transport.refresh();const data=new Map<string,string>();
  const storage={getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>{data.set(k,v);},removeItem:(k:string)=>{data.delete(k);}};
  const first=createClient(createConnectedService(h.transport),storage);h.lose();
  await expect(first.execute('emma',{type:'saveDraft',questionId:'goal',value:'synthetic recovery'})).rejects.toThrow();
  expect(first.hasPending()).toBe(true);const revision=h.mock.getSnapshot().revision;
  const reloaded=createClient(createConnectedService(h.transport),storage);
  expect(await reloaded.recover()).toBe('succeeded');expect(reloaded.hasPending()).toBe(false);
  expect(h.mock.getSnapshot().revision).toBe(revision);
  expect(h.fetcher.mock.calls.filter(c=>c[1]?.method==='POST')).toHaveLength(1);
 });
 it('rejects malformed snapshots and allows safe GET retry',async()=>{
  const fetcher=vi.fn().mockResolvedValueOnce(Response.json({})).mockResolvedValueOnce(Response.json(connected()));
  const t=createHttpTransport({baseUrl:'http://localhost/api',fetch:fetcher});
  await expect(t.refresh()).rejects.toMatchObject({code:'INVALID_RESPONSE'});await t.refresh();expect(t.getSnapshot().runtimeProfile).toBe('connected');
 });
 it('does not accept mismatched receipts',async()=>{
  const t=createHttpTransport({baseUrl:'http://localhost/api',fetch:vi.fn().mockResolvedValue(Response.json({id:'other',state:'succeeded'}))});
  await expect(t.getOperation('mine')).rejects.toMatchObject({code:'INVALID_RECEIPT'});
 });
});

it('does not leave an unsent journal when a refresh blocks submission', async()=>{
 let release!: (r:Response)=>void;
 const t=createHttpTransport({baseUrl:'http://localhost/api',fetch:vi.fn(()=>new Promise<Response>(r=>{release=r;}))});
 const loading=t.refresh();
 const data=new Map<string,string>();
 const journal={getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>{data.set(k,v);},removeItem:(k:string)=>{data.delete(k);}};
 // Receipt lookup must not run for a guaranteed unsent busy request.
 const client=createClient({profile:'connected',getSnapshot:t.getSnapshot,subscribe:t.subscribe,execute:t.execute,getOperation:vi.fn()},journal);
 await expect(client.execute('emma',{type:'saveDraft',questionId:'goal',value:'synthetic'})).rejects.toMatchObject({code:'CLIENT_BUSY'});
 expect(client.hasPending()).toBe(false);
 release(Response.json(connected()));await loading;
});

it('rejects nested malformed workspace before publishing',async()=>{
 const snapshot={...connected(),workspaces:{emma:{},john:{}}};
 const t=createHttpTransport({baseUrl:'http://localhost/api',fetch:vi.fn().mockResolvedValue(Response.json(snapshot))});
 await expect(t.refresh()).rejects.toMatchObject({code:'INVALID_RESPONSE'});
});
it('explicit retry sends the original identity after a request never reached the server',async()=>{
 const h=harness();await h.transport.refresh();
 const values=new Map<string,string>();const journal={getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{values.set(k,v);},removeItem:(k:string)=>{values.delete(k);}};
 const request:Request={operationId:'retry-same-id',role:'emma',command:{type:'saveDraft',questionId:'goal',value:'synthetic retry'}};
 values.set('emma-john-v2-pending-connected',JSON.stringify(request));
 const client=createClient(createConnectedService(h.transport),journal);
 expect(await client.recover()).toBe('unknown');expect(h.fetcher.mock.calls.filter(c=>c[1]?.method==='POST')).toHaveLength(0);
 expect(await client.retryPending()).toBe('succeeded');expect(client.hasPending()).toBe(false);
 const post=h.fetcher.mock.calls.find(c=>c[1]?.method==='POST')!;
 expect(JSON.parse(String(post[1]?.body))).toEqual(request);
});
