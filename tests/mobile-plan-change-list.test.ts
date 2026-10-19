import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MobilePlanChangeList } from '../src/components/MobilePlanChangeList';
import { planDifferences } from '../src/domain/workbench-artifacts';
import type { PlanItem } from '../src/domain/types';

const item = (id: string, title: string): PlanItem => ({id, title, status: 'planned'});
describe('mobile semantic plan changes', () => {
  it('renders simple added actions once without empty comparison labels', () => {
    const markup = renderToStaticMarkup(createElement(MobilePlanChangeList, {rows: planDifferences([], [item('1','明确要验证的问题'), item('2','搭建可测试的原型'), item('3','收集测试反馈')])}));
    expect(markup).toContain('新增 <span>3 项</span>');
    expect(markup.match(/<li>/g)).toHaveLength(3);
    expect(markup).not.toContain('原计划');
    expect(markup).not.toContain('调整后');
    expect(markup).not.toContain('—');
    expect(markup).toContain('应用后更新当前计划，可撤销本次更改。');
  });
  it('renders actual added, changed, removed and retained semantics with complete long titles', () => {
    const long = '与目标用户共同完成完整原型测试并整理可供后续方案选择的反馈证据';
    const before = [item('keep','继续整理作品'), item('change','先完成访谈'), item('remove','暂停旧方案')];
    const after: PlanItem[] = [before[0], {...before[1], title: long, status: 'in_progress', dueAt: '2026-10-20T00:00:00Z'}, item('add','招募测试用户')];
    const markup = renderToStaticMarkup(createElement(MobilePlanChangeList, {rows: planDifferences(before,after)}));
    expect(markup).toContain('<h4>'+long+'</h4>');
    expect(markup).toContain('原为：先完成访谈');
    expect(markup).toContain('进行中');
    expect(markup).toContain('dateTime="2026-10-20T00:00:00Z"');
    expect(markup).toContain('aria-label="移除行动"');
    expect(markup).toContain('<h4>暂停旧方案</h4>');
    expect(markup).toContain('<details><summary>保留 1 项原有行动，未作修改</summary>');
    expect(markup).not.toContain('<details open');
  });
});
