import assert from 'node:assert/strict';
import {wordReveal,startKineticType} from '../src/overview/kinetic-type.mjs';
assert.equal(wordReveal(0,10,0),0);
assert(wordReveal(0,10,.2)>wordReveal(8,10,.2));
for(let index=0;index<10;index++){
  assert.equal(wordReveal(index,10,1.5),1);
  assert.equal(wordReveal(index,10,3.7),0);
  for(let seconds=-1;seconds<5;seconds+=.03)assert(wordReveal(index,10,seconds)>=0&&wordReveal(index,10,seconds)<=1);
}
assert(wordReveal(0,10,3)<wordReveal(9,10,3),'The leading words must leave before trailing words');
assert.equal(wordReveal(0,1,1.5),1);
console.log('Kinetic type: staggered arrival, readable hold, leading-word exit and bounded reveal passed.');

const listeners=new Set();let disconnected=false;
globalThis.matchMedia=()=>({matches:true,addEventListener(){},removeEventListener(){}});
globalThis.innerHeight=720;globalThis.document={fonts:{ready:Promise.resolve()}};
globalThis.ResizeObserver=class{observe(){}disconnect(){disconnected=true;}};
globalThis.addEventListener=name=>listeners.add(name);globalThis.removeEventListener=name=>listeners.delete(name);
globalThis.requestAnimationFrame=()=>{throw new Error('Reduced motion must not animate');};globalThis.cancelAnimationFrame=()=>{};
const cells=Array.from({length:10},()=>({dataset:{},style:{},firstElementChild:{offsetWidth:100,style:{}}}));
const stop=startKineticType({querySelectorAll:()=>cells,getBoundingClientRect:()=>({top:100,height:220})});
await Promise.resolve();assert(cells.every(cell=>cell.style.width==='100px'));stop();assert(disconnected);assert.equal(listeners.size,0);
console.log('Kinetic type reduced motion remains fully readable and cleans up listeners.');

let scroll,raf;let widthWrites=0,top=100;
globalThis.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
globalThis.addEventListener=(name,fn)=>{if(name==='scroll')scroll=fn;};
globalThis.requestAnimationFrame=fn=>{raf=fn;return 1;};
const counted=Array.from({length:10},()=>{let width;return {dataset:{},style:{get width(){return width;},set width(value){width=value;widthWrites++;}},firstElementChild:{offsetWidth:100,style:{}}};});
const finish=startKineticType({querySelectorAll:()=>counted,getBoundingClientRect:()=>({top,height:220})});
await Promise.resolve();const initial=widthWrites;scroll();raf();assert.equal(widthWrites,initial,'Unchanged progress must not rewrite widths');
top=120;scroll();raf();assert.equal(widthWrites,initial,'Readable hold must not rewrite unchanged word widths');
top=1000;scroll();raf();const offscreen=widthWrites;top=1100;scroll();raf();assert.equal(widthWrites,offscreen,'Offscreen scroll must not keep rewriting widths');finish();
console.log('Kinetic type skips unchanged width writes during holds and offscreen scrolling.');
