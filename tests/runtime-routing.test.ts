import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {retainRuntimeSearch} from '../src/domain/runtime-routing';
describe('runtime identity survives existing navigation without changing destinations',()=>{
 it.each(['emma','john'])('retains connected after root/entry/guard navigation and refresh (%s)',role=>{
   const root='?mode=connected';
   const entry=retainRuntimeSearch('',root);
   const onboarding=retainRuntimeSearch('',entry);
   const refresh=retainRuntimeSearch(onboarding,onboarding);
   expect(entry).toBe(root);expect(onboarding).toBe(root);expect(refresh).toBe(root);
   // Role selection remains in existing pathname logic; selectors have no destination field.
   expect(`/${role}/onboarding${onboarding}`).toBe(`/${role}/onboarding?mode=connected`);
 });
 it('preserves only supported sticky selectors; page flags remain local',()=>{
   const prior='?mode=connected&fixture=fresh&canvas=full&overview=1&reopen=1&conversations=1&redirect=https://evil.example';
   expect(retainRuntimeSearch('?overview=1&reopen=1',prior)).toBe('?overview=1&reopen=1&mode=connected&fixture=fresh');
   expect(retainRuntimeSearch('',prior)).toBe('?mode=connected&fixture=fresh');
 });
 it('allows explicit supported selector changes without restoring the previous mode',()=>{
   expect(retainRuntimeSearch('?mode=demo_mock&fixture=v6','?mode=connected&fixture=fresh')).toBe('?mode=demo_mock&fixture=v6');
 });
 it.each(['?mode=https://evil.example','?mode=connected&mode=demo_mock','?fixture=../../secret','?mode=%2F%2Fevil.example'])('does not retain injected or ambiguous selectors: %s',value=>{
   expect(retainRuntimeSearch(value,'')).toBe('');
 });
 it('keeps explicit local page flags and normalizes without a redirect target',()=>{
   const result=retainRuntimeSearch('?canvas=full','?mode=connected&next=https://evil.example');
   expect(result).toBe('?canvas=full&mode=connected');
   expect(retainRuntimeSearch(result,result)).toBe(result);
 });
 it('places runtime retention above App without changing existing route declarations',()=>{
   const main=readFileSync(new URL('../src/main.tsx',import.meta.url),'utf8');
   expect(main.indexOf('<RuntimeRouting>')).toBeGreaterThan(main.indexOf('<BrowserRouter'));
   expect(main.indexOf('<App />')).toBeGreaterThan(main.indexOf('<RuntimeRouting>'));
 });
});
