"""Export the licensed Highland master and both instanced traffic LODs with Blender 5.2.

    blender -b models/特斯拉Model3-焕新版.blend -P scripts/model3_highland.py
"""
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public/models"
scene = bpy.context.scene
meshes = [obj for obj in scene.objects if obj.type == "MESH"]
wheels = [obj for obj in scene.objects if obj.get("rolling_radius")]
assert len(wheels) == 4 and sum(bool(o.get("street_plate")) for o in meshes) == 2


def export(objects, name):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.export_scene.gltf(
        filepath=str(OUT / name), export_format="GLB", use_selection=True,
        export_extras=True, export_animations=False, export_lights=False, export_cameras=False,
        export_meshopt_compression_enable=True, export_meshopt_extension="EXT_meshopt_compression",
    )


# Keep the original textured materials in the detailed car. Every wheel has
# its own axle node, for both parked cars and instanced rolling traffic.
export(meshes + wheels, "model3-detail.glb")


def finish(name, color, metallic, roughness, emission=0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*color, 1)
    shader.inputs["Metallic"].default_value = metallic
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Emission Color"].default_value = (*color, 1)
    shader.inputs["Emission Strength"].default_value = emission
    return mat


glass = finish("Traffic tinted glass", (.034, .047, .054), .36, .21)
trim = finish("Traffic graphite trim", (.012, .015, .017), .25, .40)
rubber = finish("Traffic tyre", (.019, .021, .023), .02, .78)
green = finish("Shenzhen green plate at distance", (.35, .70, .37), .12, .43)
red = finish("Traffic rear light", (.34, .012, .014), .21, .22, .58)
white = finish("Traffic headlight", (.62, .70, .76), .36, .18, .45)


def traffic_finish(mat):
    name = mat.name
    if name in ("Panoramic roof and windscreens", "Right side glass", "Left side glass"):
        return glass
    if name == "Tire1Mtl":
        return rubber
    if name == "Shenzhen green registration":
        return green
    if name == "Ln12Mtl":
        return red
    if name == "Ln7Mtl":
        return white
    if name in ("Geodoorl2sub11Mtl", "Geocockpithrsub000332Mtl", "Geocockpithrsub000921Mtl"):
        return trim
    return mat


def simplified(src, ratio):
    obj = src.copy()
    obj.data = src.data.copy()
    scene.collection.objects.link(obj)
    # Weld UV seams for decimation. Traffic materials use solid colours.
    mesh = obj.data
    while mesh.uv_layers:
        mesh.uv_layers.remove(mesh.uv_layers[0])
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.remove_doubles(bm, verts=bm.verts[:], dist=.00002)
    bm.to_mesh(mesh)
    bm.free()
    for slot in obj.material_slots:
        slot.material = traffic_finish(slot.material)
    if len(mesh.polygons) > 30:
        mod = obj.modifiers.new("Distance silhouette", "DECIMATE")
        mod.ratio = min(1, max(ratio, 20 / len(mesh.polygons)))
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return obj


def join_at_origin(parts, name):
    # All traffic batches use metre coordinates relative to a single pivot.
    for obj in parts:
        matrix = obj.matrix_world.copy()
        obj.parent = None
        obj.data.transform(matrix)
        obj.matrix_world = Matrix.Identity(4)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in parts:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    obj = bpy.context.object
    obj.name = name
    return obj


def body_shell(obj):
    # Opaque glazing encloses the cabin at road distances.
    name = obj.data.materials[0].name
    return not name.startswith(("Geocockpit", "Geodoorl2int", "Geodoorlint"))


plates = [obj for obj in meshes if obj.get("street_plate")]
panels = [obj for obj in meshes if not obj.parent and obj not in plates and body_shell(obj)]
body = join_at_origin([simplified(o, .085) for o in panels], "Highland traffic body")
body["design_reference"] = "2024 Tesla Model 3 / RBLXSupercars / CC BY 4.0"
far = join_at_origin([simplified(o, .009) for o in panels + plates] +
                     [simplified(o, .012) for axle in wheels for o in axle.children if o in meshes],
                     "Highland distant silhouette")
far["distant_vehicle"] = True

# setupType instances the left front wheel's mesh at the four axle positions.
# Store the pivots on the roots, independent of glTF mesh primitive grouping.
prototype = next(axle for axle in wheels if axle.name == "wheel_LF")
hub = join_at_origin([simplified(o, .09) for o in prototype.children if o in meshes], "Traffic wheel")
hub.data.transform(Matrix.Translation(-prototype.location))
traffic_wheels = []
for axle in wheels:
    name = axle.name
    axle.name = "Detailed " + name
    wheel = bpy.data.objects.new(name, hub.data)
    scene.collection.objects.link(wheel)
    wheel.location = axle.location
    if wheel.location.x > 0:
        wheel.rotation_euler.z = 3.141592653589793
    wheel["rolling_radius"] = axle["rolling_radius"]
    traffic_wheels.append(wheel)
export([body, far] + traffic_wheels + plates, "model3.glb")
