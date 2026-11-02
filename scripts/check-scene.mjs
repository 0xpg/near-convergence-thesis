import assert from 'node:assert/strict';
import {fieldAt,motionTime,selectPeople,labelAnchor,walkingPose,ditherAt,drift,depthBlur,bodyShape,focusBox} from '../cinematic.mjs';
for(const second of [0,.033,5,10,15,20,25,30,4800]) {
  const scene=fieldAt(second);
  assert.equal(scene.nodes.length,48);assert.equal(scene.focus.length,3);
  assert(scene.attention>=0&&scene.attention<3);
  for(const node of [...scene.nodes,...scene.focus]) {
    assert(Number.isFinite(node.x)&&node.x>0&&node.x<1);
    assert(Number.isFinite(node.y)&&node.y>0&&node.y<1);
    assert(node.variant>=0&&node.variant<48);
  }
}
const regions=new Set(fieldAt(0).nodes.map(node=>Math.floor(node.x*3)+','+Math.floor(node.y*3)));
assert(regions.size>=8,'The illustrative field must spread across the scene, not collapse to a diagonal');
assert.deepEqual(fieldAt(0),fieldAt(0));
assert.notDeepEqual(fieldAt(0).focus,fieldAt(5).focus);
assert.throws(()=>fieldAt(NaN));assert.throws(()=>fieldAt(-1));
console.log('Scene geometry, repeatability, motion and invalid-time checks passed.');

assert.equal(motionTime(5),motionTime(6.5));
assert(motionTime(8)>motionTime(7));
const selection=selectPeople(fieldAt(0).nodes,()=>.5);
assert.equal(new Set(selection).size,3);
assert.deepEqual(fieldAt(0,selection).focus,selection.map(index=>fieldAt(0).nodes[index]));
assert.notDeepEqual(selectPeople(fieldAt(0).nodes,()=>0),selectPeople(fieldAt(0).nodes,()=>.99));
console.log('Still intervals, distinct selections and real-person label binding passed.');

const nextSelection=selectPeople(fieldAt(0).nodes,()=>.5,selection);
assert(nextSelection.every((person,index)=>person!==selection[index]));

for(const width of [288,320,390,1440])for(const node of fieldAt(0).nodes){const x=labelAnchor(node.x,width);assert(x>=6&&x+100<=width-6);}

assert.deepEqual(walkingPose(0),walkingPose(16));
assert(Math.abs(walkingPose(4).swing-1)<1e-12);
assert(Math.abs(walkingPose(12).swing+1)<1e-12);
assert.notDeepEqual(fieldAt(5).nodes.map(node=>node.gait),fieldAt(6.5).nodes.map(node=>node.gait));
console.log("Opposing limb phases, closed walking cycle and continuous walking passed.");

const crowd=fieldAt(0).nodes;
assert(crowd.every(node=>node.cadence>=3.2&&node.cadence<=5.12));
assert(new Set(crowd.map(node=>node.cadence)).size>30);
assert(new Set(crowd.map(node=>node.gait)).size>30);
assert.equal(new Set(crowd.map(node=>node.direction)).size,2);
assert(crowd.every(node=>node.profile>=.48&&node.profile<=1.02));
console.log('Slower individual cadences, independent phases and varied directions passed.');

const sample=frame=>Array.from({length:200},(_,i)=>ditherAt(5+i%20*3,40+Math.floor(i/20)*3,2,frame));
assert.deepEqual(sample(0),sample(0));assert.notDeepEqual(sample(0),sample(4));
assert(sample(0).some(Boolean)&&sample(0).some(value=>!value));
console.log('Repeatable dither pattern, visible dots and changing abstract form passed.');

assert.equal(new Set(crowd.map(node=>node.variant)).size,48);
assert.notDeepEqual(sample(0),Array.from({length:200},(_,i)=>ditherAt(5+i%20*3,40+Math.floor(i/20)*3,17,0)));

for(const time of [0,1,10,100,10000])assert(drift(.4,-.02,time)>=0&&drift(.4,-.02,time)<=1);
assert(crowd.every((node,i)=>Array.from({length:6},(_,step)=>{const a=fieldAt(step*.5).nodes[i],b=fieldAt((step+1)*.5).nodes[i];return Math.hypot(b.x-a.x,b.y-a.y);}).reduce((a,b)=>a+b,0)>.008));
const silhouettes=Array.from({length:48},(_,variant)=>Array.from({length:200},(_,i)=>Number(ditherAt(5+i%20*3,40+Math.floor(i/20)*3,variant,0))).join(''));
assert.equal(new Set(silhouettes).size,48);
console.log('Bounded independent travel and 48 distinct dither masks passed.');

assert.equal(depthBlur(.5),0);assert(depthBlur(0)>7&&depthBlur(1)>7);

assert.equal(new Set(crowd.map(node=>JSON.stringify(bodyShape(node.variant)))).size,1);
for(const t of [0,5,30])for(const node of fieldAt(t).nodes){const next=fieldAt(t+.05).nodes[node.variant];if(Math.abs(next.x-node.x)>.00002)assert.equal(node.direction,Math.sign(next.x-node.x));}
assert.deepEqual(bodyShape(0),bodyShape(47));assert(crowd.every(node=>node.profile===.9));
console.log('Consistent body shape and facing direction following travel passed.');

for(const node of crowd)assert(Math.abs(node.cadence-(.005+((node.variant*.754877666)%1)*.003)*640)<1e-10);

for(const width of [288,390,1440])for(const node of crowd){const box=focusBox(node,width,300);assert(box.x>=6&&box.x+100<=width-6);assert(box.y>=6&&box.boxY+box.boxHeight+20<=300);assert.equal(box.boxY-box.y,17);}
console.log('Label title, figure box and description bounds passed.');
