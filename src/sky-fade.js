import * as T from 'three';
import {FullScreenQuad} from 'three/addons/postprocessing/Pass.js';

// Keep one already-composited frame on the GPU. The new world continues to
// animate under it, including when another selection interrupts the dissolve.
export function skyFade(renderer){
  const size=new T.Vector2();
  const uniforms={previous:{value:null},opacity:{value:0}};
  const quad=new FullScreenQuad(new T.ShaderMaterial({
    uniforms,transparent:true,depthTest:false,depthWrite:false,toneMapped:false,
    vertexShader:'varying vec2 coord; void main(){coord=uv;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader:'varying vec2 coord; uniform sampler2D previous; uniform float opacity; void main(){gl_FragColor=vec4(texture2D(previous,coord).rgb,opacity);}'
  }));
  let started=null;
  return {
    capture(){
      renderer.getDrawingBufferSize(size);
      let texture=uniforms.previous.value;
      if(!texture||texture.image.width!==size.x||texture.image.height!==size.y){
        texture?.dispose();
        uniforms.previous.value=texture=new T.FramebufferTexture(size.x,size.y);
      }
      renderer.copyFramebufferToTexture(texture);
      started=performance.now();
    },
    render(){
      if(started===null)return;
      const fraction=(performance.now()-started)/320;
      if(fraction>=1){started=null;return;}
      uniforms.opacity.value=1-T.MathUtils.smoothstep(fraction,0,1);
      const clear=renderer.autoClear;renderer.autoClear=false;
      try{quad.render(renderer);}finally{renderer.autoClear=clear;}
    },
    cancel(){started=null;}
  };
}
