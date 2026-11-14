import {useEffect,useState,type ReactNode} from 'react';

export default function ResearchCard({title,takeaway,wide=false,children}:{title:string,takeaway:ReactNode,wide?:boolean,children:ReactNode}){
 const [open,setOpen]=useState(true);
 useEffect(()=>{
  const mobile=matchMedia('(max-width:760px)'),sync=()=>setOpen(!mobile.matches);
  sync();mobile.addEventListener('change',sync);
  return()=>mobile.removeEventListener('change',sync);
 },[]);
 return <details className={'lab-card lab-research-card'+(wide?' is-wide':'')} open={open} onToggle={event=>setOpen(event.currentTarget.open)}>
  <summary className="lab-card-head"><h3>{title}</h3><p className="lab-research-takeaway">{takeaway}</p><span className="lab-research-action">{open?'Close analysis':'Read analysis'}</span></summary>
  {children}
 </details>;
}
