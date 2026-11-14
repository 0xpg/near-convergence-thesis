import assert from 'node:assert/strict';
import {startScenarioField} from '../src/lab/scenario-field.ts';
let pending,resize;
const listeners=new Map(),text=[],backs=[];
const pen={clearRect(){},fillRect(...args){if(args[2]>50)backs.push(args);},save(){},restore(){},setLineDash(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},arc(){},fill(){},setTransform(){},measureText(label){return {width:label.length*parseFloat(this.font.match(/([\d.]+)px/)[1])*.55};},fillText(...args){text.push(args);}};
let box={left:0,top:0,width:560,height:420};
const canvas={getContext:()=>pen,getBoundingClientRect:()=>box,addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name)};
globalThis.matchMedia=()=>({matches:true,addEventListener(){},removeEventListener(){}});
globalThis.devicePixelRatio=2;
globalThis.document={hidden:false,addEventListener(){},removeEventListener(){}};
globalThis.requestAnimationFrame=fn=>{pending=fn;return 1;};
globalThis.cancelAnimationFrame=()=>{pending=null;};
let disconnected=0;
globalThis.ResizeObserver=class{constructor(fn){resize=fn;}observe(){}disconnect(){disconnected++;}};
globalThis.IntersectionObserver=class{observe(){}disconnect(){disconnected++;}};
const stop=startScenarioField(canvas);
const paint=()=>{const fn=pending;pending=null;text.length=0;backs.length=0;fn(100);assert.equal(pending,null,'Reduced motion draws one static frame');};
for(const [width,height] of [[560,420],[460,345],[342,192]]){
 box={left:0,top:0,width,height};resize();paint();
 assert(pen.font.includes(width>=420&&height>=240?'14px':'11px'),'Roomy charts use larger labels; compact charts retain 11px');
 assert.equal(canvas.width,width*2);assert.equal(canvas.height,height*2);
 for(const [x,y] of [[0,0],[width,0],[0,height],[width,height],[width/2,height/2]]){
  listeners.get('pointermove')({clientX:x,clientY:y});paint();
  const label=text.find(([label])=>label.includes('hurdle'));
  assert(label,'Pointer feedback remains visible');
  assert(label[1]>=0&&label[1]+pen.measureText(label[0]).width<=width,'Label stays inside horizontal bounds');
  assert(label[2]>=20&&label[2]<=height-20,'Label clears both axes');
  const back=backs.at(-1);assert(back[0]>=0&&back[0]+back[2]<=width&&back[1]>=0&&back[1]+back[3]<=height,'Label background stays inside the chart');
 }
}
stop();assert.equal(listeners.size,0);assert.equal(disconnected,2);
console.log('Scenario field resizes at desktop and mobile sizes, keeps corner labels inside bounds, honors reduced motion and cleans up.');
