"""Blender geometry for a mounted, rolled-edge Chinese registration plate."""
import math
import bpy


def material(name, color, metallic, roughness, image=None):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bs = mat.node_tree.nodes.get("Principled BSDF")
    bs.inputs["Base Color"].default_value = (*color, 1)
    bs.inputs["Metallic"].default_value = metallic
    bs.inputs["Roughness"].default_value = roughness
    if image:
        tex = mat.node_tree.nodes.new("ShaderNodeTexImage")
        tex.image = image
        mat.node_tree.links.new(tex.outputs["Color"], bs.inputs["Base Color"])
    return mat


def mounted_plate(label, sign, y, z, slope, face, backing, alloy, number, electric):
    width, height = (.48 if electric else .44), .14
    coords, faces, slots = [], [], []
    def point(x, v, depth):
        coords.append((-sign*x, y + slope*v + sign*depth, z+v))
        return len(coords)-1

    def ring(w, h, radius, depth):
        loop = []
        for k in range(4):
            cx = (1 if k in (0, 3) else -1) * (w/2-radius)
            cz = (1 if k < 2 else -1) * (h/2-radius)
            for j in range(5):
                angle = (k+j/4)*math.pi/2
                loop.append(point(cx+radius*math.cos(angle), cz+radius*math.sin(angle), depth))
        return loop

    def polygon(indices, slot):
        faces.append(indices)
        slots.append(slot)
    def bridge(inner, outer, slot):
        for i in range(len(inner)):
            j = (i+1) % len(inner)
            polygon((inner[i], inner[j], outer[j], outer[i]), slot)

    mount = ring(width+.010, height+.010, .007, -.003)
    lip = ring(width+.010, height+.010, .007, .006)
    edge = ring(width, height, .006, .009)
    polygon(mount[::-1], 1)
    bridge(mount, lip, 1)
    bridge(lip, edge, 1)
    polygon(edge, 0)
    face_index = len(faces)-1
    for x in (-.114, .114):
        for v in (-.058, .058):
            circles = []
            for radius, depth in ((.0069,.0092),(.0054,.0122)):
                circles.append([point(x + radius*math.cos(j*math.tau/12),
                                      v + radius*math.sin(j*math.tau/12), depth) for j in range(12)])
            bridge(*circles, 2)
            polygon(circles[1], 2)
    mesh = bpy.data.meshes.new(label)
    mesh.from_pydata(coords, [], faces)
    for mat in (face, backing, alloy):
        mesh.materials.append(mat)
    for poly, slot in zip(mesh.polygons, slots):
        poly.material_index = slot
    uv = mesh.uv_layers.new()
    for loop in mesh.polygons[face_index].loop_indices:
        x, _, pv = coords[mesh.loops[loop].vertex_index]
        uv.data[loop].uv = (.5-sign*x/width, .5+(pv-z)/height)
    mesh.update()
    obj = bpy.data.objects.new(label, mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj["street_plate"] = True
    obj["registration"] = number
    return obj
