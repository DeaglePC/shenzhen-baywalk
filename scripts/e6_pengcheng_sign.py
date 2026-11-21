"""Apply the Pengcheng fleet prints and build the transverse LED taximeter sign.

Called from the vehicle generator with its metre-scale body surface samplers.
Coordinates passed to Surface are transverse x, forward station, and height.
"""
from math import cos, pi, sin

import bpy

from e6_pengcheng_livery import BOXES, SIZE
from vehicle_build import material


def _print_material(ctx, key, label, filename, *, cutout=False, light=0, rough=.42, coat=.075):
    mat = material(label, "#ffffff", rough=rough, coat=coat)
    ctx.mats[key] = mat
    image = bpy.data.images.load(str(ctx.atlas / filename), check_existing=True)
    image.pack()
    tree = mat.node_tree
    sampler = tree.nodes.new("ShaderNodeTexImage")
    sampler.image = image
    sampler.extension = "EXTEND"
    shader = tree.nodes.get("Principled BSDF")
    shader.inputs["Specular IOR Level"].default_value = .18 if light else .26
    tree.links.new(sampler.outputs["Color"], shader.inputs["Base Color"])
    if cutout:
        clip = tree.nodes.new("ShaderNodeMath")
        clip.operation = "GREATER_THAN"
        clip.inputs[1].default_value = .24
        tree.links.new(sampler.outputs["Alpha"], clip.inputs[0])
        tree.links.new(clip.outputs[0], shader.inputs["Alpha"])
    if light:
        tree.links.new(sampler.outputs["Color"], shader.inputs["Emission Color"])
        shader.inputs["Emission Strength"].default_value = light
    return mat


def _printed_grid(surface, shape, desired, key, box=None, nx=10, ny=3):
    """Tessellate a decal onto the actual panel; UVs remain readable on both sides."""
    if box:
        x0,y0,x1,y1 = BOXES[box]
        def uv(u,v):
            return ((x0+.5+u*(x1-x0-1))/SIZE[0], 1-(y1-.5-v*(y1-y0-1))/SIZE[1])
    else:
        def uv(u,v):
            return u,v
    for col in range(nx):
        for row in range(ny):
            u,uu = col/nx,(col+1)/nx
            v,vv = row/ny,(row+1)/ny
            corners = [(u,v),(uu,v),(uu,vv),(u,vv)]
            surface.face([shape(a,b) for a,b in corners],key,desired,True,[uv(a,b) for a,b in corners])


def _side_prints(ctx):
    doors = ctx.part("Pengcheng - door emblems lettering and multilingual shoulder")
    window = ctx.part("Pengcheng - rear quarter glass inspection permits")
    bumper = ctx.part("Pengcheng - bumper fleet registration AT-099")
    # Bottom-left/right and top-left/right design points on the photographed
    # driver side. Intersecting the camera rays with the curved body, rather
    # than a single flat plane, corrects the shearing around the door crease.
    labels = {
        "company": ((-.874,.739),(-.277,.719),(-.810,.867),(-.223,.839)),
        "emblem": ((.288,.657),(.517,.653),(.338,.823),(.559,.816)),
        "call": ((-.756,.435),(-.206,.413),(-.789,.525),(-.227,.499)),
        "service": ((.103,.383),(.690,.365),(.132,.481),(.711,.461)),
        "speak": ((.059,.993),(.870,.938),(.033,1.028),(.855,.982)),
        "hello": ((1.006,.918),(1.624,.850),(1.000,.967),(1.619,.873)),
        "sticker": ((-1.338,1.181),(-1.020,1.197),(-1.367,1.309),(-1.072,1.308)),
    }
    for side in (-1,1):
        normal=(side,0,0)
        def affix(key,corners):
            glass=key=="sticker"
            sample = ctx.sideglass if glass else ctx.flank
            def shape(u,v):
                t=u if side<0 else 1-u
                weights=((1-v)*(1-t),(1-v)*t,v*(1-t),v*t)
                s=sum(p[0]*w for p,w in zip(corners,weights))
                z=sum(p[1]*w for p,w in zip(corners,weights))
                if key in ("hello","speak"):
                    top=ctx.sideglass(side,s,0)[2]
                    z=min(z,top-.0035)
                return sample(side,s,z,.0032 if glass else .0029)
            _printed_grid(window if glass else doors,shape,normal,"pengcheng_print",key,14,4)
        for key,corners in labels.items():
            affix(key,corners)
        def registration(u,v):
            return ctx.front(side*.686+(u-.5)*.161,.602+(v-.5)*.043,.0035)
        _printed_grid(bumper,registration,(side*.4,1,0),"pengcheng_print","number",12,3)


def _roof_sign(ctx):
    shell=ctx.part("Pengcheng - curved amber roof sign and two mounting feet")
    print_faces=ctx.part("Pengcheng - Shenzhen and operator roof panels")
    display=ctx.part("Pengcheng - green vacancy diode matrices")
    center_s=-.225
    half_width=.392
    depth=.108
    rise=.100

    def roof_at(x,s):
        a,b=-1.,1.
        # Roof cross-sections taper, hence convert transverse metres locally.
        for _ in range(16):
            f=(a+b)/2
            if ctx.roof(s,f)[0]<x:
                a=f
            else:
                b=f
        return ctx.roof(s,(a+b)/2)[2]

    bottom=max(roof_at(g*.310,center_s) for g in (-1,1))+.030

    def foot(cx):
        # Rounded elliptical pads follow the crown along their full footprint.
        profile=[(.053,.069,.000,"pengcheng_foot"),(.055,.071,.005,"pengcheng_foot"),
                 (.052,.068,.011,"pengcheng_foot"),(.043,.052,.012,"pengcheng_roof"),
                 (.038,.047,.025,"pengcheng_roof"),(.041,.050,.035,"pengcheng_roof"),
                 (.048,.054,.044,"pengcheng_roof")]
        rings=[]
        for rx,rs,h,_ in profile:
            ring=[]
            for j in range(32):
                a=2*pi*j/32
                x=cx+rx*cos(a); s=center_s+rs*sin(a)
                ring.append((x,s,roof_at(x,s)+h))
            rings.append(ring)
        for i in range(len(rings)-1):
            for j in range(32):
                k=(j+1)%32; a=2*pi*(j+.5)/32
                shell.face((rings[i][j],rings[i][k],rings[i+1][k],rings[i+1][j]),
                           profile[i+1][3],(cos(a),sin(a),0))

    for g in (-1,1):
        foot(g*.310)

    def arch(x,theta,out=0,raised=0):
        # Blended shoulders form the seam at each separate moulded end cap.
        end=max(0,min(1,(abs(x)-half_width+.014)/.014))
        radius=depth-.006*end+out
        return (x,center_s+radius*cos(theta),bottom+.014+(.001+rise-.005*end+out+raised)*sin(theta))

    # The shell section has a semi-elliptical top over a thin flat plinth.
    # End caps are independently triangulated; finish each with a mould-parting bead.
    coords=[-half_width,-half_width+.003,-half_width+.008,-half_width+.014,
            -.335,-.122,0,.122,.335,half_width-.014,half_width-.008,half_width-.003,half_width]
    def section(x):
        ring=[arch(x,j*pi/32) for j in range(33)]
        radius=ring[0][1]-center_s
        ring.extend([(x,center_s-radius+.001,bottom+.006),(x,center_s-radius+.008,bottom),
                     (x,center_s+radius-.008,bottom),(x,center_s+radius-.001,bottom+.006)])
        return ring
    rings=[section(x) for x in coords]
    for i in range(len(rings)-1):
        for j in range(len(rings[i])):
            k=(j+1)%len(rings[i]); p=rings[i][j]
            n=(0,p[1]-center_s,p[2]-bottom-.040)
            shell.face([rings[i][j],rings[i][k],rings[i+1][k],rings[i+1][j]],
                       "pengcheng_roof",n)
    for i,g in [(0,-1),(-1,1)]:
        mid=(coords[i],center_s,bottom+.052)
        ring=rings[i]
        for j in range(len(ring)):
            shell.face((mid,ring[j],ring[(j+1)%len(ring)]),"pengcheng_roof",(g,0,0),False)

    # A raised centre instrument enclosure, including an independently moulded
    # yellow peripheral gasket. The black matrix and both printed fields track
    # the three-dimensional curve of the shell; there are no floating boards.
    def bump(x):
        t=max(0.,min(1.,(.112-abs(x))/.020))
        return .016*(t*t*(3-2*t))
    for k in range(25):
        x=-.112+.224*k/25; xx=-.112+.224*(k+1)/25
        for j in range(28):
            a=pi*j/28; b=pi*(j+1)/28
            points=[arch(px,angle,.0006,bump(px)) for px,angle in [(x,a),(xx,a),(xx,b),(x,b)]]
            shell.face(points,"pengcheng_roof",(0,cos((a+b)/2),sin((a+b)/2)))
    for side in (1,-1):
        for key,x0,x1 in [("roof_city",-.361,-.111),("roof_operator",.111,.361),("led",-.090,.090)]:
            def face(u,v):
                x=side*(x0+(x1-x0)*u)
                angle=.10+1.22*v
                if side<0:
                    angle=pi-angle
                return arch(x,angle,.0018,bump(x) if key=="led" else 0)
            _printed_grid(display if key=="led" else print_faces,face,(0,side,.65),
                          "pengcheng_led" if key=="led" else "pengcheng_roof_print",
                          None if key=="led" else key,14,13)
    for i in range(13):
        x=(i-6)*.010
        s=center_s+depth-.003
        z=bottom+.0067
        shell.face(((x-.002,s,z-.0016),(x+.002,s,z-.0016),
                    (x+.002,s+.001,z+.0016),(x-.002,s+.001,z+.0016)),
                   "pengcheng_foot",(0,1,0),False)


def build_livery(ctx):
    """Populate the vehicle builder's named mesh surfaces and packed source materials."""
    ctx.mats["pengcheng_roof"]=material("Pengcheng yellow polycarbonate roof shell","#e2a81c",.04,.37,coat=.26)
    ctx.mats["pengcheng_foot"]=material("Pengcheng sign mounting rubber","#282922",0,.73)
    _print_material(ctx,"pengcheng_print","Pengcheng fleet and roof screen prints",
                    "pengcheng-print.png",cutout=True)
    roof_print=_print_material(ctx,"pengcheng_roof_print","Pengcheng roof cap enamel lettering",
                               "pengcheng-print.png",cutout=True,rough=.48,coat=.01)
    roof_print.node_tree.nodes.get("Principled BSDF").inputs["Specular IOR Level"].default_value=.12
    _print_material(ctx,"pengcheng_led","Pengcheng vacancy LED matrix",
                    "pengcheng-led.png",light=.72,rough=.44,coat=.035)
    _print_material(ctx,"pengcheng_plate","Pengcheng green plate - 粤B·C53270",
                    "pengcheng-plate.png",rough=.44,coat=.055)
    _side_prints(ctx)
    _roof_sign(ctx)
