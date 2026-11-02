export function walkingPose(frame) {
  const phase=(frame%16)/16*Math.PI*2;
  return {swing:Math.sin(phase),lift:Math.cos(phase)};
}

export function fieldAt(seconds) {
  if(!Number.isFinite(seconds)||seconds<0)throw new RangeError('Time must be finite and nonnegative');
  const nodes=Array.from({length:72},(_,i)=>{
    const seed=(i*0.61803398875)%1, depth=((i*0.41421356237+0.07)%1);
    return {x:0.04+seed*0.92+Math.sin(seconds*0.13+i*1.7)*0.014,y:0.16+depth*0.64+Math.cos(seconds*0.11+i)*0.008,z:depth,variant:i%6};
  });
  const bases=[[.25,.43],[.49,.34],[.74,.54]];
  const focus=bases.map(([x,y],i)=>({x:x+Math.sin(seconds*.12+i*2)*.045,y:y+Math.cos(seconds*.15+i)*.035,z:.5,variant:i+1}));
  return {nodes,focus,attention:Math.floor(seconds/5)%3};
}

if(typeof document!=='undefined') {
  const canvas=document.getElementById('activity-field'), stage=document.getElementById('field-stage');
  const ctx=canvas?.getContext('2d');
  if(ctx&&stage) {
    const preference=matchMedia('(prefers-reduced-motion: reduce)');
    const labels=[...stage.querySelectorAll('[data-focus]')];
    const colors=['#367b63','#a55561','#466d9f'];
    let width=0,height=0,time=0,last=0,request=0,playing=!preference.matches,visible=true,fieldFocused=false;
    const sprites=Array.from({length:6},(_,variant)=>Array.from({length:16},(_,pose)=>{
      const sprite=document.createElement('canvas');sprite.width=76;sprite.height=140;
      const pen=sprite.getContext('2d'),agent=variant===2||variant===5;
      const {swing,lift}=walkingPose(pose);
      const shade=variant%2?'#404644':'#555b57';
      pen.fillStyle='#27332c12';pen.beginPath();pen.ellipse(39,122,19,4,0,0,Math.PI*2);pen.fill();
      pen.translate(0,-Math.abs(swing)*1.2);
      function limb(points,color,width){pen.strokeStyle=color;pen.lineWidth=width;pen.lineCap='round';pen.lineJoin='round';pen.beginPath();pen.moveTo(...points[0]);for(const point of points.slice(1))pen.lineTo(...point);pen.stroke();}
      // Opposing arm and leg phases make a complete, repeatable walking cycle.
      limb([[35,72],[34+swing*8,94],[34+swing*15,116-Math.max(0,lift)*5]],'#69706b',7);
      limb([[43,72],[43-swing*8,94],[43-swing*15,116-Math.max(0,-lift)*5]],'#353d38',8);
      limb([[29,43],[25-swing*6,61],[27-swing*11,77]],'#69706b',5);
      limb([[47,43],[52+swing*6,61],[49+swing*11,77]],'#38423b',5);
      const coat=pen.createLinearGradient(26,0,50,0);coat.addColorStop(0,'#818781');coat.addColorStop(.45,shade);coat.addColorStop(1,'#2e3932');pen.fillStyle=coat;
      pen.beginPath();pen.moveTo(30,37);pen.quadraticCurveTo(38,33,47,38);pen.lineTo(49,71);pen.quadraticCurveTo(38,77,28,71);pen.closePath();pen.fill();
      if(agent){
        pen.fillStyle='#4b5750';pen.beginPath();pen.roundRect(29,17,20,17,4);pen.fill();
        pen.fillStyle='#b7cac0';pen.fillRect(33,23,4,3);pen.fillRect(42,23,4,3);
        limb([[39,17],[39,12]],'#58685f',2);pen.fillStyle='#668e7a';pen.beginPath();pen.arc(39,11,2,0,Math.PI*2);pen.fill();
        pen.strokeStyle='#a0b0a6';pen.lineWidth=1;pen.strokeRect(33,47,12,14);
      }else{
        pen.fillStyle='#5e655f';pen.fillRect(35,31,7,8);
        const head=pen.createLinearGradient(30,0,46,0);head.addColorStop(0,'#969a92');head.addColorStop(1,'#414941');pen.fillStyle=head;pen.beginPath();pen.ellipse(38,24,8,10,variant%2?.12:-.12,0,Math.PI*2);pen.fill();
        pen.fillStyle='#333b35';pen.beginPath();pen.ellipse(38,18,8,5,0,Math.PI,Math.PI*2);pen.fill();
      }
      return sprite;
    }));
    function draw(){
      const {nodes,focus,attention}=fieldAt(time);
      ctx.clearRect(0,0,width,height);
      const scale=width<600?.62:1;
      for(const node of [...nodes,...focus].sort((a,b)=>a.z-b.z)) {
        const size=(.26+node.z*.67)*scale;
        ctx.globalAlpha=.28+(.5-Math.abs(node.z-.5))*.9;
        ctx.filter=`blur(${Math.max(0,Math.abs(node.z-.5)-.12)*8}px)`;
        const pose=Math.floor(time*9+node.variant*2)%16;
        ctx.drawImage(sprites[node.variant][pose],node.x*width-38*size,node.y*height-70*size,76*size,140*size);
      }
      ctx.filter='none';ctx.globalAlpha=1;
      for(let i=0;i<3;i++) {
        const a=focus[i],b=focus[(i+1)%3];
        ctx.strokeStyle=colors[i]+(attention===i?'60':'24');ctx.lineWidth=.7;
        ctx.beginPath();ctx.moveTo(a.x*width,a.y*height);ctx.lineTo(b.x*width,b.y*height);ctx.stroke();
        ctx.strokeStyle=colors[i];ctx.lineWidth=attention===i?1.2:.6;ctx.strokeRect(a.x*width-10,a.y*height-24,20,44);
        labels[i].style.transform=`translate(${a.x*width-10}px,${a.y*height-43}px)`;
        labels[i].style.opacity='1';
      }
    }
    function tick(stamp){
      request=0;
      if(!playing||!visible||document.hidden||fieldFocused)return;
      if(!last)last=stamp;
      if(stamp-last>=50){time+=Math.min((stamp-last)/1000,.1);last=stamp;draw();}
      request=requestAnimationFrame(tick);
    }
    function sync(){cancelAnimationFrame(request);request=0;last=0;if(playing&&visible&&!document.hidden&&!fieldFocused)request=requestAnimationFrame(tick);}
    stage.addEventListener('focusin',()=>{fieldFocused=true;sync();});
    stage.addEventListener('focusout',event=>{if(!stage.contains(event.relatedTarget)){fieldFocused=false;sync();}});
    preference.addEventListener('change',()=>{playing=!preference.matches;sync();draw();});
    document.addEventListener('visibilitychange',sync);
    new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;sync();}).observe(stage);
    new ResizeObserver(()=>{const nextWidth=stage.clientWidth,nextHeight=Math.min(400,Math.max(260,stage.clientWidth*.3));if(nextWidth===width&&nextHeight===height)return;width=nextWidth;height=nextHeight;stage.style.height=height+'px';const dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);draw();stage.classList.add('is-ready');}).observe(stage);
    sync();
  }
}
