import { useState } from "react";
import rolePaperCube from "../assets/role-paper-cube.png";
import { UserRound } from "lucide-react";
import { useProduct } from "../product";
import { pictureToken } from "../domain/profile-picture";
import { roleCandidates,roleStory,shareCard,cardSvg,type RoleStory,type ShareFields } from "../domain/development-report";
import { Button,Dialog } from "./ui";
export function RoleStoryCard({story}:{story:RoleStory}) {
 return <article className="role-story-card" aria-label="个人画像角色故事卡"><div className="role-avatar-static" aria-hidden="true"><img className="role-paper-art" src={rolePaperCube} alt="" /></div><div><p className="eyebrow">个人画像 · 角色故事卡</p><h3>{story.title}</h3><p className="role-story-text">{story.story}</p><p className="role-basis">{story.basis}</p><p className="role-evidence">{story.evidenceCaption}</p></div></article>;
}
export function RoleIdentity() {
 const {workspace,run,busy,pending}=useProduct();const story=roleStory(workspace);
 const [open,setOpen]=useState(false),[title,setTitle]=useState(""),[hidden,setHidden]=useState(false),[token,setToken]=useState("");
 const [fields,setFields]=useState<ShareFields>({avatar:false,title:false,story:false});
 const [message,setMessage]=useState("");
 const shown=story;const preview=shareCard(shown,fields);const any=Object.values(fields).some(Boolean);
 function launch(){setTitle(workspace.roleExpression?.title||"");setHidden(story.hidden);setToken(pictureToken(workspace));setFields({avatar:false,title:false,story:false});setMessage("");setOpen(true);}
 function download(){const blob=new Blob([cardSvg(shown,fields)],{type:"image/svg+xml;charset=utf-8"});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='我的角色卡.svg';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setMessage("已发起卡片下载。卡片只包含你勾选的内容，没有对外发布。");}
 return <>
 <section className="profile-identity" aria-label="个人画像角色"><button className="role-avatar-button" onClick={launch} aria-label="查看角色卡详情与分享预览" aria-haspopup="dialog"><UserRound size={48}/><span>查看角色卡</span></button><div><h2>{story.hidden?"角色卡已隐藏":story.title}</h2><p>{story.hidden?"你可以点击头像，重新显示角色卡。":story.basis}</p><p className="role-evidence">称号和形象由你选择，不代表能力认证。</p></div></section>
 {open&&<Dialog title="角色卡与分享预览" onClose={()=>setOpen(false)} wide>
  <RoleStoryCard story={shown}/>
  <details><summary>查看角色依据</summary>{shown.sourceIds.length?<ul>{shown.sourceIds.map(id=><li key={id}>{workspace.context.filter(n=>!n.deleted&&n.sourceId===id).map(n=>n.title).join("；")||"来源已变化，请核对当前资料"}</li>)}</ul>:<p>还没有足够的经历资料。</p>}</details>
  <fieldset className="role-expression-editor"><legend>角色卡设置</legend><label>自选称号<input value={title} maxLength={40} list="role-candidate-expressions" onChange={e=>setTitle(e.target.value)}/></label><datalist id="role-candidate-expressions">{roleCandidates.map(name=><option value={name} key={name}/>)}</datalist><label><input type="checkbox" checked={hidden} onChange={e=>setHidden(e.target.checked)}/>隐藏角色卡</label><Button variant="secondary" disabled={busy||pending} onClick={async()=>{if(await run({type:"saveRoleExpression",title,hidden,baseToken:token})){setToken(pictureToken(workspace));setMessage("角色卡设置已保存。这个设置不会修改你的经历资料，也不代表能力认证。");}}}>保存设置</Button></fieldset>
  <section className="role-share"><h3>分享预览</h3><p>默认不勾选任何内容，也不会自动公开。勾选后，下方会显示卡片预览。只有你下载并自行分享后，接收者才会看到卡片里选中的形象、称号或故事。卡片不包含原始回答、来源细节、记忆和完整画像。</p><fieldset><legend>选择卡片内容</legend>{([['avatar','形象'],['title','称号'],['story','故事']] as const).map(([key,label])=><label key={key}><input type="checkbox" checked={fields[key]} onChange={e=>{setFields({...fields,[key]:e.target.checked});setMessage("");}}/>{label}</label>)}</fieldset><div className="role-share-preview" aria-label="所选内容预览">{!any?<p>请先勾选想放进卡片的内容。</p>:<>{fields.avatar&&<UserRound size={36}/>} {fields.title&&<h4>{shown.title}</h4>}{fields.story&&<p>{shown.story}</p>}<small>{preview.notice}</small></>}</div><div className="row"><Button variant="secondary" disabled={!any||busy||pending} onClick={download}>下载卡片</Button><Button disabled={!any||busy||pending} onClick={()=>setMessage("不会替你发布卡片。请先核对预览，再下载卡片自行分享。")}>查看分享说明</Button></div><p role="status">{message}</p></section>
 </Dialog>}
 </>;
}
