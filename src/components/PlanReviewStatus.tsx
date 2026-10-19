import { Check, RefreshCw } from 'lucide-react';
import './plan-review-status.css';

/** This status describes the proposal, independently of the historical result. */
export function PlanReviewStatus({ stale, refreshing = false }: { stale: boolean; refreshing?: boolean }) {
  if (stale && !refreshing) return null; // The existing alert supplies the blocked state and recovery.
  return <p className="plan-review-source-status" role="status">
    {refreshing ? <RefreshCw size={16} aria-hidden="true"/> : <Check size={16} aria-hidden="true"/>}
    <span>{refreshing ? '正在按当前资料与计划更新预览…' : '本次预览已核对当前资料与计划'}</span>
  </p>;
}
