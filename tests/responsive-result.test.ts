import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MobileFold, ResponsiveVoiceSceneResult } from '../src/components/ResponsiveResult';
import { coreRelationNodes } from '../src/components/VisualTemplates';
import { voiceIntents, workbenchScene } from '../src/domain/workbench-voice';

describe('responsive results',()=>{
 it('keeps only core and immediate neighbors in the graph summary, without duplicate cyclic nodes',()=>{
  const nodes=['a','b','c','d'].map(id=>({id,title:id,detail:id}));
  expect(coreRelationNodes(nodes,[{from:'a',to:'b',label:'depends'},{from:'b',to:'a',label:'relates'},{from:'b',to:'c',label:'next'},{from:'a',to:'missing',label:'invalid'}]).map(n=>n.id)).toEqual(['a','b']);
  expect(coreRelationNodes([],[])).toEqual([]);
 });
 it('does not offer disclosure when all items already fit',()=>{
  const html=renderToStaticMarkup(createElement(MobileFold,{count:2,children:'two complete items'}));
  expect(html).not.toContain('<button');
  const more=renderToStaticMarkup(createElement(MobileFold,{count:3,children:'three complete items'}));
  expect(more).toContain('aria-expanded="false"');
  expect(more).toContain('展开全部（3）');
 });
 it('preserves every cell and the answer across all twelve templates for either role',()=>{
  for(const role of ['emma','john'] as const)for(const intent of voiceIntents){
   const scene=workbenchScene(role,intent);
   const html=renderToStaticMarkup(createElement(ResponsiveVoiceSceneResult,{scene}));
   expect(html).toContain(scene.answer);
   for(const row of scene.rows)for(const cell of row)expect(html).toContain(cell);
   expect(html).not.toContain('line-clamp');
  }
 });
});
