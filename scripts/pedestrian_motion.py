"""Bake CMU subject 07 walks onto the two shipped rigs. Usage:
python scripts/pedestrian_motion.py <folder containing 07_01.c3d, 07_03.c3d, 07_06.c3d>
Requires c3d, numpy and scipy. Source: https://mocap.cs.cmu.edu/subjects/07/
"""
import json
import struct
import sys
from pathlib import Path

import c3d
import numpy as np
from scipy.signal import savgol_filter
from scipy.spatial.transform import Rotation as R

MEDIA = Path(__file__).resolve().parents[1] / "public/media"
SAMPLES = 41
SIDES = ("L", "R")
UP = np.array([0., 1., 0.])


def unit(v):
    return v / np.linalg.norm(v)


def swing(a, b):
    a, b = unit(a), unit(b)
    return R.from_quat(np.r_[np.cross(a, b), 1 + np.dot(a, b)])


def palm_frame(fingers, across):
    length = unit(fingers)
    width = unit(across - length*np.dot(across, length))
    return R.from_matrix(np.stack([width, length, np.cross(width, length)], axis=1))


def capture(folder, take, start, end):
    with (folder / (take + ".c3d")).open("rb") as f:
        reader = c3d.Reader(f)
        names = [k.strip().split(":")[-1] for k in reader.point_labels]
        raw = np.array([points[:, :3].copy() for _, points, _ in reader.read_frames()]) * .001
        rate = reader.point_rate
    raw = savgol_filter(raw, 9, 2, axis=0)
    waist = np.mean([raw[:, names.index(k)] for k in ("LFWT", "LBWT", "RFWT", "RBWT")], axis=0)
    stride_axis = waist[end] - waist[start]
    stride_axis[2] = 0
    forward = unit(stride_axis)
    up = np.array([0, 0, 1])
    basis = np.stack([np.cross(up, forward), up, forward], axis=1)
    origin = waist[start].copy()
    origin[2] = 0
    # Linear root extraction preserves a stationary planted shoe when game
    # travel advances by the same stride. Blend both sides of the loop seam.
    n = end - start
    motion = (raw - origin - (np.arange(len(raw)) - start)[:, None, None] * stride_axis / n) @ basis
    def sample(t):
        i = int(t)
        return motion[i] + (t-i) * (motion[i+1] - motion[i])
    frames = []
    for phase in np.linspace(0, 1, SAMPLES):
        t = start + phase*n
        distance = min(phase, 1-phase)
        weight = .5 * max(0, 1-distance/.14)**2
        other = t+n if phase < .5 else t-n
        frames.append(sample(t)*(1-weight) + sample(other)*weight if weight else sample(t))
    points = dict(zip(names, np.array(frames).swapaxes(0, 1)))
    return points, np.linalg.norm(stride_axis), n/rate


class Rig:
    def __init__(self, name):
        glb = (MEDIA / (name+".glb")).read_bytes()
        size = struct.unpack_from("<I", glb, 12)[0]
        doc = json.loads(glb[20:20+size])
        nodes = doc["nodes"]
        self.parents, self.offset, self.local, self.scale = {}, {}, {}, {}
        def visit(i, parent, scale):
            node = nodes[i]
            key = node["name"]
            self.parents[key] = parent
            self.offset[key] = np.array(node.get("translation", [0., 0., 0.])) * scale
            self.local[key] = R.from_quat(node.get("rotation", [0, 0, 0, 1]))
            self.scale[key] = scale
            for child in node.get("children", []):
                visit(child, key, scale*node.get("scale", [1])[0])
        for root in doc["scenes"][0]["nodes"]:
            visit(root, None, 1.)
        self.pos, self.rot = {}, {}
        for key, parent in self.parents.items():
            self.pos[key] = self.pos[parent]+self.rot[parent].apply(self.offset[key]) if parent else self.offset[key]
            self.rot[key] = self.rot[parent]*self.local[key] if parent else self.local[key]
        # The actual shoe silhouette determines the lowest point during roll.
        shoes = next(m for m in doc["meshes"] if m["name"].startswith("shoes"))
        vertices = []
        for prim in shoes["primitives"]:
            acc = doc["accessors"][prim["attributes"]["POSITION"]]
            view = doc["bufferViews"][acc["bufferView"]]
            byte_offset = size+28+view.get("byteOffset", 0)+acc.get("byteOffset", 0)
            vertices.extend(np.ndarray((acc["count"], 3), "<f4", buffer=glb, offset=byte_offset,
                                       strides=(view.get("byteStride", 12), 4)))
        vertices = np.array(vertices) * self.scale["foot_l"]
        self.sole = {}
        for side, sign in zip(SIDES, (1, -1)):
            foot = self.pos["foot_"+side.lower()]
            shoe = vertices[(vertices[:, 0]*sign > 0) & (vertices[:, 1] < foot[1]*1.3)]
            self.sole[side] = shoe - foot


def angles(left, right):
    v = left-right
    return np.stack([np.arctan2(-v[:, 2], v[:, 0]), np.arctan2(v[:, 1], v[:, 0])], axis=1)


def bake(rig, points, stride, duration, idle=False):
    pos, rot = rig.pos, rig.rot
    pelvis = np.mean([points[k] for k in ("LFWT","LBWT","RFWT","RBWT")], axis=0)
    centre = pelvis[:-1].mean(axis=0)
    hips = angles(points["LFWT"]+points["LBWT"], points["RFWT"]+points["RBWT"])
    chest = angles(points["LSHO"], points["RSHO"])
    head = angles(points["LFHD"]+points["LBHD"], points["RFHD"]+points["RBHD"])
    for a in (hips, chest, head):
        a -= a[:-1].mean(axis=0)
    leg_scale = (pos["thigh_l"][1]-pos["foot_l"][1])/.867
    tracks = {}
    for i, phase in enumerate(np.linspace(0, 1, SAMPLES)):
        t = 2*np.pi*phase
        result = {}
        pelvis_pos = pos["pelvis"].copy() + (pelvis[i]-centre)*leg_scale
        pelvis_pos[1] -= .030*leg_scale
        orientation = {}
        for name, a, lean in (("pelvis", hips, .007), ("spine_03", chest, .027), ("head", head, .003)):
            yaw, roll = a[i]
            if idle:
                yaw = .012*np.sin(t + .3)
                roll = .007*np.sin(t)
                lean = .009*np.cos(t)
            orientation[name] = R.from_euler("YXZ", [yaw, lean, roll])
        if idle:
            pelvis_pos = pos["pelvis"] + [.012+.004*np.sin(t), -.025+.003*np.cos(t), 0]
        feet = {}
        clearances = []
        for side, sign in zip(SIDES, (1, -1)):
            key = side.lower()
            ankle = pos["foot_"+key]
            heel, toe = points[side+"HEE"], points[side+"TOE"]
            direction = toe[i]-heel[i]
            pitch = -np.arctan2(direction[1], np.hypot(direction[0],direction[2]))
            roll = R.from_rotvec([np.clip(pitch, -.53, 1.08), 0, 0])
            sole = rig.sole[side]
            clearance = max(0., min(heel[i,1]-min(heel[:,1]), toe[i,1]-min(toe[:,1]))-.008)*leg_scale
            clearances.append(clearance)
            # Locate the shoe from the measured heel, including its shift about
            # the heel at contact. The ankle marker itself is on the outer skin.
            heel_offset = np.array([0., -ankle[1], np.percentile(sole[:,2], 2)])
            target = np.array([(heel[i,0]-centre[0])*.72+sign*.032, 0., heel[i,2]-centre[2]])*leg_scale
            target[2] -= roll.apply(heel_offset)[2]
            target[1] = -roll.apply(sole)[:,1].min() + clearance + .002
            if idle:
                target = np.array([sign*abs(pos["thigh_"+key][0])*.95, ankle[1], sign*.042])
                roll = R.identity()
            feet[side] = target, roll
            thigh, knee = pos["thigh_"+key], pos["calf_"+key]
            reach = np.linalg.norm(thigh-knee)+np.linalg.norm(ankle-knee)-.002
            hip_offset = orientation["pelvis"].apply(thigh-pos["pelvis"])
            delta = target-(pelvis_pos+hip_offset)
            max_hip = target[1]+np.sqrt(max(.01,reach**2-delta[0]**2-delta[2]**2))
            pelvis_pos[1] = min(pelvis_pos[1], max_hip-hip_offset[1])
        if not idle:
            # Walking has no flight phase. The lowest shoe is the support
            # even when the heel and toe markers both sit above the lab floor.
            support = min(clearances)
            pelvis_pos[1] -= support
            for ankle, _ in feet.values():
                ankle[1] -= support
        world = {}
        def orient(key, q):
            parent = rig.parents[key]
            parent_q = world.get(parent, rot[parent])
            world[key] = q
            result[key, "rotation"] = (parent_q.inv()*q).as_quat()
        def translate(key, p):
            parent = rig.parents[key]
            result[key, "translation"] = rot[parent].inv().apply(p-pos[parent])/rig.scale[key]
        translate("pelvis", pelvis_pos)
        orient("pelvis", orientation["pelvis"]*rot["pelvis"])
        # Divide counterrotation along the lumbar and thoracic spine.
        twist = orientation["spine_03"]*orientation["pelvis"].inv()
        for part, fraction in (("spine_01", .28), ("spine_02", .63), ("spine_03", 1.)):
            orient(part, R.from_rotvec(twist.as_rotvec()*fraction)*orientation["pelvis"]*rot[part])
        world["neck_01"] = world["spine_03"]*rig.local["neck_01"]
        orient("head", orientation["head"]*rot["head"])
        for side, sign in zip(SIDES, (1,-1)):
            s = "_"+side.lower()
            thigh, knee, foot = ("thigh"+s, "calf"+s, "foot"+s)
            ankle, foot_rot = feet[side]
            hip = pelvis_pos + orientation["pelvis"].apply(pos[thigh]-pos["pelvis"])
            axis, reach = unit(ankle-hip), np.linalg.norm(ankle-hip)
            upper, lower = np.linalg.norm(pos[knee]-pos[thigh]), np.linalg.norm(pos[foot]-pos[knee])
            along = (upper**2-lower**2+reach**2)/(2*reach)
            pole = np.array([sign*.10, 0., 1.])
            bend = hip+axis*along+unit(pole-axis*np.dot(pole,axis))*np.sqrt(max(0.,upper**2-along**2))
            orient(thigh, swing(pos[knee]-pos[thigh], bend-hip)*rot[thigh])
            orient(knee, swing(pos[foot]-pos[knee], ankle-bend)*rot[knee])
            translate(foot, ankle)
            orient(foot, foot_rot*rot[foot])
            clav, arm, elbow, hand = ("clavicle"+s, "upperarm"+s, "lowerarm"+s, "hand"+s)
            world[clav] = world["spine_03"]*rig.local[clav]
            a = points[side+"ELB"][i]-points[side+"SHO"][i]
            wrist = (points[side+"WRA"][i]+points[side+"WRB"][i])*.5
            b = wrist-points[side+"ELB"][i]
            # Remove the shoulder-to-elbow marker's lateral mounting offset.
            a = a.copy()
            a[0] -= sign*.038
            if idle:
                a = [sign*.057, -.30, -.022+.004*np.sin(t)]
                b = [-sign*.014, -.27, .059+.008*np.cos(t)]
            orient(arm, swing(pos[elbow]-pos[arm], a)*rot[arm])
            # Keep forearm twist from the upper arm as the elbow flexes.
            arm_change = world[arm]*rot[arm].inv()
            orient(elbow, swing(arm_change.apply(pos[hand]-pos[elbow]), b)*arm_change*rot[elbow])
            # FIN is a knuckle marker. Reconstruct the palm plane too so the
            # wrist doesn't inherit the curled-out twist of the rig's bind pose.
            finger_dir = unit(points[side+"FIN"][i]-wrist)*.65 - UP*.35 if not idle else -UP
            across = np.array([sign*.15, 0., 1.])
            bind_palm = palm_frame(pos["middle_01"+s]-pos[hand], pos["index_01"+s]-pos["pinky_01"+s])
            palm = palm_frame(finger_dir, across)
            hand_change = palm*bind_palm.inv()
            orient(hand, hand_change*rot[hand])
            # The little and ring fingers flex more than the index in repose.
            inward = -sign*palm.apply([0., 0., 1.])
            for finger, curl in (("index", .18), ("middle", .28), ("ring", .37), ("pinky", .45)):
                for joint, flex in ((1, curl), (2, curl+.48)):
                    knuckle = f"{finger}_0{joint}"+s
                    next_joint = f"{finger}_0{joint+1}"+s
                    direction = unit(finger_dir)*np.cos(flex) + inward*np.sin(flex)
                    orient(knuckle, swing(hand_change.apply(pos[next_joint]-pos[knuckle]), direction)
                           *hand_change*rot[knuckle])
        for key, value in result.items():
            tracks.setdefault(key, []).append(value)
    return tracks, float(stride*leg_scale), float(duration)


def export(name, captures):
    rig = Rig(name)
    nodes, indices, accessors, views, animations, binary = [], {}, [], [], [], bytearray()
    def buffer(values, kind):
        a = np.asarray(values, dtype="<f4")
        views.append(dict(buffer=0, byteOffset=len(binary), byteLength=a.nbytes))
        binary.extend(a.tobytes())
        accessors.append(dict(bufferView=len(views)-1, componentType=5126, count=len(a), type=kind,
                              min=a.reshape(len(a),-1).min(axis=0).tolist(), max=a.reshape(len(a),-1).max(axis=0).tolist()))
        return len(accessors)-1
    for clip, (tracks, stride, duration) in captures(rig):
        time = buffer(np.linspace(0, duration, SAMPLES), "SCALAR")
        channels, samplers = [], []
        for (key, path), values in tracks.items():
            if key not in indices:
                indices[key] = len(nodes)
                nodes.append(dict(name=key))
            values = np.array(values)
            values[-1] = values[0]
            if path == "rotation":
                for i in range(1, len(values)):
                    if np.dot(values[i], values[i-1]) < 0:
                        values[i] *= -1
            constant = np.allclose(values, values[0], atol=.00002)
            channel_time = buffer([0.], "SCALAR") if constant else time
            output = buffer(values[:1] if constant else values, "VEC4" if path == "rotation" else "VEC3")
            channels.append(dict(sampler=len(samplers), target=dict(node=indices[key], path=path)))
            samplers.append(dict(input=channel_time, output=output))
        animations.append(dict(name=clip, extras=dict(strideMeters=stride), samplers=samplers, channels=channels))
    document = dict(asset=dict(version="2.0"), scene=0, scenes=[dict(nodes=list(range(len(nodes))))],
                    nodes=nodes, animations=animations, bufferViews=views, accessors=accessors, buffers=[dict(byteLength=len(binary))])
    js = json.dumps(document,separators=(",",":")).encode()
    js += b" "*(-len(js)%4)
    header = struct.pack("<4sIIII", b"glTF", 2, 28+len(js)+len(binary), len(js), 0x4e4f534a)
    (MEDIA/(name+"-motion.glb")).write_bytes(header+js+struct.pack("<II",len(binary),0x004e4942)+binary)


if __name__ == "__main__":
    walks = [(take, capture(Path(sys.argv[1]), take, start, end)) for take, start, end in
             (("07_01",54,185), ("07_03",53,202), ("07_06",163,300))]
    def clips(rig):
        for take, motion in walks:
            yield "Walk_"+take, bake(rig, *motion)
        yield "Stand", bake(rig, walks[0][1][0], 0., 4.6, idle=True)
    for actor in ("sam", "maya"):
        export(actor, clips)
