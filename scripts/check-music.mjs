import assert from 'node:assert/strict';
import {pianoScore,renderPiano} from './compose.mjs';
const score=pianoScore();assert.equal(score.duration,60);assert(score.notes.length>100);
for(const note of score.notes){assert(note.time>=0&&note.time<score.duration);assert(note.midi>=29&&note.midi<=79);assert(note.level>0&&note.level<=.1);assert(Math.abs(note.pan)<=1);}
const wave=renderPiano({duration:1,notes:[{time:0,midi:69,level:.1,pan:0}]},8000);
assert.equal(wave.toString('ascii',0,4),'RIFF');assert.equal(wave.length,32044);
let peak=0,energy=0;for(let i=44;i<wave.length;i+=2){const sample=wave.readInt16LE(i);peak=Math.max(peak,Math.abs(sample));energy+=sample*sample;}
assert(peak>10000&&peak<25000);assert(energy>0);
const loop=renderPiano(score);
assert(Math.abs(loop.readInt16LE(44)-loop.readInt16LE(loop.length-4))<1000,'Composition loop boundary must not jump sharply');
console.log('Original score timing, note bounds, stereo PCM and headroom checks passed.');

const {readFileSync}=await import('node:fs');
const {runInNewContext}=await import('node:vm');
const listeners=new Map(),mediaListeners=new Map();
let attempts=0;
const player={paused:true,volume:1,dataset:{},addEventListener:(name,handler)=>mediaListeners.set(name,handler),play(){attempts++;if(attempts===1)return Promise.reject({name:'NotAllowedError'});this.paused=false;return Promise.resolve();}};
const document={getElementById:()=>player,addEventListener:(name,handler)=>listeners.set(name,handler),removeEventListener:name=>listeners.delete(name)};
runInNewContext(readFileSync('ambient.mjs','utf8'),{document});
await new Promise(resolve=>setImmediate(resolve));
assert.equal(player.dataset.state,'waiting-for-interaction');assert.equal(player.volume,.3);
await listeners.get('pointerup')();assert.equal(player.dataset.state,'playing');assert.equal(attempts,2);assert.equal(listeners.size,0);
mediaListeners.get('error')();assert.equal(player.dataset.state,'unavailable');
console.log('Autoplay rejection, first-gesture retry, quiet volume and playback error handling passed.');
