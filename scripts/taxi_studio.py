"""Add an editable studio and reference cameras to the native Pengcheng taxi file.

    blender -b models/深圳鹏程出租车.blend -P scripts/taxi_studio.py -- [preview.png]

The studio is a separate collection. The game GLB is exported from the vehicle
before this step. No pixels from the reference photograph enter the render.
"""
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[1]
scene=bpy.context.scene
scene.unit_settings.system='METRIC'
scene.unit_settings.length_unit='METERS'
studio_name="摄影棚 · 灯光、地面与核形相机"
existing=bpy.data.collections.get(studio_name)
if existing:
    for obj in list(existing.objects):
        bpy.data.objects.remove(obj,do_unlink=True)
    bpy.data.collections.remove(existing)
studio=bpy.data.collections.new(studio_name)
scene.collection.children.link(studio)

def obj(name,data):
    o=bpy.data.objects.new(name,data)
    studio.objects.link(o)
    return o

def blender(v):return Vector((v[0],-v[2],v[1]))
def aim(o,p):o.rotation_euler=(Vector(p)-o.location).to_track_quat('-Z','Y').to_euler()
def camera(name,coordinates,target,fov=35):
    c=bpy.data.cameras.new(name)
    c.sensor_fit='VERTICAL';c.sensor_height=24;c.lens=12/math.tan(math.radians(fov*.5))
    o=obj(name,c);o.location=coordinates;aim(o,target)
    return o

photo=camera("照片机位 · 左前",blender([-2.578866,1.046449,3.599124]),(0,0,1),43.6445)
forward=blender([.655855,-.034160,-.754114]).normalized()
up=blender([.034842,.999281,-.014964]).normalized()
from mathutils import Matrix
photo.rotation_euler=Matrix((forward.cross(up).normalized(),up,-forward)).transposed().to_euler()
side=camera("核形 · 正侧",(-7.6,0,.90),(0,0,.90))
side.data.type='ORTHO';side.data.ortho_scale=4.25
rear=camera("核形 · 左后",(-4.9,5.5,2.05),(0,.12,.82))
scene.camera=photo

def panel(name,location,target,energy,width,height,color):
    light=bpy.data.lights.new(name,'AREA')
    light.shape='RECTANGLE';light.size=width;light.size_y=height
    light.energy=energy;light.color=color
    o=obj(name,light);o.location=location;aim(o,target)

panel("左侧长条柔光箱",(-3.7,-.7,3.1),(0,0,.9),270,5.4,1.0,(.90,.95,1))
panel("车尾轮廓光",(1.35,4,2.65),(0,0,1),200,3,1.35,(1,.94,.83))
panel("前脸补光",(1.75,-4.1,3.5),(0,-.5,.8),235,3,2.6,(1,.98,.94))
floor_mesh=bpy.data.meshes.new("无缝地台")
floor_mesh.from_pydata([(-150,-150,-.002),(150,-150,-.002),(150,150,-.002),(-150,150,-.002)],[],[(0,1,2,3)])
floor=obj("地台 · 哑光灰",floor_mesh)
mat=bpy.data.materials.new("摄影棚地面");mat.use_nodes=True
bs=mat.node_tree.nodes.get('Principled BSDF')
bs.inputs['Base Color'].default_value=(.155,.173,.184,1);bs.inputs['Roughness'].default_value=.53
floor.data.materials.append(mat)
world=bpy.data.worlds.new("日光环境 · 可旋转");world.use_nodes=True
scene.world=world;nt=world.node_tree
env=nt.nodes.new('ShaderNodeTexEnvironment')
env.image=bpy.data.images.load(str(ROOT/'public/media/courtyard.hdr'),check_existing=True);env.image.pack()
nt.links.new(env.outputs['Color'],nt.nodes.get('Background').inputs['Color'])
nt.nodes.get('Background').inputs['Strength'].default_value=.84
camera_bg=nt.nodes.new('ShaderNodeBackground');camera_bg.inputs['Color'].default_value=(.32,.35,.37,1)
paths=nt.nodes.new('ShaderNodeLightPath');mix=nt.nodes.new('ShaderNodeMixShader')
nt.links.new(paths.outputs['Is Camera Ray'],mix.inputs[0])
nt.links.new(nt.nodes.get('Background').outputs[0],mix.inputs[1])
nt.links.new(camera_bg.outputs[0],mix.inputs[2]);nt.links.new(mix.outputs[0],nt.nodes.get('World Output').inputs['Surface'])
scene.render.engine='CYCLES';scene.cycles.samples=48;scene.cycles.use_denoising=True
scene.render.resolution_x=1600;scene.render.resolution_y=1200;scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX'
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D':
            space=area.spaces.active;space.region_3d.view_perspective='CAMERA'
            space.shading.type='MATERIAL';space.overlay.show_overlays=False
scene['model_target']='深圳巴士集团 / 鹏程 AT-099 / 比亚迪第二代 e6'
scene['reference_view']='1600 × 1200；依据参考照片的两个轮毂和前车牌估算透视。'
scene['dimensions_source']='https://sg.byd.com/wp-content/uploads/2021/11/BYD-e6-Spec-Sheet-Sime-Darby-2th-Nov-2021.pdf'
bpy.context.preferences.filepaths.save_version=0
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=bpy.data.filepath,compress=True)
args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
if args:
    prefs=bpy.context.preferences.addons['cycles'].preferences
    for backend in ('OPTIX','CUDA'):
        try:
            prefs.compute_device_type=backend;prefs.get_devices()
            gpu=[d for d in prefs.devices if d.type==backend]
            if gpu:
                for d in prefs.devices:d.use=d in gpu
                scene.cycles.device='GPU'
                break
        except RuntimeError:
            continue
    scene.render.filepath=str(Path(args[0]).resolve())
    bpy.ops.render.render(write_still=True)
