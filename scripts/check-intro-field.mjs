import assert from 'node:assert/strict';
import {fieldPoint,startIntroField} from '../src/overview/intro-field.mjs';
let moved=0;
for(let row=0;row<36;row++)for(let column=0;column<96;column++){
  for(const time of [0,1.2,2.4]){
    const point=fieldPoint(column,row,time);
    assert(Object.values(point).every(Number.isFinite));
    assert(point.x>=-.1&&point.x<=1.1&&point.y>=0&&point.y<=1);
    assert(point.alpha>=0&&point.alpha<=1&&point.size>0&&point.size<3);
  }
  if(fieldPoint(column,row,0).y!==fieldPoint(column,row,2.4).y)moved++;
}
assert.equal(moved,3456);
assert.deepEqual(fieldPoint(48,18,1.2),fieldPoint(48,18,1.2));
let disconnected=false,removed=false,drawn=0;
globalThis.matchMedia=()=>({matches:true,addEventListener(){},removeEventListener(){removed=true;}});
globalThis.ResizeObserver=class{observe(){}disconnect(){disconnected=true;}};
globalThis.devicePixelRatio=3;
globalThis.cancelAnimationFrame=()=>{};
globalThis.requestAnimationFrame=()=>{throw new Error('Reduced motion must stay static');};
const canvas={getContext:()=>({clearRect(){},setTransform(){},fillRect(){drawn++;}}),getBoundingClientRect:()=>({width:800,height:260})};
const stop=startIntroField(canvas);
assert.equal(canvas.width,1600);assert.equal(canvas.height,520);assert(drawn>=3456);
stop();assert(disconnected&&removed);
let callback,scheduled=0;
globalThis.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
globalThis.requestAnimationFrame=run=>{callback=run;return ++scheduled;};
const finish=startIntroField(canvas);
assert.equal(scheduled,1);
callback(performance.now()+5000);
assert.equal(scheduled,1,'The field must settle instead of scheduling frames after 4.8 seconds');
finish();
console.log('Intro field: 3,456 bounded moving points, deterministic output, 4.8s settling, static reduced motion, capped DPR and cleanup.');
