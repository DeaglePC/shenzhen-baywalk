"""Second-generation Shenzhen Bus Group / Pengcheng e6. Metre-scale Blender authoring.

    blender -b -P scripts/e6_pengcheng.py -- <decal-directory> [--pack]

The side elevations were traced from BYD's new-e6 dimension drawing. Body and lens
stations are corrected against the near-side three-quarter user photograph. Model
coordinates are right, forward, up; Blender uses (x,-forward,z). All four wheels
have independent axle-centred objects. Use --draft for a shell-only working GLB.
"""
from math import sin, cos, pi, asin, exp, hypot, sqrt
from pathlib import Path
from types import SimpleNamespace
import sys, subprocess, shutil, os
import bpy
from mathutils import Vector
sys.path.insert(0,str(Path(__file__).resolve().parent))
from vehicle_build import Surface, material, rod, ellipsoid, samples, lerp

ROOT=Path(__file__).resolve().parents[1]
ATLAS=Path(sys.argv[sys.argv.index("--")+1]).resolve()
DRAFT="--draft" in sys.argv
PACK="--pack" in sys.argv
FRONT_AXLE,REAR_AXLE=1.400,-1.400
SIDE_FRONT,SIDE_REAR=1.776,-1.990
L,W,H=4.695,1.810,1.670
R=.325
def clamp(x,lo=0,hi=1):return max(lo,min(x,hi))
def bell(x,w):return exp(-(x/w)**2)
def plus(v,d):return tuple(a+b for a,b in zip(v,d))
def path(seq,u):
    """Monotone cubic profile: horizontal tangencies at traced silhouette extrema."""
    if u<=seq[0][0]:return seq[0][1]
    if u>=seq[-1][0]:return seq[-1][1]
    def sec(i):
        x,a=seq[i];y,b=seq[i+1];return (b-a)/(y-x)
    def tan(i):
        if i==0:return sec(0)
        if i==len(seq)-1:return sec(i-1)
        a,b=sec(i-1),sec(i)
        return 2*a*b/(a+b) if a*b>0 else 0
    for i,((a,x),(b,y)) in enumerate(zip(seq,seq[1:])):
        if u<=b:
            t=(u-a)/(b-a);t2=t*t;t3=t*t2
            return (2*t3-3*t2+1)*x+(t3-2*t2+t)*(b-a)*tan(i)+(-2*t3+3*t2)*y+(t3-t2)*(b-a)*tan(i+1)

def waist(s):
    return path([(-2.12,1.183),(-1.88,1.175),(-1.56,1.160),(-1.05,1.146),
                 (-.65,1.111),(-.08,1.077),(.48,1.045),(.94,1.014),
                 (1.20,.987),(1.42,.946),(1.60,.883),(1.776,.842)],s)
def sill(s):
    return .194+.016*bell(s-.08,1.14)+.040*bell(s+2.11,.31)+.026*bell(s-1.87,.22)
def arch(s):
    d=min(abs(s-FRONT_AXLE),abs(s-REAR_AXLE));rad=.366
    if d>=rad+.023:return sill(s)
    if d>rad:return lerp(R,sill(s),(d-rad)/.023)
    return R+sqrt(max(0,rad**2-d*d))
def side_width(s,h):
    n=clamp((h-sill(s))/(waist(s)-sill(s)))
    w=path([(-2.12,.833),(-1.99,.855),(-1.68,.890),(-1.40,.893),(-1.0,.884),
            (-.38,.882),(.36,.882),(.97,.886),(1.40,.897),(1.64,.883),(1.776,.857)],s)
    # Tangent-continuous barrel; stamped protection crease stays level through both doors.
    roll=path([(0,-.036),(.055,-.019),(.13,-.016),(.205,-.011),(.249,-.003),
               (.275,-.003),(.366,-.011),(.52,-.013),(.72,-.004),(.85,.004),
               (.91,.006),(1,-.030)],n)
    a=min((FRONT_AXLE,REAR_AXLE),key=lambda p:abs(s-p))
    swelling=.022*bell(hypot(s-a,h-R)-.413,.056)*clamp((h-.21)/.16)
    # Concave hand clearance is pressed into the door behind each flush pull.
    pocket=sum(.020*bell(s-st,.093)*bell(h-zh,.040) for st,zh in [(-.947,.945),(.163,.895)])
    return min(W/2,w+roll+swelling-pocket)
def flank(g,s,h,out=0):return (g*(side_width(s,h)+out),s,h)

def front_top(x):
    return path([(0,.710),(.32,.715),(.55,.740),(.70,.780),(.806,.821),
                 (side_width(SIDE_FRONT,waist(SIDE_FRONT)),waist(SIDE_FRONT))],abs(x))
def rear_top(x):
    return lerp(1.189,waist(SIDE_REAR),(clamp(abs(x)/.841))**2)
def front_floor(u):
    return path([(0,.245),(.43,.254),(.90,.235),(1,sill(SIDE_FRONT))],abs(u))
def cap(k,u,h,out=0):
    endpoint=SIDE_FRONT if k>0 else SIDE_REAR
    a=clamp(abs(u))*pi/2; side=1 if u>=0 else -1; frac=sin(a)
    w=side_width(endpoint,h)
    if k>0:
        centre=path([(.14,2.267),(.2,2.320),(.245,2.337),(.255,2.340),(.282,2.300),
             (.425,2.239),(.530,2.237),(.640,2.237),(.712,2.236),(.87,2.225)],h)
    else:
        centre=path([(.15,-2.225),(.24,-2.31),(.35,-2.343),(.47,-2.332),(.69,-2.288),
                     (.88,-2.264),(1.02,-2.249),(1.190,-2.200)],h)
    exponent=path([(.245,1.90),(.425,3.75),(.54,3.25),(.71,2.15),(.85,2.15)],h) if k>0 else 4.65
    s=endpoint+(centre-endpoint)*max(0,1-frac**exponent)**.60
    return (side*(w*frac+out*sin(a)),s+k*out*cos(a),h)
def front(x,h,out=0):
    a=clamp(abs(x)/side_width(SIDE_FRONT,h))
    return cap(1,(1 if x>=0 else -1)*asin(a)*2/pi,h,out)
def rear(x,h,out=0):
    a=clamp(abs(x)/side_width(SIDE_REAR,h))
    return cap(-1,(1 if x>=0 else -1)*asin(a)*2/pi,h,out)

# Roof skin is below the rated height at the rear antenna tip.
EDGE_REAR,EDGE_FRONT=-2.034,1.211
ROOF=[(EDGE_REAR,1.180),(-1.91,1.333),(-1.69,1.546),(-1.50,1.577),(-1.13,1.587),
      (-.65,1.590),(-.22,1.582),(.031,1.573),(.22,1.536),(.46,1.437),
      (.72,1.303),(.98,1.147),(1.13,1.065),(EDGE_FRONT,1.028)]
def roof_shape(s):return path(ROOF,s)
def cab(g,s,q):
    lo=waist(s);space=max(0,roof_shape(s)-lo)
    edge=roof_shape(s)-min(.103,space*.21)
    x=side_width(s,lo)-min(.139,.285*space)*q**1.30+.004*sin(pi*q)
    return (g*x,s,lerp(lo,edge,q))
def sideglass(g,s,h,out=0):
    low=cab(g,s,0)[2];high=cab(g,s,1)[2];q=clamp((h-low)/max(.008,high-low))
    return plus(cab(g,s,q),(g*out,0,0))
def roof(s,f):
    edge=cab(1,s,1);zh=roof_shape(s)
    # A stock windshield is bowed in both axes; the edges remain on the A pillar.
    bow=path([(-2.04,-.118),(-1.69,-.049),(-1.4,-.011),(-.07,.0),(.19,.022),(.72,.077),(1.22,.093)],s)
    return (f*edge[0],s+bow*(1-f*f),lerp(zh,edge[2],f*f))

bpy.ops.wm.read_factory_settings(use_empty=True)
def m(name,color,metal=0,rough=.42,emission=0,coat=0):
    return material(name,color,metal,rough,emission,coat)
mats={
    "blue":m("Ocean Blue clearcoat","#3785C8",.59,.205,coat=.97),
    "white":m("Pearl White clearcoat","#E3E6DF",.22,.295,coat=.93),
    "navy":m("Pengcheng midnight blue pinstripe","#163C6A",.30,.27,coat=.91),
    "black":m("Satin graphite trim","#1A1F21",.10,.39),
    "seal":m("Window and door weatherstrip","#242728",.015,.72),
    "chrome":m("Electroplated polished metal","#CCD3D3",.92,.15),
    "alloy":m("Machined aluminium","#CFD0CA",.53,.287),
    "alloyFacet":m("Satin machined spoke bevel","#90999C",.64,.30),
    "cast":m("Cast alloy return","#686F73",.70,.36),
    "rubber":m("Tyre sidewall","#202322",.01,.80),
    "tread":m("Tyre shoulder and tread","#292B29",.012,.86),
    "wheelwell":m("Wheel housing felt","#181918",.01,.94),
    "rotor":m("Brake disc and hubs","#666B6C",.77,.39),
    "lens":m("Optic clear lens","#CEDBDE",.045,.11,coat=.80),
    "glass":m("Laminated windscreen","#435263",.46,.073,coat=.74),
    "glassSide":m("Front door solar glass","#364454",.40,.09,coat=.76),
    "glassBack":m("Privacy glass","#222C37",.37,.103,coat=.76),
    "blackGlass":m("Gloss black window frit","#152022",.30,.14,coat=.60),
    "garnet":m("Garnet lens","#AB2028",.36,.22,.11,coat=.72),
    "amber":m("Amber signal optics","#BD783E",.28,.23,.13,coat=.64),
    "lamp":m("Headlight source","#E5EDF1",.30,.15,.45),
    "mark":m("Enamel markings","#F2F3EA",.06,.46),
    "leather":m("Graphite leather seats","#252A2B",.01,.62),
    "dash":m("Instrument cowl","#262B2B",.025,.73),
    "stitch":m("Charcoal seam thread","#4C5150",.02,.79),
}
for key,op in [("lens",.16),("glass",.77),("glassSide",.82),("glassBack",.92)]:
    mats[key].node_tree.nodes.get("Principled BSDF").inputs["Alpha"].default_value=op
for key in ("blue","white","navy"):
    mats[key].node_tree.nodes.get("Principled BSDF").inputs["Coat Roughness"].default_value=.065 if key=="blue" else .112

class Car:
    def __init__(self):
        self.atlas=ATLAS;self.root=ROOT;self.mats=mats;self.parts=[]
        self.active="01 Body pressings"
        self.front=front;self.rear=rear;self.cap=cap;self.flank=flank
        self.front_top=front_top;self.rear_top=rear_top;self.front_floor=front_floor
        self.roof=roof;self.sideglass=sideglass
    def part(self,name):
        data=Surface();self.parts.append((name,data,self.active));return data
ctx=Car()
def tube(body,points,r,mat,n=7):rod(body,points,r,mat,n)
def rb(body,c,extent,mat,p=.38,n=24):
    def sp(a):return (1 if a>=0 else -1)*abs(a)**p
    def at(a,b):
        rel=(sp(cos(b))*sp(cos(a)),sp(cos(b))*sp(sin(a)),sp(sin(b)))
        return tuple(x+y*z for x,y,z in zip(c,extent,rel))
    U=samples(0,2*pi,n);V=samples(-pi/2+.0001,pi/2-.0001,12)
    for u,U1 in zip(U,U[1:]):
        for v,V1 in zip(V,V[1:]):
            pts=[at(u,v),at(U1,v),at(U1,V1),at(u,V1)]
            body.face(pts,mat,Vector(pts[0])-Vector(c))
def seam(key,q):
    return path({
        "rear":[(0,SIDE_REAR),(1,SIDE_REAR)],
        "C":[(0,-.912),(.24,-1.019),(.52,-1.193),(.79,-1.228),(1,-1.209)],
        "B":joint_stations["B"],
        "front":joint_stations["front"],
        "nose":[(0,SIDE_FRONT),(1,SIDE_FRONT)]
    }[key],q)
def upper_navy(s):return waist(s)-path([(-2.0,.089),(-1.15,.082),(-.1,.075),(.85,.067),(1.4,.066),(1.78,.051)],s)
def lower_navy(s):return upper_navy(s)-path([(-2.0,.041),(-1.15,.055),(-.1,.067),(.85,.069),(1.30,.051),(1.53,.023),(1.66,0),(1.78,0)],s)
def rocker(s):return .277+.015*bell(s+.35,1.2)+.007*s
def panel_level(s,q):
    low=arch(s);hi=waist(s)
    heights=[(0,low),(.14,clamp(rocker(s)-.047,low,hi)),(.21,clamp(rocker(s),low,hi)),
             (.77,clamp(lower_navy(s),low,hi)),(.89,clamp(upper_navy(s),low,hi)),(1,hi)]
    for (a,x),(b,y) in zip(heights,heights[1:]):
        if q<=b:return lerp(x,y,(q-a)/(b-a))
    return hi
def livery(t,q):
    if q<.14:return "blue"
    if q<.21:return "navy"
    if q<.77:return "white"
    return "navy" if q<.89 else "blue"

# Recover station from the photographed door edges at each elevation. Each stamp
# is symmetric. The calibrated near-side image fixes its compound curvature once.
joint_stations={}
eye=Vector((-2.5788662624,1.0464488847,3.5991239907))
view=Vector((.65585499745,-.03416016,-.75411359))
right=view.cross(Vector((.0348419642,.999280804,-.0149636868))).normalized()
for key,trace,initial in [
    ("front",[(.18,588),(.26,583),(.42,579),(.64,577),(.86,579),(1.03,587)],.93),
    ("B",[(.18,369),(.28,370),(.47,368),(.72,368),(.90,370),(1.08,381)],.0)]:
    fit=[]
    for q in samples(0,1,24):
        s=initial
        for iteration in range(6):
            h=panel_level(s,q)
            normal=right-view*((path(trace,h)-800)/1498.46)
            s=(eye.dot(normal)+normal.x*side_width(s,h)-normal.y*h)/normal.z
        fit.append((q,s))
    joint_stations[key]=fit

for g,side in [(-1,"LH"),(1,"RH")]:
    edges=["rear","C","B","front","nose"]
    for i,name in enumerate(["Quarter panel","Rear door","Front door","Front fender"]):
        body=ctx.part(side+" "+name)
        left,right=edges[i:i+2];lo,hi=seam(left,.5),seam(right,.5)
        ts=set(samples(0,1,max(20,round((hi-lo)*39)))+[.002,.006,.015,.986,.994,.998])
        for ax in (FRONT_AXLE,REAR_AXLE):
            for a in samples(0,pi,77):
                t=(ax+.366*cos(a)-lo)/(hi-lo)
                if 0<t<1:ts.add(t)
            for d in (-.390,.390):
                t=(ax+d-lo)/(hi-lo)
                if 0<t<1:ts.add(t)
        def sheet(t,q):
            l=seam(left,q)+(.0016 if i else 0);r=seam(right,q)-(.0016 if i<3 else 0)
            s=lerp(l,r,t);h=panel_level(s,q)
            hem=(.0065*bell(s-l,.007) if i else 0)+(.0065*bell(r-s,.007) if i<3 else 0)
            return flank(g,s,h,-hem)
        body.patch(sorted(ts),sorted(set(samples(0,1,51)+[.14,.21,.77,.89])),sheet,livery,(g,0,0))
    joins=ctx.part(side+" door shuts and outer flanges")
    for key in ["C","B","front"]:
        tube(joins,[flank(g,seam(key,q),panel_level(seam(key,q),q),-.0055) for q in samples(0,1,70)],.0030,"seal")
    for axle in (FRONT_AXLE,REAR_AXLE):
        def inner(a,d):
            s=axle+.366*cos(a);h=R+.366*sin(a)
            return flank(g,s,h,-d)
        joins.patch(samples(0,pi,66),[0,.009,.041,.120,.256],inner,
              lambda a,d:"white" if d<.009 else "wheelwell",(0,0,-1))
        joins.patch(samples(0,pi,55),[.002,.21,.39,.42],
              lambda a,v:(g*.62,axle+v*cos(a),R+v*sin(a)),"wheelwell",(g,0,0))
    tube(joins,[flank(g,s,.239+.006*s,.003) for s in samples(-.995,.997,51)],.0050,"blue")
    # Body-colour horizontal door handles and their recessed pockets.
    handles=ctx.part(side+" paint-matched pull handles")
    for s,h in [(-.947,.945),(.163,.895)]:
        p=flank(g,s,h,.003)
        ellipsoid(handles,p,(.007,.094,.036),"seal",27,9)
        ellipsoid(handles,plus(p,(g*.002,0,-.004)),(.008,.088,.029),"white",27,9)
        pts=[flank(g,s+d,h+.009,.015+.010*cos(d/.089*pi/2)) for d in samples(-.089,.089,19)]
        tube(handles,pts,.011,"white",10)
        tube(handles,[flank(g,s+d,h+.014,.022+.010*cos(d/.089*pi/2)) for d in samples(-.075,.078,16)],.0023,"chrome")
    if g==-1:
        s0,h0=-1.770,.887
        ref=[]
        for a in samples(0,2*pi,60):
            f=lambda v:(1 if v>=0 else -1)*abs(v)**.48
            ss=s0+.109*f(cos(a));hh=h0+.093*f(sin(a))
            ref.append(flank(g,ss,hh,.0015))
        tube(joins,ref,.0025,"seal",6)

# Genuine geometric front and rear wrap, with registered trim and optics on the same surface.
for k,label in [(1,"Front bumper understructure"),(-1,"Tailgate and rear bumper")]:
    body=ctx.part(label)
    for g in (-1,1):
        def skin(u,q):
            high=waist(SIDE_FRONT if k>0 else SIDE_REAR)
            for i in range(5):
                x=side_width(SIDE_FRONT if k>0 else SIDE_REAR,high)*sin(u*pi/2)
                high=front_top(x) if k>0 else rear_top(x)
            low=front_floor(u) if k>0 else lerp(.230,sill(SIDE_REAR),sin(u*pi/2)**2)
            return cap(k,g*u,lerp(low,high,q))
        body.patch(samples(0,1,58),sorted(set(samples(0,1,34)+[.062,.150,.920,.966])),skin,
          (lambda u,q:"white" if q<.965 else "blue") if k==1 else
          (lambda u,q:"blue" if q<.15 or q>.92 else "white"),(g*.50,k,.01))

# Blue bonnet and fender returns. Transverse ribs taper into the rising fender crown.
def hood(g,u,t):
    high=waist(SIDE_FRONT)
    for i in range(5):high=front_top(side_width(SIDE_FRONT,high)*sin(u*pi/2))
    forward=cap(1,g*u,high)
    back=roof(EDGE_FRONT,g*sin(u*pi/2))
    if u>.999999:
        s=lerp(EDGE_FRONT,SIDE_FRONT,t)
        return flank(g,s,waist(s))
    s=lerp(back[1],forward[1],t)
    x=lerp(back[0],forward[0],t)
    centre=lerp(back[2],forward[2],t)+.021*sin(pi*t)
    span=sin(u*pi/2)
    h=lerp(centre,waist(s),span**8*sin(pi*t))
    h+=.016*bell(u-.586,.096)*sin(pi*t)
    return (x,s,h)
for g,side in [(-1,"LH"),(1,"RH")]:
    body=ctx.part(side+" bonnet stamping and bonnet shutline")
    body.patch(samples(0,1,52),samples(0,1,49),lambda u,v:hood(g,u,v),"blue",(0,.20,1))
    tube(body,[plus(hood(g,.693,t),(0,0,.001)) for t in samples(.027,.997,54)],.0025,"seal")
    tube(body,[plus(hood(g,u,.997),(0,0,.001)) for u in samples(0,1,39)],.0021,"black")

ctx.active="02 Safety glass and roof"
def sash(key,q):
    # Real DLO shape, including the fixed front quarterlight, slanted B/C pillars and the D-pillar sail.
    return {
        "rear":lerp(-1.983,-1.704,q),
        "C":lerp(-1.125,-.997,q),
        "B":lerp(.015,-.102,q),
        "triangle":lerp(.881,.734,q),
        "A":lerp(1.170,1.124,q)
    }[key]
for g,side in [(-1,"LH"),(1,"RH")]:
    windows=ctx.part(side+" side window panes and ceramic frit")
    edges=["rear","C","B","triangle","A"]
    for i,(le,ri) in enumerate(zip(edges,edges[1:])):
        def pane(t,q):
            return cab(g,lerp(sash(le,q),sash(ri,q),t),q)
        U=sorted(set(samples(0,1,32)+[.022,.053,.087,.92,.958,.983]))
        Q=sorted(set(samples(0,1,25)+[.029,.048,.071,.878,.917,.950,.973]))
        def panemat(t,q):
            if q<.029:return "blue"
            if q<.048:return "chrome"
            if q<.071 or q>.95:return "seal"
            if t<.053 or t>.958 or q>.917:return "blackGlass"
            if i==0 and (t<.19 or (q<.18 and t<.34)):return "blackGlass"
            return "glassBack" if i<2 else "glassSide"
        windows.patch(U,Q,pane,panemat,(g,0,.16))
    trim=ctx.part(side+" A pillar, D sail and bright window surrounds")
    for key,end in [("rear",EDGE_REAR),("A",EDGE_FRONT)]:
        trim.patch(samples(0,1,17),samples(0,1,27),lambda t,q:cab(g,lerp(end,sash(key,q),t),q),
                   "blackGlass" if key=="rear" else "blue",(g,0,.22))
    for name in ("C","B","triangle"):
        tube(trim,[plus(cab(g,sash(name,q),q),(g*.002,0,0)) for q in samples(.064,.93,30)],.0048,"seal")
    tube(trim,[plus(cab(g,s,.953),(g*.002,0,.001)) for s in samples(-1.66,1.165,82)],.005,"chrome",9)
    tube(trim,[plus(cab(g,s,.049),(g*.002,0,.001)) for s in samples(-1.985,1.15,72)],.0041,"chrome",9)

# Laminated front screen, separate backlight and a deeply crowned aluminium roof.
glassA,glassB=.134,1.180
rearA,rearB=-2.006,-1.673
stations=sorted(set(samples(EDGE_REAR,EDGE_FRONT,128)+[p[0] for p in ROOF]+
                    [glassA,glassA+.023,glassB-.025,glassB,rearA,rearA+.019,rearB-.019,rearB]))
for region,a,b in [("Tailgate backlight",EDGE_REAR,rearB),("Roof skin",rearB,glassA),("Front windscreen",glassA,EDGE_FRONT)]:
    part=ctx.part(region)
    ss=[s for s in stations if a<=s<=b]
    def roofmat(s,f):
        fr=glassA<s<glassB;back=rearA<s<rearB
        if not(fr or back):return "blue"
        if abs(f)>.943:return "blue"
        if abs(f)>.875 or (fr and min(s-glassA,glassB-s)<.024) or (back and min(s-rearA,rearB-s)<.018):
            return "blackGlass"
        return "glass" if fr else "glassBack"
    part.patch(ss,sorted(set(samples(-1,1,46)+[-.943,-.875,.875,.943])),roof,roofmat,(0,0,1))
rooftrim=ctx.part("Roof channels, antenna and rear spoiler")
for g in (-1,1):
    tube(rooftrim,[plus(roof(s,g*.88),(0,0,.002)) for s in samples(-1.678,.141,56)],.0055,"seal")
    rooftrim.patch(samples(0,1,23),samples(0,1,14),
       lambda u,v:plus(roof(lerp(-1.746,-1.606,v),g*u),(0,-.022*(1-v),.008+.013*(1-v))),"blue",(0,0,1))
    tube(rooftrim,[plus(roof(-1.742,g*u),(0,-.023,.016)) for u in samples(.0,.92,27)],.006,"black")
tube(rooftrim,[plus(roof(-1.742,f),(0,-.026,.014)) for f in samples(-.38,.38,30)],.006,"garnet")
# Roof aerial sets the factory vehicle height above the unladen main roof.
ant=roof(-1.30,0)
rb(rooftrim,plus(ant,(0,0,.013)),(.028,.071,.014),"black",.48)
tube(rooftrim,[plus(ant,(0,-.027,.024)),(0,-1.426,H-.00267)],.0033,"black",9)
heat=ctx.part("Heated rear screen filaments and wiper mechanisms")
for i in range(10):
    s=lerp(-1.975,-1.699,i/9)
    tube(heat,[plus(roof(s,f),(0,-.0008,.0005)) for f in samples(-.856,.856,25)],.00077,"cast",4)
heat.patch(samples(0,1,12),samples(-.887,.887,52),
           lambda u,f:plus(roof(lerp(1.148+.014*f*f,1.209,u),f),(0,.001,.0018)),
           "seal",(0,.5,1))
for s,lo,hi in [(1.165,-.844,-.052),(1.172,-.088,.822)]:
    def blades(t):return plus(roof(s-.006*sin(pi*t),lerp(lo,hi,t)),(0,.002,.0053))
    tube(heat,[blades(t) for t in samples(0,1,29)],.0044,"black",7)
    tube(heat,[plus(roof(1.200,lo+.13),(0,.002,.0045)),blades(.40)],.0047,"seal")
tube(heat,[plus(roof(-1.96,f),(0,-.006,.003)) for f in samples(-.28,.62,29)],.007,"black")
# Rear beltline sheet closes the gap between the arched glass and the vertical liftgate.
hatch=ctx.part("Tailgate upper shoulder")
for g in (-1,1):
    def hatch_surface(t,u):
        a=roof(EDGE_REAR,g*sin(u*pi/2))
        h=rear_top(side_width(SIDE_REAR,waist(SIDE_REAR))*sin(u*pi/2))
        b=cap(-1,g*u,h)
        return tuple(lerp(x,y,t) for x,y in zip(a,b))
    hatch.patch(samples(0,1,14),samples(0,1,36),hatch_surface,"blue",(0,-.46,1))

ctx.active="03 Exterior fittings"
for g,side in [(-1,"LH"),(1,"RH")]:
    mirror=ctx.part(side+" mirror housing, black sail and turn repeater")
    # A single black swan-neck gasket grows out of the painted door boss. The
    # elliptical section broadens into the underside of the shell without a hinge cube.
    foot=flank(g,.961,.949,-.005)
    def mount(t,a):
        x=path([(0,abs(foot[0])),(.20,.906),(.61,.941),(1,.964)],t)
        s=path([(0,.961),(.32,.923),(.70,.866),(1,.835)],t)
        h=path([(0,.946),(.25,.969),(.70,1.024),(1,1.062)],t)
        width=path([(0,.053),(.28,.049),(.63,.060),(1,.089)],t)
        depth=path([(0,.026),(.20,.023),(.76,.021),(1,.032)],t)
        return (g*(x+depth*.74*cos(a)),s+width*sin(a),h-depth*.67*cos(a))
    def ring_surface(fn,ts,angles,finish,orientation):
        for t,q in zip(ts,ts[1:]):
            for a,b in zip(angles,angles[1:]):
                tm=(t+q)/2;am=(a+b)/2
                mirror.face([fn(t,a),fn(q,a),fn(q,b),fn(t,b)],finish(tm,am),orientation(tm,am))
    ring_surface(mount,samples(0,1,22),samples(0,2*pi,46),
                 lambda t,a:"blue" if t>.40 and sin(a)*.65-cos(a)*.75>lerp(.77,-.01,t) else "black",
                 lambda t,a:(g*.74*cos(a),sin(a),-.67*cos(a)))
    cx=.956;cs=.865;ch=1.089
    def mirror_shell(t,a):
        shape=path([(-1,.77),(-.84,.919),(-.42,1),(-.14,1.023),(.33,.932),(.74,.64),(.95,.29),(1,.012)],t)
        x=g*(cx+.112*shape*cos(a)-.013*t)
        h=ch+.064*shape*sin(a)+.010*t+.009*cos(a)
        return (x,cs+.110*t-.017*shape*cos(a),h)
    def mirror_mat(t,a):
        if t<-.90 or sin(a)<-.60:return "black"
        if cos(a)>.19 and -.12<sin(a)<.025 and -.88<t<.82:return "seal"
        return "blue"
    ring_surface(mirror_shell,samples(-1,1,27),samples(0,2*pi,68),mirror_mat,
                 lambda t,a:(g*cos(a),t*.65,sin(a)))
    def mirror_glass(a,u):
        rim=mirror_shell(-1,a)
        return (lerp(g*(cx+.013),rim[0],u),lerp(cs-.112,rim[1],u),lerp(ch-.01,rim[2],u))
    mirror.patch(samples(0,2*pi,60),[.0001,.56,.87,.93,1],mirror_glass,
                 lambda a,u:"chrome" if u<.93 else "seal",(0,-1,0))
    tube(mirror,[mirror_shell(t,-.065) for t in samples(-.61,.62,24)],.0029,"lens",7)

ctx.active="04 Cabin"
under=ctx.part("Pressed undertray, inner rocker and sill shadow")
rb(under,(0,-.03,.255),(.738,1.83,.110),"wheelwell",.43,27)
instrument=ctx.part("Dashboard, cowl, vents and centre display")
rb(instrument,(0,.925,.845),(.775,.238,.099),"dash",.38,28)
rb(instrument,(-.369,.697,.932),(.159,.101,.061),"black",.52,25)
rb(instrument,(0,.737,.973),(.144,.029,.091),"black",.22,24)
rb(instrument,(0,.710,.974),(.132,.004,.079),"blackGlass",.24,24)
for x in (-.625,-.119,.122,.631):
    rb(instrument,(x,.731,.864),(.074,.012,.019),"black",.24)
    for dz in (-.009,-.001,.007):
        tube(instrument,[(x-.061,.717,.864+dz),(x+.061,.717,.864+dz)],.0021,"cast",5)
steer=ctx.part("Left-hand drive steering wheel and stalks")
ring=[(-.380+.151*cos(a),.588-.075*sin(a),.927+.131*sin(a)) for a in samples(0,2*pi,62)]
tube(steer,ring,.016,"leather",12)
rb(steer,(-.380,.590,.923),(.075,.037,.038),"leather")
for i in (1,30,45):tube(steer,[(-.380,.590,.919),ring[i]],.017,"alloy",9)
tube(steer,[(-.420,.677,.919),(-.548,.640,.934)],.009,"black")
seats=ctx.part("Front bucket seats, head restraints and rear bench")
for g in (-1,1):
    x=g*.389
    rb(seats,(x,.018,.537),(.222,.215,.068),"leather",.53,30)
    rb(seats,(x,-.155,.817),(.208,.085,.258),"leather",.64,31)
    for sx in (-1,1):
        rb(seats,(x+sx*.171,-.102,.839),(.062,.061,.192),"leather",.61)
        tube(seats,[(x+sx*.117,-.067,.666),(x+sx*.135,-.061,.847),(x+sx*.113,-.084,1.003)],.0022,"stitch",5)
        tube(seats,[(x+sx*.053,-.162,1.066),(x+sx*.053,-.168,1.146)],.008,"chrome")
    rb(seats,(x,-.178,1.168),(.113,.069,.082),"leather",.54,28)
    rb(seats,(x,-1.017,.813),(.249,.093,.25),"leather",.57)
    rb(seats,(x,-1.068,1.123),(.122,.066,.068),"leather",.56)
    for st in (-.531,.422):
        rb(seats,(g*.777,st,.702),(.052,.349,.153),"dash")
        rb(seats,(g*.728,st,.741),(.060,.218,.037),"leather")
rearview=ctx.part("Interior mirror and rain sensor")
rb(rearview,(0,.411,1.275),(.105,.022,.034),"black",.50)
tube(rearview,[(0,.455,1.390),(0,.415,1.293)],.008,"black",8)

def road_wheel(g):
    """215/55 R17, cast silver split spokes, machined lip and five lug bores."""
    w=Surface()
    def point(d,rr,a):
        z=rr*sin(a)
        # The road contact patch carries the nominal radial tyre's static deflection.
        if rr>.314 and z < -.318:z=max(-R,-.318+(z+.318)*.54)
        return (g*d,rr*cos(a),z)
    T=samples(0,2*pi,88)
    def lathe(section,mat):
        for (d,r),(e,rr) in zip(section,section[1:]):
            for a,b in zip(T,T[1:]):
                mid=(a+b)*.5
                w.face([point(d,r,a),point(d,r,b),point(e,rr,b),point(e,rr,a)],mat,
                       (g*(r-rr),(e-d)*cos(mid),(e-d)*sin(mid)))
    section=[(-.098,.213),(-.107,.245),(-.109,.277),(-.105,.302),(-.097,.320),
             (-.083,.330),(-.067,.334),(-.053,.334),(-.050,.330),(-.045,.330),(-.042,.334),
             (-.018,.334),(-.015,.329),(-.011,.329),(-.009,.334),(.014,.334),(.018,.329),
             (.023,.329),(.026,.334),(.051,.334),(.054,.330),(.060,.330),(.064,.334),
             (.076,.332),(.089,.327),(.098,.317),(.104,.301),(.108,.279),(.109,.254),
             (.107,.237),(.101,.216)]
    lathe(section,"rubber")
    for r,d in [(.234,.108),(.250,.110),(.284,.109),(.309,.103)]:
        lathe([(d,r+.0009),(d+.0009,r),(d,r-.0009)],"tread")
    for j in range(74):
        a=2*pi*j/74
        for side in (-1,1):
            tube(w,[point(side*d,rr,a+.034*(d/.103)) for d,rr in
                    ((.023,.3343),(.046,.3345),(.073,.3336),(.090,.3265),(.101,.3135))],
                 .0016,"tread",4)
    lathe([(.083,.217),(.098,.220),(.108,.217),(.109,.212),(.105,.206),(.097,.198)],"alloy")
    lathe([(.097,.205),(.067,.199),(.025,.189),(.022,.064)],"cast")
    lathe([(.059,.159),(.065,.162),(.067,.159),(.067,.071),(.073,.070),(.074,.027)],"rotor")
    for r in (.130,.143):
        lathe([(.068,r+.00055),(.068,r-.00055)],"cast")
    ellipsoid(w,(g*.073,-.123,.026),(.023,.035,.060),"cast",18,9)
    for j in range(5):
        angle=j*2*pi/5+.15
        # Ten die-cast blades share a broad root in pairs. The split machining
        # plane breaks the reflection along each branch as on the stock alloy.
        for branch in (-1,1):
            def ray(t,v,d):
                rr=lerp(.053,.213,t)
                sweep=branch*path([(0,.138),(.18,.19),(.36,.226),(.63,.255),(1,.293)],t)+.025*sin(pi*t)
                half=path([(0,.315),(.17,.251),(.44,.192),(.74,.148),(1,.148)],t)*(1+.035*branch)
                bevel=path([(-1,-.007),(-.78,-.001),(.15,.006),(.78,.0030),(1,-.004)],v*branch)
                face=path([(0,.099),(.22,.085),(.52,.084),(.8,.101),(1,.108)],t)
                height=face+bevel*sin(pi*t)**.65
                return point(height+d,rr,angle+sweep+v*half)
            w.patch(samples(0,1,20),[-1,-.78,-.69,-.15,.15,.69,.78,1],lambda t,v:ray(t,v,0),
                    lambda t,v:"alloyFacet" if v*branch<-.64 or v*branch>.85 else "alloy",(g,0,0))
            for v in (-1,1):
                for t,tt in zip(samples(0,1,16),samples(0,1,16)[1:]):
                    w.face([ray(t,v,0),ray(tt,v,0),ray(tt,v,-.019),ray(t,v,-.019)],"cast",
                           (g,-v*sin(angle),v*cos(angle)))
    def hub(t,a):
        outer=.085+.012*cos(5*(a-.15))
        d=path([(0,.107),(.38,.104),(.65,.101),(.81,.094),(1,.083)],t)
        return point(d,max(.0001,outer*t),a)
    w.patch(samples(0,1,21),T,hub,"alloy",(g,0,0))
    lathe([(.103,.034),(.107,.032),(.108,.001)],"alloy")
    lathe([(.107,.0336),(.107,.0321)],"cast")
    # Cast circular hub cover with a shallow oval and embossed BYD strokes.
    def stamp(p):return (g*.1086,g*p[0],p[1])
    tube(w,[stamp((.023*cos(a),.010*sin(a))) for a in samples(0,2*pi,47)],.00072,"alloyFacet",5)
    glyphs=[
        [(-.015,-.0045),(-.015,.0045),(-.010,.0045),(-.008,.002),(-.010,0),(-.015,0)],
        [(-.010,0),(-.0078,-.002),(-.0098,-.0045),(-.015,-.0045)],
        [(-.0055,.0045),(-.002,0),(.002,.0045)],[(-.002,0),(-.002,-.0045)],
        [(.005,-.0045),(.005,.0045),(.010,.0045),(.014,.002),(.014,-.002),(.010,-.0045),(.005,-.0045)]]
    for stroke in glyphs:tube(w,[stamp(v) for v in stroke],.00072,"alloyFacet",5)
    for j in range(5):
        a=j*2*pi/5+.760
        def bolt(d,r,n):
            return [(g*d,.050*cos(a)+r*cos(2*pi*i/n),.050*sin(a)+r*sin(2*pi*i/n)) for i in range(n)]
        w.face(bolt(.104,.0137,18),"black",(g,0,0))
        p,q=bolt(.104,.0086,6),bolt(.1054,.0082,6)
        for k in range(6):
            z=(k+1)%6
            w.face([p[k],p[z],q[z],q[k]],"cast",(g,cos(k*pi/3),sin(k*pi/3)))
        w.face(q,"alloyFacet",(g,0,0),False)
    return w

if not DRAFT:
    from e6_pengcheng_sign import build_livery
    from e6_optics import build_optics
    ctx.active="05 Pengcheng livery and roof lamp";build_livery(ctx)
    ctx.active="06 Headlights, dragon face and tail optics";build_optics(ctx)

# The back of the passenger compartment is swept inwards in plan. Apply the
# measured rear corner section to joined components in one coordinate frame,
# including the lamp that wraps continuously across the shoulder and liftgate.
def stamped_section(p):
    x,y,h=p;s=-y
    if s< -1.10 and h>.84:
        influence=path([(-2.36,1),(-1.84,1),(-1.68,.91),(-1.43,.57),(-1.10,0)],s)
        influence*=path([(.84,0),(.92,.10),(1.03,.45),(1.14,.91),(1.24,1),(1.58,.95)],h)
        across=clamp(abs(x)/.83)
        x-=((1 if x>=0 else -1)*.092*influence*across**1.8)
        s+=.088*influence*across**2.4
    return (x,-s,h)
for _,source,_ in ctx.parts:
    source.vertices=[stamped_section(p) for p in source.vertices]
# All skin, lighting and fittings share common bumper datum planes.
if not DRAFT:
    end_front=max(-v[1] for _,p,_ in ctx.parts for v in p.vertices)
    end_rear=max(v[1] for _,p,_ in ctx.parts for v in p.vertices)
    body_side=max(abs(v[0]) for name,p,_ in ctx.parts if "mirror housing" not in name for v in p.vertices)
    for name,p,_ in ctx.parts:
        def datum(v):
            x,y,h=v
            if y>2.18:y+=((L*.5-end_rear)*clamp((y-2.18)/(end_rear-2.18))) if end_rear>2.18 else 0
            if y< -2.18:y-=((L*.5-end_front)*clamp((-y-2.18)/(end_front-2.18))) if end_front>2.18 else 0
            if "mirror housing" not in name:x*=W*.5/body_side
            return (x,y,h)
        p.vertices=[datum(v) for v in p.vertices]

# Blender source retains coherent collections and an individual object for every pressed panel.
groups={}
def collect(obj,key):
    if key not in groups:
        groups[key]=bpy.data.collections.new(key);bpy.context.scene.collection.children.link(groups[key])
    for old in list(obj.users_collection):old.objects.unlink(obj)
    groups[key].objects.link(obj)
for name,source,group in ctx.parts:
    if not source.faces:continue
    obj=source.export_object(name,mats);collect(obj,group)
    if group=="01 Body pressings":obj["construction"]="Separate stamped body panel"
    if name=="Roof skin":
        obj["body_dimensions_m"]=[L,W,H];obj["wheelbase_m"]=2.800
        obj["design_reference"]="Second-generation BYD e6 · Shenzhen Bus Group Pengcheng · user photograph"
for g,key in [(-1,"L"),(1,"R")]:
    source=road_wheel(g)
    source.vertices=[(x,y,max(-R,h)) for x,y,h in source.vertices]
    frontwheel=source.export_object("Wheel_F"+key,mats,(g*.770,FRONT_AXLE,R))
    rearwheel=bpy.data.objects.new("Wheel_R"+key,frontwheel.data)
    bpy.context.collection.objects.link(rearwheel);rearwheel.location=(g*.765,-REAR_AXLE,R)
    for obj in (frontwheel,rearwheel):
        collect(obj,"07 Wheels and brakes");obj["rolling_radius"]=R;obj["tyre"]="215/55 R17"
        obj["wheelbase_m"]=2.800

scene=bpy.context.scene
scene.unit_settings.system="METRIC";scene.unit_settings.length_unit="METERS"
scene["vehicle"]="BYD e6 II / Shenzhen Bus Group Pengcheng"
scene["reference_dimensions"]="4,695 × 1,810 × 1,670 mm • wheelbase 2,800 mm"
scene["source_specification"]="https://www.byd.com/material/byd-site/hk/product/new-e6/pc/e6-specs-en.pdf"
for area in bpy.context.screen.areas:
    if area.type=="VIEW_3D":
        sp=area.spaces.active;sp.region_3d.view_distance=5.8;sp.region_3d.view_location=(0,0,.81)
        sp.region_3d.view_rotation=Vector((2.9,3.7,-.85)).to_track_quat("-Z","Y")
        sp.shading.type="MATERIAL"
bpy.context.preferences.filepaths.save_version=0
if not DRAFT:
    directory=ROOT/"models";directory.mkdir(exist_ok=True)
    bpy.ops.file.pack_all()
    bpy.ops.wm.save_as_mainfile(filepath=str(directory/"深圳鹏程出租车.blend"),compress=True)
ATLAS.mkdir(exist_ok=True,parents=True)
target=ATLAS/"e6-pengcheng.draft.glb" if DRAFT else ROOT/"public/models/e6-pengcheng.glb"
sourcefile=ATLAS/"e6-pengcheng.author.glb" if PACK else target
bpy.ops.export_scene.gltf(filepath=str(sourcefile),export_format="GLB",export_yup=True,export_extras=True,
   export_animations=False,export_cameras=False,export_lights=False,export_texcoords=True,export_normals=True)
if PACK:
    subprocess.run([shutil.which("npx.cmd") or "npx","--yes","gltfpack@1.3.0","-i",str(sourcefile),
                    "-o",str(target),"-cc","-ce","ext","-si","0.61","-se","0.00016","-slb",
                    "-kn","-km","-ke","-vp","16","-vn","12","-vt","14"],check=True)
print("Exported",target,target.stat().st_size,"bytes;",len(scene.objects),"editable mesh objects")
