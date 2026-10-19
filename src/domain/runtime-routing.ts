/** Only runtime selectors survive internal navigation; page flags stay route-local. */
const allowed = {
  mode: new Set(['connected', 'demo_mock']),
  fixture: new Set(['fresh', 'v5', 'v6', 'upwork-v1']),
};
export function retainRuntimeSearch(currentSearch: string, previousSearch: string): string {
  const current = new URLSearchParams(currentSearch);
  const previous = new URLSearchParams(previousSearch);
  for (const [key, values] of Object.entries(allowed)) {
    const explicit = current.getAll(key);
    const prior = previous.getAll(key);
    const value = explicit.length === 1 && values.has(explicit[0]) ? explicit[0]
      : prior.length === 1 && values.has(prior[0]) ? prior[0] : undefined;
    current.delete(key);
    if (value) current.set(key, value);
  }
  const result = current.toString();
  return result ? `?${result}` : '';
}
