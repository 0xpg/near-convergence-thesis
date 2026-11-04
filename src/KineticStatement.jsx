import React,{useLayoutEffect,useRef} from 'react';
import {startKineticType} from './overview/kinetic-type.mjs';

export default function KineticStatement({text}){
  const stage=useRef(),words=text.split(' ');
  useLayoutEffect(()=>startKineticType(stage.current),[text]);
  return <div className="kinetic-statement" ref={stage}><p><span className="tidal-sr">{text}</span><span aria-hidden="true">{words.map((word,index)=><React.Fragment key={index}>
    {(index===3||index===words.length-3)&&<span className="kinetic-cell" data-mark="true"><span className="kinetic-mark"><svg viewBox="0 0 48 32"><path d="M0 0H19L29 16 19 32H0ZM48 0H36L26 16 36 32H48Z"/></svg></span></span>}
    <span className="kinetic-cell"><span className={'kinetic-word '+(index>=words.length-3?'kinetic-emphasis':'')}>{word}{index<words.length-1?'\u00a0':''}</span></span>
  </React.Fragment>)}</span></p></div>;
}
