export function voiceStreamNotice(error:unknown) {
 const name=typeof error==='object'&&error!==null&&'name' in error?String(error.name):'';
 const reason=name==='NotAllowedError'?'麦克风权限未开启，请检查浏览器的网站权限和系统麦克风权限。'
 :name==='NotFoundError'?'没有找到可用麦克风，请检查输入设备。'
 :name==='NotReadableError'?'麦克风无法读取，可能正被其他应用占用。'
 :name==='SecurityError'?'当前页面无法访问麦克风，请使用本机 http://127.0.0.1 入口。'
 :'麦克风音量流不可用。';
 return reason+' 音量光效已停用；浏览器识别可继续，若识别也失败请改用文字。';
}
export function createVoiceStream(owner:{request:()=>Promise<MediaStream>;stream:(s:MediaStream|null)=>void;notice:(s:string)=>void}) {
 let generation=0,stream:MediaStream|null=null;
 const listeners:Array<()=>void>=[];
 function release(){for(const off of listeners.splice(0))off();if(stream)for(const track of stream.getTracks())track.stop();stream=null;owner.stream(null);}
 return {
  async start(){const token=++generation;release();owner.notice("正在获取麦克风音频流；此时光效仅表示识别状态。");
   try{const received=await owner.request();if(token!==generation){for(const track of received.getTracks())track.stop();return;}
    stream=received;const tracks=received.getAudioTracks();
    if(!tracks.length||tracks.every(t=>t.readyState!=="live")){release();owner.notice("音频流不可用，语音识别仍可继续；可改用文字。");return;}
    const update=()=>{
     if(token!==generation)return;
     const usable=tracks.some(t=>t.readyState==="live"&&!t.muted);
     owner.stream(usable?received:null);
     owner.notice(usable?"光效由麦克风音频流驱动，不表示模型思考。":"音轨暂时静音或中断，音量光效已停用；可继续识别或改用文字。");
    };
    for(const track of tracks)for(const event of ["mute","unmute","ended"]){track.addEventListener(event,update);listeners.push(()=>track.removeEventListener(event,update));}
    update();
   }catch(error){if(token===generation){release();owner.notice(voiceStreamNotice(error));}}
  },
  stop(){generation++;release();owner.notice("");},
 };
}
