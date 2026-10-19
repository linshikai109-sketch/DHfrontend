/** Returns the destination only when Tab would leave the modal's focus cycle. */
export function tabBoundaryTarget<T>(items: readonly T[], active: T | null, backwards: boolean): T | null {
  if (!items.length) return null;
  const index = active === null ? -1 : items.indexOf(active);
  if (index < 0) return backwards ? items[items.length - 1] : items[0];
  if (backwards && index === 0) return items[items.length - 1];
  if (!backwards && index === items.length - 1) return items[0];
  return null;
}

/** BODY/HTML and ordinary containers are not valid restoration targets. */
export function canReturnFocus(node: Pick<HTMLElement, 'tagName' | 'isConnected' | 'tabIndex' | 'matches' | 'closest' | 'hasAttribute' | 'getClientRects'> | null | undefined): boolean {
  if (!node || !node.isConnected || /^(BODY|HTML)$/.test(node.tagName)) return false;
  if (node.matches(':disabled') || node.closest('[inert], [hidden]') || !node.getClientRects().length) return false;
  return node.tabIndex >= 0 || node.hasAttribute('tabindex') || node.matches('button, a[href], input, select, textarea, summary, [contenteditable="true"]');
}
