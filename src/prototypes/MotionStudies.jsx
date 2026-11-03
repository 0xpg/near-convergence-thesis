import React,{useEffect,useLayoutEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {startAbsorption} from './absorption.mjs';
import './motion-studies.css';

const names=['Archive','Tidal','Focus'];
function Study({mode}){
  const canvas=useRef();
  useLayoutEffect(()=>startAbsorption(canvas.current,mode),[mode]);
  return <main className={'motion-study motion-study-'+mode}><canvas ref={canvas} tabIndex="0" aria-label={`${names[mode]} particle motion study. Move over a cluster or touch it to draw particles toward the center. Use left and right keys to select clusters; Escape releases selection.`}/></main>;
}
function App(){
  const [current,setCurrent]=useState(()=>Math.max(0,Math.min(2,(parseInt(new URLSearchParams(location.search).get('v'),10)||1)-1))),[replay,setReplay]=useState(0);
  const picker=useRef(),highlight=useRef(),buttons=useRef([]);
  function choose(index){setCurrent(index);setReplay(n=>n+1);const url=new URL(location);url.searchParams.set('v',index+1);history.replaceState(null,'',url);}
  useLayoutEffect(()=>{function position(){const button=buttons.current[current];highlight.current.style.width=button.offsetWidth+'px';highlight.current.style.transform=`translateX(${button.offsetLeft}px)`;}position();window.addEventListener('resize',position);return()=>window.removeEventListener('resize',position);},[current]);
  useEffect(()=>{const frame=requestAnimationFrame(()=>requestAnimationFrame(()=>picker.current?.setAttribute('data-ready','')));return()=>cancelAnimationFrame(frame);},[]);
  useEffect(()=>{function keys(event){if(event.defaultPrevented||event.metaKey||event.ctrlKey||event.altKey||/^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)||event.target.isContentEditable)return;const number=Number(event.key);if(number>=1&&number<=3){event.preventDefault();choose(number-1);}else if(event.key==='ArrowRight'){event.preventDefault();choose((current+1)%3);}else if(event.key==='ArrowLeft'){event.preventDefault();choose((current+2)%3);}else if(event.key.toLowerCase()==='r')setReplay(n=>n+1);}document.addEventListener('keydown',keys);return()=>document.removeEventListener('keydown',keys);},[current]);
  return <><Study key={current+'-'+replay} mode={current}/><nav ref={picker} className="proto-picker" aria-label="Prototype variants"><span ref={highlight} className="proto-picker-highlight" aria-hidden="true"/>{names.map((name,index)=><button key={name} ref={element=>buttons.current[index]=element} className="proto-picker-item" data-active={current===index?'':undefined} aria-current={current===index?'true':undefined} onClick={()=>choose(index)}>{name}</button>)}<span className="proto-picker-divider" aria-hidden="true"/><button className="proto-picker-item proto-picker-replay" aria-label="Replay animation (R)" onClick={()=>setReplay(n=>n+1)}>Replay</button></nav></>;
}
createRoot(document.getElementById('root')).render(<App/>);
