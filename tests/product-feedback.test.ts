import { beforeEach, describe, expect, it, vi } from 'vitest';
const test = vi.hoisted(() => ({ setters: [] as ReturnType<typeof vi.fn>[], failSnapshot: false, values: new Map<string,string>() }));
vi.mock('react', async original => ({ ...await original<typeof import('react')>(), useEffect: () => {}, useSyncExternalStore: (_subscribe: unknown, get: ()=>unknown) => get(), useState: (initial: any) => { const setter=vi.fn();test.setters.push(setter);return [typeof initial==='function'?initial():initial,setter]; }, useRef: (value:any)=>({current:value}) }));
let provider: any;
beforeEach(async () => {
 vi.resetModules();test.setters=[];test.values.clear();test.failSnapshot=false;
 const storage={getItem:(key:string)=>test.values.get(key)??null,setItem:(key:string,value:string)=>{if(test.failSnapshot&&key==='dhai-mvp-product-demo-v1:explicit-report-fresh-fixture')throw new Error('quota');test.values.set(key,value);},removeItem:(key:string)=>test.values.delete(key)};
 vi.stubGlobal('window',{localStorage:storage,location:{search:'?fixture=fresh'}});vi.stubGlobal('localStorage',storage);
 const {ProductProvider}=await import('../src/product');const outer=ProductProvider({role:'emma',children:null}) as any;
 provider=outer.type(outer.props).props.value;provider.setFault("none");
});
const command={type:'saveAnswer',questionId:'e-goal',value:'完整的目标说明',nextIndex:1} as const;
describe('duplicate-click completion feedback uses the real operation outcome',()=>{
 it('writes one answer and replaces the temporary busy notice after success',async()=>{
  const first=provider.run(command);const duplicate=provider.run(command);
  const [saved,rejected]=await Promise.all([first,duplicate]);
  expect(rejected).toBeNull();expect(saved.workspaces.emma.acquisition.answers['e-goal'].version).toBe(1);
  expect(test.setters[2].mock.calls.at(-1)?.[0]).toBe('');
  expect(test.setters[4].mock.calls.at(-1)?.[0]).toBe('上次操作已完成，没有重复执行。');
  provider.clearNotice();expect(test.setters[4].mock.calls.at(-1)?.[0]).toBe('');
  await provider.run({...command,value:'新的目标说明'});
  expect(test.setters[4].mock.calls.at(-1)?.[0]).toBe('');
 });
 it('retains service failure instead of replacing it with a completion notice',async()=>{
  provider.setFault('failure');await Promise.all([provider.run(command),provider.run(command)]);
  expect(test.setters[2].mock.calls.at(-1)?.[0]).toBe('这次操作没有成功，请再试一次。');
  expect(test.setters[4].mock.calls.at(-1)?.[0]).toBe('');
 });
 it('keeps an unknown recovery pending instead of reporting duplicate success',async()=>{
  test.values.set('emma-john-v2-pending-demo_mock:explicit-report-fresh-fixture',JSON.stringify({operationId:'missing-receipt',role:'emma',command}));
  await Promise.all([provider.recover(),provider.recover()]);
  expect(test.setters[2].mock.calls.at(-1)?.[0]).toContain('还不能确定');
  expect(test.setters[3].mock.calls.at(-1)?.[0]).toBe(true);
  expect(test.setters[4].mock.calls.at(-1)?.[0]).toBe('');
 });
 it('retains snapshot-write failure after the client clears its operation journal',async()=>{
  test.failSnapshot=true;await Promise.all([provider.run(command),provider.run(command)]);
  const error=test.setters[2].mock.calls.at(-1)?.[0];
  expect(error).toContain('保存失败');expect(error).not.toContain('已完成');
  expect(test.setters[4].mock.calls.at(-1)?.[0]).toBe('');
 });
});
