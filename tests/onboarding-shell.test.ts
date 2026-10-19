import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createMemoryRouter,RouterProvider} from 'react-router';
import {beforeEach,describe,expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {seedSnapshot} from '../src/domain/fixtures';
const state=vi.hoisted(()=>({snapshot:null as any,role:'john' as 'emma'|'john',staleOpen:false}));
vi.mock('../src/product',()=>({ProductProvider:({children}:any)=>children,useProduct:()=>({role:state.role,snapshot:state.snapshot,workspace:state.snapshot.workspaces[state.role],error:'',pending:false,busy:false,run:vi.fn(),recover:vi.fn(),clearError:vi.fn(),setFault:vi.fn()})}));
vi.mock('react',async original=>{const react=await original<typeof import('react')>();return {...react,useState:(initial:any)=>[typeof initial==='boolean'&&state.staleOpen?true:typeof initial==='function'?initial():initial,vi.fn()]};});
vi.mock('../src/pages/Onboarding',()=>({default:()=>createElement('section',{'data-test':'question-and-right-canvas'},'既有问答及采集画板')}));
vi.mock('../src/pages/Workbench',()=>({default:()=>createElement('section',{'data-test':'workspace'},'既有工作台')}));
vi.mock('../src/components/EmmaMobileOnboarding',()=>({EmmaMobileOnboarding:({children}:any)=>children}));
import App from '../src/App';
function render(path:string){
 const router=createMemoryRouter([{path:'*',element:createElement(App)}],{initialEntries:[path]});
 const html=renderToStaticMarkup(createElement(RouterProvider,{router}));router.dispose();return html;
}
beforeEach(()=>{state.snapshot=seedSnapshot();state.role='john';state.staleOpen=false;});
describe('onboarding shell excludes workspace navigation at every viewport',()=>{
 it.each(['emma','john'] as const)('%s onboarding keeps the question/canvas but has no rail or drawer entry',role=>{
  state.role=role;const html=render(`/${role}/onboarding?mode=connected`);
  expect(html).toContain('data-surface="onboarding"');
  expect(html).toContain('data-test="question-and-right-canvas"');
  for(const marker of ['john-navigation','john-nav-toggle','john-mobile-toggle','john-mobile-links','aria-label="功能导航"'])expect(html).not.toContain(marker);
 });
 it.each(['/john/workbench','/john'])('keeps John workspace navigation at %s',path=>{
  state.snapshot.workspaces.john.acquisition.confirmed=true;const html=render(path);
  expect(html).toContain('data-surface="workspace"');expect(html).toContain('john-navigation');expect(html).toContain('john-mobile-toggle');
  for(const route of ['/john/workbench','/john/report','/john/quest','/john/profile'])expect(html).toContain(`href="${route}"`);
 });
 it('does not retain an open drawer or collapsed rail state when entering onboarding',()=>{
  state.staleOpen=true;const html=render('/john/onboarding');
  expect(html).toContain('data-nav-collapsed="false"');expect(html).not.toContain('john-mobile-links');expect(html).not.toContain('john-mobile-toggle');
 });
 it.each(['emma','john'] as const)('recognizes only the existing %s acquisition route including its trailing slash',role=>{
  state.role=role;expect(render(`/${role}/onboarding/`)).toContain('data-surface="onboarding"');
 });
 it('reclaims the rail width only on onboarding and leaves its question/canvas columns untouched',()=>{
  const css=readFileSync(new URL('../src/onboarding-shell.css',import.meta.url),'utf8');
  expect(css).toContain('[data-surface="onboarding"]');expect(css).toContain('--shell-nav-width: 0px');expect(css).toContain('padding-left: 0');expect(css).not.toContain('grid-template-columns');
 });
});
