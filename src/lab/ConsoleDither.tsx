import {useEffect,useRef} from 'react';
import {prefersReducedMotion} from './dither.tsx';

const BAYER=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5].map(value=>(value+.5)/16);
const STEP=5,DOT=1.7,RIPPLE_SECONDS=1.6,ORIGIN={x:.18,y:.24};

function density(u:number,v:number,time:number,ripple:number|null){
  const drift=.5+.5*Math.sin(u*5.1+time*.25+Math.sin(v*3.3-time*.18)*1.4);
  const swell=.5+.5*Math.sin(v*4.2-time*.21+Math.cos(u*2.6+time*.13));
  const weight=.25+.75*((u+v)/2)**1.3,field=drift*swell;
  if(Math.abs(field-.58)<.016&&weight>.4)return .95;
  let value=.62*field*field*weight;
  if(ripple!==null){
    const distance=Math.hypot(u-ORIGIN.x,(v-ORIGIN.y)*.8),front=ripple*1.15;
    value+=.42*Math.exp(-(((distance-front)/.07)**2))*Math.max(0,1-ripple/RIPPLE_SECONDS);
  }
  return value;
}

export function startConsoleDither(canvas:HTMLCanvasElement|null,pulse:{current:number|null}){
  const context=canvas?.getContext('2d');if(!canvas||!context)return()=>{};
  const pen:CanvasRenderingContext2D=context,field:HTMLCanvasElement=canvas,started=performance.now();
  let frame=0,last=0,visible=true,active=true,width=0,height=0;
  const looping=()=>visible&&!prefersReducedMotion();
  function resize(){
    const dpr=Math.min(devicePixelRatio||1,2);width=field.clientWidth;height=field.clientHeight;
    field.width=Math.round(width*dpr);field.height=Math.round(height*dpr);pen.setTransform(dpr,0,0,dpr,0,0);
  }
  function paint(now:number){
    frame=0;if(!active)return;
    if(looping()&&now-last<32){frame=requestAnimationFrame(paint);return;}
    last=now;
    const still=prefersReducedMotion(),time=still?2:(now-started)/1000;
    const ripple=!still&&pulse.current!==null?(now-pulse.current)/1000:null;
    if(ripple!==null&&ripple>RIPPLE_SECONDS)pulse.current=null;
    pen.clearRect(0,0,width,height);pen.fillStyle='rgba(214,233,215,.26)';
    const columns=Math.ceil(width/STEP),rows=Math.ceil(height/STEP);
    for(let row=0;row<rows;row++)for(let column=0;column<columns;column++){
      if(BAYER[(row&3)*4+(column&3)]<density(column/columns,row/rows,time,ripple&&ripple<=RIPPLE_SECONDS?ripple:null))pen.fillRect(column*STEP,row*STEP,DOT,DOT);
    }
    if(looping())frame=requestAnimationFrame(paint);
  }
  const schedule=()=>{if(!frame)frame=requestAnimationFrame(paint);};
  const sized=new ResizeObserver(()=>{resize();schedule();});sized.observe(field);
  const viewport=typeof IntersectionObserver==='function'?new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;if(visible)schedule();}):null;viewport?.observe(field);
  resize();schedule();
  return()=>{active=false;cancelAnimationFrame(frame);sized.disconnect();viewport?.disconnect();};
}

export default function ConsoleDither({value}:{value:number}){
  const ref=useRef<HTMLCanvasElement>(null),pulse=useRef<number|null>(null),previous=useRef(value);
  useEffect(()=>{if(previous.current!==value){previous.current=value;pulse.current=performance.now();}},[value]);
  useEffect(()=>startConsoleDither(ref.current,pulse),[]);
  return <canvas ref={ref} className="lab-console-dither" aria-hidden="true"/>;
}
