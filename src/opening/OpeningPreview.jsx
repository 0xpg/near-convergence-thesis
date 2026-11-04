import React,{useEffect,useLayoutEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import OverviewScene from '../OverviewScene.jsx';
import Converge from './Converge.jsx';
import Resolve from './Resolve.jsx';
import Sequence from './Sequence.jsx';
import '../../overview.css';
import './opening.css';
const variants=[{name:'Converge',Component:Converge},{name:'Resolve',Component:Resolve},{name:'Sequence',Component:Sequence}];
function App(){
  const [current,setCurrent]=useState(()=>{const value=parseInt(new URLSearchParams(location.search).get('v'),10);return value>=1&&value<=3?value-1:0;}),[replay,setReplay]=useState(0);
  const picker=useRef(),highlight=useRef(),buttons=useRef([]),top=useRef();const Variant=variants[current].Component;
  function choose(index){setCurrent(index);setReplay(value=>value+1);const url=new URL(location);url.searchParams.set('v',index+1);url.hash='';history.replaceState(null,'',url);top.current.scrollIntoView({behavior:'instant'});}
  useLayoutEffect(()=>{function position(){const button=buttons.current[current];highlight.current.style.width=button.offsetWidth+'px';highlight.current.style.transform=`translateX(${button.offsetLeft}px)`;}position();window.addEventListener('resize',position);return()=>window.removeEventListener('resize',position);},[current]);
  useEffect(()=>{let second;const first=requestAnimationFrame(()=>{second=requestAnimationFrame(()=>picker.current?.setAttribute('data-ready',''));});return()=>{cancelAnimationFrame(first);cancelAnimationFrame(second);};},[]);
  useEffect(()=>{function keys(event){if(event.defaultPrevented||event.metaKey||event.ctrlKey||event.altKey||/^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)||event.target.isContentEditable)return;const number=Number(event.key);if(number>=1&&number<=3){event.preventDefault();choose(number-1);}else if(event.key==='ArrowRight'){event.preventDefault();choose((current+1)%3);}else if(event.key==='ArrowLeft'){event.preventDefault();choose((current+2)%3);}else if(event.key.toLowerCase()==='r')choose(current);}document.addEventListener('keydown',keys);return()=>document.removeEventListener('keydown',keys);},[current]);
  return <div className="opening-preview" ref={top}><a className="opening-skip" href="#evidence">Skip introduction</a><header className="opening-header"><a href="https://near-evidence.pages.dev/" className="opening-brand">NEAR</a><span>Thesis</span><a href="https://near-evidence.pages.dev/report">Report</a></header>
    <section className={'opening-hero opening-direction-'+current} aria-label="Thesis introduction"><Variant key={current+'-'+replay}/><div className="opening-footer"><span>From proposition to evidence</span><a href="#evidence">Explore the network</a></div></section>
    <section id="evidence" className="opening-evidence" aria-label="NEAR evidence map"><OverviewScene/></section>
    <nav ref={picker} className="proto-picker" aria-label="Prototype variants"><span ref={highlight} className="proto-picker-highlight" aria-hidden="true"/>{variants.map((variant,index)=><button key={variant.name} ref={element=>buttons.current[index]=element} className="proto-picker-item" data-active={current===index?'':undefined} aria-current={current===index?'true':undefined} onClick={()=>choose(index)}>{variant.name}</button>)}<span className="proto-picker-divider" aria-hidden="true"/><button className="proto-picker-item proto-picker-replay" aria-label="Replay animation (R)" title="Replay animation (R)" onClick={()=>choose(current)}>R</button></nav>
  </div>;
}
createRoot(document.getElementById('root')).render(<App/>);
