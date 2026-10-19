import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const { bridge, portals } = vi.hoisted(() => ({ bridge: { current: null as null | { anchor: object; preparing: boolean } }, portals: vi.fn() }));
vi.mock('../src/components/EmmaMobileOnboarding', () => ({ useEmmaMobileOrb: () => bridge.current }));
vi.mock('react-dom', async original => ({ ...await original<typeof import('react-dom')>(), createPortal: (node: unknown, target: unknown) => { portals(node,target); return null; } }));
vi.mock('../src/components/VoiceVisual', () => ({ VoiceVisual: () => createElement('span',{className:'voice-visual'}) }));
vi.mock('../src/components/VoiceAura', () => ({ VoiceAura: () => createElement('span',{className:'aura-substitute'}) }));
import { OnboardingVoice } from '../src/components/EmmaDemoVoice';

const props = { role:'emma' as const, value:'', staged:null, onEnterText:vi.fn(),onChange:vi.fn(),onStage:vi.fn(),onActive:vi.fn(),sample:'模拟回答' };

beforeEach(()=>{bridge.current=null;portals.mockClear();});
describe('mobile voice bridge (SSR and portal substitute)',()=>{
  it('renders one existing orb into the anchor and disables capture during intro',()=>{
    const anchor={};bridge.current={anchor,preparing:true};
    const html=renderToStaticMarkup(createElement(OnboardingVoice,props));
    expect(portals).toHaveBeenCalledOnce();
    const [orb,target]=portals.mock.calls[0];
    expect(target).toBe(anchor);
    expect(orb.props.disabled).toBe(true);
    expect(orb.props.children[0].props.paused).toBe(true);
    expect(html).not.toContain('voice-visual-trigger');
    expect(html).not.toContain('说说你的想法</span>');
    expect(html).toContain('aria-label="文字输入"');
    expect(html).toContain('aura-substitute');
    expect(props.onActive).not.toHaveBeenCalled();
  });
  it('keeps the same destination and enabled explicit-start action when docked',()=>{
    const anchor={};bridge.current={anchor,preparing:false};
    renderToStaticMarkup(createElement(OnboardingVoice,props));
    expect(portals.mock.calls[0][1]).toBe(anchor);
    expect(portals.mock.calls[0][0].props.disabled).toBe(false);
    const orbHtml=renderToStaticMarkup(portals.mock.calls[0][0]);
    expect(orbHtml).toContain('点击开始说话');
    expect(orbHtml).toContain('role="status"');
    expect(orbHtml).not.toContain('aria-hidden="true"');
  });
  it.each(['emma','john'] as const)('keeps original inline controls for %s when mobile adapter is absent',role=>{
    const html=renderToStaticMarkup(createElement(OnboardingVoice,{...props,role}));
    expect(portals).not.toHaveBeenCalled();
    expect(html.match(/class="voice-visual-trigger"/g)).toHaveLength(1);
    expect(html).toContain('aria-label="文字输入"');
  });
  it('preserves a long editable answer without introducing a second orb',()=>{
    bridge.current={anchor:{},preparing:false};
    const text='这是一段保留的回答。'.repeat(80);
    const html=renderToStaticMarkup(createElement(OnboardingVoice,{...props,value:text,staged:text}));
    expect(html).toContain(text);
    expect(html).toContain('aria-label="输入内容"');
    expect(portals).toHaveBeenCalledOnce();
  });
});
