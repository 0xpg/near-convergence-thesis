const BAYER=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5].map(value=>(value+.5)/16);

export function surface(x,y,time){
  const volume=.12+.88*x,retention=1-y;
  const base=volume**.62*(.18+.82*retention**1.4);
  return Math.max(0,Math.min(1,base+.07*Math.sin(x*7+time)*Math.cos(y*5-time*.7)));
}

export function startScenarioField(canvas:HTMLCanvasElement|null){
  const context=canvas?.getContext('2d');if(!canvas||!context)return()=>{};
  const pen:CanvasRenderingContext2D=context,field:HTMLCanvasElement=canvas;
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  const step=4,threshold=.52,started=performance.now();
  let width=0,height=0,frame=0,last=0,visible=true,active=true,pointer:{x:number,y:number}|null=null;
  function cursorAt(time){
    if(pointer)return pointer;
    return {x:.5+.32*Math.sin(time*.23),y:.48+.28*Math.sin(time*.31+1.2)};
  }
  function paint(now){
    frame=0;if(!active)return;
    const time=motion.matches?1.6:(now-started)/1000;
    pen.clearRect(0,0,width,height);
    const columns=Math.floor(width/step),rows=Math.floor(height/step);
    for(let row=0;row<rows;row++)for(let column=0;column<columns;column++){
      const x=column/columns,y=row/rows,value=surface(x,y,time*.35);
      const edge=Math.abs(value-threshold)<.012;
      if(edge){pen.fillStyle='#20372d';pen.fillRect(column*step,row*step,2,2);continue;}
      if(BAYER[(row&3)*4+(column&3)]<value*.92){pen.fillStyle=value>=threshold?'#2f5a45':'#8fae9f';pen.fillRect(column*step,row*step,1.6,1.6);}
    }
    const cursor=cursorAt(time),cx=cursor.x*width,cy=cursor.y*height;
    pen.save();pen.strokeStyle='#20372d55';pen.setLineDash([2,4]);pen.beginPath();pen.moveTo(cx,0);pen.lineTo(cx,height);pen.moveTo(0,cy);pen.lineTo(width,cy);pen.stroke();pen.restore();
    pen.fillStyle='#fafaf8';pen.beginPath();pen.arc(cx,cy,9,0,Math.PI*2);pen.fill();
    pen.fillStyle='#a55561';pen.beginPath();pen.arc(cx,cy,4.5,0,Math.PI*2);pen.fill();
    const value=surface(cursor.x,cursor.y,time*.35);
    pen.font='500 11px Saans, Arial, sans-serif';pen.textBaseline='middle';const labelY=Math.max(32,Math.min(height-28,cy));
    const label=value>=threshold?'Clears the hurdle':'Below the hurdle';
    pen.fillStyle='#fafaf8';const measured=pen.measureText(label).width;
    const labelX=Math.max(8,Math.min(width-measured-8,cx+16));pen.textAlign='left';pen.fillRect(labelX-6,labelY-10,measured+12,20);
    pen.fillStyle=value>=threshold?'#20372d':'#5c6861';pen.fillText(label,labelX,labelY);
    pen.font='400 11px Saans, Arial, sans-serif';pen.textBaseline='alphabetic';pen.fillStyle='#5c6861';
    pen.textAlign='left';pen.fillText('Retention ↑',8,16);pen.textAlign='right';pen.fillText('Volume →',width-8,height-8);
    if(!motion.matches&&visible&&!document.hidden&&!pointer)frame=requestAnimationFrame(tick);
  }
  function tick(now){if(now-last<80){frame=requestAnimationFrame(tick);return;}last=now;paint(now);}
  function schedule(){cancelAnimationFrame(frame);frame=requestAnimationFrame(paint);}
  function resize(){
    const box=field.getBoundingClientRect();width=box.width;height=box.height;
    const dpr=Math.min(devicePixelRatio||1,2);field.width=Math.round(width*dpr);field.height=Math.round(height*dpr);pen.setTransform(dpr,0,0,dpr,0,0);schedule();
  }
  const move=event=>{const box=field.getBoundingClientRect();pointer={x:Math.min(1,Math.max(0,(event.clientX-box.left)/box.width)),y:Math.min(1,Math.max(0,(event.clientY-box.top)/box.height))};schedule();};
  const leave=()=>{pointer=null;schedule();};
  field.addEventListener('pointermove',move);field.addEventListener('pointerleave',leave);
  const sizeObserver=new ResizeObserver(resize);sizeObserver.observe(field);
  const visibility=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;schedule();});visibility.observe(field);
  document.addEventListener('visibilitychange',schedule);motion.addEventListener('change',schedule);
  resize();
  return()=>{active=false;cancelAnimationFrame(frame);sizeObserver.disconnect();visibility.disconnect();field.removeEventListener('pointermove',move);field.removeEventListener('pointerleave',leave);document.removeEventListener('visibilitychange',schedule);motion.removeEventListener('change',schedule);};
}
