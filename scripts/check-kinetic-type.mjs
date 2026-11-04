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
