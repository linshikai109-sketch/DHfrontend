import type { ContextNode } from './types';

/** Match the current workspace nodes and ExternalMaterialsCanvas render inputs.
 * Answers and drafts are deliberately excluded until they produce visible content.
 */
export function johnAcquisitionLayout(
  context: Pick<ContextNode, 'deleted'>[],
  external: { materials: readonly unknown[]; membership?: unknown; loadError?: string },
) {
  const visibleCount = context.filter(node => !node.deleted).length
    + (external.loadError ? 0 : external.materials.length + (external.membership ? 1 : 0));
  const state = visibleCount > 0 ? 'populated' : 'empty';
  return {
    visibleCount,
    state,
    columns: state === 'empty' ? 'minmax(0, 58fr) minmax(0, 42fr)' : 'minmax(0, 45fr) minmax(0, 55fr)',
  } as const;
}
