"""Pose the project's existing Sam character at the e6 wheel and bake a static upper body."""
import bpy
import bmesh
from mathutils import Matrix,Vector

def seat_driver(source):
    before=set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(source),import_pack_images=True)
    imported=set(bpy.data.objects)-before
    rig=next(obj for obj in imported if obj.type=="ARMATURE")
    rig.animation_data_clear()
    for bone in rig.pose.bones:bone.matrix_basis.identity()
    bpy.context.view_layer.update()
    scale=.905
    place=Matrix.Translation((-.393,-.055,-.223))@Matrix.Scale(scale,4)
    world_from_bones=place@rig.matrix_world
    into_bones=world_from_bones.inverted()
    def aim(name,target):
        pb=rig.pose.bones[name]
        direction=(into_bones@Vector(target))-pb.head
        rotation=(pb.tail-pb.head).rotation_difference(direction)
        pivot=Matrix.Translation(pb.head)
        pb.matrix=pivot@rotation.to_matrix().to_4x4()@pivot.inverted()@pb.matrix
        bpy.context.view_layer.update()
    for key,g in [("l",1),("r",-1)]:
        aim("upperarm_"+key,(-.393+g*.216,-.257,.928))
        aim("lowerarm_"+key,(-.393+g*.142,-.531,.980))
        aim("hand_"+key,(-.393+g*.111,-.590,.998))
    deps=bpy.context.evaluated_depsgraph_get()
    for obj in sorted(imported,key=lambda o:o.name):
        if obj.type!="MESH" or obj.name not in {"eyebrow001","eyelashes01","low-poly","male_casualsuit02","Sam | anatomical body","short01","teeth_base"}:continue
        ev=obj.evaluated_get(deps)
        mesh=bpy.data.meshes.new_from_object(ev,preserve_all_data_layers=True,depsgraph=deps)
        mesh.transform(place@ev.matrix_world)
        edit=bmesh.new();edit.from_mesh(mesh)
        remove=[]
        for v in edit.verts:
            x,y,z=v.co
            hidden_skin=obj.name=="Sam | anatomical body" and z<1.120 and not (y<-.21 and z>.83)
            if z<.552 or hidden_skin:remove.append(v)
        bmesh.ops.delete(edit,geom=remove,context="VERTS")
        edit.to_mesh(mesh);edit.free();mesh.update()
        if not mesh.polygons:
            bpy.data.meshes.remove(mesh);continue
        for m in mesh.materials:
            if m and m.name=="Sam | original top":
                m.node_tree.nodes.get("Principled BSDF").inputs["Base Color"].default_value=(.065,.094,.132,1)
        baked=bpy.data.objects.new("Seated driver · "+obj.name,mesh)
        bpy.context.collection.objects.link(baked)
    for obj in imported:bpy.data.objects.remove(obj,do_unlink=True)
