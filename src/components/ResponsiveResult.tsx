import { useState, type ReactNode } from 'react';
import type { VoiceScene } from '../domain/workbench-voice';
import { Dialog } from './ui';
import './responsive-result.css';

/** Only hides whole rows on small screens; desktop content is never truncated. */
export function MobileFold({children,count,limit=2,label='展开全部'}:{children:ReactNode;count:number;limit?:number;label?:string}) {
 const [expanded,setExpanded]=useState(false);
 return <div className="responsive-fold" data-expanded={expanded} style={{'--fold-limit':limit} as React.CSSProperties}>
  <div className={`responsive-fold-items fold-${limit}`}>{children}</div>
  {count>limit&&<button className="responsive-fold-toggle" aria-expanded={expanded} onClick={()=>setExpanded(v=>!v)}>{expanded?'收起':`${label}（${count}）`}</button>}
 </div>;
}

export function ResponsiveVoiceSceneResult({scene}:{scene:VoiceScene}) {
 const [full,setFull]=useState(false);
 const columns=scene.columns;
 const items=()=><div className={`responsive-scene-items scene-${scene.id}`}>
  {scene.rows.map((row,i)=><section key={i}>
   <span>{row[0]}</span>
   {row.slice(1).map((value,j)=><div key={j}>{columns&&<small>{columns[j+1]}</small>}<strong>{value}</strong></div>)}
   {scene.id==='flow'&&i<scene.rows.length-1&&<span aria-hidden="true">↓</span>}
  </section>)}
 </div>;
 const cardRows=<MobileFold count={scene.rows.length} label={scene.id==='flow'?'展开完整步骤':scene.id==='roadmap'?'展开完整路线':'展开全部'}>
  {scene.rows.map((row,i)=><section className="responsive-scene-card" key={i}><span>{row[0]}</span>{row.slice(1).map((value,j)=><div key={j}>{columns&&<small>{columns[j+1]}</small>}<strong>{value}</strong></div>)}
   {scene.id==='flow'&&i<scene.rows.length-1&&<span className="responsive-step-arrow" aria-hidden="true">↓</span>}
  </section>)}
 </MobileFold>;
 return <article className={`wb-scene-result responsive-result result-${scene.id}`}><h2>{scene.title}</h2><p>{scene.answer}</p>
  {columns?<><div className="wb-scene-table responsive-desktop"><table><thead><tr>{columns.map(c=><th key={c}>{c}</th>)}</tr></thead><tbody>{scene.rows.map((row,i)=><tr key={i}>{row.map((cell,j)=>j===0?<th scope="row" key={j}>{cell}</th>:<td key={j}>{cell}</td>)}</tr>)}</tbody></table></div><div className="responsive-mobile">{cardRows}</div></>:scene.id==='statistics'?<div className="wb-bars">{scene.rows.map(([title,value,detail])=><div key={title}><span>{title}</span><div className="wb-bar-track"><i style={{width:`${value}%`}}/></div><strong>{value}%</strong><small>{detail}</small></div>)}</div>:<><div className={`wb-scene-items wb-scene-${scene.id} responsive-desktop`}>{scene.rows.map((row,i)=><section key={i}>{scene.id==='checklist'&&<span className="wb-check-square" aria-hidden="true"/>}<span className="wb-item-label">{row[0]}</span><strong>{row[1]}</strong>{scene.id==='flow'&&i<scene.rows.length-1&&<span className="wb-flow-arrow" aria-hidden="true">↓</span>}</section>)}</div><div className="responsive-mobile">{cardRows}</div></>}
  {scene.id==='relationships'&&<button className="responsive-full-button" onClick={()=>setFull(true)}>查看完整关系</button>}
  {full&&<Dialog title={scene.title} wide onClose={()=>setFull(false)}><div className="responsive-full-content">{items()}</div></Dialog>}
 </article>;
}
