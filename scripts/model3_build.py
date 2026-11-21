"""Blender authoring for the Chinese Model 3 RWD, 18-inch Photon, dark interior.

Run Blender 5.2 in background with -P scripts/model3_build.py -- <temporary-dir>.
All surfaces below are original. MT382, PN01, W38A and IPB11 were independently
confirmed in Tesla China's configuration data; the matched front, rear, side,
wheel and interior compositor views define the production details.
"""
from math import pi, sin, cos, sqrt, exp, hypot, asin, atan2, radians, tan
from functools import lru_cache
from pathlib import Path
import os, shutil, subprocess, sys
import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"scripts"))
from vehicle_build import Surface,material,samples,lerp,rod,ellipsoid

TEMP=Path(sys.argv[sys.argv.index("--")+1]);TEMP.mkdir(exist_ok=True,parents=True)
OUT=ROOT/"public/models"
REF="https://www.tesla.cn/ownersmanual/model3/zh_cn/"
MANUAL=REF+"GUID-56562137-FC31-4110-A13C-9A9FC6657BF0.html"
EXTERIOR=REF+"GUID-6C6C3944-9674-4E81-A0E8-94D60B6D87B9.html"
PHOTON="https://service.tesla.cn/docs/Model3/ServiceManual/2024/zh-cn/GUID-769C9625-76EE-467B-B756-C9032AC2B99A.html"
CONFIG="https://static-assets.tesla.cn/configurator/compositor?context=design_studio_2&options=$MT382,$PN01,$W38A,$IPB11&view=STUD_FRONT34&model=m3&size=1920&bkba_opt=2&crop=0,0,0,0&overlay=0&"
L,W,H,WB=4.720,1.848,1.442,2.875
FA,RA,TRACK,R=L/2-.868,-L/2+.977,1.584,.326
def clamp(x,a=0,b=1):return max(a,min(b,x))
def bell(x,w):return exp(-(x/w)**2)
def soft(x):q=clamp(x);return q*q*(3-2*q)
def add(p,q):return tuple(a+b for a,b in zip(p,q))
def blend(a,b,t):return tuple(lerp(i,j,t) for i,j in zip(a,b))

class Spline:
    """Shape-preserving cubic section across measured stations."""
    def __init__(self,pts):
        self.pts=sorted(pts);r=self.pts
        m=[(y1-y0)/(x1-x0) for (x0,y0),(x1,y1) in zip(r,r[1:])]
        self.t=[m[0]]+[2*a*b/(a+b) if a*b>0 else 0 for a,b in zip(m,m[1:])]+[m[-1]]
    def __call__(self,x):
        r=self.pts
        if x<=r[0][0]:return r[0][1]
        if x>=r[-1][0]:return r[-1][1]
        for j,((a,y),(b,z)) in enumerate(zip(r,r[1:])):
            if x<=b:
                t=(x-a)/(b-a);q=t*t;u=q*t
                return (2*u-3*q+1)*y+(u-2*q+t)*(b-a)*self.t[j]+(-2*u+3*q)*z+(u-q)*(b-a)*self.t[j+1]

def S(px):
    for i,j,a,b in [(9,136,2.360,FA),(136,596,FA,RA),(596,748,RA,-2.360)]:
        if px<=j:return lerp(a,b,(px-i)/(j-i))
    return -2.36
def Z(py):return (292-py)*H/(292-64)
def profile(points):return Spline([(S(px),Z(py)) for px,py in points])
silhouette=profile([(9,199),(20,190),(35,183),(50,176),(65,169),(80,163),(110,155),
    (135,150),(160,147),(185,144),(200,139),(215,131),(235,120),(260,107),(280,98),
    (300,90),(325,81),(350,74),(375,69),(397,66),(420,64.5),(443,64),(475,64),
    (500,65),(530,68),(555,72),(575,76),(600,82),(625,90),(650,98),(670,105),
    (692,113),(713,120),(734,125),(738,126)])
belt_profile=profile([(65,170),(90,164),(125,156),(165,150),(196,148),(223,146),(255,144),
    (325,140),(405,136),(500,132),(557,127),(594,122),(613,117),(628,108),
    (641,107),(670,114),(710,126),(722,130)])
boot_slope=Spline([(-2.36,1.013),(-2.28,1.012),(-2.227,1.001),(-2.196,1.002),
    (-2.158,1.010),(-2.105,1.026),(-2.031,1.047),(-1.953,1.073),(-1.872,1.102),
    (-1.79,1.131),(-1.71,1.159),(-1.61,1.194),(-1.49,1.231),(-1.37,1.263)])
def boot_height(s,x):
    crown=.020*(1-clamp(abs(x)/.845)**2)*soft((s+2.235)/.44)
    return boot_slope(s)+crown
def belt(s):
    base=belt_profile(s)-.034*bell(s+1.651,.162)-.010*bell(s+1.78,.22)
    return lerp(base,boot_slope(s),soft((-s-1.575)/.157))
cantrail=profile([(183,146),(202,141),(222,136),(234,131),(258,116),(283,105),
    (307,97),(330,89),(355,83),(380,79),(411,76.5),(437,75),(475,77),(509,81),
    (542,86),(575,93),(599,99),(625,106),(641,108),(669,114)])
width=Spline([(S(p),w) for p,w in [(65,.855),(90,.890),(137,.912),(170,.899),(225,.886),
    (350,.890),(437,.891),(516,.903),(596,.918),(650,.909),(700,.884),(721,.847)]])
roll=Spline([(0,-.040),(.045,-.021),(.12,-.015),(.225,-.009),(.375,-.019),(.55,-.018),
    (.75,-.004),(.880,.006),(.939,.002),(1,-.026)])
sill_p=Spline([(S(p),h) for p,h in [(65,.178),(137,.172),(202,.158),(338,.157),
    (518,.162),(595,.170),(685,.181),(721,.189)]])
stern_width=Spline([(.15,.878),(.22,.895),(.32,.910),(.432,.918),(.510,.915),
    (.590,.904),(.690,.887),(.810,.859),(.904,.847),(.958,.841),(1.037,.826),(1.146,.794)])
def side_width(s,h):
    t=clamp((s-S(660))/.119)
    s-=.088*t*(1-t)**2
    q=clamp((h-sill_p(s))/(belt(s)-sill_p(s)))
    a=min((FA,RA),key=lambda axle:abs(s-axle))
    distance=hypot(s-a,h-R)
    shoulder=(.014*bell(distance-.401,.081) if a==RA else .020*bell(distance-.398,.057))
    shoulder+=.005*bell(distance-.380,.015)
    # The two press lines are not horizontal decals: the upper return grows out
    # of the repeater, while the lower spear dies out under the two door handles.
    upper=.741-.039*s+.011*bell(s+1.01,.46)
    lower=.393-.029*s-.016*bell(s-.69,.32)
    upper_amplitude=soft((s+1.38)/.61)*soft((1.18-s)/.27)
    lower_amplitude=soft((s+1.06)/.41)*soft((.98-s)/.40)
    shoulder+=upper_amplitude*(.011*bell(h-upper,.043)-.007*bell(h-upper+.09,.090))
    shoulder+=lower_amplitude*(.010*bell(h-lower,.022)-.013*bell(h-lower-.051,.055))
    rear_sail=.072*bell(s+1.54,.424)*soft((h-.898)/.304)
    tail_taper=soft((-s-1.31)/.49)
    tail_section=tail_taper*(.018*bell(h-.548,.125)-.065*soft((h-.64)/.31))
    surface=width(s)+roll(q)+shoulder-rear_sail+tail_section
    station_width=stern_width(h)+.058*(s-S(660))
    return lerp(surface,station_width,soft((-s-1.587)/.2074))
def flank(g,s,h,out=0):return (g*(side_width(s,h)+out),s,h)
def arch(s):
    d=min(abs(s-FA),abs(s-RA));r=.370
    if d>=r+.020:return sill_p(s)
    if d>=r:return lerp(R,sill_p(s),(d-r)/.020)
    return R+sqrt(max(0,r*r-d*d))

SF,SR=S(91),S(660)
front_c=Spline([(.137,2.286),(.174,2.333),(.217,2.336),(.270,2.287),(.343,2.299),
    (.420,2.339),(.530,2.360),(.594,2.356),(.653,2.341),(.693,2.298),(.77,2.203)])
# Actual horizontal press sections through the stern. The light wraps onto
# the side 28 cm forward of the broadest bumper station. A single end cap
# with the same exponent at all heights cannot describe both shapes.
tail_fractions=[0,.45,.73,.86,.92,.953,.970,.981,.990,1]
rear_sections=[
  (.145,[2.148,2.142,2.126,2.101,2.066,2.014,1.976,1.927,1.865,-SR]),
  (.190,[2.247,2.244,2.207,2.150,2.114,2.058,2.000,1.945,1.885,-SR]),
  (.275,[2.325,2.321,2.289,2.224,2.180,2.124,2.064,1.994,1.920,-SR]),
  (.368,[2.333,2.329,2.296,2.239,2.202,2.163,2.108,2.038,1.950,-SR]),
  (.475,[2.355,2.346,2.313,2.264,2.227,2.194,2.153,2.094,2.003,-SR]),
  (.542,[2.365,2.355,2.321,2.276,2.233,2.198,2.158,2.108,2.021,-SR]),
  (.565,[2.358,2.346,2.309,2.260,2.217,2.177,2.140,2.093,2.002,-SR]),
  (.622,[2.325,2.310,2.260,2.197,2.142,2.082,2.044,1.996,1.922,-SR]),
  (.735,[2.329,2.311,2.251,2.197,2.143,2.098,2.050,1.998,1.927,-SR]),
  (.819,[2.318,2.303,2.246,2.200,2.151,2.109,2.071,2.024,1.943,-SR]),
  (.868,[2.326,2.305,2.251,2.202,2.145,2.105,2.073,2.033,1.954,-SR]),
  (.932,[2.292,2.271,2.225,2.177,2.138,2.104,2.076,2.036,1.955,-SR]),
  (.966,[2.274,2.258,2.217,2.168,2.131,2.103,2.075,2.027,1.937,-SR]),
  (.986,[2.265,2.257,2.224,2.192,2.161,2.123,2.093,2.045,1.954,-SR]),
  (1.014,[2.289,2.286,2.255,2.221,2.188,2.147,2.101,2.048,1.961,-SR]),
  (1.16,[2.270,2.262,2.218,2.176,2.132,2.093,2.055,2.010,1.940,-SR])]
rear_longitudinal=[Spline([(h,ss[i]) for h,ss in rear_sections]) for i in range(len(tail_fractions))]
@lru_cache(maxsize=8192)
def stern_slice(h):
    # Fair the control sections in body height. Broad specular reflections
    # reveal tiny discontinuities that cannot be seen in a sampled silhouette.
    weights=[(-.052,.07),(-.028,.20),(0,.46),(.028,.20),(.052,.07)]
    return Spline([(f,sum(w*col(h+dh) for dh,w in weights)) for f,col in zip(tail_fractions,rear_longitudinal)])
def original_stern(f,h):
    x=f*side_width(SR,h)
    section=stern_slice(h);q=.022*sin(pi*f)**.7
    sheet=-(.22*section(f-q)+.56*section(f)+.22*section(f+q))
    # The bumper shoulder is one transverse draw. Each lateral station shares
    # its single longitudinal roll up to the quarter, avoiding a train of
    # locally independent creases beneath the outboard end of the lamp.
    if .373<h<.757:
        mid=stern_slice(.730)(f);crest=stern_slice(.522)(f)
        t=soft((.705-h)/.191) if h>=.513 else 1-.28*soft((.513-h)/.14)
        refined=-lerp(mid,crest,t)
        sheet=lerp(sheet,refined,soft((h-.373)/.060)*soft((.757-h)/.059))
    # A single shallow stamped basin, pitched with the registration carrier.
    # Its outboard return tapers into the quarter instead of a square step.
    pocket_width=.552+.045*soft((h-.620)/.224)
    lower=.617+.019*(x/.60)**4;upper=.865-.009*(x/.60)**3
    pocket=soft((pocket_width-x)/.095)*soft((h-lower)/.046)*soft((upper-h)/.033)
    plane=-2.299+.237*(h-.746)+.036*(x/.59)**2
    return lerp(sheet,plane,pocket)

def apron_ease(q):
    t=np.clip(q,0,1)
    return t**3*(10-15*t+6*t*t)

class RearApron:
    """Radial loft from the tail-lamp flange to the lower bumper, in metres.

    Each angular section has a quadratic upper panel, a 5 mm rolled crease
    and an inward-tapering lower panel. Position and tangent at its lower
    join come from the original body. The same forming surface places the
    registration basin, panel seams, reflector and lower diffuser.
    """
    def __init__(self):
        self.fraction=np.linspace(0,1,801)
        self.heights=np.unique(np.r_[np.linspace(.192,.821,270),np.arange(.495,.60,.00075)])
        # Measure the existing editable blank onto uniform station rings.
        stock_h=.170+.003*np.arange(278)
        stock_f=np.linspace(0,1,650)
        stock=np.array([[original_stern(f,h) for f in stock_f] for h in stock_h])
        width_h=.170+.002*np.arange(427)
        widths=np.array([side_width(SR,h) for h in width_h])
        def station(f,h):
            t=np.clip((h-stock_h[0])/.003,0,len(stock_h)-1)
            i=min(int(t),len(stock_h)-2)
            return np.interp(f,stock_f,lerp(stock[i],stock[i+1],t-i))
        def width(h):return float(np.interp(h,width_h,widths))
        # Locate the measured angles in the calibrated body-coordinate frame.
        # Store only the longitudinal displacement back in design coordinates;
        # the full vehicle and all attached components receive adjust() once.
        scale_x,scale_s,datum=.99015488,.99724267,-1.90
        cx,cs=.550,-1.945
        dense_f=np.linspace(0,1,1297)
        angles=np.deg2rad(np.arange(-45,136,.5))
        def ring(h):
            x=dense_f*width(h)*scale_x
            s=datum+(station(dense_f,h)-datum)*scale_s
            return x,s,np.arctan2(x-cx,cs-s),np.hypot(x-cx,s-cs)
        def radii(h):
            _,_,a,r=ring(h)
            return np.interp(angles,a,r)
        top,sole=.802,.215
        cap=radii(top);top_slope=(radii(top-.012)-radii(top+.012))/.024
        foot=radii(sole);foot_slope=(radii(sole+.012)-radii(sole-.012))/.024
        # A broad fairing of the entire angular guide removes section knots
        # below the optical flange while its actual boundary remains exact.
        bins=np.arange(-39,40)
        weights=np.exp(-.5*(bins/14.)**2);weights/=weights.sum()
        def smooth_guide(values):
            return np.convolve(np.pad(values,39,mode="edge"),weights,"valid")
        cap_fair=smooth_guide(cap);slope_fair=smooth_guide(top_slope)
        self.delta=[]
        for h in self.heights:
            if h<=sole or h>=.808:
                self.delta.append(np.zeros_like(self.fraction))
                continue
            x,s,angle,r=ring(h)
            degrees=np.rad2deg(angle)
            weight=(apron_ease((degrees+5)/46)*apron_ease((100-degrees)/28)
                    *apron_ease((h-sole)/.012)*apron_ease((.808-h)/.043))
            edge=.540-.056*(np.sin(angle)-.64)
            height=top-edge;fillet=.005
            above=.5*(np.hypot(h-edge,fillet)+h-edge)
            below=.5*(np.hypot(h-edge,fillet)-h+edge)
            along=above-height
            fair=apron_ease((top-h)/.145)
            radius_top=np.interp(angle,angles,lerp(cap,cap_fair,fair))
            slope_top=np.interp(angle,angles,lerp(top_slope,slope_fair,fair))
            slope_edge=.19
            radius_edge=radius_top+.5*(slope_top+slope_edge)*height
            radius_foot=np.interp(angle,angles,foot)
            slope_foot=np.interp(angle,angles,foot_slope)
            span=edge-sole
            easing=np.clip(.47*np.maximum(.010,radius_edge-radius_foot)/np.maximum(.02,slope_foot),.007,.032)
            run=easing*(1-np.exp(-span/easing))
            slope_lower=(radius_edge-radius_foot-slope_foot*run)/(span-run)
            distance=np.clip(span-below,0,span)
            lower=radius_foot+slope_lower*distance+(slope_foot-slope_lower)*easing*(1-np.exp(-distance/easing))
            upper=radius_top-slope_top*along+(slope_edge-slope_top)*along**2/(2*height)
            travel=(upper+lower-radius_edge-r)*weight
            formed_x=x+np.sin(angle)*travel
            formed_s=s-np.cos(angle)*travel
            active_inner=apron_ease((formed_x-.290)/(0.59-.290))
            active_flank=apron_ease((-formed_s-1.817)/(2.035-1.817))
            def cap_integral(v,w):
                t=np.clip(v/w,0,1)
                return w*(t**3-.5*t**4)+np.maximum(0,v-w)
            q=.805-h
            ramp=cap_integral(q,.055)-cap_integral(q-(.805-0.546),.040)
            active_height=ramp/(.805-0.546-.0075)*apron_ease((h-.218)/.187)
            preserve_pocket=1-apron_ease((.605-formed_x)/.082)*apron_ease((h-.600)/.060)
            formed_s-=0.041*active_inner*active_flank*active_height*preserve_pocket
            increasing=np.r_[True,np.diff(np.maximum.accumulate(formed_x))>1e-8]
            sheet=np.interp(self.fraction*width(h)*scale_x,formed_x[increasing],formed_s[increasing])
            self.delta.append((sheet-datum)/scale_s+datum-station(self.fraction,h))
        self.delta=np.array(self.delta)
        h=.540
        a=np.arctan2(self.fraction*side_width(SR,h)*scale_x-cx,
                     cs-np.array([original_stern(f,h) for f in self.fraction]))
        self.crease=.540-.056*(np.sin(a)-.64)

    @lru_cache(maxsize=90000)
    def offset(self,f,h):
        if not self.heights[0]<h<self.heights[-1]:return 0.
        i=int(np.searchsorted(self.heights,h))-1
        t=(h-self.heights[i])/(self.heights[i+1]-self.heights[i])
        return lerp(float(np.interp(f,self.fraction,self.delta[i])),
                    float(np.interp(f,self.fraction,self.delta[i+1])),t)

apron=RearApron()
def stern_station(f,h):
    return original_stern(f,h)+apron.offset(f,h)

front_upper=Spline([(0,.537),(.20,.541),(.46,.557),(.60,.585),(.70,.634),(.77,.680),
                    (.82,.726),(.866,.765),(.899,belt(SF))])
rear_crown=Spline([(0,1.018),(.40,1.020),(.72,1.020),(.86,1.020),(.92,1.014),
      (.960,1.006),(.977,1.013),(.986,1.044),(.995,1.096),(1,belt(SR))])
def cap(k,u,h,out=0):
    st=SF if k>0 else SR
    a=clamp(abs(u))*pi*.5;f=sin(a);g=1 if u>=0 else -1
    w=side_width(st,h)
    if k>0:
        c=front_c(h);exponent=2.67+.75*bell(h-.47,.16)
        s=st+(c-st)*max(0,1-f**exponent)**.61
    else:s=stern_station(f,h)
    if k>0:
        # Shallow oval in the sealed front, with an upswept and pinched outer end.
        low=.369+.044*f*f+.093*f**8
        high=.651-.044*f*f-.079*f**8
        smooth=lambda v:clamp(v)**2*(3-2*clamp(v))
        field=smooth((h-low)/.041)*smooth((high-h)/.034)
        s+=(-.031*field+.012*bell(h-low,.031))*(1-f**3.8)
    return (g*(w*f+out*sin(a)),s+k*out*cos(a),h)
def fascia(k,x,h,out=0):
    st=SF if k>0 else SR
    return cap(k,(1 if x>=0 else -1)*2/pi*asin(clamp(abs(x)/side_width(st,h))),h,out)
@lru_cache(maxsize=2048)
def captop(k,u):
    if k<0:
        h=rear_crown(sin(abs(u)*pi/2))
        for _ in range(5):
            x,s,z=cap(k,u,h)
            h=boot_height(s,x)
        return cap(k,u,h)
    st=SF;profile=front_upper
    h=belt(st)
    for i in range(4):h=profile(side_width(st,h)*sin(abs(u)*pi/2))
    return cap(k,u,h)

def cab(g,s,q):
    lo=belt(s);free=cantrail(s)+.039*bell(s+1.30,.43)
    top=max(lo+.0005,lerp(free,boot_height(s,.822),soft((-s-1.475)/.25)))
    inset=clamp((top-lo)/.37)
    cpost=.063*(1-inset)*bell(s+1.55,.44)*soft((s-S(649))/.166)
    x=side_width(s,lo)-(.207*inset+.003+cpost)*q**1.20+.004*sin(pi*q)
    return (g*x,s,lerp(lo,top,q))
def roof(s,f):
    edge=cab(1,s,1);h=silhouette(s)+.029*bell(s+1.27,.44)
    x=f*edge[0];z=lerp(h,edge[2],f*f)
    z=lerp(z,boot_height(s,x),soft((-s-1.497)/.227))
    return (x,s,z)

bpy.ops.wm.read_factory_settings(use_empty=True)
def m(name,c,metal=0,r=.4,emit=0,coat=0):return material(name,c,metal,r,emit,coat)
mats={
    "paint":m("Body paint","#464650",.64,.245,coat=.98),
    "badge":m("PN01 dark titanium script","#48474C",.58,.297,coat=.35),
    "handleWell":m("Flush handle recessed base","#17171C",.16,.36),
    "plateMetal":m("Factory graphite display plate","#77767B",.30,.37,coat=.22),
    "trim":m("Satin black trim","#222526",.13,.34),
    "frit":m("Obsidian ceramic frit","#101216",.16,.143,coat=.46),
    "headerGlass":m("Solar band at glazing upper edge","#20252B",.14,.102,coat=.43),
    "intakeDark":m("Front air intake cavity","#08090A",.0,.86),
    "glass":m("Acoustic windscreen","#46505A",.18,.076,coat=.53),
    "backglass":m("Heated rear windscreen","#242B35",.33,.090,coat=.64),
    "quarterGlass":m("Fixed rear quarter glass","#12171E",.22,.105,coat=.46),
    "door_glass":m("Frameless side glass","#343942",.15,.079,coat=.56),
    "roof_glass":m("Solar panoramic roof","#101217",.16,.166,coat=.42),
    "rubber":m("Rubber seals","#222425",.012,.79),
    "tyre":m("235 45R18 radial tyre","#2D2D2E",.012,.82),
    "sidewall":m("Moulded 235 45R18 tyre information","#333334",.012,.74),
    "tread":m("Tyre ribs","#373737",.015,.72),
    "felt":m("Arched fender lining","#171819",.0,.95),
    "cover":m("Photon NEU 243E graphite","#41414A",.36,.32,coat=.48),
    "coverEdge":m("Photon chamfer highlight","#585861",.44,.28,coat=.50),
    "blade":m("Photon NEU 251E charcoal","#242429",.30,.29,coat=.52),
    "bladeFacet":m("Photon moulded vent chamfer","#3B3C43",.32,.27,coat=.49),
    "alloy":m("Photon ghost metallic alloy","#777C7E",.65,.31),
    "brake":m("Steel brake discs","#515654",.58,.38),
    "chrome":m("Satin bright metal","#B5BBBD",.80,.22),
    "optic":m("Headlight recessed bowl","#192125",.51,.19),
    "lens":m("Headlight clear polycarbonate","#7F949F",.055,.089,coat=.61),
    "red":m("Stop optic red","#740F1B",.32,.19,.06,coat=.78),
    "red_light":m("Tail light guides","#E64347",.22,.20,.72,coat=.73),
    "tailShell":m("Anthracite smoked tail perimeter","#39373C",.35,.23,coat=.72),
    "tailGrey":m("Graphite prism substrate","#76727A",.38,.23,coat=.63),
    "sideRed":m("Red side marker facets","#C92726",.19,.23,.36,coat=.68),
    "tailRose":m("Taillamp thick cast lens","#E62B32",.14,.20,.29,coat=.71),
    "head":m("Daytime running guide","#EEF4F4",.19,.15,.85,coat=.76),
    "leather":m("Black premium seat upholstery","#302F30",.02,.65),
    "textile":m("Woven cabin soft trim","#404040",.01,.83),
    "stitch":m("Seam cord","#535152",.015,.72),
    "ambient":m("IPB11 violet ambient ribbon","#8279DD",.15,.28,.43),
    "screen":m("IPB11 central display pixels","#CFD1D2",.02,.27,.16),
    "plate":m("Shenzhen EV fleet plate","#96CDA9",.13,.34),
}
subprocess.run([shutil.which("python") or "python",str(ROOT/"scripts/model3_markings.py"),str(TEMP)],check=True)
def image_node(mat,file,socket,normal=False):
    nodes=mat.node_tree.nodes
    tex=nodes.new("ShaderNodeTexImage");tex.image=bpy.data.images.load(str(TEMP/file))
    output=tex.outputs["Color"]
    if normal:
        tex.image.colorspace_settings.name="Non-Color";bump=nodes.new("ShaderNodeNormalMap")
        bump.inputs["Strength"].default_value=.67;mat.node_tree.links.new(output,bump.inputs["Color"]);output=bump.outputs["Normal"]
    mat.node_tree.links.new(output,nodes["Principled BSDF"].inputs[socket])
image_node(mats["sidewall"],"model3-tyre-wall.png","Base Color")
image_node(mats["sidewall"],"model3-tyre-normal.png","Normal",True)
image_node(mats["plate"],"model3-street-plate.png","Base Color")
image_node(mats["screen"],"model3-touchscreen.png","Base Color")
for k,a in [("lens",.10),("glass",.425),("backglass",.62),("quarterGlass",.84),("door_glass",.44),("headerGlass",.73)]:
    mats[k].node_tree.nodes.get("Principled BSDF").inputs["Alpha"].default_value=a
mats["paint"].node_tree.nodes.get("Principled BSDF").inputs["Coat Roughness"].default_value=.098
parts=[];active="01 • Coachwork pressings"
def part(name):
    mesh=Surface();parts.append((active,name,mesh));return mesh
def tube(p,line,r,key,n=7):rod(p,line,r,key,n)
def rb(p,centre,radii,key,pow=.44,n=22):
    def sp(k):return (1 if k>=0 else -1)*abs(k)**pow
    def at(a,b):
        q=(sp(cos(b))*sp(cos(a)),sp(cos(b))*sp(sin(a)),sp(sin(b)))
        return tuple(c+r*t for c,r,t in zip(centre,radii,q))
    u=samples(0,2*pi,n);v=samples(-pi/2+.0001,pi/2-.0001,11)
    for a,b in zip(u,u[1:]):
      for c,d in zip(v,v[1:]):
        vs=[at(a,c),at(b,c),at(b,d),at(a,d)]
        p.face(vs,key,Vector(vs[0])-Vector(centre))

joint_profiles=[Spline(p) for p in [[(0,660),(1,660)],[(0,494),(.14,511),(.48,544),(.80,575),(.944,585),(1,581)],
    [(0,409),(.42,408),(.76,410),(1,415)],[(0,226),(.37,224),(.68,223),(1,226)],[(0,91),(1,91)]]]
def joint(i,q):return S(joint_profiles[i](q))
def doorbottom(s):return .271+.006*bell(s+.19,1.12)+.013*bell(s+1.57,.35)
def aperture(s,h):
    d=min(abs(s-FA),abs(s-RA))
    if h>=R:return hypot(d,h-R)-.370
    return d-.370-.020*clamp((R-h)/(R-sill_p(s)))
def cut_panel(mesh,us,vs,point,g,key,normal=None):
    """Clip real sheet boundaries against the wheel aperture in the sheet plane.

    Changing door-seam station through its height must never pull a vertical fan
    of faces up the circular wheel opening.
    """
    grid=[[point(t,q) for q in vs] for t in us]
    for j in range(len(us)-1):
        for k in range(len(vs)-1):
            c=[grid[j][k],grid[j+1][k],grid[j+1][k+1],grid[j][k+1]]
            clipped=[]
            for a,b in zip(c,c[1:]+[c[0]]):
                da=aperture(a[1],a[2]);db=aperture(b[1],b[2])
                if da>=0:clipped.append(a)
                if (da>=0)!=(db>=0):
                    low=0;high=1
                    for step in range(9):
                        mid=(low+high)*.5;p=blend(a,b,mid)
                        if (aperture(p[1],p[2])>=0)==(da>=0):low=mid
                        else:high=mid
                    clipped.append(blend(a,b,(low+high)*.5))
            if len(clipped)>2:mesh.face(clipped,key,normal or (g,0,0))
for g,side in [(-1,"Left"),(1,"Right")]:
    bottom=part(side+" painted sill and rocker return")
    cut_panel(bottom,samples(SR,SF,187),samples(0,1,15),
          lambda s,q:flank(g,s,lerp(sill_p(s),doorbottom(s),q)),g,"paint")
    for i,label in enumerate(["quarter pressing","rear door","front door","front wing"]):
        shell=part(side+" "+label)
        a,b=joint(i,.5),joint(i+1,.5)
        tset=set(samples(0,1,max(21,round((b-a)*42)))+[.0025,.006,.014,.985,.994,.9975])
        for axle in (FA,RA):
            for x in [axle+.370*cos(v) for v in samples(0,pi,68)]+[axle-.391,axle+.391]:
                t=(x-a)/(b-a)
                if 0<t<1:tset.add(t)
        def face(t,q):
            lo=joint(i,q)+(.00175 if i else 0);hi=joint(i+1,q)-(.00175 if i<3 else 0)
            s=lerp(lo,hi,t);h=lerp(doorbottom(s),belt(s),q)
            hem=(.006*bell(s-lo,.007) if i else 0)+(.006*bell(hi-s,.007) if i<3 else 0)
            return flank(g,s,h,-hem)
        cut_panel(shell,sorted(tset),samples(0,1,62),face,g,"paint")
    seal=part(side+" panel flanges and wheel housing")
    for j in (1,2,3):
        tube(seal,[flank(g,joint(j,q),lerp(doorbottom(joint(j,q)),belt(joint(j,q)),q),-.0047)
                   for q in samples(0,1,66)],.00265,"rubber",6)
    tube(seal,[flank(g,s,doorbottom(s)+.0015,.0004) for s in samples(S(494),S(226),85)],.00155,"rubber",5)
    for axle in (FA,RA):
        def well(a,d):
            s=axle+.370*cos(a);h=R+.370*sin(a)
            return flank(g,s,h,-d)
        seal.patch(samples(0,pi,60),[0,.006,.018,.070,.209],well,
                   lambda a,d:"paint" if d<.006 else "felt",(0,0,-1))
        seal.patch(samples(0,pi,35),[.003,.26,.427],
                   lambda a,r:(g*.66,axle+r*cos(a),R+r*sin(a)),"felt",(g,0,0))
        seal.patch(samples(-.414,.414,19),samples(.137,R+.004,8),
                   lambda ds,h:(g*.652,axle+ds,h),"felt",(g,0,0))
        for d in (-1,1):
            seal.patch(samples(0,1,9),[0,.006,.13,.22],lambda t,dep:flank(g,
                    axle+d*lerp(.370,.390,t),lerp(R,sill_p(axle+d*.390),t),-dep),
                    lambda t,dep:"paint" if dep<.006 else "felt",(0,-d,0))
    seal.patch(samples(S(529),S(202),64),[0,.2,.76,1],
            lambda s,q:flank(g,s,lerp(.148,.232,q),-.008+.009*sin(pi*q)),"trim",(g,0,-.2))
    handles=part(side+" flush handles and repeater camera")
    for px,py in [(382,158),(547,151)]:
        ss,hh=S(px),Z(py)
        high=Spline([(0,.0005),(.045,.008),(.52,.010),(.70,.012),(.81,.022),(.94,.024),(1,.015)])
        low=Spline([(0,.0003),(.055,-.008),(.58,-.008),(.83,-.009),(.968,-.002),(1,.015)])
        def pull(t,q,out):
            return flank(g,ss+lerp(.107,-.105,t),hh+lerp(low(t),high(t),q),out)
        handles.patch(samples(0,1,31),[-.13,.17,.89,1.18],lambda t,q:pull(t,q,.0021),"handleWell",(g,0,0))
        handles.patch(samples(0,1,31),[0,.14,.67,1],lambda t,q:pull(t,q,.0046+.0022*(1-q)),"badge",(g,0,0))
        tube(handles,[pull(t,0,.0054) for t in samples(0,1,30)]+[pull(t,1,.0054) for t in samples(1,0,30)],.00165,"frit",5)
    ss,hh=S(201),Z(174)
    lo=Spline([(0,.016),(.13,-.002),(.32,-.026),(.43,-.031),(.74,-.008),(1,.023)])
    hi=Spline([(0,.017),(.12,.025),(.69,.025),(1,.023)])
    handles.patch(samples(0,1,21),samples(0,1,8),
        lambda t,q:flank(g,ss+lerp(.073,-.091,t),hh+lerp(lo(t),hi(t),q),.0038+.0039*sin(pi*q)),
        lambda t,q:"trim" if q>.85 else "frit",(g,0,0))
    ellipsoid(handles,flank(g,ss-.026,hh+.001,.005),(.0026,.009,.007),"lens",14,6)

fleet_apron={False:[],True:[]}
for k,label in [(1,"Unbroken shark-nose front bumper"),(-1,"Liftgate face and rear bumper")]:
    shell=part(label)
    for g in (-1,1):
        def bumper(u,q):
            top=captop(k,g*u)[2]
            floor=lerp(.148 if k>0 else .190,sill_p(SF if k>0 else SR),sin(u*pi/2)**2)
            return cap(k,g*u,lerp(floor,top,q))
        if k>0:
            cut_panel(shell,samples(0,1,73),samples(0,1,57),bumper,g,"paint",(g*.5,k,0))
        else:
            # The rolled shoulder is its own set of aligned topology rows.
            # A uniform 10 mm mesh would smooth away its small tooling radius.
            def rearrow(u,j):
                f=sin(abs(u)*pi/2);edge=float(np.interp(f,apron.fraction,apron.crease))
                low=lerp(.190,sill_p(SR),f*f);high=captop(-1,g*u)[2]
                if j<=31:h=lerp(low,edge-.020,j/31)
                elif j<=50:h=edge-.018+.002*(j-32)
                else:h=lerp(edge+.021,high,(j-51)/50)
                return cap(-1,g*u,h)
            shell.patch(samples(0,1,118),list(range(102)),rearrow,"paint",(g*.5,-1,0))
            for far,divisions,rows in [(False,30,[0,5,14,23,30,35,38,40,42,45,50,55,65,75,87,101]),
                                       (True,15,[0,12,25,36,40,43,53,70,86,101])]:
                lod=Surface()
                lod.patch(samples(0,1,divisions),rows,rearrow,"paint",(g*.5,-1,0))
                fleet_apron[far].append(lod)

GLASS_REAR,GLASS_FRONT=S(649),S(190)
def deck(k,u,t):
    end=captop(k,u);start=roof(GLASS_FRONT if k>0 else GLASS_REAR,sin(u*pi/2))
    p=blend(start,end,t);s=p[1];f=abs(sin(u*pi/2));g=1 if u>=0 else -1
    sside=lerp(GLASS_FRONT if k>0 else GLASS_REAR,SF if k>0 else SR,t)
    if k<0:
        # The deck, outboard quarter top and trailing hem evaluate the same
        # master section used by the glass edge and rear bumper's top row.
        x=p[0]
        x=lerp(x,g*side_width(sside,belt(sside)),f**18*sin(pi*t))
        z=boot_height(s,x)
        z+=((start[2]-boot_height(start[1],start[0]))*(1-t)**3
            +(end[2]-boot_height(end[1],end[0]))*t**3)
        roll=(1-soft((f-.925)/.065))*soft((t-.86)/.14)
        return (x,s-.006*roll,z+.003*roll)
    upper=lerp(silhouette(s),p[2],t**4)
    upper+=(.027*bell(f-.77,.095)-.009*bell(f-.61,.14))*sin(pi*t)
    h=lerp(upper,belt(sside),f**5)
    h=lerp(h,p[2],t**7+(1-t)**8)
    x=lerp(p[0],g*side_width(sside,h),f**8*sin(pi*t))
    return (x,s,h)
for k,label in [(1,"Front luggage lid and crowned fenders"),(-1,"Boot lid and integrated lip spoiler")]:
    panel=part(label)
    for g in (-1,1):
        panel.patch(samples(0,1,52),samples(0,1,48),lambda u,t:deck(k,g*u,t),"paint",(0,k*.14,1))
        def cut(t):return lerp(.72,.390,t**.85)
        tube(panel,[add(deck(k,g*cut(t),t),(0,0,.0007)) for t in samples(.007,.986,59)],.0017,"rubber")
        if k>0:tube(panel,[add(deck(k,g*u,.986),(0,0,.0008)) for u in samples(0,.393,34)],.00155,"rubber")
        if k<0:
            def lip(u,q):
                tip=captop(-1,g*u);f=abs(sin(u*pi*.5))
                fade=1-soft((f-.925)/.065)
                # Hem curls under the trailing edge, leaving a distinct shadow
                # below the short, upward-curving boot lid in side elevation.
                section=[(.006,.003),(.009,.002),(.009,0),
                         (.008,-.003),(.004,-.008),(0,-.012)]
                ds,dz=section[q]
                return add(tip,(0,-ds*fade,dz*fade))
            for j in range(5):
                panel.patch(samples(0,.932,72),[j,j+1],lambda u,q:lip(u,int(q)),
                     "paint",(g*.19,-.5,1 if j<3 else -.55))

active="02 • Glazing and roof"
def pillar(key,q):
    curves={"A":(229,250),"B":(405,422),"quarter":(557,565),"C":(625,631)}
    a,b=curves[key];return S(lerp(a,b,q))
for g,label in [(-1,"Left"),(1,"Right")]:
    glass=part(label+" frameless door glazing and fixed quarterlight")
    for j,(le,ri) in enumerate([("C","quarter"),("quarter","B"),("B","A")]):
        def pane(t,q):return cab(g,lerp(pillar(le,q),pillar(ri,q),t),q)
        def panemat(t,q):
            if q<.035 or q>.951:return "trim"
            if le=="C":
                if q<.13+.09*(1-t)**2 or q>.855 or t<.10 or t>.93:return "frit"
                return "quarterGlass"
            if q<.074 or q>.872:return "frit"
            if t<(.090 if le=="B" else .041) or t>(.907 if ri=="B" else .967):return "frit"
            if q>.797:return "headerGlass"
            return "door_glass"
        glass.patch(sorted(set(samples(0,1,36)+[.041,.090,.907,.967])),
                    sorted(set(samples(0,1,26)+[.035,.067,.912,.951])),pane,panemat,(g,0,.15))
        if le=="C":
            line=[add(pane(t,.055+.022*(1-t)**2),(g*.0015,0,0)) for t in samples(0,1,41)]
            tube(glass,line,.0058,"frit",8)
    rails=part(label+" roof-side rail and gloss pillars")
    for key,end in [("A",GLASS_FRONT),("C",GLASS_REAR)]:
        rails.patch(samples(0,1,19),samples(0,1,28),lambda t,q:cab(g,lerp(end,pillar(key,q),t),q),
                    "paint",(g,0,.28))
    for q in (.027,.961):
        line=[add(cab(g,lerp(pillar("A",q),pillar("C",q),t),q),(g*.0012,0,.0007)) for t in samples(0,1,93)]
        tube(rails,line,.005,"trim",8)
    tube(rails,[add(cab(g,pillar("quarter",q),q),(g*.002,0,0)) for q in samples(.047,.94,25)],.0041,"trim")

roofcuts=[S(v) for v in (190,335,481,502,649)]
for a,b,name,key in [(roofcuts[1],roofcuts[0],"Acoustic front windscreen","glass"),
       (roofcuts[2],roofcuts[1],"Forward panel of panoramic glass roof","roof_glass"),
       (roofcuts[4],roofcuts[2],"Panoramic aft glass and heated rear windscreen","backglass")]:
    glazing=part(name)
    def roof_key(t,f):
        limit=lerp(.792,.874,sin(pi*t))
        if abs(f)>.957:return "paint"
        if abs(f)>limit or min(t,1-t)<.034:return "frit"
        if name.startswith("Acoustic") and t<.119:return "headerGlass"
        if name.startswith("Panoramic aft") and t>.56:return "roof_glass"
        if name.startswith("Panoramic aft") and t<.071:return "frit"
        return key
    def bow(t,f):
        s=lerp(a,b,t)
        # Curved transverse joints. All touching glass pieces share each boundary.
        shift=.048*cos((s-GLASS_FRONT)/(GLASS_REAR-GLASS_FRONT)*pi)*(1-f*f)
        shift*=sin(pi*clamp((s-GLASS_FRONT)/(GLASS_REAR-GLASS_FRONT)))**.42
        return roof(s+shift,f)
    glazing.patch(sorted(set(samples(0,1,43)+[.016,.984])),
               sorted(set(samples(-1,1,60)+[-.956,.956])),bow,roof_key,(0,0,1))

# Roof rails are closed structural sections. An opaque dark headliner sits
# below the panoramic roof and behind the black ceramic frit at the pillars.
liner=part("Black headliner, solid A and C pillar returns")
liner.patch(samples(S(554),S(329),52),samples(-.986,.986,42),
            lambda s,f:add(roof(s,f),(0,0,-.023)),"textile",(0,0,-1))
liner.patch(samples(S(554),S(329),52),samples(-.986,.986,34),
            lambda s,f:add(roof(s,f),(0,0,-.019)),"frit",(0,0,1))
for g in (-1,1):
    def apo(s,v):
        f=g*lerp(.787,.977,v)
        return add(roof(s,f),(-g*.016,0,-.020-.010*sin(pi*v)))
    liner.patch(samples(S(339),S(195),41),samples(0,1,12),apo,"frit",(g,.35,.54))
    liner.patch(samples(S(339),S(195),41),samples(0,1,12),lambda s,v:add(apo(s,v),(0,.003,-.010)),"textile",(-g,-.2,-.7))
    for q in (.24,.72):
        tube(liner,[add(apo(s,q),(-g*.008,0,-.012)) for s in samples(S(336),S(196),41)],.012,"textile",8)
    def rail(s,q):
        outer=cab(g,s,1)
        return add(outer,(-g*(.011+.031*q),0,-.010-.024*q))
    liner.patch(samples(S(638),S(233),72),[0,.16,.67,1],rail,"rubber",(g,0,-.3))
    def cpost(t,q):
        s=lerp(S(621)-.070*q,S(649)-.040*q,t)
        return add(cab(g,s,q),(-g*.017,0,-.010))
    liner.patch(samples(0,1,13),samples(0,1,18),cpost,"textile",(-g,0,-.2))
trim=part("Cowl, defroster lines and glass seals")
for p in (335,481):
    st=S(p);a=(st-GLASS_FRONT)/(GLASS_REAR-GLASS_FRONT)
    tube(trim,[add(roof(st+.048*cos(a*pi)*(1-f*f)*sin(pi*a)**.42,f),(0,0,.0018))
               for f in samples(-.932,.932,60)],.0028,"rubber")
for p in range(522,637,12):
    tube(trim,[add(roof(S(p),f),(0,0,.00085)) for f in samples(-.84,.84,38)],.00054,"brake",4)
trim.patch(samples(0,1,9),samples(-.84,.84,38),
      lambda t,f:add(roof(lerp(S(202),GLASS_FRONT,t),f),(0,0,.0008)),"trim",(0,.6,1))
for f0,f1,p in [(-.83,-.04,201),(-.115,.78,198)]:
    line=[add(roof(S(p+1.7*sin(pi*t)),lerp(f0,f1,t)),(0,.002,.0046)) for t in samples(0,1,31)]
    tube(trim,line,.004,"trim")
    tube(trim,[add(roof(S(191),f0+.10),(0,0,.0025)),line[13]],.004,"trim")

active="03 • Exterior lights and brightwork"
fleet_lamps={False:[],True:[]}
def transverse(g,k,u,t,lower,upper,out):
    x=lerp(lower[0](u),upper[0](u),t)
    h=lerp(lower[1](u),upper[1](u),t)
    return fascia(k,g*x,h,out)
for g,label in [(-1,"Left"),(1,"Right")]:
    lamp=part(label+" Highland LED headlamp and segmented projector")
    # Traced swept housing. The inboard point pinches into the hood seam.
    bottom=(Spline([(0,.592),(.25,.659),(.56,.770),(.82,.843),(1,.887)]),
            Spline([(0,.581),(.25,.582),(.56,.595),(.82,.622),(1,.668)]))
    upper=(Spline([(0,.606),(.25,.677),(.56,.788),(.82,.854),(1,.888)]),
           Spline([(0,.595),(.25,.618),(.56,.654),(.82,.680),(1,.707)]))
    def lp(u,v,out=0):
        p=transverse(g,1,u,v,bottom,upper,out)
        # Rearward sweep through the outer wing folds into the upstream fender crown.
        return add(p,(0,-.012*u**4,.0024*sin(pi*u)*sin(pi*v)))
    lamp.patch(samples(0,1,44),samples(0,1,13),lambda u,v:lp(u,v,.0041),"optic",(g*.45,1,.22))
    outline=[lp(u,0,.0063) for u in samples(0,1,36)]+[lp(1,v,.0063) for v in samples(0,1,8)]
    outline+=[lp(u,1,.0063) for u in samples(1,0,36)]+[lp(0,v,.0063) for v in samples(1,0,8)]
    tube(lamp,outline,.0037,"trim",7)
    # The DRL follows the bottom of the housing, then hooks up the outer shoulder.
    guide=Spline([(.02,.115),(.31,.135),(.44,.175),(.61,.153),(.78,.225),(.87,.415),(.95,.803)])
    tube(lamp,[lp(u,guide(u),.010) for u in samples(.024,.951,56)],.0053,"head",9)
    for i in range(3):
        u=.585+.082*i
        lamp.patch(samples(0,1,11),samples(0,1,7),lambda t,v:lp(lerp(u,u+.062,t),lerp(.36,.69,v),.0091),
                   "brake",(g*.60,1,.20))
        tube(lamp,[lp(u+.009,t,.011) for t in samples(.43,.66,6)],.0018,"chrome")
    lamp.patch(samples(0,1,41),samples(0,1,14),lambda u,v:lp(u,v,.013),"lens",(g*.55,1,.25))
    tail=part(label+" wraparound smoked lamp, C light guide and side retroreflector")
    # A continuous coordinate follows the physical lens from the boot centre,
    # across the rear corner and forward onto the quarter. Distances at the
    # corner are tied to corresponding points in STUD_REAR34 and STUD_SIDE.
    guide=[(0,.390,-2.229),(.14,.530,-2.234),(.242,.629,-2.221),
           (.334,.713,-2.177),(.402,.762,-2.144),(.452,.796,-2.117),
           (.489,.818,-2.091),(.520,.838,-2.063),(.590,.844,-1.995),
           (.675,.848,-1.912),(.756,.835,-1.833)]
    planned_x=Spline([(d,x) for d,x,s in guide])
    planned_s=Spline([(d,s) for d,x,s in guide])
    def follow(d,h,depth):
        w=side_width(SR,h);s=planned_s(d);f=clamp(planned_x(d)/w)
        if d>.329:
            lo,hi=.38,1.0
            for _ in range(17):
                mid=(lo+hi)/2
                if stern_station(mid,h)<s:lo=mid
                else:hi=mid
            f=lerp(f,(lo+hi)*.5,soft((d-.329)/.124))
        s=stern_station(f,h);df=.0002
        tangent=-(stern_station(min(1,f+df),h)-stern_station(max(0,f-df),h))/(2*df*w)
        # As lateral x increases, the surface normal rotates from aft to side.
        norm=hypot(tangent,1)
        return (g*(w*f-depth*tangent/norm),s-depth/norm,h)
    hi=Spline([(0,.916),(.028,.934),(.22,.946),(.373,.951),(.462,.954),
               (.508,.958),(.615,.957),(.734,.956),(.756,.952)])
    low=Spline([(0,.915),(.038,.910),(.245,.904),(.362,.904),(.406,.899),
                (.443,.882),(.463,.849),(.487,.810),(.522,.806),
                (.575,.820),(.628,.844),(.680,.881),(.730,.919),(.756,.952)])
    def envelope(d,v,depth):
        return follow(d,lerp(low(d),hi(d),v),depth)
    ds=samples(0,.756,114)
    def jacket(d,v):return envelope(d,v,.0055+.0035*sin(pi*v))
    tail.patch(ds,samples(0,1,17),jacket,
               lambda d,v:"tailGrey" if d>.518 and v>.28 else "tailShell",(g*.5,-1,.15))
    for edge in (0,1):
        tail.patch(ds,[0,.35,1],lambda d,v:envelope(d,edge,lerp(-.001,.0055,v)),
                   "tailShell",(g*.40,-.5,-1 if edge==0 else 1))
        tube(tail,[envelope(d,edge,.0052) for d in ds],.0019,"rubber",6)
    # The bottom jaw and vertical return share an overlapping mould, avoiding
    # a hard join at the bend or a tiny isolated red sliver in profile.
    low_edge=Spline([(.210,.847),(.235,.833),(.335,.826),(.412,.818),(.503,.808),(.525,.809)])
    up_edge=Spline([(.210,.8475),(.238,.854),(.346,.854),(.44,.857),(.504,.844),(.525,.830)])
    tail.patch(samples(.210,.525,48),samples(0,1,8),
               lambda d,v:follow(d,lerp(low_edge(d),up_edge(d),v),.0092+.002*sin(pi*v)),"tailShell",(g*.48,-1,0))
    centre=[(.000,.021,.924),(.152,.141,.934),(.346,.293,.940),
            (.511,.408,.939),(.612,.460,.932),(.680,.478,.914),
            (.743,.489,.883),(.787,.498,.849),(.817,.498,.830),
            (.845,.479,.828),(.915,.379,.832),(1,.223,.840)]
    dd=Spline([(t,d) for t,d,h in centre]);zz=Spline([(t,h) for t,d,h in centre])
    breadth=Spline([(0,.0007),(.08,.0044),(.35,.0080),(.59,.0107),
            (.67,.0140),(.78,.0164),(.815,.0147),(.86,.0110),(.94,.0088),(1,.00085)])
    def lightguide(t,v,depth=.014):
        a,b=max(0,t-.001),min(1,t+.001)
        xd,yd=dd(b)-dd(a),zz(b)-zz(a);r=max(.000001,hypot(xd,yd))
        d=dd(t)+.014+.013*soft((.26-dd(t))/.18)+.044*soft((.412-dd(t))/.205)
        radius=1.21*breadth(t)
        return follow(d-v*radius*yd/r,zz(t)-.006+v*radius*xd/r,depth+.0031*(1-v*v))
    ts=sorted(set(samples(0,1,115)+[t for t,d,h in centre]))
    tail.patch(ts,[-1,-.90,-.72,-.28,.42,.75,.91,1],lightguide,
               lambda t,v:"tailRose" if abs(v)>.75 else "red_light",(g*.56,-.8,0))
    for v in (-1,1):
        tail.patch(ts,[.008,.011,.014],lambda t,out:lightguide(t,v,out),
            "sideRed",(g*.5,-.7,0))
    # The inner off-white optical strip tapers before the lower return.
    tube(tail,[lightguide(t,-.77,.0171) for t in samples(.12,.778,68)],.0025,"head",8)
    # A transparent-smoked side pod contains a bright prismatic reflector
    # with a flat upper edge, rather than a solid black-painted triangle.
    ref_low=Spline([(.526,.870),(.552,.869),(.635,.875),(.666,.900),(.68,.905)])
    ref_hi=Spline([(.526,.903),(.554,.907),(.637,.907),(.68,.9055)])
    def reflector(d,v):return follow(d,lerp(ref_low(d),ref_hi(d),v),.013+.0017*sin(pi*v))
    tail.patch(samples(.543,.68,39),samples(0,1,9),reflector,
               lambda d,v:"sideRed" if v>.15 else "red",(g,-.17,0))
    for d in samples(.549,.648,13):
        tube(tail,[reflector(d+offset,v) for offset,v in [(0,.26),(.002,.48),(.004,.68)]],.00043,"tailRose",4)
    # Assembly gap between quarter panel and opening liftback; the lens is
    # continuous across this seam. Follow the rear surface down to the bumper.
    side_seam=[(.521,.806),(.524,.764),(.529,.691),(.533,.637),(.553,.618),
               (.582,.612),(.680,.606),(.756,.600)]
    tube(tail,[follow(d,h,.0034) for a,b in zip(side_seam,side_seam[1:])
                   for d,h in [blend(a,b,t) for t in samples(0,1,8)]],.0017,"rubber",6)
    # Retopologise the road lights directly at their optical landmarks. A
    # general triangle decimator can collapse one of the two short C arms.
    for distant,count in [(False,30),(True,14)]:
        road=Surface()
        road.patch(sorted(set(samples(0,.756,count)+[.211,.424,.489,.52,.63])),
            [0,.30,1],jacket,lambda d,v:"tailGrey" if d>.523 and v>.29 else "tailShell",(g*.5,-1,0))
        road.patch(samples(.21,.525,8 if distant else 15),[0,1],
            lambda d,v:follow(d,lerp(low_edge(d),up_edge(d),v),.0096),"tailShell",(g*.5,-1,0))
        keys=sorted(set(samples(0,1,count)+[t for t,d,h in centre]))
        band=[-1,1] if distant else [-1,-.73,.72,1]
        road.patch(keys,band,lightguide,
            lambda t,v:"tailRose" if abs(v)>.75 else "red_light",(g*.56,-.8,0))
        road.patch([.543,.576,.635,.662,.68],[0,1],reflector,"sideRed",(g,-.2,0))
        fleet_lamps[distant].append(road)

intake=part("Lower intake, air guides and rear diffuser")
for g in (-1,1):
    def inlet(u,v):
        x=.655*u;lower=.189+.006*u*u
        upper=.286-.028*u**2-.054*u**8
        return fascia(1,g*x,lerp(lower,upper,v),.004)
    intake.patch(samples(0,1,34),samples(0,1,9),inlet,"intakeDark",(g*.2,1,0))
    for v in (.31,.58,.78):
        tube(intake,[add(inlet(u,v),(0,.003,0)) for u in samples(0,.955,31)],.0032,"trim",6)
    for u in (.065,.344,.69,.96):
        tube(intake,[add(inlet(u,v),(0,.0022,0)) for v in (.03,.95)],.0037,"trim")
    def diff(u,v):
        x=.839*u;lo=.202+.026*(1-u*u)-.014*bell(u-.77,.2)
        hi=.393-.016*u*u-.191*soft((u-.798)/.202)
        h=lerp(lo,hi,v);out=.006+.009*sin(pi*v)
        return fascia(-1,g*x,h,out)
    intake.patch(samples(0,1,68),samples(0,1,22),diff,
               lambda u,v:"rubber" if v<.37 else "trim",(g*.3,-1,-.15))
    tube(intake,[diff(u,.982) for u in samples(.001,.993,72)],.0046,"trim",8)
    def marker(t,q):
        x=lerp(.366,.677,t);h=.370-.007*t+q*.0115*(1-(2*t-1)**8)
        u=x/.839;lo=.202+.026*(1-u*u)-.014*bell(u-.77,.2)
        hi=.393-.016*u*u-.191*soft((u-.798)/.202)
        v=clamp((h-lo)/max(.006,hi-lo))
        backing=(.006+.009*sin(pi*v))*(1-soft((h-hi+.0035)/.008))
        return fascia(-1,g*x,h,backing+.0016)
    intake.patch(samples(0,1,37),[-1,-.7,.70,1],marker,
               lambda t,q:"red" if abs(q)<.72 else "tailShell",(g*.35,-1,0))
    tube(intake,[add(fascia(1,g*.806*u,.154+.013*u*u,.002),(0,0,-.003)) for u in samples(0,1,31)],.0034,"trim",7)
under=part("Battery casing and flat underbody")
rb(under,(0,-.03,.224),(.742,1.805,.086),"felt",.41,24)
for k,st in [(1,SF),(-1,SR)]:
    for g in (-1,1):
        def floorpan(u,t):
            h=lerp(.148 if k>0 else .190,sill_p(st),sin(pi*u/2)**2)
            outer=cap(k,g*u,h)
            inner=(outer[0],k*1.56,.144+.007*u*u)
            return blend(inner,outer,t)
        under.patch(samples(0,1,24),samples(0,1,13),floorpan,"felt",(0,0,-1))

# Curved field of a Tesla T including the separate outer crown.
def tesla_mark(p,at,scale,key,normal):
    paths=[[(0,-.50),(-.105,.155),(-.36,.24),(-.31,.34),(-.105,.32),(0,.24),(.105,.32),(.31,.34),(.36,.24),(.105,.155)],
           [(-.48,.344),(-.36,.418),(-.17,.474),(0,.49),(.17,.474),(.36,.418),(.48,.344),(.410,.307),(.185,.381),(0,.397),(-.185,.381),(-.410,.307)]]
    for poly in paths:p.face([at(u*scale,v*scale) for u,v in poly],key,normal,False)
badges=part("Dark titanium bonnet emblem and individual TESLA deck letters")
def crest(x,y):
    u=clamp(abs(x)/.87)
    p=deck(1,(1 if x>=0 else -1)*u,.89-y*.98)
    return (x,p[1],p[2]+.0030)
tesla_mark(badges,crest,.096,"badge",(0,.35,1))
letters={"T":[[(-.43,.38),(.43,.38)],[(0,.38),(0,-.42)]],"E":[[(-.40,.37),(.40,.37)],[(-.33,0),(.30,0)],[(-.40,-.37),(.40,-.37)]],
    "S":[[(.37,.37),(-.25,.37),(-.39,.22),(-.30,.07),(.30,-.05),(.39,-.22),(.25,-.37),(-.37,-.37)]],
    "L":[[(-.31,.37),(-.31,-.37),(.39,-.37)]],"A":[[(-.40,-.38),(0,.37),(.40,-.38)],[(-.19,-.08),(.19,-.08)]]}
for i,c in enumerate("TESLA"):
    for stroke in letters[c]:
        tube(badges,[fascia(-1,-(i-2)*.104-u*.033,.947+v*.034,.0059) for u,v in stroke],.00235,"badge",7)
tube(badges,[fascia(1,-.532+.029*cos(a),.449+.028*sin(a),.0008) for a in samples(0,2*pi,37)],.0014,"trim",5)
trunk=part("Boot opening flange, handle and registration recess")
for g in (-1,1):
    shape=[(.607,.849),(.615,.834),(.605,.777),(.592,.707),(.573,.658),(.548,.639),(.35,.628),(0,.624)]
    tube(trunk,[fascia(-1,g*x,h,.0016) for (x,h),(xx,hh) in zip(shape,shape[1:]) for x,h in
                   [blend((x,h),(xx,hh),t) for t in samples(0,1,7)]],.0026,"rubber",6)
    tube(trunk,[fascia(-1,g*x,.852,.0041) for x in samples(.001,.590,56)],.0032,"frit")
    def garnish(x,q):
        h=.852+.015*q+.004*(x/.603)**2
        return fascia(-1,g*x,h,.007+.006*sin(pi*q))
    trunk.patch(samples(0,.601,52),[0,.18,.49,.77,1],garnish,"trim",(g*.23,-1,-.15))
rb(trunk,(0,fascia(-1,0,.834)[1]-.002,.834),(.079,.005,.007),"trim",.48,20)

active="04 • Mirrors and interior"
for g,label in [(-1,"Left"),(1,"Right")]:
    mirror=part(label+" door mirror")
    root=flank(g,S(257),Z(144),-.003)
    def stem(t,a):
        p=blend(root,(g*.948,S(266),Z(138)),t)
        return add(p,(g*.011*cos(a),(.061-.020*t)*sin(a),.015*cos(a)))
    def rings(mesh,ts,angles,fn,key,nrm):
        for t,q in zip(ts,ts[1:]):
            for a,b in zip(angles,angles[1:]):
                m=(t+q)*.5;v=(a+b)*.5
                mesh.face([fn(t,a),fn(q,a),fn(q,b),fn(t,b)],key(m,v),nrm(m,v))
    rings(mirror,samples(0,1,12),samples(0,2*pi,31),stem,lambda t,a:"trim",
          lambda t,a:(g*.40*cos(a),sin(a),cos(a)))
    def capmirror(t,a):
        shape=Spline([(-1,.75),(-.79,.92),(-.28,1),(.26,.90),(.75,.60),(1,.011)])(t)
        return (g*(.946+.0985*shape*cos(a)-.006*t),S(272)+.103*t-.016*cos(a)*shape,
                Z(132)+.050*shape*sin(a)+.007*t+.006*cos(a))
    rings(mirror,samples(-1,1,23),samples(0,2*pi,52),capmirror,
        lambda t,a:"trim" if t<-.89 or sin(a)<-.48 else "paint",
        lambda t,a:(g*cos(a),t*.55,sin(a)))
    def mirror_glass(a,u):
        rim=capmirror(-1,a);return blend((g*.952,S(272)-.106,Z(132)-.007),rim,u)
    mirror.patch(samples(0,2*pi,47),[.0001,.79,.91,1],mirror_glass,
        lambda a,u:"chrome" if u<.91 else "trim",(0,-1,0))

cabin=part("Minimal dashboard, textile fascia and ambient strip")
rb(cabin,(0,.887,.786),(.778,.230,.088),"leather",.46,26)
rb(cabin,(0,.697,.799),(.754,.033,.036),"textile",.41,26)
vent=[(x,.669+.052*(x/.74)**2,.814+.012*(x/.74)**2) for x in samples(-.735,.735,53)]
tube(cabin,vent,.008,"frit",8);tube(cabin,[add(p,(0,0,.010)) for p in vent],.0025,"ambient")
screen=part("IPB11 16 inch QHD central display and console")
def display(u,v,depth=0):
    return (u*.1771,.567+.020*v-depth,.840+.0997*v)
rim=[(-1.026,-1.046),(1.026,-1.046),(1.026,1.046),(-1.026,1.046)]
screen.face([display(u,v,-.018) for u,v in rim],"trim",(0,1,-.18),False)
for a,b in zip(rim,rim[1:]+rim[:1]):
    screen.face([display(*a,0),display(*b,0),display(*b,-.018),display(*a,-.018)],
                "trim",(a[0]+b[0],0,a[1]+b[1]),False)
def rectangle(cw,ch,z,material):
    xy=[(-cw,-ch),(cw,-ch),(cw,ch),(-cw,ch)]
    screen.face([display(u,v,z) for u,v in xy],material,(0,-1,.18),False,
                [(.5+u/(2*cw),.5+v/(2*ch)) for u,v in xy])
rectangle(1.026,1.046,0,"frit")
rectangle(1,1,.0014,"screen")
rb(screen,(0,.145,.490),(.139,.327,.060),"leather",.38)
rb(screen,(0,.391,.561),(.128,.142,.028),"trim",.32)
for x in (-.069,.069):
    rb(screen,(x,.374,.586),(.052,.087,.008),"textile",.31)
    tube(screen,[(x-.027,.312,.594),(x+.027,.312,.594)],.0019,"trim")
rb(screen,(0,-.211,.526),(.127,.015,.077),"trim",.26)
rb(screen,(0,-.228,.530),(.118,.002,.067),"frit",.22)
for x in (-.067,.067):
    tube(screen,[(x+.048*cos(a),.103+.049*sin(a),.552) for a in samples(0,2*pi,29)],.0041,"trim")
wheel=part("Left-hand-drive touch steering wheel")
rr=[(-.371+.161*cos(a),.504-.061*sin(a),.794+.147*sin(a)) for a in samples(0,2*pi,64)]
tube(wheel,rr,.0155,"leather",11)
rb(wheel,(-.371,.501,.792),(.069,.043,.054),"leather",.49)
for dir in (-1,1):
    tube(wheel,[(-.371+dir*.027,.499,.797),(-.371+dir*.096,.493,.805),rr[0 if dir>0 else 32]],.014,"trim")
    rb(wheel,(-.371+dir*.087,.475,.805),(.012,.006,.007),"chrome",.53,13)
    tube(wheel,[(-.371+dir*.035,.493,.762),(-.371+dir*.059,.524,.697),rr[48]],.009,"chrome",7)
tube(wheel,[(-.410,.543,.777),(-.449,.554,.785),(-.551,.581,.819)],.006,"trim",8)
rb(wheel,(-.551,.580,.818),(.021,.010,.012),"trim",.54,15)
seats=part("Front ventilated seats, rear bench and safety belts")
for g in (-1,1):
    x=g*.374
    rb(seats,(x,-.041,.465),(.214,.223,.066),"leather",.55,25)
    rb(seats,(x,-.233,.769),(.206,.075,.260),"leather",.56,28)
    rb(seats,(x,-.269,1.095),(.108,.069,.130),"leather",.71,29)
    rb(seats,(x,-1.038,.710),(.242,.086,.229),"leather",.59)
    rb(seats,(x,-1.076,1.029),(.108,.061,.099),"leather",.57)
    for d in (-1,1):
        rb(seats,(x+d*.163,-.186,.748),(.054,.051,.163),"leather",.69)
        tube(seats,[(x+d*.102,-.160,.573),(x+d*.119,-.153,.738),(x+d*.095,-.168,.907)],.002,"stitch",5)
    for st in (.27,-.60):
        rb(seats,(g*.77,st,.617),(.046,.282,.132),"textile",.44)
        rb(seats,(g*.740,st,.627),(.056,.212,.043),"leather",.51)
        tube(seats,[(g*.753,st+ds,.797+.009*ds) for ds in samples(-.329,.34,28)],.0021,"ambient")
    tube(seats,[(g*.695,-.34,1.168),(g*.665,-.328,1.048),(g*.536,-.191,.617),(g*.477,-.167,.493)],
          .0125,"rubber",9)
rb(seats,(0,-.885,.448),(.640,.190,.069),"leather",.38,24)
rearview=part("Rearview mirror and windshield cameras")
rb(rearview,(0,.402,1.199),(.103,.025,.029),"trim",.48)
tube(rearview,[(0,.422,1.296),(0,.407,1.222)],.008,"trim")
rearview.patch(samples(0,1,22),samples(-1,1,19),
       lambda t,f:add(roof(lerp(.324,.507,t),f*(.052+.063*t)),(0,0,-.010-.018*sin(pi*t)*(1-f*f))),
       "frit",(0,0,-1))

def roadwheel(g,detail=True):
    """Seven swept graphite fields and seven open vents on the fitted Photon cover."""
    w=Surface()
    def p(d,r,a):
        h=r*sin(a)
        if r>.307 and h<-.316:h=max(-R,-.316+.59*(h+.316))
        return (g*d,r*cos(a),h)
    aa=samples(0,2*pi,96 if detail else 28)
    def lathe(seq,key):
        for (d,r),(e,R1) in zip(seq,seq[1:]):
          for a,b in zip(aa,aa[1:]):
            v=(a+b)*.5
            points=[p(d,r,a),p(d,r,b),p(e,R1,b),p(e,R1,a)]
            use_sidewall=detail and key=="tyre" and min(d,e)>.084
            uv=[(.5-g*s/.671,.5+z/.671) for x,s,z in points] if use_sidewall else None
            w.face(points,"sidewall" if use_sidewall else key,
                    (g*(r-R1),(e-d)*cos(v),(e-d)*sin(v)),tex=uv)
    tire=[(-.107,.219),(-.116,.259),(-.1175,.282),(-.112,.306),(-.101,.324),(-.082,.333),
        (-.070,.3345),(-.055,.3345),(-.052,.330),(-.048,.330),(-.044,.3345),(-.022,.3345),
        (-.020,.330),(-.015,.330),(-.012,.3345),(.013,.3345),(.016,.330),(.022,.330),
        (.025,.3345),(.045,.3345),(.049,.330),(.054,.330),(.059,.3345),(.076,.3345),
        (.091,.330),(.103,.321),(.111,.306),(.117,.282),(.1175,.261),(.113,.240),(.109,.222)]
    lathe(tire if detail else [tire[i] for i in (0,2,4,6,24,26,28,29)],"tyre")
    if detail:
        for d,r in [(.115,.249),(.118,.263),(.115,.291),(.111,.305)]:
            lathe([(d,r-.0007),(d+.0009,r),(d,r+.0007)],"tread")
        for j in range(95):
            a=2*pi*j/95
            for v in (-1,1):
                tube(w,[p(v*d,r,a+v*.055*(d-.032)/.076) for d,r in
                          ((.031,.3349),(.055,.3349),(.078,.3342),(.095,.3286),(.106,.315),(.113,.301))],.00132,"tread",5)
                tube(w,[p(v*d,r,a+.025+v*.031*(d-.057)/.049) for d,r in
                          ((.058,.3347),(.075,.3345),(.094,.3293),(.105,.317))],.00072,"tread",4)
    lathe([(.084,.239),(.105,.246),(.110,.244),(.113,.240),(.109,.234),(.102,.225)],"bladeFacet")
    lathe([(.039,.160),(.043,.158),(.043,.060),(.054,.039),(.054,.001)],"brake")
    lathe([(.031,.226),(.033,.216),(.023,.199),(.016,.001)],"felt")
    if detail:
        for i in range(10):
            a=2*pi*i/10+.106
            w.patch(samples(0,1,8),[-1,0,1],
                    lambda t,v:p(.061+.016*t,lerp(.043,.205,t),a+.07*t+v*lerp(.20,.068,t)),
                    "alloy",(g,0,0))
    for j in range(7):
        beta=2*pi*j/7+pi/2
        span=2*pi/7
        def disk(t,v,offset=0):
            r=lerp(.031,.244,t)
            a=beta+span*v+.041*(1-t)
            base=.113+.008*(1-t)+.006*sin(pi*t)
            q=clamp((v-.143)/.666)
            if v>.812:q=1-clamp((v-.812)/.312)
            # The broad painted field is a tilted and slightly convex blade. The
            # leading bevel and trailing shoulder reflect different sky angles.
            lift=(.009*(q-.50)+.0043*sin(pi*q))*min(1,.25+1.9*t)
            lift*=min(1,10*(1-t)+.15)
            return p(base+lift+offset,r,a)
        verts=samples(0,1,18 if detail else 5)
        for a,b,ma,da,db in [(.124,.145,"bladeFacet",-.002,.001),(.145,.169,"coverEdge",.001,.002),
              (.169,.775,"cover",.002,.0005),(.775,.794,"coverEdge",.0005,-.0005),(.794,.812,"bladeFacet",-.0005,-.0024)]:
            w.patch(verts,samples(0,1,8 if ma=="cover" and detail else 2),
                    lambda t,q:disk(t,lerp(a,b,q),lerp(da,db,q)),ma,(g,0,0))
        tlo,thi=.323,.941
        def opening(t):
            q=clamp((t-tlo)/(thi-tlo))
            capshape=1-(1-min(q/.14,(1-q)/.12,1))**2
            half=lerp(.049,.131,q)*sqrt(max(0,capshape))
            centre=lerp(1.017,.970,q)
            return centre-half,centre+half
        st=sorted(set(samples(tlo,thi,18 if detail else 7)+[tlo+.011,thi-.012]))
        for a,b in [(0,tlo),(thi,1)]:
            w.patch(samples(a,b,9 if detail else 3),samples(.812,1.124,11 if detail else 4),
                lambda t,v:disk(t,v,-.0035-.006*(1-abs(v-.971)/.159)*t),"blade",(g,0,0))
        for side in (-1,1):
            def lip(t,u):
                v0,v1=opening(t)
                outer=.812 if side<0 else 1.124;inner=v0 if side<0 else v1
                v=lerp(outer,inner,u);c=sin(.5*pi*u)
                recess=-.0035-.027*c*c*(.72+.28*sin(pi*clamp((t-tlo)/(thi-tlo))))
                return disk(t,v,recess)
            w.patch(st,[0,.20,.55,.78,1],lip,
                  lambda t,u:"bladeFacet" if u>.55 else "blade",(g,0,0))
            w.patch(st,[0,1],lambda t,q:add(lip(t,1),(-g*.012*q,0,0)),"blade",(g,0,0))
    lathe([(.112,.036),(.122,.035),(.125,.031),(.126,.0275),(.126,.0002)],"blade")
    lathe([(.125,.0308),(.126,.0298)],"coverEdge")
    tesla_mark(w,lambda u,v:(g*.1272,g*u,v),.039,"frit",(g,0,0))
    if detail:
        # Two shallow molded vent details are visible on the close compositor view.
        a=-.269
        centre=p(.103,.205,a)
        ellipsoid(w,centre,(.009,.0048,.0048),"rubber",12,7)
    # Keep the face of the fitted cover inside the published stock body width.
    extent=max(g*x for x,y,z in w.vertices);limit=(W-TRACK)/2
    def calibrate(p):
        x,y,z=p;depth=x*g
        if depth>.103 and extent>limit:depth=lerp(.103,limit,(depth-.103)/(extent-.103))
        return (g*depth,y,max(-R,z))
    w.vertices=[calibrate(point) for point in w.vertices]
    return w

collections={}
def collect(o,k):
    if k not in collections:
        collections[k]=bpy.data.collections.new(k);bpy.context.scene.collection.children.link(collections[k])
    for c in list(o.users_collection):c.objects.unlink(o)
    collections[k].objects.link(o)
def calibrated_vertex(v,name):
    x,y,z=v
    if -y>SF:y-=((L/2-actual_front)*clamp((-y-SF)/(actual_front-SF)))
    if y> -SR:y+=(L/2-actual_rear)*clamp((y+SR)/(actual_rear+SR))
    x*=((2.089/2)/actual_mirror if "door mirror" in name else (W/2)/actual_body)
    if z>1.30:z+=((H-actual_height)*clamp((z-1.30)/(actual_height-1.30)))
    # Once calibrated, round out the lower shoulder by at most 11.2 mm.
    # A linear change in rearward depth across the upper sheet preserves
    # its broad reflection. Both ends of the draw have a C2 transition.
    if y>1.86 and .208<z<.811:
        depth=max(0.,L*.5-y)
        def ease(v):
            t=clamp(v);return t**3*(10+t*(-15+6*t))
        def ramp(v,w):
            t=clamp(v/w);return w*(t**3-.5*t**4)+max(0.,v-w)
        q=.810-z
        height=(ramp(q,.080)-ramp(q-.190,.070))/.185
        gate=ease(abs(x)/.55)*ease((.485-depth)/.255)*ease((z-.210)/.147)
        y+=.0112*(1-exp(-depth/.017))*gate*height
    return (x,y,z)
actual_front=max(-y for _,_,a in parts for x,y,z in a.vertices)
actual_rear=max(y for _,_,a in parts for x,y,z in a.vertices)
actual_mirror=max(abs(x) for _,name,a in parts if "door mirror" in name for x,y,z in a.vertices)
actual_body=max(abs(x) for _,name,a in parts if "door mirror" not in name for x,y,z in a.vertices)
actual_height=max(z for _,_,a in parts for x,y,z in a.vertices)
class PocketReturn:
    """Tooling surface between the registration recess and bumper shoulder.

    Read the current full-size pressing, including its mounting flange. Each
    longitudinal section joins that flange to the measured lower crease on a
    single gradually turning curve. Adjacent hardware follows the same draw.
    """
    def __init__(self,blank):
        vertices=[calibrated_vertex(p,"rear pressing") for p in blank.vertices]
        self.surface=BVHTree.FromPolygons(vertices,blank.faces,all_triangles=False)

    @lru_cache(maxsize=65536)
    def station(self,x,h):
        point,_,_,_=self.surface.ray_cast((x,3.25,h),(0,-1,0),2.0)
        if point is None:
            raise ValueError("Rear pressing has no transverse section at %r" % ((x,h),))
        return -point.y

    @lru_cache(maxsize=65536)
    def draw(self,x,h):
        # Both sides are cut from the same tool. The shoulder-to-pocket web
        # spans 405 mm transversely; the ends blend into the existing sheet.
        top=.733146
        if not (.371685<x<.776177 and .31<h<top+.002):return 0.
        theta=atan2(x-.550,-1.945-self.station(x,h))
        crease=.548550-.056*(sin(theta)-.64)
        span=top-crease
        rise=h-crease
        above=.5*(hypot(rise,.005)+rise)
        below=above-rise
        if above>=span:return 0.
        high=self.station(x,top)
        low=self.station(x,crease)
        flange_slope=.819986*(self.station(x,top+.012)-self.station(x,top-.012))/.024
        average=(high-low)/span
        t=1.-above/span
        ruled=high-span*(flange_slope*t+(average-flange_slope)*t**1.479228)
        lateral=ease_scalar((x-.371685)/.127087)*ease_scalar((.776177-x)/.127938)
        release=exp(-(below/.046739)**2)*ease_scalar((top+.002-h)/.028)
        return .936226*lateral*release*(ruled-self.station(x,crease+above))

def ease_scalar(v):
    t=clamp(v)
    return t**3*(10+t*(-15+6*t))

cover=next(mesh for _,name,mesh in parts if name=="Liftgate face and rear bumper")
pocket_return=PocketReturn(cover)

def adjust(v,name):
    x,y,h=calibrated_vertex(v,name)
    if y>1.83:
        y-=pocket_return.draw(abs(x),h)
    return x,y,h

coach=[]
for group,name,a in parts:
    a.vertices=[adjust(v,name) for v in a.vertices]
    ob=a.export_object(name,mats);collect(ob,group);coach.append(ob)

# Street dressing is a separate accessory so the showroom can reproduce the
# manufacturer photography. The registration is fictional.
plates=[]
for k,label,hc in [(1,"Front",.403),(-1,"Rear",.746)]:
    mesh=Surface()
    pitch=.082 if k>0 else .242
    stations=[fascia(k,k*.24*u,hc+.070*v)[1]-pitch*.070*v+k*.006*u*u
              for u in samples(-1,1,16) for v in samples(-1,1,18)]
    mounting_station=(max(stations) if k>0 else min(stations))+k*.007
    def platepoint(u,v,depth):
        x=k*.24*u;h=hc+.070*v
        # A shallow display carrier on the convex front bumper pitches with its
        # local tangent. Both ends remain supported by the screw bosses.
        station=mounting_station+pitch*(h-hc)-k*.006*u*u
        return (x,station+k*depth,h)
    us=samples(-1,1,18);vs=samples(-1,1,7)
    for a,b in zip(us,us[1:]):
      for v,w in zip(vs,vs[1:]):
        cell=[(a,v),(b,v),(b,w),(a,w)]
        mesh.face([platepoint(i,j,.0035) for i,j in cell],"plate",(0,k,0),
                  tex=[((i+1)/2,(j+1)/2) for i,j in cell])
    corners=[(-1,-1),(1,-1),(1,1),(-1,1)]
    for a,b in zip(corners,corners[1:]+corners[:1]):
        line=[platepoint(*blend(a,b,t),.0039) for t in samples(0,1,19)]
        tube(mesh,line,.0021,"trim",7)
        mesh.face([platepoint(*a,-.005),platepoint(*b,-.005),platepoint(*b,.0035),platepoint(*a,.0035)],
                  "trim",(a[0]+b[0],0,a[1]+b[1]))
    for u in (-.78,.78):
        for v in (-.79,.79):
            c=platepoint(u,v,.0046);ellipsoid(mesh,c,(.0041,.0022,.0041),"chrome",10,5)
    if k<0:mesh.vertices=[adjust(v,"registration carrier") for v in mesh.vertices]
    ob=mesh.export_object("StreetPlate "+label,mats)
    ob["street_plate"]=True;ob["registration_type"]="Fictional Shenzhen small new-energy plate"
    collect(ob,"07 • Removable Shenzhen road registration");plates.append(ob)
    if k<0:
        display=Surface()
        display.patch(samples(-.788,.788,24),[-1.111,1.111],
            lambda u,v:platepoint(u,v,-.0019),"plateMetal",(0,-1,0))
        display_letters={
          "M":[[(0,0),(0,1),(.45,.42),(.9,1),(.9,0)]],
          "O":[[(.1,0),(0,.15),(0,.86),(.14,1),(.77,1),(.90,.86),(.90,.15),(.79,0),(.1,0)]],
          "D":[[(0,0),(0,1),(.56,1),(.86,.78),(.86,.23),(.56,0),(0,0)]],
          "E":[[(.85,1),(0,1),(0,0),(.85,0)],[(0,.51),(.72,.51)]],
          "L":[[(0,1),(0,0),(.86,0)]],
          "3":[[(0,1),(.75,1),(.9,.78),(.62,.52),(.89,.29),(.76,0),(0,0)],[(.2,.52),(.62,.52)]],
        }
        for idx,char in enumerate("MODEL 3"):
            for stroke in display_letters.get(char,[]):
                tube(display,[platepoint((idx-3.47)*.133+x*.108,(v-.5)*.48,-.0009)
                               for x,v in stroke],.0008,"trim",6)
        display.vertices=[adjust(v,"registration carrier") for v in display.vertices]
        ob=display.export_object("Recessed rear MODEL 3 configurator plaque",mats)
        collect(ob,"01 • Coachwork pressings");coach.append(ob)
placements=[("wheel_LF",-1,FA),("wheel_RF",1,FA),("wheel_LR",-1,RA),("wheel_RR",1,RA)]
wheels=[];prototypes={}
for name,g,s in placements:
    if g not in prototypes:
        w=roadwheel(g);ob=w.export_object(name,mats,(g*TRACK/2,s,R));prototypes[g]=ob
    else:
        ob=bpy.data.objects.new(name,prototypes[g].data);bpy.context.collection.objects.link(ob)
        ob.location=(g*TRACK/2,-s,R)
    collect(ob,"05 • Photon wheels");ob["rolling_radius"]=R;ob["tyre"]="235/45R18"
    ob["size"]="18 x 8.5 J ET38";wheels.append(ob)
anchor=coach[0];anchor["design_reference"]="Tesla China Model 3 RWD / MT382 / PN01 / W38A / IPB11"
anchor["body_dimensions_m"]=[L,W,H];anchor["wheelbase_m"]=WB
sc=bpy.context.scene;sc.unit_settings.system="METRIC";sc.unit_settings.length_unit="METERS"
sc["reference"]=CONFIG;sc["dimensions_source"]=MANUAL;sc["wheel_reference"]=PHOTON
sc["configuration"]="MT382 / PN01 / W38A / IPB11"
sc["market"]="Tesla 中国 · 后轮驱动版 · 星空灰 · 18英寸光子轮毂 · 深色高级内饰"
sc["dimensions_m"]="4.720 x 1.848 x 1.442; unfolded mirrors 2.089; wheelbase 2.875"
sc["geometry_note"]="Original reconstructed surfaces from public elevations; dimensions in metres."

# Save the editable project with a native studio camera that is excluded from GLB exports.
studio="06 • Studio"
def camera(name,pos,look,lens):
    data=bpy.data.cameras.new(name);o=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(o)
    o.location=pos;o.rotation_euler=(Vector(look)-Vector(pos)).to_track_quat("-Z","Y").to_euler()
    data.lens=lens;collect(o,studio);return o
def factory_camera(name,eye,target,vertical_fov):
    def blender(p):return (p[0],-p[2],p[1])
    o=camera(name,blender(eye),blender(target),12/tan(radians(vertical_fov)/2))
    o.data.sensor_fit="VERTICAL";o.data.sensor_height=24
    return o
cam=factory_camera("Model 3 · STUD_FRONT34",(4.560252,.8147661,3.8303095),(0,.6364665,.37393),44.1551739);sc.camera=cam
factory_camera("Model 3 · STUD_SIDE",(6.7535436,.6644278,.2919665),(0,.6208283,-.0187802),40.8586742)
factory_camera("Model 3 · STUD_REAR34",(5.8366641,.8862789,-5.6470877),(0,.6746467,-.3815446),33.2233633)
world=bpy.data.worlds.new("PN01 white sweep and longitudinal reflection cards");sc.world=world;world.use_nodes=True
nodes=world.node_tree.nodes
studio_map=OUT/"model3-studio.hdr"
if not studio_map.exists():
    subprocess.run([shutil.which("python") or "python",str(ROOT/"scripts/model3_studio.py"),str(studio_map)],check=True)
hdri=nodes.new("ShaderNodeTexEnvironment");hdri.image=bpy.data.images.load(str(studio_map))
world.node_tree.links.new(hdri.outputs["Color"],nodes["Background"].inputs["Color"])
nodes["Background"].inputs["Strength"].default_value=1.05
def softbox(name,pos,size,power):
    data=bpy.data.lights.new(name,"AREA");data.energy=power;data.shape="DISK";data.size=size
    o=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(o);o.location=pos
    o.rotation_euler=(Vector((0,0,.7))-Vector(pos)).to_track_quat("-Z","Y").to_euler();collect(o,studio)
softbox("Soft studio fill",(-3,-3,5.4),5.6,94)
softbox("Boot rim fill",(2.9,3.9,4.8),5.1,74)
sc.render.engine="CYCLES";sc.cycles.samples=32;sc.cycles.use_denoising=True
sc.render.resolution_x=1440;sc.render.resolution_y=810;sc.render.resolution_percentage=100
sc.render.film_transparent=True
for area in bpy.context.screen.areas:
    if area.type=="VIEW_3D":
        sp=area.spaces.active;sp.region_3d.view_distance=5.9;sp.region_3d.view_location=(0,0,.72)
        sp.region_3d.view_rotation=cam.rotation_euler.to_quaternion();sp.shading.type="MATERIAL"
bpy.context.preferences.filepaths.save_version=0
bpy.ops.object.select_all(action="DESELECT");bpy.context.view_layer.objects.active=anchor
bpy.ops.file.pack_all()
native=ROOT/"models/特斯拉Model3.blend";native.parent.mkdir(exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(native),compress=True)

def export(obs,target):
    bpy.ops.object.select_all(action="DESELECT")
    for o in obs:o.select_set(True)
    bpy.context.view_layer.objects.active=obs[0]
    bpy.ops.export_scene.gltf(filepath=str(target),export_format="GLB",use_selection=True,export_yup=True,
                  export_extras=True,export_normals=True,export_animations=False,export_cameras=False,export_lights=False)
authored=TEMP/"model3-highland-source.glb";hero=OUT/"model3-detail.glb"
export(coach+wheels+plates,authored)
subprocess.run([shutil.which("npx.cmd") or "npx","--yes","gltfpack@1.3.0","-i",str(authored),
      "-o",str(hero),"-cc","-ce","ext","-si","0.65","-se","0.00013","-slb","-kn","-km","-ke",
      "-vp","16","-vn","12"],check=True)

class Batch:
    def __init__(self):
        self.verts=[];self.faces=[];self.colors=[];self.indices={}
    def face(self,vs,key):
        face=[]
        for p in vs:
            v=tuple(round(e,5) for e in p)
            if v not in self.indices:
                self.indices[v]=len(self.verts);self.verts.append(v)
            face.append(self.indices[v])
        if len(set(face))>2:self.faces.append(face);self.colors.append(key)
    def object(self,name):
        data=bpy.data.meshes.new(name);data.from_pydata(self.verts,[],self.faces)
        keys=list(dict.fromkeys(self.colors))
        for mat in keys:data.materials.append(mat)
        for i,f in enumerate(data.polygons):
            f.material_index=keys.index(self.colors[i]);f.use_smooth=True
        data.update();ob=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(ob);return ob
def simplified(far):
    batch=Batch()
    for o in coach:
        n=o.name.lower()
        if "wraparound smoked lamp" in n or "liftgate face and rear bumper" in n:continue
        if any(k in n for k in ("central display","steering","rearview","defroster","emblem")):continue
        if far and any(k in n for k in ("textile","safety belt","flanges","door mirror","handles","cowl","battery")):continue
        clothes=("front wing","quarter pressing","rear door","front door","bumper","lip spoiler","front luggage lid")
        pane=("glazing","roof","windscreen","side rail")
        b=420 if any(k in n for k in clothes) else 230 if any(k in n for k in pane) else 130
        if far:b=max(15,round(b*.12))
        if "liftgate face" in n or "boot lid" in n:b=146 if far else 760
        mod=o.modifiers.new("Preserve visible silhouette","DECIMATE")
        mod.ratio=clamp(b/max(1,len(o.data.polygons)*1.8),.0030,1)
        deps=bpy.context.evaluated_depsgraph_get();e=o.evaluated_get(deps);mesh=e.to_mesh()
        for f in mesh.polygons:
            mat=o.data.materials[f.material_index]
            if mat==mats["lens"]:continue
            if far and mat in (mats["door_glass"],mats["glass"],mats["backglass"],mats["quarterGlass"],mats["headerGlass"],mats["roof_glass"]):mat=mats["frit"]
            batch.face([o.matrix_world@mesh.vertices[j].co for j in f.vertices],mat)
        e.to_mesh_clear();o.modifiers.remove(mod)
    for profile in fleet_lamps[far]+fleet_apron[far]:
        for face,key in zip(profile.faces,profile.names):
            batch.face([adjust(profile.vertices[j],"road profile") for j in face],mats[key])
    return batch
near=simplified(False).object("Coachwork")
near["design_reference"]="Tesla Model 3 RWD / 18-inch Photon";near["body_dimensions_m"]=[L,W,H];near["wheelbase_m"]=WB
far=simplified(True)
def distant_wheel(batch,g,s):
    n=12;tyre=mats["tyre"];dark=mats["blade"];grey=mats["cover"]
    def at(d,r,a):return (g*(TRACK/2+d),-(s+r*cos(a)),R+r*sin(a))
    def surf(verts,mat,normal):
        m=(Vector(verts[1])-Vector(verts[0])).cross(Vector(verts[-1])-Vector(verts[0]))
        batch.face(verts if m.dot(Vector(normal))>0 else list(reversed(verts)),mat)
    for j in range(n):
        a,b=samples(j*2*pi/n,(j+1)*2*pi/n,1)
        for d,r,e,rr in [(-.085,.284,-.082,R),(-.082,R,.077,R),(.077,R,.114,.287),(.114,.287,.110,.226)]:
            surf([at(d,r,a),at(d,r,b),at(e,rr,b),at(e,rr,a)],tyre,(g*(r-rr),-(e-d)*cos(a),(e-d)*sin(a)))
        surf([at(.11,.225,a),at(.11,.225,b),at(.113,.002,b)],grey if j%2 else dark,(g,0,0))
for _,g,s in placements:distant_wheel(far,g,s)
far_o=far.object("Distant Model 3 silhouette");far_o["distant_vehicle"]=True
for ob in wheels:ob.name="Editable "+ob.name
traffic=[near,far_o];rolling={}
for name,g,s in placements:
    if g not in rolling:
        ob=roadwheel(g,False).export_object(name,mats,(g*TRACK/2,s,R));rolling[g]=ob
    else:
        ob=bpy.data.objects.new(name,rolling[g].data);bpy.context.collection.objects.link(ob)
        ob.location=(g*TRACK/2,-s,R)
    ob["rolling_radius"]=R;traffic.append(ob)
# The fleet reuses a low-cost opaque plate silhouette without a shared serial.
fleetplates=Batch()
for plate in plates:
    for f in plate.data.polygons:
        if plate.data.materials[f.material_index]!=mats["plate"]:continue
        # The repeated moving cars carry the plate colour but no duplicate number.
        fleetplates.face([plate.data.vertices[i].co for i in f.vertices],mats["plate"])
fleetplate=fleetplates.object("Fleet green registrations")
flatplate=m("Local EV plate green","#9FD1AB",.1,.43)
for i in range(len(fleetplate.data.materials)):fleetplate.data.materials[i]=flatplate
traffic.append(fleetplate)
export(traffic,OUT/"model3.glb")
print("MODEL3 COMPLETE",native,native.stat().st_size,hero.stat().st_size,(OUT/"model3.glb").stat().st_size,
      "polygons",len(near.data.polygons),len(far_o.data.polygons))
