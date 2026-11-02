import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
const root=new URL('../',import.meta.url);
const width=90,height=51,ramp=' .,:;+=ox%#@';
const depth=new Float64Array(width*height).fill(-Infinity);
const pixels=new Array(width*height).fill(' ');
// Orthographic character study: folded toroidal surface, independent of research data.
for(let u=0;u<Math.PI*2;u+=0.018) for(let v=0;v<Math.PI*2;v+=0.022) {
  const radius=1.6+0.55*Math.cos(v);
  const x=radius*Math.cos(u),y=radius*Math.sin(u),z=0.55*Math.sin(v)+0.55*Math.sin(u*2);
  const a=0.78,b=-0.5;
  const yy=y*Math.cos(a)-z*Math.sin(a),zz=y*Math.sin(a)+z*Math.cos(a);
  const xx=x*Math.cos(b)+zz*Math.sin(b),d=-x*Math.sin(b)+zz*Math.cos(b);
  const col=Math.round(width/2+xx*18),row=Math.round(height/2+yy*10);
  if(col<0||col>=width||row<0||row>=height)continue;
  const i=row*width+col;
  if(d<=depth[i])continue;
  depth[i]=d;
  const light=Math.max(0,Math.min(1,0.5+0.32*Math.sin(v-u)+0.16*Math.cos(u*3)));
  pixels[i]=ramp[1+Math.floor(light*(ramp.length-2))];
}
const rows=Array.from({length:height},(_,y)=>pixels.slice(y*width,(y+1)*width).join(''));
assert(rows.every(row=>row.length===width));
assert(rows.join('').replace(/ /g,'').length>650);
assert(rows.join('').split('#').length>2);
const html=readFileSync(new URL('index.html',root),'utf8');
assert(html.includes('<!-- ascii:start -->')&&html.includes('<!-- ascii:end -->'));
writeFileSync(new URL('index.html',root),html.replace(/<!-- ascii:start -->[\s\S]*?<!-- ascii:end -->/,'<!-- ascii:start -->\n'+rows.map(row=>row.trimEnd()).join('\n')+'\n<!-- ascii:end -->'));
console.log('Generated deterministic 90 × 51 ASCII surface; bounds, density and glyph checks passed.');
