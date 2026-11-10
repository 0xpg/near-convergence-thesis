import {useEffect,useRef} from 'react';

const BAYER=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5].map(value=>(value+.5)/16);
const STEP=3,DOT=1.6;
export const INK='#20372d',MUTED='#5c6861',RULE='#293b3222',GREEN='#436851',SOFT='#8fae9f',RED='#a55561',AMBER='#9a7428',BLUE='#466d9f',PAPER='#fafaf8';
const FONT='Saans, Arial, sans-serif';

export function ditherRect(pen,x,y,width,height,density,color){
  if(!(width>0&&height>0&&density>0))return;
  pen.fillStyle=color;
  const left=Math.ceil(x/STEP),right=Math.ceil((x+width)/STEP)-1,top=Math.ceil(y/STEP),bottom=Math.ceil((y+height)/STEP)-1;
  for(let row=top;row<=bottom;row++)for(let column=left;column<=right;column++)if(BAYER[(row&3)*4+(column&3)]<density)pen.fillRect(column*STEP,row*STEP,DOT,DOT);
}

export function ditherArea(pen,points,baseline,density,color){
  if(points.length<2)return;
  pen.fillStyle=color;
  const first=Math.ceil(points[0][0]/STEP),last=Math.floor(points.at(-1)[0]/STEP);
  let segment=0;
  for(let column=first;column<=last;column++){
    const x=column*STEP;
    while(segment<points.length-2&&points[segment+1][0]<x)segment++;
    const [x0,y0]=points[segment],[x1,y1]=points[segment+1],t=x1===x0?0:(x-x0)/(x1-x0),top=y0+(y1-y0)*Math.min(1,Math.max(0,t));
    for(let row=Math.ceil(top/STEP);row*STEP<baseline;row++)if(BAYER[(row&3)*4+(column&3)]<density)pen.fillRect(x,row*STEP,DOT,DOT);
  }
}

export function ditherLine(pen,points,color,weight=1){
  pen.save();pen.strokeStyle=color;pen.lineWidth=weight;pen.lineJoin='round';pen.beginPath();
  points.forEach(([x,y],index)=>index?pen.lineTo(x,y):pen.moveTo(x,y));pen.stroke();pen.restore();
}

export function text(pen,value,x,y,{size=11,color=MUTED,align='left',weight=400,baseline='alphabetic'}={}){
  pen.font=`${weight} ${size}px ${FONT}`;pen.fillStyle=color;pen.textAlign=align;pen.textBaseline=baseline;pen.fillText(value,x,y);
}

export function rule(pen,x1,y1,x2,y2,color=RULE,dash=[]){
  pen.save();pen.strokeStyle=color;pen.lineWidth=1;pen.setLineDash(dash);pen.beginPath();pen.moveTo(Math.round(x1)+.5,Math.round(y1)+.5);pen.lineTo(Math.round(x2)+.5,Math.round(y2)+.5);pen.stroke();pen.restore();
}

export function handle(pen,x,y,color=INK){
  pen.save();pen.fillStyle=PAPER;pen.strokeStyle=color;pen.lineWidth=1.5;pen.beginPath();pen.arc(x,y,7,0,Math.PI*2);pen.fill();pen.stroke();
  pen.fillStyle=color;pen.beginPath();pen.arc(x,y,2.5,0,Math.PI*2);pen.fill();pen.restore();
}

export const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
export const logScale=(min,max)=>({to:(value,length)=>Math.log(value/min)/Math.log(max/min)*length,from:(position,length)=>min*(max/min)**clamp(position/length,0,1)});

export function DitherCanvas({draw,height,label,onDrag}){
  const ref=useRef(),drawRef=useRef(draw),dragRef=useRef(onDrag),scheduleRef=useRef(()=>{});
  drawRef.current=draw;dragRef.current=onDrag;
  useEffect(()=>{
    const canvas=ref.current,pen=canvas?.getContext('2d');
    if(!pen)return;
    let frame=0,active=true;
    const paint=()=>{
      frame=0;if(!active)return;
      const width=canvas.clientWidth,heightPx=canvas.clientHeight,dpr=Math.min(devicePixelRatio||1,2);
      if(canvas.width!==Math.round(width*dpr)||canvas.height!==Math.round(heightPx*dpr)){canvas.width=Math.round(width*dpr);canvas.height=Math.round(heightPx*dpr);}
      pen.setTransform(dpr,0,0,dpr,0,0);pen.clearRect(0,0,width,heightPx);
      if(width>0)drawRef.current(pen,width,heightPx);
    };
    const schedule=()=>{if(!frame)frame=requestAnimationFrame(paint);};
    scheduleRef.current=schedule;schedule();
    const observer=new ResizeObserver(schedule);observer.observe(canvas);
    document.fonts?.ready.then(schedule);
    return()=>{active=false;cancelAnimationFrame(frame);observer.disconnect();};
  },[]);
  useEffect(()=>scheduleRef.current());
  const point=event=>{const box=ref.current.getBoundingClientRect();return [event.clientX-box.left,event.clientY-box.top,box.width,box.height];};
  const down=event=>{if(!dragRef.current)return;event.preventDefault();ref.current.setPointerCapture(event.pointerId);ref.current.dataset.dragging='true';dragRef.current(...point(event),'start');};
  const move=event=>{if(ref.current.dataset.dragging==='true')dragRef.current?.(...point(event),'move');};
  const up=event=>{if(ref.current.dataset.dragging!=='true')return;delete ref.current.dataset.dragging;ref.current.releasePointerCapture?.(event.pointerId);dragRef.current?.(...point(event),'end');};
  return <canvas ref={ref} className={'lab-canvas'+(onDrag?' is-draggable':'')} style={{height}} role="img" aria-label={label} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}/>;
}
