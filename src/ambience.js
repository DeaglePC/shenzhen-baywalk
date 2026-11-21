export function createAmbience(){
  let ctx,master,noise,interval,enabled=false;
  function init(){
    ctx=new AudioContext();master=ctx.createGain();master.gain.value=0;master.connect(ctx.destination);
    const buffer=ctx.createBuffer(1,ctx.sampleRate*5,ctx.sampleRate);const data=buffer.getChannelData(0);
    let prev=0;for(let i=0;i<data.length;i++){prev=.977*prev+.12*(Math.random()*2-1);data[i]=prev;}
    noise=ctx.createBufferSource();noise.buffer=buffer;noise.loop=true;
    const low=ctx.createBiquadFilter();low.type='lowpass';low.frequency.value=1250;noise.connect(low).connect(master);noise.start();
    interval=setInterval(()=>{if(!enabled||document.hidden)return;
      const now=ctx.currentTime;for(let i=0;i<2;i++){
        const osc=ctx.createOscillator(),amp=ctx.createGain(),time=now+i*.16;
        osc.frequency.setValueAtTime(1850+Math.random()*450,time);osc.frequency.exponentialRampToValueAtTime(3100+Math.random()*600,time+.07);
        amp.gain.setValueAtTime(.0001,time);amp.gain.exponentialRampToValueAtTime(.052,time+.025);amp.gain.exponentialRampToValueAtTime(.0001,time+.13);
        osc.connect(amp).connect(master);osc.start(time);osc.stop(time+.14);osc.onended=()=>{osc.disconnect();amp.disconnect();};
      }
    },5100);
  }
  return {get enabled(){return enabled;},async toggle(){if(!ctx)init();if(ctx.state==='suspended')await ctx.resume();enabled=!enabled;master.gain.setTargetAtTime(enabled?.32:0,ctx.currentTime,.15);return enabled;},step(fast){
    if(!enabled||!ctx)return;
    const src=ctx.createBufferSource();src.buffer=noise.buffer;const gain=ctx.createGain(),filter=ctx.createBiquadFilter();
    filter.type='lowpass';filter.frequency.value=fast?760:540;gain.gain.setValueAtTime(fast?.85:.55,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.13);
    src.connect(filter).connect(gain).connect(master);src.start(0,Math.random()*4);src.stop(ctx.currentTime+.14);src.onended=()=>{src.disconnect();filter.disconnect();gain.disconnect();};
  }};
}
