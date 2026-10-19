import { isPersistedSnapshot, type ConnectedTransport } from './service';
import type { Snapshot, Request, Operation } from './types';
const fail = (code: string, message: string) => Object.assign(new Error(message), {code});
export function createHttpTransport(options: {baseUrl: string; fetch?: typeof fetch; timeoutMs?: number}): ConnectedTransport & {refresh(): Promise<void>} {
  const base = new URL(options.baseUrl.endsWith('/') ? options.baseUrl : options.baseUrl + '/');
  if (base.protocol !== 'http:' || !['localhost','127.0.0.1','[::1]'].includes(base.hostname) || base.username || base.password || base.search || base.hash) throw fail('CAPABILITY_UNAVAILABLE','隐私边界待确认，仅允许本机模拟服务。');
  let snapshot: Snapshot | undefined;
  let loading: Promise<void> | undefined;
  let busy = false;
  const listeners = new Set<() => void>();
  function accept(value: unknown) {
    const s = value as Snapshot;
    if (!isPersistedSnapshot(s, 'connected')) throw fail('INVALID_RESPONSE','服务返回的数据格式不完整，请重试读取。');
    if (snapshot && s.revision < snapshot.revision) throw fail('STALE_RESPONSE','服务返回过期数据，请重试读取。');
    snapshot = s; listeners.forEach(fn=>fn()); return s;
  }
  async function request(path: string, init?: RequestInit): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(()=>controller.abort(), options.timeoutMs ?? 10000);
    try {
      const r = await (options.fetch ?? globalThis.fetch)(new URL(path,base), {...init, signal:controller.signal, credentials:'omit', redirect:'error', cache:'no-store', headers:{'Content-Type':'application/json',...init?.headers}});
      if (r.status === 404 && path.startsWith('operations/')) return undefined;
      if (!r.ok) throw fail('HTTP_ERROR',`服务请求失败（${r.status}），请重试或查询原操作。`);
      return await r.json();
    } catch(e) {
      if ((e as {code?:string}).code) throw e;
      throw fail('NETWORK_UNAVAILABLE','连接中断或响应无效，请恢复连接后重试读取或查询原操作。');
    } finally {clearTimeout(timer);}
  }
  return {
    getSnapshot(){if(!snapshot)throw fail('NOT_READY','正在读取工作区');return snapshot;},
    subscribe(fn){listeners.add(fn);return ()=>{listeners.delete(fn);};},
    refresh(){
      if(busy)return Promise.reject(fail('CLIENT_BUSY','当前操作正在处理中，请稍候。'));
      if(!loading)loading=request('snapshot').then(accept).then(()=>{}).finally(()=>{loading=undefined;});
      return loading;
    },
    async execute(r: Request){
      if(busy||loading)throw fail('CLIENT_BUSY','当前操作正在处理中，请稍候。');busy=true;
      try{return accept(await request('commands',{method:'POST',headers:{'Idempotency-Key':r.operationId},body:JSON.stringify(r)}));}finally{busy=false;}
    },
    async getOperation(id: string){
      const value=await request(`operations/${encodeURIComponent(id)}`);
      if(value===undefined)return undefined;
      const op=value as Operation;
      if(op.id!==id||!['succeeded','failed'].includes(op.state))throw fail('INVALID_RECEIPT','操作回执格式无效，请稍后查询原操作。');
      accept(await request('snapshot'));return op;
    },
  };
}
