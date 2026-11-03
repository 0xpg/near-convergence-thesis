import assert from 'node:assert/strict';
import {createParticles,particleAt} from '../src/prototypes/absorption.mjs';
const points=createParticles();
assert.equal(points.length,1800);
assert.deepEqual(points,createParticles());
assert.throws(()=>createParticles(3));
const stream=points.find(p=>p.stream&&!p.core);
for(let mode=0;mode<3;mode++)for(let time=0;time<24;time+=.2)for(const p of createParticles(mode)){
  const at=particleAt(p,time,mode,p.sector);
  assert(Number.isFinite(at.x)&&Number.isFinite(at.y)&&at.alpha>=0&&at.alpha<=1);
  assert(Math.hypot(at.x-320,at.y-320)<300);
}
const distances=Array.from({length:80},(_,i)=>{const at=particleAt(stream,i/10,0,stream.sector);return Math.hypot(at.x-320,at.y-320);});
assert(Math.max(...distances)-Math.min(...distances)>100,'Particles must travel inward, not only fade');
assert.notDeepEqual(particleAt(stream,2,0,stream.sector),particleAt(stream,2,1,stream.sector));
assert(createParticles(1)[0].r>points[0].r,'Tidal needs a wider ring without enlarging its individual tiles');
console.log('1,800 deterministic tiles: finite bounded positions, real inward travel and distinct motion directions passed.');
