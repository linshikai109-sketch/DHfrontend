import {describe,it,expect} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {EmmaInlineVoice,inlineCaptureNotice} from '../src/components/EmmaInlineVoice';
import {voiceStreamNotice} from '../src/domain/voice-stream';
const props={value:'',onChange:()=>{},disabled:false,label:'也可以补充说明',status:'idle' as const,error:'',interim:'',recognized:false,stream:null,streamNotice:'',reduced:true,begin:()=>{},stop:()=>{},abort:()=>{}};
describe('onboarding inline voice input',()=>{
 it('offers immediate start in the current question without a dialog or extra entry click',()=>{const html=renderToStaticMarkup(createElement(EmmaInlineVoice,props));expect(html).toContain('开始语音');expect(html).toContain('aria-label="也可以补充说明"');expect(html).not.toContain('role="dialog"');expect(html).not.toContain('打开语音输入');});
 it('keeps interim/final captions separate and editor hidden while live',()=>{const html=renderToStaticMarkup(createElement(EmmaInlineVoice,{...props,status:'listening',recognized:true,value:'最终文字',interim:'临时文字'}));expect(html).toContain('emma-inline-final');expect(html).toContain('emma-inline-interim');expect(html.match(/最终文字/g)).toHaveLength(1);expect(html).not.toContain('<textarea');expect(html).toContain('停止并检查文字');expect(html).toContain('取消本次识别');});
 it('enables editing and confirmation after nonempty final ends',()=>{const html=renderToStaticMarkup(createElement(EmmaInlineVoice,{...props,recognized:true,value:'最终文字',onSubmit:()=>{}}));expect(html).toContain('data-voice-phase="complete"');expect(html).toContain('<textarea');expect(html).toContain('确认并提交文字');});
 it('keeps a draft and text fallback visible on failure',()=>{const html=renderToStaticMarkup(createElement(EmmaInlineVoice,{...props,error:'网络不可用',value:'原草稿'}));expect(html).toContain('role="alert"');expect(html).toContain('原草稿');expect(html).toContain('改用文字');expect(html).not.toContain('data-voice-phase="complete"');});
 it('explains capture permission, missing device and busy device separately',()=>{expect(voiceStreamNotice({name:'NotAllowedError'})).toContain('系统麦克风权限');expect(voiceStreamNotice({name:'NotFoundError'})).toContain('没有找到');expect(voiceStreamNotice({name:'NotReadableError'})).toContain('占用');});
});

describe('minimal voice copy',()=>{
 it('omits routine descriptions and empty-caption instructions but keeps disclosure and accessible state',()=>{const html=renderToStaticMarkup(createElement(EmmaInlineVoice,{...props,status:'listening',streamNotice:'光效由麦克风音频流驱动，不表示模型思考。'}));expect(html).not.toContain('浏览器正在识别');expect(html).not.toContain('光效由');expect(html).not.toContain('字幕会显示');expect(html).not.toContain('emma-inline-transcript');expect(html).toContain('sr-only');expect(html).toContain('正在录音');expect(html).toContain('浏览器服务提供方');expect(html).toContain('aria-label="停止并检查文字"');});
 it('preserves actionable capture notices and hides routine setup/success',()=>{expect(inlineCaptureNotice('正在获取麦克风音频流；此时光效仅表示识别状态。')).toBe('');expect(inlineCaptureNotice('光效由麦克风音频流驱动，不表示模型思考。')).toBe('');expect(inlineCaptureNotice(voiceStreamNotice({name:'NotAllowedError'}))).toContain('权限');expect(inlineCaptureNotice(voiceStreamNotice({name:'NotFoundError'}))).toContain('未找到');expect(inlineCaptureNotice(voiceStreamNotice({name:'NotReadableError'}))).toContain('占用');});
});
