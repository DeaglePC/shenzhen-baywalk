import * as T from 'three';

// Sample the completed colour and depth buffers. Water retains its own planar reflection pass.
export function createFilm(renderer,camera){
  if(!renderer.extensions.has('EXT_color_buffer_float'))return {render:(scene,view)=>renderer.render(scene,view)};
  const target=new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType,depthBuffer:true,samples:Math.min(4,renderer.capabilities.maxSamples)});
  target.depthTexture=new T.DepthTexture(1,1,T.UnsignedIntType);
  const size=new T.Vector2(),view=new T.OrthographicCamera(-1,1,1,-1,0,1);
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute([-1,-1,0,3,-1,0,-1,3,0],3));
  const mat=new T.ShaderMaterial({depthTest:false,depthWrite:false,uniforms:{
    colorBuffer:{value:target.texture},depthBuffer:{value:target.depthTexture},size:{value:size},logFar:{value:Math.log2(camera.far+1)}
  },vertexShader:`varying vec2 coord;void main(){coord=position.xy*.5+.5;gl_Position=vec4(position,1.);}`,
  fragmentShader:`
    uniform sampler2D colorBuffer,depthBuffer;
    uniform vec2 size;uniform float logFar;varying vec2 coord;
    float distanceAt(vec2 p){return exp2(texture2D(depthBuffer,p).r*logFar)-1.;}
    void main(){
      vec3 rgb=texture2D(colorBuffer,coord).rgb;
      float z=distanceAt(coord),contact=0.;
      vec3 bloom=vec3(0.);
      float radius=clamp(size.y*.46/max(z,.5),2.,16.);
      for(int i=0;i<8;i++){
        float a=(float(i)+.375)*.78539816;
        vec2 axis=vec2(cos(a),sin(a));
        float delta=z-distanceAt(coord+axis*radius/size);
        contact+=smoothstep(.065,.24,delta)*(1.-smoothstep(.5,1.8,delta));
        vec3 c=texture2D(colorBuffer,coord+axis*vec2(6.)/size).rgb;
        bloom+=c*smoothstep(1.65,6.,dot(c,vec3(.2126,.7152,.0722)));
      }
      rgb*=1.-.23*(contact*.125)*(1.-smoothstep(70.,210.,z));
      rgb+=bloom*.004;
      float lens=1.-.095*smoothstep(.30,.79,distance(coord,vec2(.5)));
      gl_FragColor=vec4(rgb*lens,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`});
  const screen=new T.Scene();screen.add(new T.Mesh(geometry,mat));
  return {render(scene,camera){
    renderer.getDrawingBufferSize(size);if(target.width!==size.x||target.height!==size.y)target.setSize(size.x,size.y);
    renderer.setRenderTarget(target);renderer.render(scene,camera);renderer.setRenderTarget(null);renderer.render(screen,view);
  }};
}
