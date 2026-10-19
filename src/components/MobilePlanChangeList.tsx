import type { PlanDifference } from '../domain/workbench-artifacts';
import type { PlanItem } from '../domain/types';
import { formatDate } from './ui';

const statuses: Record<PlanItem['status'], string> = { planned: '待开始', in_progress: '进行中', completed: '已完成' };

function Metadata({ item }: { item: PlanItem }) {
  return <p className="mobile-change-meta">{statuses[item.status]}{item.dueAt && <> · <time dateTime={item.dueAt}>{formatDate(item.dueAt)}</time></>}</p>;
}

function Action({ row }: { row: PlanDifference }) {
  const item = row.after || row.before!;
  const before = row.kind === 'changed' ? row.before : undefined;
  return <li><h4>{item.title}</h4>{before ? <>
    {before.title !== item.title && <p className="mobile-change-before">原为：{before.title}</p>}
    {before.status !== item.status && <p className="mobile-change-meta">状态：{statuses[before.status]} → {statuses[item.status]}</p>}
    {before.dueAt !== item.dueAt && <p className="mobile-change-meta">日期：{before.dueAt ? formatDate(before.dueAt) : '未安排'} → {item.dueAt ? <time dateTime={item.dueAt}>{formatDate(item.dueAt)}</time> : '未安排'}</p>}
    {(before.attemptId !== item.attemptId || before.recommendationId !== item.recommendationId) && <p className="mobile-change-meta">关联任务或建议已更新</p>}
  </> : <Metadata item={item}/>}</li>;
}

/** Mobile review groups by consequence, without empty before/after cells. */
export function MobilePlanChangeList({ rows }: { rows: PlanDifference[] }) {
  const retained = rows.filter(row => row.kind === 'retained');
  return <div className="mobile-plan-changes">
    {(['added', 'changed', 'removed'] as const).map(kind => {
      const group = rows.filter(row => row.kind === kind);
      return group.length > 0 && <section key={kind} aria-label={`${({added:'新增',changed:'调整',removed:'移除'})[kind]}行动`}><h3>{({added:'新增',changed:'调整',removed:'移除'})[kind]} <span>{group.length} 项</span></h3><ul>{group.map(row => <Action key={row.id} row={row}/>)}</ul></section>;
    })}
    {retained.length > 0 && <details><summary>保留 {retained.length} 项原有行动，未作修改</summary><ul>{retained.map(row => <Action key={row.id} row={row}/>)}</ul></details>}
    <p className="mobile-change-consequence">应用后更新当前计划，可撤销本次更改。</p>
  </div>;
}
