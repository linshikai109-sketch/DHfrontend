import { describe, expect, it } from 'vitest';
import { johnAcquisitionLayout } from '../src/domain/john-acquisition-layout';

describe('John acquisition layout from current visible canvas content', () => {
  const emptyExternal = { materials: [] };

  it('prioritizes the question at zero content and excludes deleted nodes', () => {
    expect(johnAcquisitionLayout([{ deleted: true }], emptyExternal)).toEqual({
      visibleCount: 0, state: 'empty', columns: 'minmax(0, 58fr) minmax(0, 42fr)',
    });
  });

  it('expands for a live node and returns to the empty proportion after deletion', () => {
    const nodes = [{ deleted: false }];
    expect(johnAcquisitionLayout(nodes, emptyExternal)).toEqual({
      visibleCount: 1, state: 'populated', columns: 'minmax(0, 45fr) minmax(0, 55fr)',
    });
    nodes[0].deleted = true;
    expect(johnAcquisitionLayout(nodes, emptyExternal).state).toBe('empty');
  });

  it('recognizes material and membership content rendered outside the context nodes', () => {
    expect(johnAcquisitionLayout([], { materials: [{}] }).state).toBe('populated');
    expect(johnAcquisitionLayout([], { materials: [], membership: { role: '负责人' } }).state).toBe('populated');
    expect(johnAcquisitionLayout([{ deleted: false }], { materials: [{}, {}], membership: {} }).visibleCount).toBe(4);
  });

  it('does not allocate canvas space for external content hidden by its load error', () => {
    const external = { materials: [{}], membership: {}, loadError: '资料读取失败' };
    expect(johnAcquisitionLayout([], external).state).toBe('empty');
    expect(johnAcquisitionLayout([{ deleted: false }], external).visibleCount).toBe(1);
  });
});
