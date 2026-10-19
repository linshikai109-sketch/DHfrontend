import {useState} from 'react';
import {useProduct} from '../product';
import {Button} from './ui';
import {pictureToken} from '../domain/profile-picture';
import {profileSummary} from '../domain/profile-summary';
import type {ContextNode} from '../domain/types';
function SourceEditor({node}:{node:ContextNode}) {
  const {workspace,run,busy,pending}=useProduct();
  const [editing,setEditing]=useState(false),[value,setValue]=useState(node.title),[baseToken,setToken]=useState('');
  const answers=(node.sourceIds||[node.sourceId]).map(s=>workspace.acquisition.answers[s]).filter(Boolean);
  return <div className="profile-source-editor">{editing?<form onSubmit={async e=>{e.preventDefault();if(await run({type:'saveProfileFact',id:node.id,title:value.trim(),baseToken}))setEditing(false);}}><label htmlFor={`fact-${node.id}`}>修改资料</label><textarea id={`fact-${node.id}`} autoFocus value={value} onChange={e=>setValue(e.target.value)}/><div className="row"><Button disabled={busy||pending||!value.trim()}>保存</Button><Button type="button" variant="quiet" onClick={()=>setEditing(false)}>取消</Button></div></form>:<><p>{node.title}</p><details><summary>查看来源</summary>{answers.map(a=><blockquote key={a.id}>{a.value}</blockquote>)}{!answers.length&&<p>你补充的资料</p>}{node.edited&&<p>当前以你修改后的内容为准</p>}</details><div className="row"><Button variant="quiet" disabled={busy||pending} onClick={()=>{setValue(node.title);setToken(pictureToken(workspace));setEditing(true);}}>修改</Button><Button variant="quiet" disabled={busy||pending} onClick={()=>void run({type:'editContext',id:node.id,patch:{deleted:true}})}>移除</Button></div></>}</div>;
}
export function ProfileSummarySections({groupIds}:{groupIds?:string[]}){
 const {workspace,run,busy,pending}=useProduct();const summary=profileSummary(workspace);const removed=workspace.context.filter(n=>n.deleted);
 return <>{!groupIds&&summary.conflicts.map((conflict,i)=><details className="profile-summary-recovery" key={i}><summary>{conflict.title}</summary>{conflict.nodes.map(node=><SourceEditor key={node.id} node={node}/>)}</details>)}<div className="profile-summary-grid">{summary.groups.filter(group=>!groupIds||groupIds.includes(group.id)).map(group=><section className="profile-summary-section" key={group.id}><h2>{group.title}</h2><div className="profile-summary-copy">{group.items.map(item=><p key={item.nodes[0].id}>{item.text}</p>)}</div><details className="profile-section-detail"><summary>查看与修改</summary>{group.items.flatMap(item=>item.nodes).map(node=><SourceEditor key={node.id} node={node}/>)}</details></section>)}</div>{!!summary.stale.length&&<details className="profile-summary-recovery"><summary>来源已更新 · {summary.stale.length} 条</summary>{summary.stale.map(node=><SourceEditor node={node} key={node.id}/>)}</details>}{!!removed.length&&<details className="profile-summary-recovery"><summary>已移除 · {removed.length} 条</summary>{removed.map(node=><div key={node.id}><p>{node.title}</p><Button variant="quiet" disabled={busy||pending} onClick={()=>void run({type:'editContext',id:node.id,patch:{deleted:false}})}>恢复</Button></div>)}</details>}</>;
}

export function ProfileIdentityDetails(){const {workspace}=useProduct();const nodes=workspace.context.filter(n=>!n.deleted&&n.status!=='stale'&&n.sourceId.split(':')[0]==='j-scope');if(!nodes.length)return null;return <details className="profile-identity-details"><summary>名称与范围</summary>{nodes.map(node=><SourceEditor node={node} key={node.id}/>)}</details>;}
