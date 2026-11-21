import {defineConfig} from 'vite';

export default defineConfig({
  optimizeDeps:{
    include:['three','three/addons/controls/OrbitControls.js','three/addons/loaders/HDRLoader.js','three/addons/loaders/GLTFLoader.js','three/addons/libs/meshopt_decoder.module.js','three/addons/objects/Reflector.js','three/addons/environments/RoomEnvironment.js','three/addons/utils/SkeletonUtils.js','three/addons/utils/BufferGeometryUtils.js']
  }
});
