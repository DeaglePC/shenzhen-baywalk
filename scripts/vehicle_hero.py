"""Hand-built close-range first-generation BYD e6, in metres.

Run vehicle_hero_decals.py with a temporary directory, then:
blender -b -P scripts/vehicle_hero.py -- <temporary-directory> --pack
Dimensions, axle offsets, tracks and tyre size follow BYD's 2017 e6 brochure.
The coachwork, optics, wheel tooling and interior are original reference-based surfaces.
"""
from pathlib import Path
from math import pi, sin, cos, exp, sqrt, hypot, asin
import sys
import shutil
import subprocess
sys.path.insert(0,str(Path(__file__).resolve().parent))
import bpy
from mathutils import Vector
from vehicle_build import Surface, material, rod, ellipsoid, lerp, samples, ATLAS, OUT
from vehicle_driver import seat_driver

bpy.ops.wm.read_factory_settings(use_empty=True)
L,W,H=4.560,1.822,1.630
FRONT_AXLE,REAR_AXLE=1.360,-1.470
FRONT_TRACK,REAR_TRACK=1.585,1.560
TYRE_RADIUS=.352 # loaded contact height of 225/65 R17
SIDE_FRONT,SIDE_REAR=1.837,-1.997
CAB_FRONT,CAB_REAR=1.087,-2.037

def spline(stations,x):
    if x<=stations[0][0]: return stations[0][1]
    def sec(k):
        a,b=stations[k],stations[k+1]
        return (b[1]-a[1])/(b[0]-a[0])
    def tangent(k):
        if k==0: return sec(0)
        if k==len(stations)-1: return sec(k-1)
        a,b=sec(k-1),sec(k)
        return 0 if a*b<=0 else 2*a*b/(a+b)
    for i,((a,av),(b,bv)) in enumerate(zip(stations,stations[1:])):
        if x<=b:
            f=(x-a)/(b-a); f2=f*f; f3=f2*f
            return (2*f3-3*f2+1)*av+(f3-2*f2+f)*(b-a)*tangent(i)+(-2*f3+3*f2)*bv+(f3-f2)*(b-a)*tangent(i+1)
    return stations[-1][1]

def clamp(x,a=0,b=1): return max(a,min(b,x))
def bell(x,w): return exp(-((x/w)**2))
def plus(p,v): return tuple(x+y for x,y in zip(p,v))
def strip(surface,pts,rad,mat,count=7): rod(surface,pts,rad,mat,count)
def decal(surface,fn,box,normal,nu=10,nv=3):
    x0,y0,x1,y1=box
    for i in range(nu):
        for j in range(nv):
            u,v=i/nu,j/nv; a,b=(i+1)/nu,(j+1)/nv
            sub=(lerp(x0,x1,u)/2,lerp(y1,y0,b)/2,lerp(x0,x1,a)/2,lerp(y1,y0,v)/2)
            surface.decal([fn(u,v),fn(a,v),fn(a,b),fn(u,b)],sub,normal)

mats={
    "blue":material("Ocean Blue clearcoat","#1179B9",.40,.285,coat=.96),
    "white":material("Pearl White clearcoat","#E1E5DF",.23,.30,coat=.95),
    "black":material("Satin black trim","#1B2020",.06,.43),
    "seal":material("Weatherstrip","#242525",.015,.75),
    "chrome":material("Polished chrome","#CCD2CF",.94,.19),
    "rim":material("Cut alloy face","#AAB0AE",.83,.265),
    "rimside":material("Cast spoke returns","#646968",.77,.36),
    "rubber":material("Tyre sidewall","#232524",.015,.78),
    "tread":material("Tyre tread","#292A28",.015,.85),
    "rotor":material("Machined brake rotor","#777B78",.79,.40),
    "wheelwell":material("Wheelwell felt","#161816",0,.91),
    "glass":material("Laminated windscreen","#46575A",.12,.11,coat=.73),
    "glass_front":material("Front door solar glass","#32494A",.13,.12,coat=.71),
    "glass_rear":material("Privacy glass","#213331",.16,.135,coat=.75),
    "lens":material("Optic clear lens","#BACDD1",.04,.10,coat=.85),
    "garnet":material("Ruby tail optic","#A41F22",.42,.21,.20,coat=.72),
    "redprism":material("Tail lens facets","#CA3234",.36,.23,.23,coat=.63),
    "amber":material("Amber reflector","#BD7534",.39,.24,coat=.63),
    "light":material("Lamp reflector hot spot","#DBE5DB",.45,.16,.39),
    "darkglass":material("Quarterlight blackout","#142425",.28,.16,coat=.45),
    "upholstery":material("Woven black cloth","#282C2D",0,.91),
    "dash":material("Dashboard vinyl","#303433",.01,.69),
    "sign":material("Taxi sign diffuser","#ECEBDD",.04,.37,.075,coat=.28),
    "mark":material("Fleet print","#FFFFFF",.08,.45),
}
for key,opacity in {"glass":.53,"glass_front":.63,"glass_rear":.80,"lens":.19}.items():
    mats[key].node_tree.nodes.get("Principled BSDF").inputs["Alpha"].default_value=opacity
for key in ("blue","white"):
    mats[key].node_tree.nodes.get("Principled BSDF").inputs["Coat Roughness"].default_value=.105
atlas=bpy.data.images.load(str(ATLAS/"e6-hero.png")); atlas.pack()
nt=mats["mark"].node_tree; node=nt.nodes.new("ShaderNodeTexImage"); node.image=atlas
pbs=nt.nodes.get("Principled BSDF")
nt.links.new(node.outputs["Color"],pbs.inputs["Base Color"]);nt.links.new(node.outputs["Alpha"],pbs.inputs["Alpha"])
for name in ("left","right"):
    side_mat=material("Fleet side enamel "+name,"#FFFFFF",.33,.285,coat=.96)
    tree=side_mat.node_tree;tile=tree.nodes.new("ShaderNodeTexImage")
    tile.image=bpy.data.images.load(str(ATLAS/("e6-side-"+name+".png")));tile.image.pack()
    paint=tree.nodes.get("Principled BSDF")
    paint.inputs["Coat Roughness"].default_value=.115
    tree.links.new(tile.outputs["Color"],paint.inputs["Base Color"])
    mats["side_"+name]=side_mat
body=Surface()
flank_faces=[]

def belt(s):
    return spline([(-2.04,1.036),(-1.7,1.056),(-1.16,1.054),(-.51,1.023),
                  (.03,1.008),(.65,.991),(1.1,.976),(1.40,.956),(1.65,.924),(1.837,.866)],s)
def nominal_width(s):
    return spline([(-2.04,.818),(-1.85,.871),(-1.47,.895),(-1.12,.889),(-.48,.885),
                  (.22,.883),(.81,.886),(1.36,.898),(1.6,.885),(1.837,.864)],s)
def sill(s):
    return .192+.018*bell(s,1.15)+.086*bell(s+2.05,.25)+.053*bell(s-1.92,.23)
def archfloor(s):
    d=min(abs(s-FRONT_AXLE),abs(s-REAR_AXLE)); radius=.391
    if d>=radius+.012:return sill(s)
    if d>radius:return lerp(TYRE_RADIUS,sill(s),(d-radius)/.012)
    return TYRE_RADIUS+sqrt(max(0,radius**2-d*d))
def flank_x(s,z):
    floor=sill(s); norm=clamp((z-floor)/max(.35,belt(s)-floor))
    # A rolled sill, a stamped protection line, a hollow door barrel and the shoulder crown.
    offset=spline([(0,-.079),(.055,-.043),(.12,-.031),(.24,-.020),(.305,-.001),
                   (.333,-.006),(.39,-.021),(.53,-.031),(.68,-.020),(.82,-.002),
                   (.896,.010),(.934,.011),(1,-.024)],norm)
    axle=min((FRONT_AXLE,REAR_AXLE),key=lambda a:abs(a-s))
    distance=hypot(s-axle,z-TYRE_RADIUS)
    arch_brow=.035*bell(distance-.449,.061)*clamp((z-.22)/.16)
    return min(.911,nominal_width(s)+offset+arch_brow)
def flank(k,s,z,off=0):return (k*(flank_x(s,z)+off),s,z)
def liv_lower(s):
    return .245+.205*bell(s+.43,.65)+.042*bell(s+1.62,.42)+.145*bell(s+2.09,.30)-.026*bell(s-1.05,.34)
def seam_s(base,q):
    if base==-1.02: return base-.092*q+.053*bell(q-.36,.23)
    if base==.037: return base-.038*q+.008*sin(q*pi)
    if base==1.012: return base+.040*q-.042*bell(q-.20,.39)
    return base
for k in (-1,1):
    partitions=[SIDE_REAR,-1.02,.037,1.012,SIDE_FRONT]
    for panel,(lo,hi) in enumerate(zip(partitions,partitions[1:])):
        ts=set(samples(0,1,max(14,round((hi-lo)*32)))+[.002,.006,.014,.987,.994,.998])
        for ax in (FRONT_AXLE,REAR_AXLE):
            for ang in samples(0,pi,48):
                t=(ax+.391*cos(ang)-lo)/(hi-lo)
                if .002<t<.998:ts.add(t)
            for d in (-.405,.405):
                t=(ax+d-lo)/(hi-lo)
                if 0<t<1:ts.add(t)
        def panelpt(t,q):
            # Adjacent pressings have an actual gap and rolled hems either side.
            left=seam_s(lo,q)+(.0022 if panel>0 else 0)
            right=seam_s(hi,q)-(.0022 if panel<3 else 0)
            s=lerp(left,right,t); z=lerp(archfloor(s),belt(s),q)
            gutter=(.009*bell((s-left),.009) if panel>0 else 0)+(.009*bell(right-s,.009) if panel<3 else 0)
            return flank(k,s,z,-gutter)
        qs=sorted(set(samples(0,1,42)+[.055,.12,.24,.305,.333,.39,.53,.68,.82,.896,.934]))
        firstface=len(body.faces)
        side_name="side_left" if k==-1 else "side_right"
        ordered=sorted(ts)
        for t,T in zip(ordered,ordered[1:]):
            for q,Q in zip(qs,qs[1:]):
                vertices=[panelpt(t,q),panelpt(T,q),panelpt(T,Q),panelpt(t,Q)]
                tex=[]
                for x,s,z in vertices:
                    u=(s+2)/3.837
                    tex.append((u if k==-1 else 1-u,(z-.15)/.97))
                body.face(vertices,side_name,(k,0,0),True,tex)
        flank_faces.append((k,firstface,len(body.faces)))
    for ss in partitions[1:-1]:
        dark=[]
        for q in samples(0,1,45):
            s=seam_s(ss,q);dark.append(flank(k,s,lerp(archfloor(s),belt(s),q),-.007))
        strip(body,dark,.0032,"seal")
    # An inner fender flange recedes from the painted arch into the wheel well.
    for ax in (FRONT_AXLE,REAR_AXLE):
        def flange(a,d):
            s=ax+.391*cos(a); z=TYRE_RADIUS+.391*sin(a)
            return flank(k,s,z,-d)
        body.patch(samples(0,pi,65),[0,.008,.033,.09,.21],flange,
                   lambda a,d:"white" if d<.009 else "wheelwell",(0,0,-1))
        body.patch(samples(0,pi,45),[.001,.24,.40,.46],lambda a,rr:(k*.68,ax+rr*cos(a),TYRE_RADIUS+rr*sin(a)),
                   "wheelwell",(k,0,0))
    # Fine sill joints, raised tread guard and bumper parting at the leading wing.
    for zz,rad,mat in [(.226,.004,"black"),(.25,.006,"blue")]:
        strip(body,[flank(k,s,zz,.001) for s in samples(-1.0,.941,35)],rad,mat)
    svals=samples(1.684,SIDE_FRONT,14)
    strip(body,[flank(k,s,.624+.023*(s-1.684)/.153,.003) for s in svals],.0032,"seal")
    # Painted pull-handle shells sit proud of elliptical finger recesses.
    for sh in (-.811,.206):
        h=belt(sh)-.093
        p=flank(k,sh,h,.004)
        ellipsoid(body,p,(.017,.092,.036),"darkglass",24,8)
        ellipsoid(body,plus(p,(k*.013,0,-.005)),(.022,.083,.028),"blue",24,8)
        strip(body,[flank(k,sh+d,h+.009,.027+(.021*cos(d/.087*pi/2))) for d in samples(-.088,.088,15)],.015,"blue",9)
        strip(body,[flank(k,sh+d,h+.016,.032+.019*cos(d/.087*pi/2)) for d in samples(-.065,.067,11)],.0024,"chrome")

# The front/rear caps are curved from fender tangent to fender tangent. Lights,
# grilles and mouldings use this same surface, so they genuinely wrap the corners.
def cap(k,u,z,off=0):
    # u=0 at the centreline, ±1 at the flank tangencies.
    side=SIDE_FRONT if k==1 else SIDE_REAR
    a=abs(u)*pi/2
    x=flank_x(side,z)*sin(a)*(1 if u>=0 else -1)
    zh=clamp((z-.16)/.84)
    inset=spline([(0,.066),(.08,.015),(.18,.004),(.32,.015),(.48,.016),(.68,0),(.80,.003),(1,.024)],zh)
    reach=(L/2-abs(side))-inset*.95
    s=side+k*reach*cos(a)**.78
    return (x+(1 if u>=0 else -1)*off*sin(a),s+k*off*cos(a),z)
def cap_top(k,u):
    return lerp(.793 if k==1 else 1.065,belt(SIDE_FRONT if k==1 else SIDE_REAR),abs(sin(u*pi/2))**2)
def cap_bottom(k,u):
    return lerp(.19 if k==1 else .237,sill(SIDE_FRONT if k==1 else SIDE_REAR),abs(sin(u*pi/2))**2)
for k in (-1,1):
    for g in (-1,1):
        for inner in (True,False):
            def cap_skin(t,q):
                band=lerp(.236,.475,q**.72) if k==1 else 1
                u=g*(lerp(0,band,t) if inner else lerp(band,1,t))
                h=lerp(cap_bottom(k,u),cap_top(k,u),q)
                if k<0:
                    uv=abs(u)
                    cutoff=lerp(.459,liv_lower(SIDE_REAR),uv**1.7)
                    h=lerp(cap_bottom(k,u),cutoff,q/.27) if q<=.27 else lerp(cutoff,cap_top(k,u),(q-.27)/.73)
                return cap(k,u,h)
            if k==-1 and not inner: continue
            def cap_paint(t,q):
                if k<0:return "blue" if q<.27 or q>.945 else "white"
                if inner:return "blue"
                return "blue" if q>.945 else "white"
            body.patch(samples(0,1,32),sorted(set(samples(0,1,24)+[.27,.945])),cap_skin,cap_paint,(g*.4,k,.02))

def hood(g,u,t):
    end=cap(1,g*u,cap_top(1,u));s0=CAB_FRONT+.077*(1-u*u);s=lerp(s0,end[1],t)
    if u==1:
        return flank(g,s,belt(s))
    sh=flank_x(s,belt(s));side=sin(u*pi/2)
    x=g*lerp(sh*side,abs(end[0]),t)
    base=lerp(.999,cap_top(1,u),t)
    longitudinal=sin(pi*t)
    z=lerp(base,belt(s),side**6*(1-t))+.039*longitudinal*(1-side*side)+.011*longitudinal*bell(u-.64,.07)
    z=lerp(z,belt(s),side**12*longitudinal)
    return (x,s,z)
for g in (-1,1):
    body.patch(samples(0,1,43),samples(0,1,37),lambda u,t:hood(g,u,t),"blue",(0,.22,1))
    strip(body,[plus(hood(g,.605,t),(0,0,.0018)) for t in samples(.045,.995,35)],.0027,"seal")
    strip(body,[plus(hood(g,u,.996),(0,0,.0015)) for u in samples(.0,.99,42)],.003,"seal")
    strip(body,[plus(hood(g,.60,t),(0,0,.004)) for t in samples(.30,.985,28)],.0031,"blue")

roofline=[(CAB_REAR,1.046),(-1.98,1.155),(-1.83,1.407),(-1.68,1.550),(-1.54,1.593),
          (-1.16,1.615),(-.57,1.63),(-.07,1.615),(.11,1.581),(.30,1.506),
          (.52,1.351),(.77,1.174),(.970,1.056),(CAB_FRONT,.993)]
def roof_h(s): return spline(roofline,s)
def cab(g,s,q):
    top=roof_h(s); base=belt(s)
    headroom=max(0,top-base)
    side_crown=min(.057,headroom*.15)
    z=lerp(base,top-side_crown,q)
    x=flank_x(s,base)-min(.120,headroom*.28)*q**1.35+.009*sin(q*pi)
    return (g*x,s,z)
def crown(s,f):
    c=cab(1,s,1);z=roof_h(s);edge=c[2]
    # Windscreen and backlight bulge across the car; the front edge meets the cowl.
    bulge=lerp(-.084,.081,clamp((s+.80)/1.4))*(1-f*f)
    return (f*c[0],s+bulge,z-(z-edge)*f*f)
glassA,glassB=.115,1.041
rearA,rearB=-1.984,-1.669
stations=sorted(set(samples(CAB_REAR,CAB_FRONT,117)+[s for s,z in roofline]+[rearA,rearB,glassA,glassB,glassA+.016,glassB-.016]))
def roof_mat(s,f):
    front=glassA<s<glassB;rear=rearA<s<rearB
    if front or rear:
        if abs(f)>.942:return "blue"
        if abs(f)>.898 or (front and min(s-glassA,glassB-s)<.017):return "seal"
        return "glass" if front else "glass_rear"
    return "blue"
body.patch(stations,sorted(set(samples(-1,1,49)+[-.942,-.898,.898,.942])),crown,roof_mat,(0,0,1))
def pillar_pos(name,q):
    return {"tail":lerp(-1.990,-1.626,q), "C":lerp(-1.112,-1.246,q),
            "B":lerp(.041,-.066,q),"A":lerp(.803,.553,q),"nose":lerp(1.058,.990,q)}[name]
for g in (-1,1):
    for piece,(left,right) in enumerate([("tail","C"),("C","B"),("B","A"),("A","nose")]):
        us=sorted(set(samples(0,1,27)+[.017,.035,.947,.974]))
        qs=sorted(set(samples(0,1,22)+[.036,.071,.085,.849,.895,.929,.968]))
        def windowpoint(t,q):
            lo,hi=pillar_pos(left,q),pillar_pos(right,q)
            s=lerp(lo,hi,t)
            if piece==0:
                # The aft quarterlight follows the raked D pillar.
                s=lerp(max(CAB_REAR,lo),hi,t)
            return cab(g,s,q)
        def glassmat(t,q):
            if q<.036:return "blue"
            if q<.071:return "chrome"
            if q<.085 or q>.895 or t<.035 or t>.947:
                return "blue" if q>.968 else "seal" if q>.929 or q<.085 or t>.974 else "black"
            if piece==0 and t<.19:return "darkglass"
            return "glass_rear" if piece<=1 else "glass_front"
        body.patch(us,qs,windowpoint,glassmat,(g,0,.15))
    # Painted D- and A-pillar skins close the curved window assembly.
    for edge,endpoint in [("tail",CAB_REAR),("nose",CAB_FRONT)]:
        body.patch(samples(0,1,12),samples(0,1,21),lambda t,q:cab(g,lerp(endpoint,pillar_pos(edge,q),t),q),
                   "darkglass" if edge=="tail" else "blue",(g,0,.20))
    for pname in ("B","C"):
        pts=[plus(cab(g,pillar_pos(pname,q),q),(g*.003,0,0)) for q in samples(.01,.951,23)]
        strip(body,pts,.005,"seal",7)
    # Roof gutters and separate rear spoiler moulding.
    strip(body,[plus(crown(s,.87*g),(0,0,.002)) for s in samples(-1.655,.089,43)],.006,"seal")
    body.patch(samples(0,1,17),samples(0,1,13),lambda u,v:plus(crown(lerp(-1.773,-1.602,v),g*u),(0,-.043*(1-v),.018+.018*(1-v))),"blue",(0,0,1))
    strip(body,[plus(crown(-1.765,g*u),(0,-.048,.023)) for u in samples(.04,.92,19)],.015,"black")
for i in range(8):
    s=lerp(-1.951,-1.707,i/7)
    strip(body,[plus(crown(s,f),(0,-.0015,.001)) for f in samples(-.832,.832,21)],.00115,"rimside",4)
for s0,f0,f1 in [(glassB-.035,-.83,-.035),(glassB-.025,-.028,.808)]:
    pts=[plus(crown(s0-.060*sin(t*pi*.75),lerp(f0,f1,t)),(0,.010,.013)) for t in samples(0,1,29)]
    strip(body,pts,.0083,"black",8)
    strip(body,[plus(crown(glassB-.006,f0+.13),(0,.006,.010)),pts[11]],.009,"seal")
strip(body,[plus(crown(-1.943,f),(0,-.012,.005)) for f in samples(-.19,.61,19)],.007,"black")

def opt(g,u,v,off=0):
    q=lerp(.317,.975,u)
    top=spline([(0,.789),(.18,.809),(.61,.845),(1,.866)],u)
    bottom=spline([(0,.689),(.11,.678),(.56,.708),(.86,.760),(1,.829)],u)
    return cap(1,g*q,lerp(bottom,top,v),off)
for g in (-1,1):
    body.patch(samples(0,1,35),samples(0,1,10),lambda u,v:opt(g,u,v,.006),"black",(g*.5,1,0))
    # Pressed & metallised trapezoidal reflector, broken into optical facets.
    for i in range(20):
        for j in range(8):
            u=.035+i*.915/20;un=u+.915/20;v=.115+j*.747/8;vn=v+.747/8
            verts=[opt(g,u,v,.010),opt(g,un,v,.010),opt(g,un,vn,.010),opt(g,u,vn,.010)]
            centre=opt(g,(u+un)/2,(v+vn)/2,.0125+.0018*sin(i*1.35+j*.67))
            for h in range(4):
                body.face([verts[h],verts[(h+1)%4],centre],"chrome" if (i+j+h)%5 else "rimside",(g*.46,1,0),False)
    for v in (.056,.931):
        strip(body,[opt(g,u,v,.012) for u in samples(.018,.982,45)],.0054,"chrome")
    for u,span,ry in [(.600,.118,.40)]:
        for rings,mat in [((1,.90),"black"),((.90,.77),"chrome"),((.77,.65),"rimside"),((.65,.18),"darkglass")]:
            body.patch(samples(0,2*pi,38),list(rings),
                 lambda a,rr:opt(g,u+span*rr*cos(a),.51+ry*rr*sin(a),.014+.012*abs(rr-.53)),mat,(g*.41,1,0))
        body.patch(samples(0,2*pi,26),[.02,.27,.58],lambda a,rr:opt(g,u+span*rr*cos(a),.51+ry*rr*sin(a),.028+.011*(1-rr**2)), "lens",(g*.41,1,0))
        strip(body,[opt(g,u+.044*cos(a),.52+.14*sin(a),.040) for a in samples(.59,1.87,9)],.0029,"light")
    strip(body,[opt(g,u,.49+.027*sin(pi*u),.024) for u in samples(.184,.319,17)],.0062,"light")
    for u in samples(.755,.915,6):
        strip(body,[opt(g,u+.013*t,t,.019) for t in samples(.24,.75,5)],.0037,"amber",6)
    body.patch(samples(.010,.988,37),samples(.026,.964,13),
               lambda u,v:opt(g,u,v,.025+.016*sin(pi*u)*sin(pi*v)),"lens",(g*.48,1,.14))
    # Lower white bumper carries recessed fog lamp and a small fleet identifier.
    def fog(u,v,off):
        return cap(1,g*lerp(.480+.028*(1-v),.682-.045*v,u),lerp(.278+.018*u,.386-.023*u,v),off)
    body.patch(samples(0,1,18),[0,.5,1],lambda u,v:fog(u,v,.006),"black",(g*.43,1,0))
    for u in (.29,.44,.59):
        strip(body,[fog(u,v,.015) for v in samples(.21,.79,5)],.0045,"chrome",6)
    body.patch(samples(.13,.70,12),[.17,.5,.81],lambda u,v:fog(u,v,.019),"lens",(g*.43,1,0))
    decal(body,lambda u,v:cap(1,g*lerp(.464,.699,u if g==1 else 1-u),lerp(.423,.467,v),.007),(3,730,529,794),(g*.39,1,0),10,3)
    # Tail lights fit the hatch endplate, with stepped jewel lenses.
    def tail(u,v,off):
        angular=lerp(.467+.09*(1-v),.808-.025*(1-v),u)
        return cap(-1,g*angular,lerp(.563+.047*u,.982-.010*u,v),off)
    body.patch(samples(0,1,20),samples(0,1,18),lambda u,v:tail(u,v,.012),"chrome",(g*.57,-1,0))
    body.patch(samples(.055,.945,20),samples(.032,.962,14),lambda u,v:tail(u,v,.015),"black",(g*.57,-1,0))
    for middle,ry,mat in [(.73,.215,"garnet"),(.407,.154,"lens"),(.175,.107,"garnet")]:
        body.patch(samples(0,2*pi,36),[.001,.70,.98],lambda a,rr:tail(.50+.44*rr*cos(a),middle+ry*rr*sin(a),.024),
                   "chrome" if mat=="lens" else "garnet",(g*.57,-1,0))
        body.patch(samples(0,2*pi,37),[.002,.52,.85,.965,1],lambda a,rr:tail(.50+.43*rr*cos(a),middle+ry*rr*sin(a),.025+.017*(1-rr**2)),mat,(g*.57,-1,0))
        for ring in (.24,.54,.84):
            strip(body,[tail(.50+.43*ring*cos(a),middle+ry*ring*sin(a),.028+.017*(1-ring*ring)) for a in samples(0,2*pi,35)],
                  .0018,"chrome" if mat=="lens" else "redprism",5)
    # On the back, the gate's cutline drops inboard of the lamps.
    strip(body,[cap(-1,g*lerp(.479,.37,t),lerp(.975,.491,t),.011) for t in samples(0,1,16)],.0034,"seal")
    strip(body,[cap(-1,g*u,.491+.011*u,.008) for u in samples(0,.37,19)],.003,"seal")

def grille(f,v,off):
    return cap(1,f*lerp(.288,.321,v),lerp(.689,.795,v),off)
body.patch(samples(-1,1,46),[0,.09,.19,.81,.91,1],lambda f,v:grille(f,v,.010),
           lambda f,v:"chrome" if v<.19 or v>.81 else "black",(0,1,0))
for x in samples(-.94,.94,39):
    strip(body,[grille(x+v*.035,v,.016) for v in (.22,.43,.63,.79)],.0017,"rimside",4)
for v in (.32,.49,.65): strip(body,[grille(f,v,.018) for f in samples(-.955,.955,47)],.0016,"rimside",4)
ec=cap(1,0,.741,.032)
ellipsoid(body,ec,(.069,.021,.043),"chrome",30,12)
ellipsoid(body,plus(ec,(0,.012,0)),(.058,.017,.034),"darkglass",26,11)
decal(body,lambda u,v:(ec[0]+(u-.5)*.096,ec[1]+.03,ec[2]+(v-.5)*.041),(669,9,1014,174),(0,1,0),6,2)
# Front inlet and rear bumper lower valance.
for side in (-1,1):
    body.patch(samples(0,1,20),[0,.17,.80,1],lambda u,v:cap(side,(u-.5)*(.45 if side==1 else .95),lerp(.215,.257 if side==1 else .295,v),.008),
               lambda u,v:"black" if .17<v<.8 else "blue",(0,side,0))
    z=.486 if side==1 else .748
    p=cap(side,0,z,.025)
    # Backing bracket and physically raised screws surround the printed EU-size EV plate.
    ellipsoid(body,plus(p,(0,-side*.003,0)),(.251,.022,.084),"seal",32,12)
    decal(body,lambda u,v:(p[0]+side*(u-.5)*.477,p[1]+side*.024,p[2]+(v-.5)*.141),
          (1,1,655,183),(0,side,0),15,6)
    for pos in (-.179,.179):
        ellipsoid(body,plus(p,(pos,side*.026,.052)),(.007,.005,.007),"chrome",12,5)

# Hatch sill from waist to backlight, including badge, lip and spoiler stop lamp.
for g in (-1,1):
    def hatch(t,u):
        p=crown(CAB_REAR,g*u)
        end=cap(-1,g*(2/pi)*asin(u),cap_top(-1,(2/pi)*asin(u)))
        return tuple(lerp(a,b,t) for a,b in zip(p,end))
    body.patch(samples(0,1,11),samples(0,1,31),hatch,"blue",(0,-.55,1))
strip(body,[plus(crown(-1.758,f),(0,-.049,.019)) for f in samples(-.27,.27,17)],.009,"garnet")
bp=cap(-1,0,.967,.022)
ellipsoid(body,bp,(.057,.015,.030),"chrome",24,8)
ellipsoid(body,plus(bp,(0,-.006,0)),(.046,.015,.023),"darkglass",20,7)
decal(body,lambda u,v:(bp[0]-(u-.5)*.082,bp[1]-.023,bp[2]+(v-.5)*.031),
      (668,7,1018,175),(0,-1,0),6,2)
decal(body,lambda u,v:cap(-1,lerp(-.27,-.344,u),lerp(.743,.787,v),.011),(705,424,1017,553),(0,-1,0))

# Wing mirrors: a swelling cover, satin return, tilted reflective pane, and indicator lens.
for g in (-1,1):
    a0=cab(g,.834,.18)
    strip(body,[a0,plus(a0,(g*.052,-.020,-.014)),plus(a0,(g*.085,-.084,.002))],.023,"black",11)
    cx=g*.944; cs=.727; ch=1.073
    def mirror(t,a):
        scale=spline([(-1,.62),(-.85,.88),(-.30,1),(.38,.95),(.77,.70),(1,.12)],t)
        return (cx+g*(.091*scale*cos(a)+.014*t),cs+.114*t,ch+.067*scale*sin(a)+.009*t)
    body.patch(samples(-1,1,15),samples(0,2*pi,38),mirror,
          lambda t,a:"black" if sin(a)<-.35 else "blue",(g,.35,.14))
    body.patch(samples(0,2*pi,36),[.002,.70,.95,1],lambda a,r:(cx+g*.062*r*cos(a),cs-.117-.007*(1-r*r),ch+.044*r*sin(a)),
               lambda a,r:"chrome" if r<.94 else "black",(0,-1,0))
    strip(body,[mirror(t,-.25) for t in samples(-.72,.70,15)],.0055,"lens")

# Replace faceted generic seats with a sculpted upholstered cabin and instrument brow.
def rounded_box(center,extent,mat,rounding=.055):
    # A smooth superellipsoid, with restrained planar faces and padded edge radii.
    power=clamp(rounding*5+.17,.20,.78)
    def signed(x):return (1 if x>=0 else -1)*abs(x)**power
    def shape(u,v):
        uv=(signed(cos(v))*signed(cos(u)),signed(cos(v))*signed(sin(u)),signed(sin(v)))
        return tuple(c+d*e for c,d,e in zip(center,extent,uv))
    us=samples(0,2*pi,31);vs=samples(-pi/2+.0001,pi/2-.0001,18)
    for u,un in zip(us,us[1:]):
        for v,vn in zip(vs,vs[1:]):
            points=[shape(u,v),shape(un,v),shape(un,vn),shape(u,vn)]
            body.face(points,mat,Vector(points[0])-Vector(center))
for g in (-1,1):
    sx=g*.393
    rounded_box((sx,.068,.546),(.235,.233,.087),"upholstery")
    rounded_box((sx,-.091,.867),(.222,.102,.276),"upholstery")
    for dx in (-.06,.06):
        strip(body,[(sx+dx,-.113,1.104),(sx+dx,-.117,1.192)],.010,"chrome")
    rounded_box((sx,-.126,1.218),(.123,.077,.082),"upholstery")
    rounded_box((sx,-1.057,.889),(.255,.112,.265),"upholstery")
    rounded_box((sx,-1.124,1.194),(.127,.078,.078),"upholstery")
    strip(body,[(g*.695,.027,1.315),(g*.679,-.126,.989),(g*.64,-.205,.718)],.016,"seal")
    for s in (-.475,.52):
        rounded_box((g*.792,s,.780),(.061,.389,.177),"dash")
        rounded_box((g*.730,s,.844),(.067,.266,.035),"black")
rounded_box((0,.945,.886),(.778,.256,.131),"dash",.084)
rounded_box((-.386,.785,.992),(.202,.106,.082),"black",.09)
rounded_box((0,.826,.952),(.112,.077,.078),"black")
rounded_box((0,.744,.945),(.096,.006,.061),"darkglass")
for px in (-.609,-.110,.113,.614):
    rounded_box((px,.758,.896),(.066,.009,.024),"black")
    for dz in (-.011,0,.011):
        strip(body,[(px-.055,.744,.898+dz),(px+.055,.744,.898+dz)],.0022,"rimside",4)
steering=[(-.393+.154*cos(a),.600-.085*sin(a),.955+.126*sin(a)) for a in samples(0,2*pi,52)]
strip(body,steering,.016,"seal",10)
rounded_box((-.393,.612,.957),(.069,.038,.046),"black")
for i in (0,24,38):strip(body,[(-.393,.609,.954),steering[i]],.020,"black",8)
rounded_box((0,.397,1.361),(.105,.022,.037),"black")
strip(body,[(0,.458,1.431),(0,.397,1.378)],.008,"black")
body.face([(-.68,-1.92,.16),(.68,-1.92,.16),(.68,1.84,.16),(-.68,1.84,.16)],"wheelwell",(0,0,-1))
rounded_box((0,-.020,.248),(.727,1.83,.118),"wheelwell",.047)

# Period roof lamp: two feet, an extrusion with rounded endcaps and a sloping lit face.
sf=.035; mount_height=crown(sf,.26)[2]; base=mount_height+.023
for g in (-1,1):
    rounded_box((g*.197,sf,mount_height+.006),(.055,.078,.013),"seal")
    rounded_box((g*.197,sf,mount_height+.020),(.034,.055,.013),"black")
def signring(x,a):
    end=clamp((abs(x)-.284)/.025)
    capscale=1-.15*end**2
    sa,ca=sin(a),cos(a)
    def sp(n,p):return (1 if n>=0 else -1)*abs(n)**p
    h=.075+.067*capscale*sp(sa,.47)
    return (x,sf+.093*capscale*sp(ca,.51)*(1.16-.31*(h/.142)),base+h)
for a0,a1 in zip(samples(0,2*pi,48),samples(0,2*pi,48)[1:]):
    for x,X in zip(samples(-.309,.309,39),samples(-.309,.309,39)[1:]):
        quad=[signring(x,a0),signring(X,a0),signring(X,a1),signring(x,a1)]
        body.face(quad,"black" if sin((a0+a1)/2)<-.91 else "sign",
                  (0,cos((a0+a1)/2),sin((a0+a1)/2)))
for g in (-1,1):
    for a,A in zip(samples(0,2*pi,48),samples(0,2*pi,48)[1:]):
        body.face([signring(g*.309,a),signring(g*.309,A),(g*.311,sf,base+.071)],"sign",(g,0,0))
    def signprint(u,v):
        x=g*(u-.5)*.514; h=lerp(.034,.125,v); sinA=(h-.075)/.067
        a=asin(clamp((1 if sinA>=0 else -1)*abs(sinA)**(1/.47),-1,1))
        if g==-1:a=pi-a
        return plus(signring(x,a),(0,g*.0015,0))
    decal(body,signprint,(6,208,1017,378),(0,g,0),29,8)
    decal(body,lambda u,v:(g*.3114,sf-g*(u-.5)*.103,base+.075+(v-.5)*.044),
          (546,212,997,373),(g,0,0),8,3)

def make_wheel(side):
    w=Surface();g=side
    def vp(d,r,a):return (g*d,r*cos(a),r*sin(a))
    def revolve(profile,mat,n=74):
        for (d,r),(e,rr) in zip(profile,profile[1:]):
            for a,b in zip(samples(0,2*pi,n),samples(0,2*pi,n)[1:]):
                mid=(a+b)/2
                w.face([vp(d,r,a),vp(d,r,b),vp(e,rr,b),vp(e,rr,a)],mat,
                       (g*(r-rr),(e-d)*cos(mid),(e-d)*sin(mid)))
    # A 17-inch lip inside a tall 225/65 sidewall. Tread grooves follow the full circumference.
    tyre=[(-.100,.216),(-.111,.247),(-.114,.288),(-.112,.315),(-.103,.338),(-.087,.348),
          (-.069,.352),(-.058,.352),(-.054,.348),(-.049,.348),(-.045,.352),(-.019,.352),
          (-.017,.348),(-.012,.348),(-.009,.352),(.013,.352),(.017,.348),(.022,.348),
          (.025,.352),(.051,.352),(.054,.348),(.059,.348),(.062,.351),(.078,.350),
          (.095,.344),(.105,.334),(.112,.315),(.115,.294),(.114,.273),(.110,.251),(.105,.219)]
    revolve(tyre,"rubber",88)
    for radius,depth in [(.247,.111),(.281,.115),(.316,.112)]:
        revolve([(depth,radius+.0012),(depth+.0018,radius),(depth,radius-.0012)],"tread")
    for j in range(76):
        a=2*pi*j/76
        for half in (-1,1):
            pts=[vp(half*d,r,a+.007+.024*(d/.102)) for d,r in ((.014,.3525),(.041,.3526),(.070,.352),(.091,.346),(.104,.337))]
            strip(w,pts,.0019,"tread",4)
    revolve([(.108,.219),(.115,.219),(.117,.215),(.114,.211),(.110,.207),(.103,.203)],"rim")
    revolve([(.104,.205),(.097,.198),(.032,.194),(.027,.056)],"rimside")
    revolve([(.062,.165),(.068,.165),(.068,.078),(.073,.074),(.073,.042)],"rotor")
    for rr in (.135,.142,.159):
        revolve([(.0685,rr+.0006),(.0685,rr-.0006)],"rimside",60)
    for j in range(30):
        a=j*2*pi/30
        w.face([vp(.069,.149,a),vp(.069,.1515,a+.014),vp(.069,.149,a+.027),vp(.069,.147,a+.014)],"black",(g,0,0))
    ellipsoid(w,(g*.078,-.122,.045),(.028,.041,.073),"rimside",17,9)
    # Five bifurcated, three-dimensional cast spokes curve from deep hub to the rim.
    for j in range(5):
        for leg in (-1,1):
            theta=j*2*pi/5
            def spoke(t,v,d):
                rr=lerp(.044,.205,t)
                angle=theta+leg*(.015+.190*t**.74)+.040*sin(pi*t)
                spread=lerp(.199,.052,t)
                depth=.099+.015*t-.018*sin(pi*t)+.003*(1-abs(v))
                return vp(depth+d,rr,angle+v*spread)
            w.patch(samples(0,1,14),[-1,-.73,.50,.82,1],lambda t,v:spoke(t,v,0),"rim",(g,0,0))
            for v in (-1,1):
                for t,T in zip(samples(0,1,14),samples(0,1,14)[1:]):
                    w.face([spoke(t,v,0),spoke(T,v,0),spoke(T,v,-.023),spoke(t,v,-.023)],"rimside",(g,-sin(theta)*v,cos(theta)*v))
    revolve([(.085,.064),(.100,.063),(.106,.057),(.108,.037),(.110,.033),(.110,.001)],"rim")
    for j in range(5):
        a=2*pi*j/5;r=.048
        cx,cy=r*cos(a),r*sin(a)
        def bolt(depth,rr,n):
            return [(g*depth,cx+rr*cos(2*pi*i/n),cy+rr*sin(2*pi*i/n)) for i in range(n)]
        w.face(bolt(.108,.012,12),"black",(g,0,0),False)
        p0,p1=bolt(.108,.0079,6),bolt(.117,.0079,6)
        for i in range(6):
            J=(i+1)%6;w.face([p0[i],p0[J],p1[J],p1[i]],"rimside",(g,cos(i*pi/3),sin(i*pi/3)))
        w.face(p1,"chrome",(g,0,0),False)
    decal(w,lambda u,v:(g*.112,-g*(u-.5)*.052,(v-.5)*.020),(668,7,1018,175),(g,0,0),4,2)
    # A section of lightly embossed sidewall type follows the tyre, as on its mould.
    def tyretype(u,v):
        ang=pi/2+g*(u-.5)*.94
        return vp(.1158,.296+(v-.5)*.011,ang)
    decal(w,tyretype,(4,818,1017,889),(g,0,0),27,2)
    return w

# Trim each extremity to BYD's nominal bumper datum, preserving the axle offsets.
front=max(-y for x,y,z in body.vertices);rear=max(y for x,y,z in body.vertices)
def datum(v):
    x,y,z=v
    if y<-1.91:y=-lerp(1.91,L*.5,(-y-1.91)/(front-1.91))
    elif y>2.03:y=lerp(2.03,L*.5,(y-2.03)/(rear-2.03))
    return (x,y,z)
body.vertices=[datum(v) for v in body.vertices]
shell=body.export_object("e6 coachwork · Shenzhen fleet",mats)
# CAD-like smooth field on the pressed panels. Keep the rolled knife edges at the door gaps.
mesh=shell.data; custom=[(0.,0.,0.)]*len(mesh.loops)
for g,first,last in flank_faces:
    for idx in range(first,last):
        poly=mesh.polygons[idx]
        for loop in poly.loop_indices:
            x,blendy,z=mesh.vertices[mesh.loops[loop].vertex_index].co
            s=-blendy
            if any(abs(s-seam_s(seam,q))<.023 for seam in (-1.02,.037,1.012)
                   for q in (.0,.18,.36,.55,.77,1.0)): continue
            ds=(flank_x(s+.0008,z)-flank_x(s-.0008,z))/.0016
            dz=(flank_x(s,z+.0008)-flank_x(s,z-.0008))/.0016
            custom[loop]=Vector((g,ds,-dz)).normalized()[:]
mesh.normals_split_custom_set(custom)
shell["design_reference"]="BYD e6 first generation / Shenzhen taxi"
shell["body_dimensions_m"]=[L,W,H];shell["wheelbase_m"]=2.830
shell["tyre"]="225/65 R17";shell["track_front_rear_m"]=[FRONT_TRACK,REAR_TRACK]
for g in (-1,1):
    wheel=make_wheel(g)
    ft=wheel.export_object("Front wheel "+str(g),mats,(g*FRONT_TRACK/2,FRONT_AXLE,TYRE_RADIUS))
    rr=bpy.data.objects.new("Rear wheel "+str(g),ft.data);bpy.context.collection.objects.link(rr)
    rr.location=(g*REAR_TRACK/2,-REAR_AXLE,TYRE_RADIUS)
    ft["rolling_radius"]=rr["rolling_radius"]=TYRE_RADIUS
seat_driver(OUT.parent/"media/sam.glb")
packed="--pack" in sys.argv
target=OUT/"e6-hero.glb"
source=ATLAS/"e6-hero.author.glb" if packed else target
bpy.ops.export_scene.gltf(filepath=str(source),export_format="GLB",export_yup=True,
        export_extras=True,export_animations=False,export_cameras=False,export_lights=False,
        export_texcoords=True,export_normals=True)
if packed:
    subprocess.run([shutil.which("npx.cmd") or "npx","--yes","gltfpack@1.3.0","-i",str(source),
        "-o",str(target),"-cc","-ce","ext","-si","0.48","-se","0.00018","-slb","-kn","-km",
        "-ke","-vp","16","-vn","12","-vt","14"],check=True)
print("Hero GLB",len(body.faces),"body polygons",target.stat().st_size,"bytes")
