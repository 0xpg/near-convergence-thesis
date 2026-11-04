import React,{useId,useLayoutEffect,useRef} from 'react';
import {startKineticType} from './overview/kinetic-type.mjs';

export default function KineticStatement({text}){
  const stage=useRef(),pattern=useId(),words=text.split(' ');
  useLayoutEffect(()=>startKineticType(stage.current),[text]);
  return <div className="kinetic-statement" ref={stage}><p><span className="tidal-sr">{text}</span><span aria-hidden="true">{words.map((word,index)=><React.Fragment key={index}>
    {(index===3||index===words.length-3)&&<span className="kinetic-cell" data-mark="true"><span className="kinetic-mark"><svg viewBox="0 0 48 32"><defs><pattern id={`${pattern}-${index}`} width="4" height="4" patternUnits="userSpaceOnUse"><rect width="1.7" height="1.7" fill="currentColor"/><rect x="2" y="2" width="1" height="1" fill="currentColor"/></pattern></defs><path fill={`url(#${pattern}-${index})`} d="M0 0H19L29 16 19 32H0ZM48 0H36L26 16 36 32H48Z"/></svg></span></span>}
    <span className="kinetic-cell"><span className={'kinetic-word '+(index>=words.length-3?'kinetic-emphasis':'')}>{word}{index<words.length-1?'\u00a0':''}</span></span>
  </React.Fragment>)}</span></p></div>;
}
