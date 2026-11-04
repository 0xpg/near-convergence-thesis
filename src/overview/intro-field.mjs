const clamp=value=>Math.max(0,Math.min(1,value));

export function fieldPoint(column,row,time){
  const depth=row/35,u=column/95;
  const crest=Math.sin(u*9-depth*3+time)*.09+Math.cos(u*5+depth*5-time*.6)*.045;
  return {
    x:.5+(u-.5)*(1.18-depth*.34),
    y:.16+depth*.65+crest,
    alpha:(.16+depth*.55)*clamp(Math.min(u,1-u)*8)*(.65+.35*Math.sin(column*1.7+row*2.3)**2),
    size:.7+depth*1.6
  };
}

export function startIntroField(canvas){
  const pen=canvas.getContext('2d');if(!pen)return()=>{};
  const preference=matchMedia('(prefers-reduced-motion: reduce)');
  const started=performance.now();
  let frame=0,active=true,width=0,height=0;
  function paint(now){
    if(!active)return;
    const progress=preference.matches?1:clamp((now-started)/4800);
    const time=2.4*(1-(1-progress)**3);
    pen.clearRect(0,0,width,height);pen.fillStyle='#416850';
    for(let row=0;row<36;row++)for(let column=0;column<96;column++){
      const point=fieldPoint(column,row,time);
      pen.globalAlpha=point.alpha;
      const x=Math.round(point.x*width),y=Math.round(point.y*height);
      pen.fillRect(x,y,point.size,point.size);
      if((row+column)%3===0){pen.globalAlpha*=.35;pen.fillRect(x+3,y+3,1,1);}
    }
    pen.globalAlpha=1;
    if(progress<1)frame=requestAnimationFrame(paint);
  }
  function resize(){
    cancelAnimationFrame(frame);
    const rect=canvas.getBoundingClientRect();width=rect.width;height=rect.height;
    const dpr=Math.min(devicePixelRatio||1,2);
    canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
    pen.setTransform(dpr,0,0,dpr,0,0);paint(performance.now());
  }
  const observer=new ResizeObserver(resize);observer.observe(canvas);
  preference.addEventListener('change',resize);resize();
  return()=>{active=false;cancelAnimationFrame(frame);observer.disconnect();preference.removeEventListener('change',resize);};
}
