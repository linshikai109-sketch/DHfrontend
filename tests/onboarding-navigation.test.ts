import { beforeEach, describe, expect, it, vi } from 'vitest';
import { seedSnapshot } from '../src/domain/fixtures';
const state = vi.hoisted(() => ({ run: vi.fn(), setters: [] as ReturnType<typeof vi.fn>[], snapshot: null as any, busy: false, role: "john" as "emma" | "john", showReview: true, view: new Map<string, string>(), write: vi.fn() }));
vi.mock('../src/product', () => ({ useProduct: () => ({ workspace: state.snapshot.workspaces[state.role], snapshot: state.snapshot, role: state.role, run: state.run, busy: state.busy, pending: false }) }));
vi.mock('react-router', () => ({ useNavigate: () => vi.fn(), useLocation: () => ({ state: { showReview: state.showReview } }), useSearchParams: () => [new URLSearchParams()] }));
vi.mock('react', async original => ({ ...await original<typeof import('react')>(), useEffect: () => {}, useState: (initial: any) => { const setter = vi.fn(); state.setters.push(setter); return [typeof initial === 'function' ? initial() : initial, setter]; }, useRef: (initial: any) => ({ current: initial }) }));
vi.mock('../src/components/ExternalMaterials', () => ({ ExternalMaterials: () => null, useExternalMaterials: () => ({ materials: [], membership: null }) }));
import Onboarding from '../src/pages/Onboarding';
function elements(node: any): any[] { if (!node || typeof node !== 'object') return []; return [node, ...[node.props?.children].flat(Infinity).flatMap(elements)]; }
beforeEach(() => {
 state.snapshot = seedSnapshot(); state.snapshot.workspaces.john.acquisition.answers = { 'j-scope': { id: 'j-scope', value: '具体项目', skipped: false, version: 1 } };
 state.setters = []; state.run.mockReset(); state.busy = false; state.role = "john"; state.showReview = true; state.view.clear(); state.write.mockReset();
 vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) });
 vi.stubGlobal('localStorage', { getItem: (key: string) => state.view.get(key) ?? null, setItem: state.write });
});
describe('onboarding review navigation saving boundary', () => {
 it('keeps review and editing identity intact when selecting an answer fails to save', async () => {
  state.run.mockResolvedValue(null);
  const item = elements(Onboarding()).find(node => node.props?.className === 'summary-item' && node.props.onClick);
  await item.props.onClick();
  expect(state.run).toHaveBeenCalledWith({ type: 'setAcquisition', index: 0, review: false });
  expect(state.setters.every(setter => setter.mock.calls.length === 0)).toBe(true);
 });
 it('changes the local editing identity only after successful navigation', async () => {
  state.run.mockResolvedValue(state.snapshot);
  const item = elements(Onboarding()).find(node => node.props?.className === 'summary-item' && node.props.onClick);
  await item.props.onClick();
  expect(state.setters[0]).toHaveBeenCalledWith(false);
  expect(state.setters[1]).toHaveBeenCalledWith('j-scope');
 });
 it('keeps the return-review screen when continuing fails and disables review editing while saving', async () => {
  state.run.mockResolvedValue(null); state.busy = true;
  const tree = elements(Onboarding());
  expect(tree.find(node => node.props?.className === 'summary-item' && node.props.onClick).props.disabled).toBe(true);
  await tree.find(node => node.props?.children === '继续填写').props.onClick();
  expect(state.setters[0]).not.toHaveBeenCalled();
 });
});

 it('keeps the committed choice supplement in its per-question view cache for previous and refresh', async () => {
  state.role = 'emma'; state.showReview = false;
  const ac = state.snapshot.workspaces.emma.acquisition;
  ac.index = 0; ac.answers = {}; ac.drafts = {};
  const prefix = `emma-john-v2-view:${state.snapshot.runtimeProfile}:emma:`;
  const choice = '找到新的工作方向';
  const reason = '希望找到适合我的工作方向，已有项目经验，想仔细梳理可以发挥的能力。';
  state.view.set(prefix + 'answer-e-goal', JSON.stringify(choice));
  state.view.set(prefix + 'supplement-e-goal', JSON.stringify(reason));
  state.run.mockResolvedValue(state.snapshot);
  const button = elements(Onboarding()).find(node => node.props?.children === '继续');
  await button.props.onClick();
  expect(state.run).toHaveBeenCalledWith(expect.objectContaining({ type: 'saveAnswer', questionId: 'e-goal', value: choice + '；' + reason }));
  expect(state.write).toHaveBeenCalledWith(prefix + 'supplement-e-goal', JSON.stringify(reason));
  expect(state.write).not.toHaveBeenCalledWith(prefix + 'supplement-e-goal', '""');
 });
