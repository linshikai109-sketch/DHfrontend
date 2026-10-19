import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RelationDiagram } from '../src/components/VisualTemplates';
const nodes=[{id:'one',title:'源一',detail:'第一项依据'},{id:'two',title:'源二',detail:'第二项依据'},{id:'result',title:'建议',detail:'待采纳'}];
describe('relation diagram',()=>{
 it('renders a shared target as one selectable node rather than duplicating it for every edge',()=>{
  const html=renderToStaticMarkup(createElement(RelationDiagram,{nodes,edges:[{from:'one',to:'result',label:'支持'},{from:'two',to:'result',label:'约束'}]}));
  expect(html.match(/<button[^>]*aria-pressed=/g)).toHaveLength(3);
  expect(html.match(/<strong>建议<\/strong>/g)).toHaveLength(1);
 });
 it('keeps disconnected facts visible while filtering missing references',()=>{
  const html=renderToStaticMarkup(createElement(RelationDiagram,{nodes,edges:[{from:'one',to:'missing',label:'无效'}]}));
  expect(html).toContain('源二');expect(html).toContain('尚无连接关系');expect(html).not.toContain('无效');
 });
 it('terminates for cyclic relationships without losing nodes',()=>{
  const html=renderToStaticMarkup(createElement(RelationDiagram,{nodes,edges:[{from:'one',to:'two',label:'关联'},{from:'two',to:'one',label:'关联'}]}));
  expect(html.match(/<button[^>]*aria-pressed=/g)).toHaveLength(3);
 });
});
