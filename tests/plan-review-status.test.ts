import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PlanReviewStatus } from '../src/components/PlanReviewStatus';

describe('proposal source status', () => {
  it('labels current proposal separately from a historical result', () => {
    const html = renderToStaticMarkup(createElement(PlanReviewStatus,{stale:false}));
    expect(html).toContain('role="status"');
    expect(html).toContain('本次预览已核对当前资料与计划');
  });
  it('does not promise current sources for an outdated or refreshing proposal', () => {
    expect(renderToStaticMarkup(createElement(PlanReviewStatus,{stale:true}))).toBe('');
    const html = renderToStaticMarkup(createElement(PlanReviewStatus,{stale:false,refreshing:true}));
    expect(html).toContain('正在按当前资料与计划更新预览');
    expect(html).not.toContain('已核对');
  });
});
