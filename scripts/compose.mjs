import {mkdirSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

export function pianoScore(){
  const beat=60/64,bar=beat*4,notes=[];
  const chords=[[50,57,60,64],[46,53,57,62],[48,55,60,64],[43,50,57,60],[50,57,60,65],[46,53,60,65],[41,48,57,60],[45,52,57,62]];
  const melody=[[74,null,69,72],[null,77,76,null],[74,null,67,null],[69,null,72,74],[77,null,76,72],[74,69,null,65],[67,null,72,null],[69,64,null,null],[74,null,77,76],[null,74,72,null],[76,null,79,null],[77,74,null,72],[69,null,72,74],[77,null,76,null],[72,null,69,null],[64,null,null,null]];
  for(let i=0;i<16;i++){
    const chord=chords[i%8],start=i*bar;
    notes.push({time:start,midi:chord[0]-12,level:.09,pan:-.18});
    for(let j=0;j<4;j++)notes.push({time:start+j*beat+.025,midi:chord[[1,2,3,2][j]],level:.052+j%2*.008,pan:(j-1.5)*.12});
    for(let j=0;j<4;j++)if(melody[i][j]!==null)notes.push({time:start+j*beat+.08,midi:melody[i][j],level:.10,pan:.12});
  }
  return {duration:16*bar,notes};
}

export function renderPiano(score,sampleRate=22050){
  const length=Math.round(score.duration*sampleRate),left=new Float64Array(length),right=new Float64Array(length);
  for(const note of score.notes){
    const frequency=440*2**((note.midi-69)/12),start=Math.round(note.time*sampleRate),duration=5.5;
    for(let i=0;i<duration*sampleRate;i++){
      const t=i/sampleRate,attack=1-Math.exp(-t/0.008);
      let sound=0;
      for(let partial=1;partial<=6;partial++){
        const weight=[1,.42,.16,.075,.035,.016][partial-1];
        sound+=weight*Math.sin(2*Math.PI*frequency*partial*Math.sqrt(1+.00015*partial*partial)*t)*Math.exp(-t/(2.7/Math.sqrt(partial)));
      }
      sound+=.16*Math.sin(2*Math.PI*frequency*1.0008*t)*Math.exp(-t/2.4);
      const value=sound*attack*Math.min(1,(duration-t)/.5)*note.level,index=(start+i)%length;
      left[index]+=value*Math.sqrt((1-note.pan)/2);right[index]+=value*Math.sqrt((1+note.pan)/2);
    }
  }
  const dryLeft=left.slice(),dryRight=right.slice();
  for(const [delay,gain]of [[.17,.16],[.29,.12],[.43,.085],[.61,.055]]){
    const offset=Math.round(delay*sampleRate);
    for(let i=0;i<length;i++){const target=(i+offset)%length;left[target]+=dryRight[i]*gain;right[target]+=dryLeft[i]*gain;}
  }
  let peak=0;for(let i=0;i<length;i++)peak=Math.max(peak,Math.abs(left[i]),Math.abs(right[i]));
  const buffer=Buffer.alloc(44+length*4);
  buffer.write('RIFF');buffer.writeUInt32LE(buffer.length-8,4);buffer.write('WAVEfmt ',8);buffer.writeUInt32LE(16,16);buffer.writeUInt16LE(1,20);buffer.writeUInt16LE(2,22);buffer.writeUInt32LE(sampleRate,24);buffer.writeUInt32LE(sampleRate*4,28);buffer.writeUInt16LE(4,32);buffer.writeUInt16LE(16,34);buffer.write('data',36);buffer.writeUInt32LE(length*4,40);
  const gain=.32/Math.max(peak,1e-9);
  for(let i=0;i<length;i++){buffer.writeInt16LE(Math.round(left[i]*gain*32767),44+i*4);buffer.writeInt16LE(Math.round(right[i]*gain*32767),46+i*4);}
  return buffer;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  mkdirSync('.audio-build',{recursive:true});writeFileSync('.audio-build/quiet-infrastructure.wav',renderPiano(pianoScore()));
  console.log('Rendered original 60-second piano loop at 64 BPM.');
}
