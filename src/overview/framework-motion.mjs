export function startFrameworkMotion(stage,world){
  const preference=matchMedia('(prefers-reduced-motion: reduce)');
  let angle=0,manual=false,visible=false,frame=0,start=null,pointer=null;
  function draw(value){
    angle=Math.max(-75,Math.min(75,value));
    world.style.transform=`rotateX(${Math.min(14,Math.abs(angle)*.35)}deg) rotateY(${angle}deg)`;
  }
  function stop(){manual=true;cancelAnimationFrame(frame);}
  function animate(now){
    if(manual||!visible||preference.matches)return;
    if(start===null)start=now;
    draw(Math.sin((now-start)/1000*.4)*48);
    frame=requestAnimationFrame(animate);
  }
  function begin(event){
    if(event.isPrimary===false||(pointer?.down&&pointer.id!==event.pointerId))return;
    if(event.type==='pointerenter'&&event.pointerType!=='mouse')return;
    stop();pointer={x:event.clientX,angle,id:event.pointerId,down:event.type==='pointerdown'};
    if(event.type==='pointerdown'&&!event.target.closest('button'))stage.setPointerCapture(event.pointerId);
  }
  function move(event){if(pointer&&event.isPrimary!==false&&(pointer.id===undefined||event.pointerId===pointer.id))draw(pointer.angle+(event.clientX-pointer.x)*.3);}
  function end(event){if(event.isPrimary===false||(pointer?.id!==undefined&&event.pointerId!==pointer.id))return;if(event.type==='pointerup'&&event.pointerType==='mouse'){if(pointer)pointer.down=false;}else pointer=null;}
  function key(event){
    if(event.target!==stage)return;
    if(!['ArrowLeft','ArrowRight','Home'].includes(event.key))return;
    event.preventDefault();stop();pointer=null;
    draw(event.key==='Home'?0:angle+(event.key==='ArrowRight'?10:-10));
  }
  function preferenceChanged(){cancelAnimationFrame(frame);if(preference.matches)draw(0);else if(visible&&!manual)frame=requestAnimationFrame(animate);}
  const events={pointerenter:begin,pointerdown:begin,pointermove:move,pointerup:end,pointerleave:end,pointercancel:end,lostpointercapture:end,keydown:key};
  for(const [name,handler] of Object.entries(events))stage.addEventListener(name,handler);
  const observer=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;cancelAnimationFrame(frame);if(visible&&!manual&&!preference.matches)frame=requestAnimationFrame(animate);});
  observer.observe(stage);preference.addEventListener('change',preferenceChanged);
  return {stop,destroy(){stop();observer.disconnect();preference.removeEventListener('change',preferenceChanged);for(const [name,handler] of Object.entries(events))stage.removeEventListener(name,handler);}};
}
