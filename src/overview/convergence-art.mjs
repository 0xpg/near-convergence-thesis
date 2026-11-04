export function convergenceArt(){
  const layers=Array.from({length:6},()=>[]);
  for(let ring=0;ring<2;ring++)for(let i=0;i<240;i++)for(let j=0;j<52;j++){
    const u=(i+(j%2)*.5)/240*Math.PI*2,v=j/52*Math.PI*2;
    const twist=v+u*2,radius=185+55*Math.cos(twist);
    const x=Math.cos(u)*radius,y=Math.sin(u)*radius*.43,z=55*Math.sin(twist);
    const tilt=ring===0?-.4:.4;
    const px=400+(ring===0?-100:100)+x*Math.cos(tilt)-y*Math.sin(tilt);
    const py=170+x*Math.sin(tilt)+y*Math.cos(tilt)+z*.65;
    const light=(Math.sin(twist)*.45+Math.cos(u)*.3+.75)/1.5;
    const noise=Math.sin(i*127.1+j*311.7+ring*71.3)*43758.5453;
    if(noise-Math.floor(noise)>light*.72+.18)continue;
    const shade=Math.min(2,Math.floor(light*3)),size=shade===2?2:1.3;
    layers[ring*3+shade].push(`M${px.toFixed(1)} ${py.toFixed(1)}h${size}v${size}h-${size}z`);
  }
  return layers.map(points=>points.join(''));
}
