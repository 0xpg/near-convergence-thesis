const clamp=value=>Math.max(0,Math.min(1,value));
export function typePoint(point,seconds){
  const progress=clamp((seconds-point.delay)/1.8),arrival=1-(1-progress)**3;
  return {x:point.x+point.dx*(1-arrival),y:point.y+point.dy*(1-arrival),alpha:clamp(progress*5)*clamp((3.1-seconds)/.35)};
}
export function startTypeDither(canvas,heading){
  const pen=canvas.getContext('2d');if(!pen)return()=>{};
  const preference=matchMedia('(prefers-reduced-motion: reduce)');
  let active=true,frame=0,points=[],width=0,height=0,start=null;
  function paint(now){
    if(!active)return;
    if(start===null)start=now;
    const seconds=(now-start)/1000;
    pen.clearRect(0,0,width,height);pen.fillStyle='#416850';
    for(const point of points){const at=typePoint(point,seconds);pen.globalAlpha=at.alpha;pen.fillRect(at.x,at.y,1.6,1.6);}
    pen.globalAlpha=1;canvas.dataset.animationTime=seconds.toFixed(2);
    if(seconds>=2.6)heading.dataset.resolved='true';
    if(seconds<3.1)frame=requestAnimationFrame(paint);
  }
  function build(){
    cancelAnimationFrame(frame);start=null;
    const bounds=heading.getBoundingClientRect();width=bounds.width;height=bounds.height;
    const dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);pen.setTransform(dpr,0,0,dpr,0,0);
    if(preference.matches){delete heading.dataset.rendering;heading.dataset.resolved='true';pen.clearRect(0,0,width,height);return;}
    heading.dataset.rendering='true';delete heading.dataset.resolved;
    const raster=document.createElement('canvas');raster.width=Math.ceil(width);raster.height=Math.ceil(height);
    const ink=raster.getContext('2d'),style=getComputedStyle(heading);ink.fillStyle='#000';ink.font=`${style.fontWeight} ${style.fontSize} Saans`;ink.textBaseline='alphabetic';ink.letterSpacing=style.letterSpacing;
    for(const line of heading.querySelectorAll('span')){const rect=line.getBoundingClientRect(),metrics=ink.measureText(line.textContent),ascent=metrics.fontBoundingBoxAscent??parseFloat(style.fontSize)*.8,descent=metrics.fontBoundingBoxDescent??parseFloat(style.fontSize)*.2;ink.fillText(line.textContent,rect.left-bounds.left,rect.top-bounds.top+(rect.height-ascent-descent)/2+ascent);}
    const pixels=ink.getImageData(0,0,raster.width,raster.height).data;points=[];
    for(let y=0;y<raster.height;y+=3)for(let x=0;x<raster.width;x+=3)if(pixels[(y*raster.width+x)*4+3]>100){const seed=Math.sin(x*12.9898+y*78.233)*43758.5453,random=seed-Math.floor(seed);points.push({x,y,dx:(random-.5)*width*.75,dy:Math.sin(x+y)*height*.7,delay:x/width*.35+random*.15});}
    frame=requestAnimationFrame(paint);
  }
  if(!preference.matches)heading.dataset.rendering='true';
  const observer=new ResizeObserver(()=>{if(active&&document.fonts.status==='loaded')build();});observer.observe(heading);
  document.fonts.ready.then(()=>{if(active)build();});preference.addEventListener('change',build);
  return()=>{active=false;cancelAnimationFrame(frame);observer.disconnect();preference.removeEventListener('change',build);};
}
