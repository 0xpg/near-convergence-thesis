import {clamp01 as clamp} from '../format.ts';
export function typePoint(point,seconds){
  const progress=clamp((seconds-point.delay)/1.8),arrival=1-(1-progress)**3;
  return {x:point.x+point.dx*(1-arrival),y:point.y+point.dy*(1-arrival),alpha:clamp(progress*5)*clamp((3.1-seconds)/.35)};
}

type Point={x:number,y:number,dx:number,dy:number,delay:number};

export function startTypeDither(canvas:HTMLCanvasElement,heading:HTMLElement){
  const context=canvas.getContext('2d');if(!context)return()=>{};
  const pen:CanvasRenderingContext2D=context;
  const preference=matchMedia('(prefers-reduced-motion: reduce)');
  let active=true,visible=false,fontReady=false,complete=false,frame=0,points:Point[]=[],width=0,height=0,start:number|null=null,fingerprint='';
  function paint(now){
    frame=0;if(!active||!visible)return;
    const origin=start??(start=now),seconds=(now-origin)/1000,fade=clamp((3.1-seconds)/.35);
    pen.clearRect(0,0,width,height);pen.fillStyle='#416850';
    for(const point of points){
      const progress=clamp((seconds-point.delay)/1.8),remaining=(1-progress)**3;
      pen.globalAlpha=clamp(progress*5)*fade;
      if(pen.globalAlpha>0)pen.fillRect(point.x+point.dx*remaining,point.y+point.dy*remaining,1.6,1.6);
    }
    pen.globalAlpha=1;canvas.dataset.animationTime=seconds.toFixed(2);
    if(seconds>=2.6)heading.dataset.resolved='true';
    if(seconds<3.1)frame=requestAnimationFrame(paint);else complete=true;
  }
  function schedule(){if(!frame&&!complete&&visible)frame=requestAnimationFrame(paint);}
  function build(){
    if(!active||!fontReady||(!visible&&!preference.matches))return;
    if(preference.matches){
      cancelAnimationFrame(frame);frame=0;complete=true;
      delete heading.dataset.rendering;heading.dataset.resolved='true';pen.clearRect(0,0,width,height);return;
    }
    // A completed reveal stays readable; resizes must not hide and replay it.
    if(complete){pen.clearRect(0,0,width,height);return;}
    const bounds=heading.getBoundingClientRect(),style=getComputedStyle(heading),dpr=Math.min(devicePixelRatio||1,2);
    const next=[bounds.width,bounds.height,dpr,style.fontWeight,style.fontSize,style.letterSpacing].join(':');
    if(next===fingerprint){schedule();return;}
    width=bounds.width;height=bounds.height;if(width<=0||height<=0)return;
    canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);pen.setTransform(dpr,0,0,dpr,0,0);
    const raster=document.createElement('canvas');raster.width=Math.ceil(width);raster.height=Math.ceil(height);
    const ink=raster.getContext('2d');if(!ink)return;ink.fillStyle='#000';ink.font=`${style.fontWeight} ${style.fontSize} Saans`;ink.textBaseline='alphabetic';ink.letterSpacing=style.letterSpacing;
    for(const line of heading.querySelectorAll('span')){const rect=line.getBoundingClientRect(),metrics=ink.measureText(line.textContent),ascent=metrics.fontBoundingBoxAscent??parseFloat(style.fontSize)*.8,descent=metrics.fontBoundingBoxDescent??parseFloat(style.fontSize)*.2;ink.fillText(line.textContent,rect.left-bounds.left,rect.top-bounds.top+(rect.height-ascent-descent)/2+ascent);}
    const pixels=ink.getImageData(0,0,raster.width,raster.height).data;points=[];
    for(let y=0;y<raster.height;y+=3)for(let x=0;x<raster.width;x+=3)if(pixels[(y*raster.width+x)*4+3]>100){const seed=Math.sin(x*12.9898+y*78.233)*43758.5453,random=seed-Math.floor(seed);points.push({x,y,dx:(random-.5)*width*.75,dy:Math.sin(x+y)*height*.7,delay:x/width*.35+random*.15});}
    fingerprint=next;heading.dataset.rendering='true';schedule();
  }
  const observer=new ResizeObserver(build);observer.observe(heading);
  const visibility=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;if(visible)build();else{cancelAnimationFrame(frame);frame=0;}});visibility.observe(heading);
  const style=getComputedStyle(heading);
  document.fonts.load(`${style.fontWeight} ${style.fontSize} Saans`).then(()=>{if(active){fontReady=true;build();}}).catch(()=>{if(active){delete heading.dataset.rendering;heading.dataset.resolved='true';}});
  preference.addEventListener('change',build);
  return()=>{active=false;cancelAnimationFrame(frame);observer.disconnect();visibility.disconnect();preference.removeEventListener('change',build);};
}
