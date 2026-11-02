export function walkingPose(frame) { const phase=(frame%16)/16*Math.PI*2; return {swing:Math.sin(phase),lift:Math.cos(phase)}; }

export function labelAnchor(x,width) { return Math.max(6,Math.min(width-106,x*width-10)); }

export function motionTime(seconds) {
  if(!Number.isFinite(seconds)||seconds<0)throw new RangeError('Time must be finite and nonnegative');
  return Math.floor(seconds/7)*4.8+Math.min(seconds%7,4.8);
}
export function selectPeople(nodes,random=Math.random,previous=[]) {
  return [[.12,.34],[.38,.62],[.66,.86]].map(([left,right],group)=>{
    const candidates=nodes.map((node,index)=>({node,index})).filter(({node,index})=>index!==previous[group]&&node.x>=left&&node.x<=right&&node.z>.25&&node.z<.72);
    return candidates[Math.min(candidates.length-1,Math.floor(random()*candidates.length))].index;
  });
}
export function fieldAt(seconds,selected=[12,33,54]) {
  motionTime(seconds);
  const motion=seconds;
  const nodes=Array.from({length:72},(_,i)=>{
    const seed=(i*.61803398875)%1,depth=(i*.41421356237+.07)%1;
    const individuality=(i*.754877666)%1,cadence=4.5+individuality*3;
    return {x:.04+seed*.92+Math.sin(motion*(.045+individuality*.035)+i*1.7)*(.009+individuality*.008),y:.16+depth*.64+Math.cos(motion*(.04+seed*.035)+i)*.006,z:depth,variant:i%6,gait:(motion*cadence+i*2.718281828)%16,cadence,direction:seed<.5?-1:1,profile:.72+individuality*.30};
  });
  return {nodes,focus:selected.map(index=>nodes[index]),attention:Math.floor(seconds/5)%3};
}

if(typeof document!=='undefined') {
  const canvas=document.getElementById('activity-field'),stage=document.getElementById('field-stage');
  if(canvas&&stage&&window.p5) new window.p5(p=>{
    const preference=matchMedia('(prefers-reduced-motion: reduce)');
    const labels=[...stage.querySelectorAll('[data-focus]')],colors=['#367b63','#a55561','#466d9f'];
    let time=0,visible=true,ready=false,selected=selectPeople(fieldAt(0).nodes),nextSwitch=[4,5.3,6.6];
    const meshes=[];
    const resting=fieldAt(0).nodes;
    const edges=resting.flatMap((a,i)=>resting.map((b,j)=>({j,d:Math.hypot(a.x-b.x,a.y-b.y)})).filter(b=>b.j>i&&b.d<.2).sort((a,b)=>a.d-b.d).slice(0,3).map(b=>[i,b.j]));
    function limb(a,b,r){
      const dx=b[0]-a[0],dy=b[1]-a[1];
      p.push();p.translate((a[0]+b[0])/2,(a[1]+b[1])/2,0);p.rotateZ(-Math.atan2(dx,dy));p.cylinder(r,Math.hypot(dx,dy),6,1);p.pop();
    }
    function oval(x,y,z,rx,ry,rz){p.push();p.translate(x,y,z);p.ellipsoid(rx,ry,rz,8,6);p.pop();}
    function person(frame){
      const {swing,lift}=walkingPose(frame),s=swing*14;
      const feet=[[ -5+s,49-Math.max(0,lift)*7],[5-s,49-Math.max(0,-lift)*7]];
      limb([-5,0],[-5+s*.45,25],3.4);limb([-5+s*.45,25],feet[0],2.8);
      limb([5,0],[5-s*.45,25],3.4);limb([5-s*.45,25],feet[1],2.8);
      limb([-9,-30],[-12-s*.4,-12],2.3);limb([-12-s*.4,-12],[-12-s*.7,5],2);
      limb([9,-30],[12+s*.4,-12],2.3);limb([12+s*.4,-12],[12+s*.7,5],2);
      oval(-12-s*.7,5,0,2.3,3,2.3);oval(12+s*.7,5,0,2.3,3,2.3);
      for(const [x,y]of feet)oval(x+2,y,1,5,2.4,3);
      oval(0,-17,0,10,20,6);limb([0,-32],[0,-40],3);oval(0,-48,0,6,8,6);
    }
    function canMove(){return !preference.matches&&visible&&!document.hidden&&!stage.querySelector(':focus-visible');}
    function sync(){if(!ready)return;if(canMove())p.loop();else {p.noLoop();p.redraw();}}
    p.setup=()=>{
      try {
        p.createCanvas(stage.clientWidth,Math.min(400,Math.max(260,stage.clientWidth*.3)),p.WEBGL,canvas);
        p.setAttributes({antialias:true,alpha:true});
        p.pixelDensity(Math.min(devicePixelRatio||1,1.5));p.frameRate(30);p.noStroke();p.fill(90,104,94);
        for(let i=0;i<32;i++)meshes.push(p.buildGeometry(()=>person(i/2)));
        ready=true;stage.dataset.renderer='p5-webgl';sync();
      } catch(error){stage.dataset.renderer='unavailable';console.error('The crowd renderer could not start.',error);p.noLoop();}
    };
    p.draw=()=>{
      if(!ready)return;
      if(canMove())time+=Math.min(p.deltaTime/1000,.1);
      const initial=fieldAt(time);
      if(canMove())for(let i=0;i<3;i++)if(time>=nextSwitch[i]){
        selected[i]=selectPeople(initial.nodes,Math.random,selected)[i];nextSwitch[i]=time+5+Math.random()*3;
        labels[i].querySelector('span').animate([{transform:'translateX(-2px)',opacity:.45,textShadow:'2px 0 #a55561,-2px 0 #466d9f'},{transform:'translateX(2px)',opacity:1},{transform:'translateX(0)',textShadow:'none'}],{duration:260,easing:'steps(3,end)'});
      }
      const {nodes,focus}=fieldAt(time,selected),w=p.width,h=p.height;
      p.clear();p.ortho(-w/2,w/2,-h/2,h/2,0,2000);p.ambientLight(115);p.directionalLight(160,165,155,-.5,.2,-1);
      const compact=w<600?.62:1;
      for(const n of nodes){
        const size=(.26+n.z*.67)*compact,fade=Math.min(1,Math.abs(n.z-.5)*1.8+.15);
        p.push();p.translate(n.x*w-w/2,n.y*h-h/2,(n.z-.5)*100);p.scale(n.direction*n.profile*size,size,size);
        p.rotateY((n.variant-2.5)*.13);p.noStroke();p.ambientMaterial(p.lerpColor(p.color('#46544a'),p.color('#f5f5f2'),fade));p.model(meshes[Math.floor(n.gait*2)%32]);p.pop();
      }
      const beat=time%7,strength=beat<4.4?Math.min(1,beat/.4):Math.max(0,1-(beat-4.4)/.4);
      p.push();p.translate(-w/2,-h/2,100);p.noFill();p.strokeWeight(.5);p.stroke(86,107,93,30*strength);
      for(const [a,b]of edges)p.line(nodes[a].x*w,nodes[a].y*h,nodes[b].x*w,nodes[b].y*h);
      for(let i=0;i<3;i++){
        const a=focus[i],b=focus[(i+1)%3],color=p.color(colors[i]);color.setAlpha(85*strength);p.stroke(color);p.line(a.x*w,a.y*h,b.x*w,b.y*h);
        p.stroke(colors[i]);p.rect(a.x*w-10,a.y*h-24,20,44);
        labels[i].style.transform=`translate(${labelAnchor(a.x,w)}px,${a.y*h-43}px)`;labels[i].style.opacity='1';labels[i].dataset.person=String(selected[i]);
      }
      p.pop();stage.classList.add('is-ready');stage.dataset.animationTime=time.toFixed(2);
    };
    new ResizeObserver(()=>{if(ready){p.resizeCanvas(stage.clientWidth,Math.min(400,Math.max(260,stage.clientWidth*.3)));sync();}}).observe(stage);
    new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;sync();}).observe(stage);
    preference.addEventListener('change',sync);document.addEventListener('visibilitychange',sync);
    stage.addEventListener('focusin',sync);stage.addEventListener('focusout',()=>requestAnimationFrame(sync));
    canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();p.noLoop();stage.classList.remove('is-ready');stage.dataset.renderer='context-lost';});
    canvas.addEventListener('webglcontextrestored',()=>location.reload());
  },stage);
}
