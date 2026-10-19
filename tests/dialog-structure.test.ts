import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Dialog } from '../src/components/ui';

describe('shared dialog scroll structure', () => {
  it('keeps the accessible title and close control outside the content scrollport', () => {
    const html = renderToStaticMarkup(createElement(Dialog, {
      title: '设置', onClose: () => {},
      children: createElement('form', null, createElement('select', { 'aria-label': '角色' }, createElement('option', null, 'Emma'))),
    }));
    const label = html.match(/aria-labelledby="([^"]+)"/)?.[1];
    expect(label).toBeTruthy();
    expect(html).toContain(`id="${label}"`);
    expect(html).toMatch(/class="dialog-head">[\s\S]*aria-label="关闭"[\s\S]*<\/button><\/div><div class="dialog-body"><form>/);
    expect(html).toContain('shared-dialog');
    expect(html).toContain('<select aria-label="角色">');
  });
  it('preserves nested dialog identity and content as separate modal structures', () => {
    const html = renderToStaticMarkup(createElement(Dialog, {
      title: '资料画板', wide: true, onClose: () => {},
      children: createElement(Dialog, { title: '添加节点', onClose: () => {}, children: createElement('input', { 'aria-label': '名称' }) }),
    }));
    expect([...html.matchAll(/aria-labelledby="([^"]+)"/g)].map(m => m[1])).toHaveLength(2);
    expect(new Set([...html.matchAll(/aria-labelledby="([^"]+)"/g)].map(m => m[1])).size).toBe(2);
    expect([...html.matchAll(/class="dialog-body"/g)]).toHaveLength(2);
    expect(html).toContain('shared-dialog wide');
  });
});
