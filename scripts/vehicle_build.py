"""Rebuild the procedural metre-scale traffic GLBs with Blender 5.2 in background mode.

Create the decals first with system Python and Pillow:
    python scripts/vehicle_decals.py <temporary-atlas-directory>
    blender -b -P scripts/vehicle_build.py -- <temporary-atlas-directory>

Longitudinal profiles are hand-authored. The source defines design coordinates as
right / forward / up. Exports face positive Z in the Three.js Y-up world.
"""
from math import sin, cos, pi, sqrt, ceil
from pathlib import Path
import sys
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
ATLAS = Path(sys.argv[sys.argv.index("--") + 1])
OUT = ROOT / "public/models"
OUT.mkdir(exist_ok=True, parents=True)

# Length, width excluding mirrors, height, wheelbase, wheel radius, belt height,
# paint, cabin top profile, glazing limits, B/C pillars, wheel spokes.
SPECS = {
    "e6": (
        (4.560,1.822,1.630,2.830,.326,.627), "#247DC9",
        [(-.98,.62),(-.94,.75),(-.83,.935),(-.72,.985),(-.39,1),(.05,.995),(.18,.968),(.33,.88),(.54,.69),(.61,.625)],
        (-.94,-.76,.17,.57),(-.43,-.035),7),
    "model3": (
        (4.720,1.850,1.440,2.875,.337,.65), "#B9C1CB",
        [(-.89,.65),(-.73,.73),(-.52,.875),(-.28,.976),(-.08,1),(.10,.985),(.24,.946),(.47,.753),(.60,.65)],
        (-.80,-.26,.16,.55),(-.51,-.045),9),
    "tang": (
        (4.870,1.950,1.725,2.820,.373,.648), "#324C5F",
        [(-.958,.65),(-.93,.78),(-.78,.945),(-.64,.99),(-.33,1),(.10,.992),(.23,.958),(.47,.75),(.57,.65)],
        (-.925,-.73,.18,.54),(-.48,-.04),5),
    "mifa9": (
        (5.270,2.000,1.840,3.200,.354,.605), "#70596B",
        [(-.985,.61),(-.976,.849),(-.924,.963),(-.80,.991),(-.40,1),(.12,.998),(.31,.98),(.44,.889),(.65,.652),(.69,.607)],
        (-.972,-.919,.315,.655),(-.50,-.015),10),
    "civic": (
        (4.685,1.802,1.415,2.735,.324,.655), "#B73337",
        [(-.78,.656),(-.64,.748),(-.44,.912),(-.24,.978),(-.06,1),(.12,.997),(.23,.946),(.47,.718),(.53,.656)],
        (-.73,-.31,.18,.497),(-.43,-.045),5),
    "mini": (
        (2.920,1.493,1.621,1.940,.267,.592), "#92BFAD",
        [(-.977,.60),(-.962,.866),(-.90,.973),(-.78,1),(-.40,1),(.12,1),(.31,.977),(.43,.894),(.64,.655),(.71,.593)],
        (-.96,-.91,.3,.66),(-.80,-.23),4),
}

def lerp(a,b,t):
    return a+(b-a)*t

def curve(points, x):
    if x <= points[0][0]:
        return points[0][1]
    for (a,f),(b,g) in zip(points,points[1:]):
        if x <= b:
            return lerp(f,g,(x-a)/(b-a))
    return points[-1][1]

def linear(c):
    s = int(c,16)/255
    return s/12.92 if s <= .04045 else ((s+.055)/1.055)**2.4

def material(name,color,metal=0,rough=.4,glow=0,coat=0):
    m=bpy.data.materials.new(name)
    m.use_nodes=True
    rgb=tuple(linear(color[i:i+2]) for i in (1,3,5))+(1,)
    node=m.node_tree.nodes.get("Principled BSDF")
    node.inputs["Base Color"].default_value=rgb
    node.inputs["Metallic"].default_value=metal
    node.inputs["Roughness"].default_value=rough
    node.inputs["Coat Weight"].default_value=coat
    if coat: node.inputs["Coat Roughness"].default_value=.16
    node.inputs["Emission Color"].default_value=rgb
    node.inputs["Emission Strength"].default_value=glow
    m.diffuse_color=rgb
    m.use_backface_culling=True
    return m

class Surface:
    def __init__(self):
        self.vertices=[]
        self.indices={}
        self.faces=[]
        self.names=[]
        self.uvs=[]
        self.smooth=[]

    def face(self, points, name, desired=None, smooth=True, tex=None):
        # Work in right/forward/up, then reflect the forward axis for Blender.
        points = [tuple(p) for p in points]
        if desired is not None:
            n = (Vector(points[1])-Vector(points[0])).cross(Vector(points[-1])-Vector(points[0]))
            if n.dot(Vector(desired)) < 0:
                points.reverse()
                if tex: tex=list(reversed(tex))
        inds=[]
        for x,s,z in reversed(points):
            key=(round(x,6),round(-s,6),round(z,6))
            if key not in self.indices:
                self.indices[key]=len(self.vertices)
                self.vertices.append(key)
            inds.append(self.indices[key])
        if len(set(inds))!=len(inds):
            return
        self.faces.append(inds)
        self.names.append(name)
        self.uvs.append(list(reversed(tex)) if tex else None)
        self.smooth.append(smooth)

    def patch(self, us, vs, fn, name, desired, smooth=True):
        for u,un in zip(us,us[1:]):
            for v,vn in zip(vs,vs[1:]):
                cell=[(u,v),(un,v),(un,vn),(u,vn)]
                self.face([fn(a,b) for a,b in cell],
                    name((u+un)/2,(v+vn)/2) if callable(name) else name,
                    desired,smooth)

    def decal(self, points, bounds, desired):
        # Points are bottom-left, bottom-right, top-right, top-left in the viewer's frame.
        x0,y0,x1,y1=bounds
        self.face(points,"mark",desired,False,
            [(x0/512,1-y1/512),(x1/512,1-y1/512),(x1/512,1-y0/512),(x0/512,1-y0/512)])

    def export_object(self, name, mats, origin=(0,0,0)):
        mesh=bpy.data.meshes.new(name)
        mesh.from_pydata(self.vertices,[],self.faces)
        keys=list(dict.fromkeys(self.names))
        for key in keys: mesh.materials.append(mats[key])
        has_uv=any(self.uvs)
        uv=mesh.uv_layers.new(name="decals") if has_uv else None
        for i,poly in enumerate(mesh.polygons):
            poly.material_index=keys.index(self.names[i])
            poly.use_smooth=self.smooth[i]
            if self.uvs[i]:
                for idx,coords in zip(poly.loop_indices,self.uvs[i]):
                    uv.data[idx].uv=coords
        mesh.update()
        obj=bpy.data.objects.new(name,mesh)
        bpy.context.collection.objects.link(obj)
        obj.location=(origin[0],-origin[1],origin[2])
        return obj

def samples(lo,hi,n):
    return [lerp(lo,hi,i/n) for i in range(n+1)]

def rod(surface, pts, radius, name, count=5):
    rings=[]
    for i,p in enumerate(pts):
        v=Vector(pts[min(i+1,len(pts)-1)])-Vector(pts[max(0,i-1)])
        if not v.length: return
        v.normalize()
        ref=Vector((0,0,1)) if abs(v.z)<.85 else Vector((1,0,0))
        u=v.cross(ref).normalized(); w=v.cross(u).normalized()
        rings.append([Vector(p)+radius*(cos(j*2*pi/count)*u+sin(j*2*pi/count)*w) for j in range(count)])
    for i in range(len(rings)-1):
        for j in range(count):
            a=(j+1)%count
            quad=[rings[i][j],rings[i][a],rings[i+1][a],rings[i+1][j]]
            surface.face(quad,name,rings[i][j]+rings[i][a]-Vector(pts[i])*2)

def ellipsoid(surface, center, scale, name, segments=16, rings=6):
    for i in range(rings):
        a=lerp(-pi/2+.001,pi/2-.001,i/rings)
        b=lerp(-pi/2+.001,pi/2-.001,(i+1)/rings)
        for j in range(segments):
            pts=[]
            for lat,jj in [(a,j),(a,j+1),(b,j+1),(b,j)]:
                lon=2*pi*jj/segments
                d=(cos(lat)*cos(lon),cos(lat)*sin(lon),sin(lat))
                pts.append(tuple(center[k]+scale[k]*d[k] for k in range(3)))
            surface.face(pts,name,Vector(pts[0])-Vector(center))

def wheel(surface,r,sgn,spokes,depth):
    # Revolved tyre section with a shoulder chamfer, alloy barrels, and brake discs.
    g=sgn
    profile=[(-depth*.50,.62),(-depth*.51,.83),(-depth*.46,.95),
             (-depth*.37,.993),(-depth*.2,1),(depth*.20,1),
             (depth*.38,.989),(depth*.49,.94),(depth*.53,.83),
             (depth*.52,.74),(depth*.48,.67)]
    def circle(d,rr,a): return (g*d,r*rr*cos(a),r*rr*sin(a))
    for k in range(len(profile)-1):
        d,rr=profile[k]; nd,nr=profile[k+1]
        for j in range(36):
            a=j*2*pi/36; b=(j+1)*2*pi/36
            surface.face([circle(d,rr,a),circle(d,rr,b),circle(nd,nr,b),circle(nd,nr,a)],"tire",
              (g*(rr-nr), (nd-d)*cos((a+b)/2),(nd-d)*sin((a+b)/2)))
    def annulus(outer,inner,d,mat):
        for j in range(36):
            a=j*2*pi/36; b=(j+1)*2*pi/36
            surface.face([circle(d,outer,a),circle(d,outer,b),circle(d,inner,b),circle(d,inner,a)],
                         mat,(g,0,0))
    annulus(.75,.692,depth*.54,"rim")
    annulus(.692,.65,depth*.49,"brake")
    annulus(.66,.04,depth*.30,"trim")
    annulus(.56,.18,depth*.34,"brake")
    annulus(.19,.125,depth*.565,"rim")
    annulus(.125,.01,depth*.565,"brake")
    for j in range(spokes):
        a=j*2*pi/spokes
        for offset in (-.075,.075) if spokes in (5,7,10) else (0,):
            spread=.055 if spokes>5 else .09
            coords=[(.15,a+offset-.11),(.37,a+offset-.09),(.69,a+offset+.105-spread),
                    (.69,a+offset+.105+spread),(.35,a+offset+.085),(.15,a+offset+.10)]
            surface.face([circle(depth*(.61 if rr<.4 else .53),rr,ph) for rr,ph in coords],
                         "rim",(g,0,0))
            # Slightly recessed return on each machined face catches a moving highlight.
            for k in (1,3):
                rr,ph=coords[k]; rn,pn=coords[k+1]
                d=depth*(.61 if rr<.4 else .53); dn=depth*(.61 if rn<.4 else .53)
                surface.face([circle(d,rr,ph),circle(dn,rn,pn),
                              circle(dn-.014,rn,pn),circle(d-.014,rr,ph)],"brake",(g,cos(ph),sin(ph)))
    for j in range(5):
        a=2*pi*j/5
        ellipsoid(surface,(g*depth*.575,r*.117*cos(a),r*.117*sin(a)),
                  (.009,.013,.013),"brake",5,3)

def build(model,spec):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    (L,W,H,wb,r,belt),paint,roof,glass,pillars,spokes=spec
    mats={
        "paint":material("Body paint",paint,.51,.23,coat=.58),
        "white":material("Taxi pearl white","#E8EDF1",.35,.27,coat=.47),
        "alloy":material("Brushed aluminium","#C2C8C7",.78,.26),
        "rim":material("Machined wheel face","#A0A8AB",.77,.32),
        "brake":material("Brake and bolt steel","#696D70",.70,.38),
        "glass":material("Solar glass","#40545A",.23,.15,coat=.26),
        "passenger":material("Rear passenger tint","#263B40",.25,.18,coat=.23),
        "roofglass":material("Panoramic roof","#293A41",.37,.18,coat=.38),
        "seat":material("Charcoal upholstery","#25282B",0,.82),
        "trim":material("Satin black trim","#23272A",.16,.38),
        "tire":material("Road rubber","#262829",.01,.87),
        "lamp":material("DRL and projector","#E6F1F2",.18,.17,.48),
        "tail":material("Tail optics","#E72332",.24,.22,.40),
        "amber":material("Indicator","#E99A37",.21,.27,.10),
        "mark":material("Printed badge, plate and fleet lettering","#FFFFFF",.10,.39),
    }
    im=bpy.data.images.load(str(ATLAS/(model+".png"))); im.pack()
    mark=mats["mark"]; nt=mark.node_tree
    tx=nt.nodes.new("ShaderNodeTexImage"); tx.image=im
    shader=nt.nodes.get("Principled BSDF")
    nt.links.new(tx.outputs["Color"],shader.inputs["Base Color"])
    nt.links.new(tx.outputs["Alpha"],shader.inputs["Alpha"])
    mark.alpha_threshold=.42
    mats["glass"].node_tree.nodes.get("Principled BSDF").inputs["Alpha"].default_value=.65
    mats["passenger"].node_tree.nodes.get("Principled BSDF").inputs["Alpha"].default_value=.81
    a=Surface()
    hw,hl=W/2,L/2
    mpv=model in ("e6","mini","mifa9")
    tau=2*pi
    def width(t):
        return hw*curve([(-1,.866),(-.94,.958),(-.76,.992),(-.43,1),(.32,1),(.75,.979),(.935,.93),(1,.85)],t)
    def belt_z(t):
        if model in ("model3","civic"):
            lift=curve([(-1,-.029),(-.91,.032),(-.66,.045),(-.2,.012),(.50,-.016),(.73,-.029),(.96,-.091),(1,-.137)],t)
        else:
            lift=curve([(-1,-.057),(-.90,.012),(-.5,.015),(.30,-.013),(.65,-.023),(.92,-.075),(1,-.106)],t)
        return H*(belt+lift)
    def s_at(t, frac):
        roundness = .24 if model in ("e6","mini") else .175 if model=="mifa9" else .34
        return hl*t-(1 if t>=0 else -1)*roundness*abs(t)**6*abs(frac)**2.5
    def arch(t):
        dx=min(abs(t*hl-wb/2),abs(t*hl+wb/2))
        clearance=r+.039
        floor=.156 if mpv else .17
        if dx>clearance+.023: return floor
        if dx>clearance: return lerp(r,floor,(dx-clearance)/.023)
        return r+sqrt(max(0,clearance*clearance-dx*dx))
    def sidefrac(q):
        return curve([(0,.94),(.07,.98),(.16,.986),(.37,.98),(.65,.993),(.82,1),(.9,.996),(1,.956)],q)
    def flank(g,t,q,offset=0):
        f=sidefrac(q)
        return (g*(width(t)*f+offset),s_at(t,f),lerp(arch(t),belt_z(t),q))
    ts=set(samples(-1,1,50))
    for center in (-wb/2,wb/2):
        for ph in samples(0,pi,24): ts.add((center+(r+.039)*cos(ph))/hl)
        for val in (-r-.063,r+.063): ts.add((center+val)/hl)
    ts=sorted(x for x in ts if -1<=x<=1)
    def flank_mat(t,q):
        if model=="e6":
            height=lerp(arch(t),belt_z(t),q)
            if height<belt_z(t)-.145 and height> .315+.09*(t+.2)+.045*sin(3*t): return "white"
            return "paint"
        if model in ("tang","mini") and q<.07: return "trim"
        return "paint"
    for g in (-1,1):
        # On the taxi its livery is cut into the body mesh, so it curves across the fenders.
        if model=="e6":
            def taxi_flank(t,q):
                low=arch(t); high=belt_z(t)
                stripe=.315+.09*(t+.2)+.045*sin(3*t)
                h=curve([(0,low),(.21,max(low,min(high,stripe))),
                         (.81,max(low,high-.145)),(1,high)],q)
                return flank(g,t,max(0,min(1,(h-low)/max(.001,high-low))))
            a.patch(ts,[0,.09,.21,.38,.56,.70,.81,.9,1],taxi_flank,
                    lambda t,q: "white" if .21<q<.81 else "paint",(g,0,0))
        else:
            a.patch(ts,[0,.07,.16,.37,.65,.82,.9,1],lambda t,q:flank(g,t,q),
                    flank_mat,(g,0,0))
        for wc in (-wb/2,wb/2):
            arc=[]
            for ph in samples(0,pi,20):
                t=(wc+(r+.039)*cos(ph))/hl
                v=flank(g,t,0); arc.append((v[0]+g*.006,v[1],v[2]))
            rod(a,arc,.012,"trim" if model!="e6" else "white")
            for p,pn in zip(arc,arc[1:]):
                a.face([p,pn,(pn[0]-g*.18,pn[1],pn[2]-.012),(p[0]-g*.18,p[1],p[2]-.012)],
                       "trim",(0,0,-1))
    start,stop=roof[0][0],roof[-1][0]
    def top(t,f):
        normal_height=belt_z(t)+.067*(1-f*f)
        inner=max(0,min(1,(t-start)/.105,(stop-t)/.115,(.95-abs(f))/.14))
        embossed=.014*max(0,1-abs(abs(f)-.68)/.15)*max(0,min(1,(t-.45)/.1))
        return (width(t)*.956*f,s_at(t,.956*f),normal_height-.23*inner+embossed)
    a.patch(sorted(set(ts+[start,stop])),samples(-1,1,16),top,
            lambda t,f:"trim" if start+.018<t<stop-.025 and abs(f)<.93 else "paint",(0,0,1))
    def end(g,f,q,off=0):
        x=width(g)*sidefrac(q)*f
        lip=(1-f*f)*curve([(0,-.073),(.09,-.018),(.19,.002),(.30,-.011),(.48,-.020),(.62,.001),(.79,.003),(1,0)],q)
        return (x,s_at(g,sidefrac(q)*f)+g*(off+lip),lerp(arch(g),belt_z(g),q)+.067*q*(1-f*f))
    for g in (1,-1):
        def endmat(f,q):
            if model=="e6" and ((g==1 and abs(f)>.51 and .23<q<.9) or (g==-1 and q>.27)):
                return "white"
            return "trim" if q<.09 and model in ("tang","civic") else "paint"
        a.patch(samples(-1,1,24),[0,.09,.23,.27,.45,.6,.77,.9,.96,1],lambda f,q:end(g,f,q),endmat,(0,g,0))
    a.face([(-hw*.79,-hl*.87,.17),(hw*.79,-hl*.87,.17),(hw*.79,hl*.87,.17),(-hw*.79,hl*.87,.17)],"trim",(0,0,-1),False)
    # The same continuous shell carries side windows, the curved windshields and roof glazing.
    def capheight(t): return max(belt_z(t)+.016,curve(roof,t)*H)
    def cabwidth(t,q):
        loss=(.117 if mpv else .185)*q**1.22
        return width(t)*(.95-loss)*(1-(.02 if mpv else .052)*q*abs(t))
    def cabin(g,t,q):
        h=capheight(t); low=belt_z(t)
        return (g*cabwidth(t,q),s_at(t,.94),lerp(low,h-.035,q))
    def crown(t,f):
        v=cabin(1,t,1)
        bend=.098*max(0,min(1,abs(t)*2))*(1-f*f)*(1 if t>0 else -1)
        return (v[0]*f,lerp(t*hl,v[1],f*f)+bend,capheight(t)-.035*f*f)
    station=set(samples(start,stop,35)+[p[0] for p in roof]+list(glass))
    for pp in pillars:
        station.update([pp-.018,pp+.018])
    station=sorted(x for x in station if start<=x<=stop)
    for g in (-1,1):
        def window(t,q):
            if t<glass[0]+.018 or t>glass[3]-.012: return "paint"
            if q<=.087 or q>.935: return "paint"
            if q<.12 or q>.89 or any(abs(t-p)<.018 for p in pillars): return "trim"
            if model=="mini" and t<-.75: return "paint"
            return "passenger" if t<pillars[-1] else "glass"
        a.patch(station,[0,.087,.12,.52,.89,.935,1],lambda t,q:cabin(g,t,q),window,(g,0,.18))
        edge=[cabin(g,t,.102) for t in station if glass[0]+.03<t<glass[3]-.04]
        rod(a,edge,.010,"alloy" if model!="mini" else "trim")
    def roofmat(t,f):
        if glass[2]<t<glass[3] or glass[0]<t<glass[1]:
            return "glass" if abs(f)<.91 else "trim" if abs(f)<.971 else "paint"
        if model in ("model3","mifa9","tang") and glass[1]+.06<t<glass[2]-.034 and abs(f)<.85:
            return "roofglass"
        return "white" if model=="mini" else "paint"
    a.patch(station,[-1,-.97,-.91,-.85,-.64,-.31,0,.31,.64,.85,.91,.97,1],crown,roofmat,(0,0,1))
    # Moulded dashboard, separate front seats/headrests and rear bench seen through the glass.
    for g in (-1,1):
        seat_s=(glass[2]-.15)*hl
        ellipsoid(a,(g*W*.227,seat_s,.625*H),(.19*W,.085*L,.144*H),"seat",14,8)
        ellipsoid(a,(g*W*.227,seat_s-.075,.794*H),(.079*W,.059,.064*H),"seat",13,7)
        rear_s=(glass[1]+.18)*hl
        ellipsoid(a,(g*W*.228,rear_s,.647*H),(.20*W,.065*L,.106*H),"seat",12,6)
        ellipsoid(a,(g*W*.228,rear_s-.034,.759*H),(.074*W,.065,.060*H),"seat",12,6)
    dash_s=glass[3]*hl-.217
    ellipsoid(a,(0,dash_s,H*belt+.038),(.419*W,.212,.092),"trim",20,6)
    steer=[]
    for phi in samples(0,2*pi,23):
        steer.append((-.225*W+.138*cos(phi),dash_s-.199-.083*sin(phi),H*belt+.086+.112*sin(phi)))
    rod(a,steer,.014,"trim",7)
    rod(a,[steer[0],(-.225*W,dash_s-.198,H*belt+.078),steer[12]],.019,"trim",6)
    if model=="e6":
        mats["jacket"]=material("Driver uniform","#394E62",0,.87)
        mats["skin"]=material("Driver skin","#9E7766",0,.81)
        mats["hair"]=material("Hair","#272522",0,.94)
        sx=-W*.222; ss=(glass[2]-.15)*hl+.177
        ellipsoid(a,(sx,ss,H*.696),(.195,.139,.219),"jacket",15,8)
        ellipsoid(a,(sx,ss+.020,H*.865),(.093,.104,.127),"skin",15,9)
        ellipsoid(a,(sx,ss+.006,H*.907),(.096,.102,.084),"hair",15,7)
        ellipsoid(a,(sx,ss+.118,H*.863),(.025,.024,.027),"skin",10,5)
        for hand in (-1,1):
            elbow=(sx+hand*.158,ss+.080,H*.695)
            wrist=(sx+hand*.111,dash_s-.195,H*belt+.105)
            rod(a,[(sx+hand*.136,ss,H*.753),elbow],.049,"jacket",8)
            rod(a,[elbow,wrist],.035,"skin",8)
            ellipsoid(a,wrist,(.043,.047,.036),"skin",9,5)
    for g in (-1,1):
        # Flush panel gaps, door handles, rocker strips and mirror assemblies.
        split=pillars[-1]
        for seam in ([split,glass[3]-.015] if model=="mini" else [pillars[0]-.04,split,glass[3]-.015]):
            pts=[flank(g,seam-.034*(1-q),q,.004) for q in (.085,.20,.40,.60,.82,.96,1)]
            rod(a,pts,.0045,"trim",4)
        for ht in ([split+.085] if model=="mini" else [pillars[0]+.09,split+.085]):
            pts=[flank(g,ht+o,.865,.015) for o in (-.04,-.019,.019,.04)]
            rod(a,pts,.014,"alloy" if model not in ("model3","mini") else "trim",6)
        pts=[flank(g,t,.095,.004) for t in samples(-.43,.40,6)]
        rod(a,pts,.011,"alloy" if model in ("mifa9","tang") else "trim")
        mt=glass[3]-.105
        # Factory open-mirror widths for Model 3 and Tang; the other offsets follow
        # the visible mirror housings in the reference silhouettes.
        mirror_width={"model3":2.089,"tang":2.180,"e6":2.08,"mini":1.71,"mifa9":2.24,"civic":2.06}[model]
        root=cabin(g,mt,.19); mc=(g*(mirror_width*.5-.094),root[1]-.064,root[2]+.037)
        rod(a,[root,(mc[0]-g*.045,mc[1],mc[2]-.016)],.023,"trim",6)
        ellipsoid(a,mc,(.094,.134,.071),"paint")
        ellipsoid(a,(mc[0],mc[1]-.095,mc[2]-.003),(.071,.037,.052),"glass",12,5)
        rod(a,[(mc[0]+g*.073,mc[1]+.037,mc[2]),(mc[0]+g*.085,mc[1]-.008,mc[2])],.006,"lamp")
        if model in ("tang","mifa9","e6"):
            rail=[crown(t,.90*g) for t in samples(glass[1]+.065,glass[2]-.025,10)]
            rod(a,[(x,s,h+.021) for x,s,h in rail],.015,"alloy")
        if model=="e6":
            def flank_decal(t,span,lo,hi,box):
                for u,un in zip(samples(-1,1,8),samples(-1,1,8)[1:]):
                    uu=lambda v:lerp(box[0],box[2],(v+1)/2)
                    coords=[flank(g,t-g*span*x,q,.014) for x,q in ((u,lo),(un,lo),(un,hi),(u,hi))]
                    a.decal(coords,(uu(u),box[1],uu(un),box[3]),(g,0,0))
            for t,span,box in [(split-.219,.158,(1,252,286,348)),(split+.26,.138,(276,264,509,339))]:
                flank_decal(t,span,.42,.65,box)
            flank_decal(split-.20,.18,.092,.155,(1,352,510,414))
    # Windscreen wipers sit on the curved windscreen surface.
    for u in (-.45,.27):
        pts=[]
        for j in range(7):
            v=crown(lerp(glass[3]-.054,glass[3]-.076,j/6),u+lerp(-.26,.28,j/6))
            pts.append((v[0],v[1]+.005,v[2]+.008))
        rod(a,pts,.008,"trim")
    # Front and rear fascia parts conform to the bumper curvature, including projector optics.
    def fascia(g,coords,mat,off=.009):
        a.face([end(g,x,z,off) for x,z in coords],mat,(0,g,0),False)
    def front_garnish(g,fa,fb,qa,qb,mat,off=.012):
        a.patch(samples(fa,fb,max(2,ceil(abs(fb-fa)*10))),[qa,qb],lambda f,q:end(g,f,q,off),mat,(0,g,0))
    if model in ("e6","tang","civic"):
        front_garnish(1,-.49,.49,.70,.86,"trim")
        for q in ([.70,.85] if model=="e6" else [.71,.755,.80,.846]):
            front_garnish(1,-.48,.48,q,q+.012,"alloy",.017)
    if model in ("mifa9","mini"):
        front_garnish(1,-.82,.82,.75,.87,"trim")
        if model=="mifa9": front_garnish(1,-.79,.79,.816,.832,"lamp",.022)
    front_garnish(1,-.54,.54,.14,.30,"trim")
    for q in (.172,.217,.262): front_garnish(1,-.49,.49,q,q+.009,"brake",.018)
    if model=="tang":
        # The first European-market Tang has the tall, widening Dragon Face grille.
        for q,qn in zip(samples(.18,.81,14),samples(.18,.81,14)[1:]):
            wa=.40+.23*(q-.18)/.63; wbgr=.40+.23*(qn-.18)/.63
            for f,fn in zip(samples(-1,1,16),samples(-1,1,16)[1:]):
                fascia(1,[(f*wa,q),(fn*wa,q),(fn*wbgr,qn),(f*wbgr,qn)],"trim",.021)
        for q in samples(.21,.80,9):
            widthgr=.40+.23*(q-.18)/.63
            front_garnish(1,-widthgr,widthgr,q,q+.013,"alloy",.035)
        for g in (-1,1):
            rod(a,[end(1,g*w,q,.039) for w,q in ((.40,.18),(.49,.41),(.57,.62),(.63,.81),(.88,.86))],.014,"alloy")
    if model=="civic":
        for x in samples(-.45,.45,18):
            rod(a,[end(1,x,.737,.031),end(1,x+.027,.807,.031)],.0035,"brake",4)
    for g in (-1,1):
        if model=="mini":
            x,s,z=end(1,g*.68,.78,.024)
            pts=[(g*.50,.65),(g*.51,.88),(g*.88,.91),(g*.91,.84),(g*.88,.65)]
            fascia(1,pts,"trim",.024)
            for cf in (.615,.775):
                px,ps,pz=end(1,g*cf,.775,.03)
                ellipsoid(a,(px,ps,pz),(.050,.021,.043),"alloy",13,6)
                ellipsoid(a,(px,ps+.014,pz),(.031,.019,.025),"lamp",12,5)
            rod(a,[end(1,g*cf,q,.034) for cf,q in ((.52,.87),(.86,.888),(.877,.851),(.87,.665),(.53,.665))],.008,"lamp")
        else:
            narrow=model in ("model3","mifa9")
            bot=.78 if narrow else .68
            coords=[(g*.48,bot+.045),(g*.51,.864),(g*.87,.931),(g*.955,.92),(g*.91,bot+.007),(g*.63,bot)]
            fascia(1,coords,"trim",.019)
            rod(a,[end(1,g*f,q,.033) for f,q in ((.486,bot+.050),(.63,bot+.010),(.89,bot+.015),(.951,.91))],
                .009,"alloy")
            for f in ([.64,.78] if not narrow else [.72]):
                x,s,z=end(1,g*f,(bot+.866)/2,.034)
                ellipsoid(a,(x,s,z),(.055,.018,.039 if not narrow else .024),"alloy",15,6)
                ellipsoid(a,(x,s+.007,z),(.037,.020,.029 if not narrow else .017),"roofglass",14,5)
                ellipsoid(a,(x,s+.017,z),(.019,.014,.017 if not narrow else .01),"lamp",10,5)
            light=[end(1,g*f,q,.032) for f,q in [(.51,.837),(.64,.850),(.78,.872),(.918,.897)]]
            rod(a,light,.010,"lamp")
            rod(a,[end(1,g*.906,bot+.018,.032),end(1,g*.921,.861,.032)],.009,"amber")
            # Wrap of the lamp and shut line onto front wings.
            rod(a,[flank(g,t,.955,.005) for t in (.89,.926,.956,.975)],.009,"alloy")
        if model in ("e6","civic","mifa9","tang"):
            fascia(1,[(g*.64,.27),(g*.84,.26),(g*.86,.39),(g*.68,.38)],"trim")
            front_garnish(1,g*.67,g*.78,.317,.335,"lamp",.019)
            if model=="mifa9":
                fascia(1,[(g*.69,.34),(g*.83,.28),(g*.88,.67),(g*.72,.645)],"trim",.025)
                for q in (.40,.49,.58):
                    front_garnish(1,g*.733,g*.833,q,q+.022,"lamp",.034)
        if model=="e6":
            fascia(-1,[(g*.66,.49),(g*.88,.54),(g*.94,.925),(g*.72,.914)],"trim")
            for j,q in enumerate((.60,.71,.82)):
                x,s,z=end(-1,g*(.788+.033*j),q,.02)
                ellipsoid(a,(x,s,z),(.060,.016,.036),"tail" if j!=1 else "lamp",10,4)
        else:
            front_garnish(-1,g*.61,g*.944,.74,.874,"trim")
            rod(a,[end(-1,g*f,q,.028) for f,q in ((.61,.81),(.73,.824),(.89,.82),(.914,.747))],.016,"tail",6)
            if model=="mifa9":
                rod(a,[end(-1,g*.909,q,.032) for q in (.82,.72,.57,.43)],.021,"tail",6)
            if model=="civic":
                rod(a,[end(-1,g*f,q,.035) for f,q in ((.908,.822),(.926,.738),(.89,.696),(.751,.704))],.016,"tail",6)
    if model in ("tang","mifa9"): front_garnish(-1,-.82,.82,.813,.837,"tail",.025)
    for direction in (-1,1):
        q=.51 if direction>0 else .545
        x,s,z=end(direction,0,q,.022)
        wp=.46 if model!="civic" else .44
        corners=[(-wp/2,-.066),(wp/2,-.066),(wp/2,.066),(-wp/2,.066)]
        a.decal([(direction*px,s+direction*.01,z+zz) for px,zz in corners],(0,0,512,130),(0,direction,0))
    x,s,z=end(-1,.47,.617,.018)
    a.decal([(x-u,s-.007,z+h) for u,h in ((-.115,-.022),(.115,-.022),(.115,.022),(-.115,.022))],(2,431,253,508),(0,-1,0))
    if model!="e6":
        x,s,z=end(1,0,.764 if model in ("tang","mini","mifa9","civic") else .95,.048)
        a.decal([(u,s,z+h) for u,h in ((-.082,-.027),(.082,-.027),(.082,.027),(-.082,.027))],(265,431,509,508),(0,1,0))
    if model=="e6":
        x,s,z=end(1,0,.79,.033)
        ellipsoid(a,(x,s,z),(.088,.022,.033),"alloy")
        ellipsoid(a,(x,s+.012,z),(.066,.019,.024),"trim",12,5)
        a.decal([(u,s+.033,z+h) for u,h in ((-.064,-.019),(.064,-.019),(.064,.019),(-.064,.019))],(265,431,509,508),(0,1,0))
        z=H+.012; sf=.10*hl
        ellipsoid(a,(0,sf,z+.035),(.299,.125,.046),"trim",20,6)
        ellipsoid(a,(0,sf,z+.106),(.282,.110,.085),"white",24,8)
        for g in (-1,1):
            a.decal([(g*px,sf+g*.113,z+.11+h) for px,h in ((-.224,-.044),(.224,-.044),(.224,.044),(-.224,.044))],(1,139,511,241),(0,g,0))
    # Accessories are inside the quoted bumper-to-bumper length. Correct only the
    # terminal overhangs so axle centres, wheel openings, and the cabin stay put.
    front_extent=max(-s for x,s,z in a.vertices)
    rear_extent=max(s for x,s,z in a.vertices)
    anchor=wb/2+r+.041
    height_scale=1 if model=="e6" else H/max(z for x,s,z in a.vertices)
    def calibrate_vertex(v):
        x,y,z=v
        if abs(y)>anchor:
            observed=rear_extent if y>0 else front_extent
            y=(1 if y>0 else -1)*lerp(anchor,L/2,(abs(y)-anchor)/(observed-anchor))
        return (x,y,z*height_scale)
    a.vertices=[calibrate_vertex(v) for v in a.vertices]
    car=a.export_object("Coachwork",mats)
    car["design_reference"]=model
    car["body_dimensions_m"]=[L,W,H]
    car["wheelbase_m"]=wb
    depth=.18 if model=="mini" else .217 if mpv else .238
    for side in (-1,1):
        tire=Surface()
        wheel(tire,r,side,spokes,depth)
        name="wheel_L" if side<0 else "wheel_R"
        x=side*(hw-depth*.54-.016)
        front=tire.export_object(name+"F",mats,(x,wb/2,r))
        rear=bpy.data.objects.new(name+"R",front.data)
        bpy.context.collection.objects.link(rear)
        rear.location=(x,wb/2,r)
        front["rolling_radius"]=r
        rear["rolling_radius"]=r
    bpy.ops.export_scene.gltf(filepath=str(OUT/(model+".glb")),export_format="GLB",export_yup=True,
            export_extras=True,export_animations=False,export_cameras=False,export_lights=False,
            export_texcoords=True,export_normals=True)
    print("WROTE",model, (OUT/(model+".glb")).stat().st_size)

if __name__ == "__main__":
    # Other production cars now come from licensed meshes.
    build("e6", SPECS["e6"])
