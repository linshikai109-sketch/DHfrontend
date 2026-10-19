import {beforeEach,describe,expect,it,vi} from 'vitest';
vi.mock('react',async original=>({...await original<typeof import('react')>(),useEffect:()=>{},useState:(initial:any)=>[typeof initial==='function'?initial():initial,vi.fn()]}));
beforeEach(()=>{
 vi.resetModules();vi.stubEnv('VITE_ENABLE_LOCAL_HTTP','false');
 const data=new Map<string,string>();
 vi.stubGlobal('window',{location:{search:''},localStorage:{getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>data.set(k,v),removeItem:(k:string)=>data.delete(k)}});
});
describe('provider first mount uses the same normalized selectors as routing',()=>{
 it.each([
  ['?mode=connected','connected'],
  ['?mode=connected&mode=demo_mock','demo_mock'],
  ['?mode=https://evil.example','demo_mock'],
 ])('%s initializes %s before route layout effects',async(search,profile)=>{
  window.location.search=search;
  const {ProductProvider}=await import('../src/product');
  const tree=ProductProvider({role:'emma',children:null}) as any;
  expect(tree.props.active.service.profile).toBe(profile);
 });
});
