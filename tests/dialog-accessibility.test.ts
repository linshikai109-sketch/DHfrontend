import { createElement, Fragment } from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Dialog } from '../src/components/ui';

describe('shared Dialog accessible naming', () => {
  it('associates each instance with its own visible title', () => {
    const html = renderToStaticMarkup(createElement(Fragment, null, createElement(Dialog, { title: '资料画板', onClose() {}, children: '内容' }), createElement(Dialog, { title: '添加节点', onClose() {}, children: '内容' })));
    const names = [...html.matchAll(/aria-labelledby="([^"]+)"/g)].map(match => match[1]);
    expect(names).toHaveLength(2);
    expect(names[0]).not.toBe(names[1]);
    expect(html).toContain(`<h2 id="${names[0]}">资料画板</h2>`);
    expect(html).toContain(`<h2 id="${names[1]}">添加节点</h2>`);
    expect(html.match(/tabindex="-1"/g)).toHaveLength(2);
  });
});
