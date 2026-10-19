import {describe,it,expect} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {ProcessingGlow,voicePresentationPhase} from '../src/components/VoiceEffects';
function html(status:'idle'|'starting'|'listening'|'transcribing',responding=false,reduced=false){return renderToStaticMarkup(createElement(ProcessingGlow,{status,responding,reduced}));}
describe('processing decoration reflects actual work',()=>{
 it('never labels idle, startup or listening as processing',()=>{for(const status of ['idle','starting','listening'] as const)expect(html(status)).toContain('data-processing="idle"');});
 it('distinguishes transcription from external generation',()=>{expect(html('transcribing')).toContain('data-processing="transcribing"');expect(html('idle',true)).toContain('data-processing="generating"');expect(html('transcribing',true)).toContain('data-processing="transcribing"');});
 it('preserves the actual work state in reduced motion without adding interactive content',()=>{const markup=html('transcribing',false,true);expect(markup).toContain('data-reduced-motion="true"');expect(markup).toContain('data-processing="transcribing"');expect(markup).toContain('aria-hidden="true"');expect(markup).not.toContain('button');});
});

describe('voice completion is based on the actual result',()=>{
 it('requires a nonempty recognized result after recognition ends',()=>{expect(voicePresentationPhase('listening',true,'最终文字','')).toBe('listening');expect(voicePresentationPhase('transcribing',true,'最终文字','')).toBe('transcribing');expect(voicePresentationPhase('idle',true,'最终文字','')).toBe('complete');});
 it('never marks a typed draft, empty result or failed recognition as complete',()=>{expect(voicePresentationPhase('idle',false,'用户输入','')).toBe('ready');expect(voicePresentationPhase('idle',true,'  ','')).toBe('ready');expect(voicePresentationPhase('idle',true,'已收到部分内容','网络不可用')).toBe('error');});
});
