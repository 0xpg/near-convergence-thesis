import {useEffect,useRef,type PointerEvent} from 'react';

const BAYER=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5].map(value=>(value+.5)/16);
const STEP=3,DOT=1.6;
export const INK='#20372d',MUTED='#5c6861',RULE='#293b3222',GREEN='#436851',SOFT='#8fae9f',RED='#a55561',AMBER='#9a7428',BLUE='#466d9f',PAPER='#fafaf8';
const FONT='Saans, Arial, sans-serif';

type Pen=CanvasRenderingContext2D;
type Point=[number,number];

export function ditherRect(pen:Pen,x:number,y:number,width:number,height:number,density:number,color:string){
  if(!(width>0&&height>0&&density>0))return;
  pen.fillStyle=color;
  const left=Math.ceil(x/STEP),right=Math.ceil((x+width)/STEP)-1,top=Math.ceil(y/STEP),bottom=Math.ceil((y+height)/STEP)-1;
  for(let row=top;row<=bottom;row++)for(let column=left;column<=right;column++)if(BAYER[(row&3)*4+(column&3)]<density)pen.fillRect(column*STEP,row*STEP,DOT,DOT);
}

export function ditherArea(pen:Pen,points:Point[],baseline:number,density:number,color:string){
  if(points.length<2)return;
  pen.fillStyle=color;
  const first=Math.ceil(points[0][0]/STEP),last=Math.floor(points[points.length-1][0]/STEP);
  let segment=0;
  for(let column=first;column<=last;column++){
    const x=column*STEP;
    while(segment<points.length-2&&points[segment+1][0]<x)segment++;
    const [x0,y0]=points[segment],[x1,y1]=points[segment+1],t=x1===x0?0:(x-x0)/(x1-x0),top=y0+(y1-y0)*Math.min(1,Math.max(0,t));
    for(let row=Math.ceil(top/STEP);row*STEP<baseline;row++)if(BAYER[(row&3)*4+(column&3)]<density)pen.fillRect(x,row*STEP,DOT,DOT);
  }
}

export function ditherLine(pen:Pen,points:Point[],color:string,weight=1){
  pen.save();pen.strokeStyle=color;pen.lineWidth=weight;pen.lineJoin='round';pen.beginPath();
  points.forEach(([x,y],index)=>index?pen.lineTo(x,y):pen.moveTo(x,y));pen.stroke();pen.restore();
}

type TextOptions={size?:number,color?:string,align?:CanvasTextAlign,weight?:number,baseline?:CanvasTextBaseline};

export function text(pen:Pen,value:string,x:number,y:number,{size=11,color=MUTED,align='left',weight=400,baseline='alphabetic'}:TextOptions={}){
  pen.font=`${weight} ${size}px ${FONT}`;pen.fillStyle=color;pen.textAlign=align;pen.textBaseline=baseline;pen.fillText(value,x,y);
}

export function rule(pen:Pen,x1:number,y1:number,x2:number,y2:number,color=RULE,dash:number[]=[]){
  pen.save();pen.strokeStyle=color;pen.lineWidth=1;pen.setLineDash(dash);pen.beginPath();pen.moveTo(Math.round(x1)+.5,Math.round(y1)+.5);pen.lineTo(Math.round(x2)+.5,Math.round(y2)+.5);pen.stroke();pen.restore();
}

export function handle(pen:Pen,x:number,y:number,color=INK){
  pen.save();pen.fillStyle=PAPER;pen.strokeStyle=color;pen.lineWidth=1.5;pen.beginPath();pen.arc(x,y,7,0,Math.PI*2);pen.fill();pen.stroke();
  pen.fillStyle=color;pen.beginPath();pen.arc(x,y,2.5,0,Math.PI*2);pen.fill();pen.restore();
}

export const clamp=(value:number,min:number,max:number)=>Math.min(max,Math.max(min,value));
export const logScale=(min,max)=>({to:(value,length)=>Math.log(value/min)/Math.log(max/min)*length,from:(position,length)=>min*(max/min)**clamp(position/length,0,1)});

export type Draw=(pen:CanvasRenderingContext2D,width:number,height:number)=>void;
export type Drag=(x:number,y:number,width:number,height:number,phase:'start'|'move'|'end')=>void;

export function DitherCanvas({draw,height,label,onDrag}:{draw:Draw,height:number|string,label:string,onDrag?:Drag}){
  const ref=useRef<HTMLCanvasElement>(null),drawRef=useRef(draw),dragRef=useRef(onDrag),scheduleRef=useRef(()=>{});
  drawRef.current=draw;dragRef.current=onDrag;
  useEffect(()=>{
    const element=ref.current,context=element?.getContext('2d');
    if(!element||!context)return;
    const canvas:HTMLCanvasElement=element,pen:CanvasRenderingContext2D=context;
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
  const point=(canvas:HTMLCanvasElement,event:PointerEvent):[number,number,number,number]=>{const box=canvas.getBoundingClientRect();return [event.clientX-box.left,event.clientY-box.top,box.width,box.height];};
  const down=(event:PointerEvent<HTMLCanvasElement>)=>{const canvas=event.currentTarget;if(!dragRef.current)return;event.preventDefault();canvas.setPointerCapture(event.pointerId);canvas.dataset.dragging='true';dragRef.current(...point(canvas,event),'start');};
  const move=(event:PointerEvent<HTMLCanvasElement>)=>{const canvas=event.currentTarget;if(canvas.dataset.dragging==='true')dragRef.current?.(...point(canvas,event),'move');};
  const up=(event:PointerEvent<HTMLCanvasElement>)=>{const canvas=event.currentTarget;if(canvas.dataset.dragging!=='true')return;delete canvas.dataset.dragging;canvas.releasePointerCapture?.(event.pointerId);dragRef.current?.(...point(canvas,event),'end');};
  return <canvas ref={ref} className={'lab-canvas'+(onDrag?' is-draggable':'')} style={{height}} role="img" aria-label={label} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}/>;
}
