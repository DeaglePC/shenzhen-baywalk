"""Import the Sumonity FBXs, retain the authored UVs and wheels, and build traffic LODs.

Run traffic_art.py first, then blender -b -P scripts/traffic_import.py -- <asset-cache>.
"""
from pathlib import Path
import math
import sys

import bpy
import numpy as np
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from registration_mesh import material, mounted_plate

CACHE = Path(sys.argv[sys.argv.index("--")+1]).resolve()
CREDIT = "Generic passenger car pack by Comrade1280, CC BY 4.0, via TUM-VT/Sumonity-PassengerCars"
# Studio body colour (sRGB), front/rear mounting heights above road, registration.
CARS = {
    "suv": ("#566671", (.59,.75), "BK6273"),
    "multivan": ("#794e59", (.55,.62), "BH3906"),
    "sedan": ("#a54143", (.54,.80), "BM5802"),
    "hatchback": ("#508d98", (.53,.71), "BS2618"),
}


# Preserve the four public GLB addresses used by existing builds and links.
FILES = {"suv":"tang", "multivan":"mifa9", "sedan":"civic", "hatchback":"mini"}


def linear(rgb):
    return tuple(((int(rgb[i:i+2], 16)/255+.055)/1.055)**2.4 for i in (1,3,5))


def pixels(image):
    data = np.empty(image.size[0]*image.size[1]*4, np.float32)
    image.pixels.foreach_get(data)
    return data.reshape(image.size[1], image.size[0], 4)


def samples(mesh, face, image):
    uv = mesh.uv_layers.active.data
    coords = np.array([uv[i].uv[:] for i in face.loop_indices])
    center = coords.mean(axis=0)
    coords = (.6*center + .4*coords) % 1
    h, w = image.shape[:2]
    return image[(coords[:,1]*h).astype(int), (coords[:,0]*w).astype(int)].mean(axis=0)


def low_detail(obj, ratio):
    clone = obj.copy()
    clone.data = obj.data.copy()
    bpy.context.scene.collection.objects.link(clone)
    bpy.context.view_layer.objects.active = clone
    mod = clone.modifiers.new("Far silhouette", "DECIMATE")
    mod.ratio = ratio
    bpy.ops.object.modifier_apply(modifier=mod.name)
    return clone


def build(car, tint, plate_heights, number):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.wm.fbx_import(filepath=str(CACHE/(car+".fbx")))
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    body, = [o for o in meshes if "body" in o.name.lower()]
    wheels = [o for o in meshes if o != body]
    assert len(wheels) == 4
    xyz = np.array([list(o.matrix_world@v.co) for o in meshes for v in o.data.vertices])
    lo, hi = xyz.min(axis=0), xyz.max(axis=0)
    center = Vector(((lo[0]+hi[0])/2, (lo[1]+hi[1])/2, lo[2]))
    align = Matrix.Rotation(math.pi, 4, "Z") @ Matrix.Translation(-center)
    for o in meshes:
        mw = align @ o.matrix_world
        o.parent = None
        o.data = o.data.copy()
        o.data.transform(mw)
        o.matrix_world = Matrix.Identity(4)
    for o in list(bpy.context.scene.objects):
        if o not in meshes:
            bpy.data.objects.remove(o, do_unlink=True)

    def picture(name):
        return bpy.data.images.load(str(CACHE/name), check_existing=True)
    atlas = picture(car+"-body.png")
    atlas.alpha_mode = "CHANNEL_PACKED"
    gray = pixels(atlas)
    lens = picture("lights.jpg")
    lens_pixels = pixels(lens)
    body_mats = [
        material("Traffic paint atlas", (1,1,1), .44,.33, atlas),
        material("Headlamps and tail lamps", (1,1,1), .15,.22, lens),
        material("Solar control glass", (.027,.041,.05), .39,.16),
    ]
    body_mats[0]["fleet_paint"] = tint
    original_slots = [p.material_index for p in body.data.polygons]
    body.data.materials.clear()
    for mat in body_mats:
        body.data.materials.append(mat)
    for poly, slot in zip(body.data.polygons, original_slots):
        poly.material_index = slot
    body.name = car+" coachwork"
    body["design_reference"] = CREDIT

    tyre = material("Wheel alloy and sidewall", (1,1,1), .24,.46, picture(car+"-wheel.jpg"))
    pivots = []
    for o in wheels:
        pts = np.array([list(v.co) for v in o.data.vertices])
        low, high = pts.min(axis=0), pts.max(axis=0)
        pivot = Vector((high+low)/2)
        radius = (high[2]-low[2])/2
        # The SUV's small backing disc is assigned to the FBX body texture.
        # Give that inner surface the central hub colour on the rim atlas.
        for poly in o.data.polygons:
            if poly.material_index != 3:
                for idx in poly.loop_indices:
                    o.data.uv_layers.active.data[idx].uv = (.57,.52)
        o.data.materials.clear()
        o.data.materials.append(tyre)
        for poly in o.data.polygons:
            poly.material_index = 0
        o.name = "wheel_"+("L" if pivot.x < 0 else "R")+("F" if pivot.y < 0 else "R")
        o.data.transform(Matrix.Translation(-pivot))
        o.location = (pivot.x, pivot.y, radius)
        o["rolling_radius"] = radius
        pivots.append(pivot)
    bpy.context.view_layer.update()

    plate_face = material("Shenzhen blue registration", (1,1,1), .12,.34, picture(car+"-plate.png"))
    backing = material("Registration holder", (.012,.016,.018), .12,.46)
    alloy = material("Registration fasteners", (.36,.4,.39), .77,.32)
    tree = BVHTree.FromObject(body, bpy.context.evaluated_depsgraph_get())
    def surface(x, z, sign):
        hit = tree.ray_cast(Vector((x,sign*5,z)), Vector((0,-sign,0)))[0]
        if hit is None:
            raise ValueError(f"No bumper on {car} at {x}, {z}")
        return hit.y
    plates = []
    for sign, z in zip((-1,1), plate_heights):
        slope = (surface(0,z+.04,sign)-surface(0,z-.04,sign))/.08
        slope = max(-.34,min(.34,slope))
        # Match the actual stamped face, including the curvature across its width.
        extent = max(sign*(surface(x,z+dz,sign)-slope*dz)
                     for x in (-.20,0,.20) for dz in (-.065,0,.065))
        plates.append(mounted_plate("Plate "+("front" if sign < 0 else "rear"), sign,
                      sign*(extent+.003), z, slope, plate_face, backing, alloy, "粤"+number, False))

    far_paint = material("Body paint", linear(tint), .45,.31)
    far_rubber = material("Distant tyre", (.019,.021,.024), .02,.76)
    far_rim = material("Distant alloy", (.22,.24,.25), .56,.36)
    far_trim = material("Satin black trim", (.017,.020,.022), .24,.44)
    far_blue = material("Blue registration", (.015,.055,.24), .2,.4)
    far_lights = [material("Rear light", (.48,.014,.017), .32,.26),
                  material("Headlights", (.50,.56,.60), .52,.20)]
    far_shell = low_detail(body, .18)
    slots = [far_trim, *far_lights, body_mats[2], far_paint, far_rim]
    new_indices = []
    for face in far_shell.data.polygons:
        idx = face.material_index
        if idx == 1:
            rgb = samples(far_shell.data, face, lens_pixels)
            new_indices.append(1 if rgb[0] > 1.6*rgb[1] else 2)
        elif idx == 0:
            rgba = samples(far_shell.data, face, gray)
            new_indices.append(4 if rgba[3] > .5 else 5 if rgba[:3].mean() > .22 else 0)
        else:
            new_indices.append(3 if idx == 2 else 4)
    far_shell.data.materials.clear()
    for mat in slots:
        far_shell.data.materials.append(mat)
    for face, idx in zip(far_shell.data.polygons, new_indices):
        face.material_index = idx
    far_parts = [far_shell]
    for o in wheels:
        low = low_detail(o, .16)
        low.data.materials.clear()
        low.data.materials.append(far_rubber)
        low.data.materials.append(far_rim)
        r = o["rolling_radius"]
        for f in low.data.polygons:
            f.material_index = int(abs(f.normal.x)>.70 and math.hypot(f.center.y,f.center.z)<r*.66)
        far_parts.append(low)
    for plate in plates:
        # Only the outline and colour of the registration resolve at this LOD.
        low = low_detail(plate, .13)
        low.data.materials[0] = far_blue
        far_parts.append(low)
    bpy.ops.object.select_all(action="DESELECT")
    for o in far_parts:
        o.select_set(True)
    bpy.context.view_layer.objects.active = far_shell
    bpy.ops.object.join()
    far_shell.name = "Distant "+car
    far_shell["distant_vehicle"] = True
    scene = bpy.context.scene
    scene["asset_credit"] = CREDIT
    bpy.ops.export_scene.gltf(filepath=str(ROOT/"public/models"/(FILES[car]+".glb")),
        export_format="GLB", export_extras=True, export_animations=False,
        export_cameras=False, export_lights=False, export_meshopt_compression_enable=True,
        export_meshopt_extension="EXT_meshopt_compression")
    wb = abs(sum(p.y if p.y>0 else -p.y for p in pivots)/2)
    print("CATALOG", car, [round(x,3) for x in (hi-lo)[[1,0,2]]], round(wb,3), round(radius,4))


for car, settings in CARS.items():
    build(car, *settings)
