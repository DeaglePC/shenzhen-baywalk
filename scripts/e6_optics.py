"""Second-generation e6 fascia tooling, in metres (right, forward, up).

The bonnet edge and wrapped bumper shapes are supplied by the coachwork.
The radiator cover is a perforated, bevelled mesh with separate dark wells.
Optical surfaces are drawn as housings, reflectors, guides and outer lenses.
"""
from math import sin, cos, pi, sqrt, exp
from mathutils import Vector
from vehicle_build import material, samples, rod


def mix(a, b, u):
    return (1-u)*a + u*b


def ordinate(points, x):
    """Cubic profile with zero slope across local maxima and minima."""
    if x <= points[0][0]:
        return points[0][1]
    slope = [(b[1]-a[1])/(b[0]-a[0]) for a, b in zip(points, points[1:])]
    def tangent(i):
        if i == 0:
            return slope[0]
        if i == len(points)-1:
            return slope[-1]
        a, b = slope[i-1:i+1]
        return 2*a*b/(a+b) if a*b > 0 else 0.
    for i, ((a, l), (b, h)) in enumerate(zip(points, points[1:])):
        if x <= b:
            t = (x-a)/(b-a)
            return l*(1-t)**2*(1+2*t) + h*t*t*(3-2*t) + (
                tangent(i)*t*(1-t)**2 + tangent(i+1)*t*t*(t-1))*(b-a)
    return points[-1][1]


def face_mesh(surface, point, key, u, v, normal, smooth=True):
    surface.patch(u, v, point, key, normal, smooth)


def ring_loop(surface, rings, materials, normal):
    for a, b, key in zip(rings, rings[1:], materials):
        for i in range(len(a)):
            j = (i+1) % len(a)
            surface.face([a[i], a[j], b[j], b[i]], key, normal)


def face_disk(surface, ring, center, key, normal, smooth=True):
    for i, a in enumerate(ring):
        surface.face([a, ring[(i+1) % len(ring)], center], key, normal, smooth)


def artist_mats(mats):
    # Real hot-stamped reflectors, moisture seals, inked chrome and acrylic
    # guides export as glTF PBR. The outside clearcoat sits on its own surface.
    definitions = [
        ('optic_smoke','Lamp housing graphite','#0C1013',.10,.34,0,.24),
        ('optic_mouth','Radiator aperture depth','#162022',.04,.71,0,0),
        ('optic_valance','Textured intake and air guides','#111415',.007,.76,0,0),
        ('optic_well','Stamped shadow inside vents','#596466',.10,.49,0,.15),
        ('optic_nickel','Nickel vapour reflector','#D5DCDC',.89,.118,0,.65),
        ('optic_flute','Faceted chrome reflector','#96A2A8',.91,.215,0,.72),
        ('optic_iris','Projector optical glass','#314348',.60,.12,0,.92),
        ('optic_coating','Projector bluish antireflection','#61777D',.47,.16,0,.91),
        ('optic_guide','White ribbon diffuser','#DFE8E3',.16,.19,.19,.72),
        ('optic_facet','Ruby tail waveguide','#B91E29',.38,.185,.275,.76),
        ('optic_ruby','Tail acrylic blackout edge','#660E1A',.33,.24,.045,.8),
        ('optic_red','Stop lamp diffuser','#CF2833',.27,.19,.29,.88),
        ('optic_bright','Reverse light prism','#C9D0CC',.52,.24,0,.79),
        ('optic_ink','Blue enamel company medallion','#16223E',.38,.16,0,.93),
        ('optic_shield','Headlight moulded polycarbonate','#CFDEE0',.06,.086,0,.97),
    ]
    for key, name, rgb, metal, rough, glow, coat in definitions:
        mats[key] = material(name, rgb, metal, rough, glow, coat)
    shield = mats['optic_shield'].node_tree.nodes.get('Principled BSDF')
    shield.inputs['Alpha'].default_value = .074


def grille(ctx):
    mesh = ctx.part('Front • perforated porcelain radiator cover')
    skin = ctx.front
    normal = (0, 1, 0)
    width = [(0,.443),(.055,.483),(.15,.512),(.32,.533),(.425,.536),
             (.57,.519),(.83,.460),(1,.408)]
    def fit(u, v, depth):
        w = ordinate(width,v)
        x = w*u
        z = mix(.340+.031*u*u,.634+.012*u*u,v)
        return skin(x,z,depth)
    rows, cols = 15, 30
    # A square-to-circle ring covers each cell completely. Its inner ring
    # remains open to the recessed well, with bevel highlights on both edges.
    angles = [pi/4 + k*pi/6 for k in range(12)]
    for iy in range(rows):
        v = (iy+.5)/rows
        for ix in range(cols):
            u = (ix+.5)*2/cols-1
            center_u = u + (-1 if iy%2 else 1)*.205/cols*2
            size = .69+.43*exp(-((v-.54)/.31)**2)
            size *= 1-.39*abs(u)**2.8
            # The punched dots are narrow horizontal ovals staggered across the cover.
            def oval(a, r, deep):
                return fit(center_u+cos(a)*.53/cols*size*r,
                           v+sin(a)*.206/rows*size*r+.024*cos(a)*u/rows,deep)
            square = [fit(u+cos(a)/max(abs(cos(a)),abs(sin(a)))/cols,
                          v+sin(a)/max(abs(cos(a)),abs(sin(a)))/rows*.5,.0095) for a in angles]
            collar = [oval(a,1.27,.0095) for a in angles]
            rim = [oval(a,1.09,.00945) for a in angles]
            throat = [oval(a,1,.0085) for a in angles]
            bottom = [oval(a,.84,.0030) for a in angles]
            ring_loop(mesh,[square,collar,rim,throat,bottom],['white','white','white','optic_mouth'],normal)
            face_disk(mesh,bottom,fit(center_u,v,.003),'optic_mouth',normal,False)
    for side in (-1,1):
        path = [fit(side,v,.0084) for v in samples(0,1,50)]
        rod(mesh,path,.0012,'white',6)
    # Body-coloured tow eye closure with finger notch.
    for side in (-1,):
        x,h = .405*side,.418
        for radius,depth,key in ((.033,.0108,'optic_well'),(.0308,.0115,'white')):
            circle=[skin(x+cos(a)*radius,h+sin(a)*radius,depth) for a in samples(0,2*pi,36)[:-1]]
            face_disk(mesh,circle,skin(x,h,depth),key,normal)
        rod(mesh,[skin(x+.010*t,h-.017+.002*(1-t*t),.0123) for t in samples(-1,1,10)],.00085,'optic_well',5)


def arc_for_x(ctx, direction, x, h):
    lo, hi = 0.,1.
    for _ in range(18):
        m=(lo+hi)*.5
        if ctx.cap(direction,m,h)[0] < abs(x):
            lo=m
        else:
            hi=m
    return (lo+hi)*.5


def headlamp(ctx, g):
    lamp = ctx.part(('Left' if g<0 else 'Right')+' • projector, light guide and optic bucket')
    clear = ctx.part(('Left' if g<0 else 'Right')+' • clear outer headlamp')
    normal=(g*.6,.8,.10)
    # Upper and lower tooling edges measured on the calibrated bumper surface.
    # Beyond q=1 the optical mould continues along the front quarter panel.
    upper=[(0.3906,0.7212),(0.4407,0.7391),(0.4935,0.7515),(0.5555,0.7668),(0.6178,0.7796),
           (0.6909,0.7918),(0.7545,0.7997),(0.8508,0.8097),(0.9762,0.8214),(1.0745,0.8306),
           (1.1394,0.8407),(1.1709,0.8432)]
    lower=[(0.4228,0.6438),(0.4653,0.6527),(0.5171,0.6600),(0.5788,0.6605),(0.6328,0.6599),
           (0.7045,0.6664),(0.7647,0.6737),(0.8459,0.6864),(0.9469,0.7146),(1.0522,0.7560),
           (1.1184,0.7995),(1.1659,0.8367)]
    def point(t, v, off):
        a=mix(upper[0][0],upper[-1][0],t)
        b=mix(lower[0][0],lower[-1][0],t)
        q=mix(b,a,v)
        h=mix(ordinate(lower,b),ordinate(upper,a),v)
        if q<=1:
            return ctx.cap(1,g*q,h,off)
        return ctx.flank(g,1.776-(q-1)*.8,h,off)
    def surface(part,key,off,t0,t1,v0,v1,nt=32,nv=3):
        face_mesh(part,lambda a,b:point(a,b,off(a,b) if callable(off) else off),key,
                  samples(t0,t1,nt),samples(v0,v1,nv),normal)
    surface(lamp,'seal',.0034,0,1,0,1)
    surface(lamp,'optic_smoke',.0064,.012,.985,.033,.962)
    # Extruded light guide folds around the lower edge and bends up at the tail.
    for n,key,d in [(.085,'optic_flute',.0095),(.044,'optic_guide',.0165)]:
        def level(a):
            return ordinate([(.045,.165),(.22,.136),(.48,.16),(.60,.22),(.72,.41),(.84,.70),(.955,.81)],a)
        face_mesh(lamp,lambda a,b:point(a,level(a)+(b-.5)*2*n,d),key,
                  samples(.047,.955,48),[0,.5,1],normal)
    rod(lamp,[point(.043+.018*b,.182+.56*b,.0125) for b in samples(0,1,11)],
        .0023,'optic_nickel',6)
    # Deep, faceted twin reflector bowls. The varying depth and normal on each
    # facet catch the street's reflections separately on the exported model.
    for ta,tb,va,vb,style in [(.058,.192,.21,.748,0),(.210,.421,.21,.798,1)]:
        nt,nv=12,6
        for i in range(nt):
            for j in range(nv):
                corners=[]
                for ii,jj in ((i,j),(i+1,j),(i+1,j+1),(i,j+1)):
                    a,b=ii/nt,jj/nv
                    taper = sin(pi*a)**.42
                    py = mix((va+vb)*.5,mix(va,vb,b),.54+.46*taper)
                    skew = (.031 if style else -.018)*(b-.5)
                    f=(2*a-1)**2*.52+(2*b-1)**2*.48
                    d=.009+.018*f+(.0015+.0018*abs(2*b-1))*sin(ii*pi*.5)
                    corners.append(point(mix(ta,tb,a)+skew,py,d))
                key='optic_nickel' if j>=nv//2 else 'optic_flute'
                lamp.face(corners,key,normal,False)
        rail=[point(mix(ta,tb,a),vb,.0205) for a in samples(0,1,12)]
        rod(lamp,rail,.00165,'optic_nickel',6)
    # Free-form high-beam parabola, aluminised sector facets and shielded
    # halogen tip, adjacent to the projector. The pear-shaped outline follows
    # the dipping lower edge of the actual reflector.
    angle=samples(0,2*pi,32)[:-1]
    metallic_rings=[]
    for radius,depth in [(1,.021),(.91,.028),(.64,.016),(.30,.011),(.12,.019)]:
        loop=[]
        for i,a in enumerate(angle):
            t=.276+radius*(.103*cos(a)-.012*sin(a))
            v=.521+radius*(.272*sin(a)+.038*cos(a))
            flute=.0024*cos(a*8)*radius+.0012*sin(a*3)
            loop.append(point(t,v,depth+flute))
        metallic_rings.append(loop)
    for j,(outer,inner) in enumerate(zip(metallic_rings,metallic_rings[1:])):
        for i,a in enumerate(angle):
            k=(i+1)%len(outer)
            key='optic_nickel' if j==0 or sin(a+.5)>.25 else 'optic_flute'
            lamp.face([outer[i],outer[k],inner[k],inner[i]],key,normal,False)
    face_disk(lamp,metallic_rings[-1],point(.276,.521,.028),'optic_nickel',normal)
    rod(lamp,[point(t,.43+.015*i,.029) for i,t in enumerate([.234,.253,.269,.288])],
        .0018,'optic_smoke',6)
    # Straight ribs of the small inboard turn-signal chamber are moulded into
    # clear acrylic, in front of its fluted metal backing.
    for a in samples(.068,.166,14):
        rod(lamp,[point(a+.010*b,mix(.31,.68,b),.0185+.003*sin(pi*b))
                  for b in samples(0,1,5)],.00058,'optic_bright',5)
    # Solenoid projector, its retained chrome barrel and convex coated lens.
    u = .431
    C = Vector(point(u,.593,.015))
    horizontal=(Vector(point(u+.004,.593,.013))-Vector(point(u-.004,.593,.013))).normalized()
    horizontal.z=0; horizontal.normalize()
    vertical=Vector((0,0,1)); axis=horizontal.cross(vertical).normalized()
    if axis.dot(Vector(normal))<0:
        axis=-axis
    # The projectors look down the road even where the bumper wraps around
    # the corner. The polished length of the barrel is visible in three-quarter.
    axis=(axis*.44+Vector((g*.10,.995,0))*.56).normalized()
    horizontal=Vector((axis.y,-axis.x,0)).normalized()
    rings=[]
    angle=samples(0,2*pi,48)[:-1]
    for r,d in ((.045,-.008),(.0445,-.003),(.042,.022),(.040,.0255),(.033,.0255),
                (.031,.019),(.030,.026),(.022,.030),(.0105,.034)):
        rings.append([C+horizontal*(r*cos(a))+vertical*(r*sin(a))+axis*d for a in angle])
    ring_loop(lamp,rings,['optic_smoke','optic_flute','optic_nickel','optic_nickel','optic_iris',
                          'optic_nickel','optic_coating','optic_iris'],axis)
    face_disk(lamp,rings[-1],C+axis*.036,'optic_iris',axis)
    # Coating crescent and concave iris are visible under the sealed outer lens.
    for r,arc,d in [(.027,(.40*pi,.91*pi),.0295),(.018,(.36*pi,.69*pi),.033)]:
        rod(lamp,[C+horizontal*r*cos(a)+vertical*r*sin(a)+axis*d for a in samples(*arc,14)],
            .00075,'optic_coating',6)
    # Upper stamped silver blade overlaps the shield shoulder. At the inboard
    # end the blade meets the central chromed wing rather than a second badge.
    surface(lamp,'optic_flute',.012,.005,.982,.857,.983,43,2)
    surface(lamp,'optic_nickel',.0151,.005,.966,.901,.959,45,1)
    surface(clear,'optic_shield',lambda a,b:.021+.017*sin(pi*a)*sin(pi*b),
            .012,.988,.038,.885,35,7)


def nose_wing(ctx):
    mesh=ctx.part('Front • hood closure and chrome wings')
    normal=(0,1,.13)
    def coord(a,v,off):
        ax=abs(a)
        # In the last 65 mm the chrome bends up to the inboard tip of the lamp.
        x=a*.499
        z=ctx.front_top(abs(x))-.0055
        low=ordinate([(0,.637),(.62,.644),(.80,.651),(.85,.661),(1,.706)],ax)
        return ctx.front(x,mix(low,z,v),off)
    for a,b,key,depth in [(0,1,'seal',.003),(.12,.89,'optic_smoke',.0065),
                          (.05,.39,'optic_nickel',.012),(.045,.11,'optic_flute',.014)]:
        face_mesh(mesh,lambda u,v:coord(u,v,depth+(.0026*sin(pi*(v-a)/(b-a)) if key=='optic_nickel' else 0)),key,samples(-1,1,80),samples(a,b,5),normal)
    for h in (.53,.69):
        rod(mesh,[coord(u,h,.0074) for u in samples(-.80,.80,39)],.00165,'black',5)


def emblem(ctx,direction,h):
    mesh=ctx.part(('Front' if direction>0 else 'Tail')+' • cloisonné BYD badge')
    normal=(0,direction,.09)
    skin=ctx.front if direction>0 else ctx.rear
    def pt(x,y,d):
        return skin(x,h+y,d)
    rings=[]
    for sx,sz,depth in ((.066,.0485,.0160),(.065,.048,.022),(.061,.0455,.0245),
                        (.059,.0437,.024),(.052,.0398,.0265)):
        rings.append([pt(cos(a)*sx,sin(a)*sz,depth) for a in samples(0,2*pi,56)[:-1]])
    ring_loop(mesh,rings,['optic_flute','chrome','optic_nickel','optic_ink'],normal)
    face_disk(mesh,rings[-1],pt(0,0,.029),'optic_ink',normal)
    # Custom raised strokes follow the squared period BYD wordmark. U direction
    # reverses viewed from the hatch, so the lettering reads from either end.
    paths=[
        [(-.045,-.013),(-.045,.013),(-.024,.013),(-.020,.010),(-.020,.005),(-.023,.001),(-.043,.001)],
        [(-.026,.001),(-.020,-.002),(-.019,-.008),(-.023,-.013),(-.043,-.013)],
        [(-.014,.013),(-.007,.004),(-.002,.002),(.003,.002),(.013,.013)],
        [(0,.002),(0,-.013)],
        [(.020,-.013),(.020,.013),(.035,.013),(.044,.007),(.044,-.006),(.036,-.013),(.020,-.013)]]
    for p in paths:
        rod(mesh,[pt(direction*x,y,.030) for x,y in p],.0020,'optic_nickel',7)


def vent_inserts(ctx):
    mesh=ctx.part('Front • triangular corner inserts and cooling duct')
    def triangle(t):
        # Rounded triangular applique, longest edge on the outer bumper.
        nodes=[(0.7471,0.5632),(0.7324,0.5606),(0.6894,0.5124),(0.6660,0.4740),(0.6614,0.4521),
           (0.6732,0.4299),(0.7170,0.3998),(0.8017,0.3389),(0.8178,0.3372),(0.8203,0.3495),
           (0.8044,0.4382),(0.7781,0.5307)]
        n=len(nodes);j=int(t*n)%n;r=t*n-int(t*n)
        p0,p1,p2,p3=[nodes[(j+i)%n] for i in (-1,0,1,2)]
        def interp(i):
            return .5*((2*p1[i])+(-p0[i]+p2[i])*r+
                (2*p0[i]-5*p1[i]+4*p2[i]-p3[i])*r*r+
                (-p0[i]+3*p1[i]-3*p2[i]+p3[i])*r*r*r)
        return interp(0),interp(1)
    for g in (-1,1):
        normal=(g*.7,.72,.05)
        loops=[]
        for scale,off in [(1,.004),(.985,.0065),(.91,.0084),(.80,.0076),(.61,.007),(.34,.0066),(.10,.0063)]:
            ring=[]
            for t in samples(0,1,78)[:-1]:
                u,z=triangle(t)
                ring.append(ctx.cap(1,g*mix(.747,u,scale),mix(.447,z,scale),off))
            loops.append(ring)
        ring_loop(mesh,loops,['seal','optic_smoke','black','black','black','black'],normal)
        face_disk(mesh,loops[-1],ctx.cap(1,g*.747,.447,.0062),'black',normal)
        for line in ([(.819,.363),(.800,.378),(.755,.414),(.723,.444)],
                     [(.806,.397),(.771,.420),(.738,.449),(.754,.478),(.782,.519)]):
            rod(mesh,[ctx.cap(1,g*(u-.028),z,.009) for u,z in line],.0015,'optic_smoke',5)
    def inlet(u,v,off):
        ax=abs(u)
        low=ordinate([(0,.272),(.12,.284),(.31,.294),(.47,.277),(.55,.271),(.71,.280),(.82,.280),(1,.256)],ax)
        hi=ordinate([(0,.330),(.19,.344),(.36,.353),(.445,.343),(.525,.301),(.565,.295),
                     (.73,.298),(.816,.294),(.834,.281),(1,.257)],ax)
        return ctx.cap(1,u,mix(low,hi,v),off)
    face_mesh(mesh,lambda u,v:inlet(u,v,.0052),'optic_mouth',samples(-.834,.834,92),samples(0,1,10),(0,1,0))
    for y in [.31,.67]:
        face_mesh(mesh,lambda u,v:inlet(u,mix(y-.030,y+.030,v),.0068+.0016*sin(pi*v)),
                  'optic_valance',samples(-.56,.56,52),[0,.45,1],(0,1,0))
    for u in samples(-.47,.47,10):
        face_mesh(mesh,lambda q,v:inlet(q,v,.0068),'optic_valance',[u-.0019,u+.0019],[.025,.97],(0,1,0))
    face_mesh(mesh,lambda u,v:inlet(u,v,.0078),'optic_valance',[-.029,0,.029],samples(.04,.98,11),(0,1,0))
    # Blue polyurethane skirt meets the undertray along the actual coachwork seam.
    def skirt(u,v):
        a=abs(u)
        high=ordinate([(0,.274),(.12,.286),(.31,.296),(.47,.279),(.55,.273),(.71,.282),(.82,.282),(.90,.290),(1,.297)],a)
        low=ctx.front_floor(u)
        return ctx.cap(1,u,mix(low,high,v),.0026+.0054*sin(pi*v))
    face_mesh(mesh,skirt,'blue',samples(-1,1,92),samples(0,1,14),(0,1,0))
    # Flush ultrasonic parking sensors. Thin dark ring plus same paint centre.
    for g in (-1,1):
        for u,z in [(.611,.522),(.794,.607),(.964,.661)]:
            points=[ctx.cap(1,g*(u+.0083*cos(a)),z+.0095*sin(a),.006) for a in samples(0,2*pi,22)[:-1]]
            rod(mesh,points+[points[0]],.0010,'optic_well',5)
            face_disk(mesh,points,ctx.cap(1,g*u,z,.0064),'white',(g*.5,.85,0))

def license_plinth(ctx, direction):
    mesh=ctx.part(('Front' if direction>0 else 'Tail')+' • rigid number plate and fasteners')
    skin=ctx.front if direction>0 else ctx.rear
    height=.428 if direction>0 else .868
    center=skin(0,height)
    # Keep the plate itself flat. On either side of centre the carrier fills
    # the changing distance down to the crowned sheet metal behind it.
    width,h=.480,.140
    normal=(0,direction,.09)
    tilt=(skin(0,height+.02)[1]-skin(0,height-.02)[1])/.04
    tilt=max(-.20,min(.20,tilt))
    def plate(x,v,d):
        return (x,center[1]+tilt*v+direction*d,height+v)
    def frame_ring(w,h,r,d):
        ring=[]
        for x,v,a in ((w/2-r,h/2-r,0),(-w/2+r,h/2-r,pi/2),
                      (-w/2+r,-h/2+r,pi),(w/2-r,-h/2+r,1.5*pi)):
            ring.extend([plate(x+r*cos(t),v+r*sin(t),d) for t in samples(a,a+pi/2,8)])
        return ring
    fillet=frame_ring(width+.027,h+.027,.012,.016)
    foot=[skin(x,z,.012 if direction>0 else .002) for x,_,z in fillet]
    mid=frame_ring(width+.024,h+.023,.010,.020)
    end=frame_ring(width+.012,h+.014,.006,.023)
    ring_loop(mesh,[foot,fillet,mid,end],['black','optic_smoke','black'],normal)
    face_disk(mesh,end,plate(0,0,.023),'black',normal,False)
    # Front view: screen-right is positive design X. Tail view reverses it.
    x1,x2=-direction*width*.5,direction*width*.5
    p=[plate(x1,-h/2,.0245),plate(x2,-h/2,.0245),
       plate(x2,h/2,.0245),plate(x1,h/2,.0245)]
    mesh.face(p,'pengcheng_plate',normal,False,[(0,0),(1,0),(1,1),(0,1)])
    for x in [-.114,.114]:
        for v in [-.061,.061]:
            pts=[plate(x+.0073*cos(a),v+.0073*sin(a),.025) for a in samples(0,2*pi,16)[:-1]]
            inner=[plate(x+.0057*cos(a),v+.0057*sin(a),.0288) for a in samples(0,2*pi,16)[:-1]]
            ring_loop(mesh,[pts,inner],['optic_flute'],normal)
            face_disk(mesh,inner,plate(x,v,.0294),'alloy',normal)


def rear_fascia(ctx):
    mesh=ctx.part('Tail • divided combination lamps and plated boot garnish')
    normal=(0,-1,.06)
    begin=arc_for_x(ctx,-1,.383,1.025)
    shoulder=.794
    def pt(g,t,v,d):
        # Inboard blade returns to a point. A second, separate moulding is
        # fixed to the rear quarter past the tailgate seam.
        e=mix(begin,1,min(1,t/shoulder))
        hi=ordinate([(0,1.036),(.36,1.041),(.72,1.066),(1,1.074)],t)
        depth=ordinate([(0,.004),(.10,.046),(.24,.092),(.42,.121),
                        (.61,.125),(.75,.105),(.9,.064),(1,.006)],t)
        h=hi-depth*(1-v)
        if t<=shoulder:
            return ctx.cap(-1,g*e,h,d)
        return ctx.flank(g,mix(-1.990,-1.799,(t-shoulder)/(1-shoulder)),h,d)
    def cover(g,key,d,x0,x1,v0,v1):
        face_mesh(mesh,lambda t,v:pt(g,t,v,d),key,samples(x0,x1,max(5,round((x1-x0)*48))),
                  samples(v0,v1,4),(g*.50,-.85,.04))
    for g in (-1,1):
        cover(g,'seal',.003,0,1,0,1)
        # Cut across the tailgate along the true part split. The clear reverse
        # lens is surrounded by a translucent ruby channel below and outside.
        for lo,hi in [(0.013,.479),(.485,.984)]:
            cover(g,'optic_ruby',.0064,lo,hi,.048,.976)
            for a,b,key,d in [(.12,.26,'optic_facet',.012),(.34,.65,'optic_red',.011)]:
                face_mesh(mesh,lambda t,v:pt(g,t,mix(a,b,v)+.18*(max(t-.62,0)/.36)**1.5,d),
                          key,samples(lo,hi,max(8,int((hi-lo)*56))),[0,.25,.75,1],(g*.5,-.85,.05))
            ilo=max(lo,.16);ihi=min(hi,.718)
            if ihi>ilo:
                def rev(t,v):
                    # The clear aperture pinches to a point at each tip.
                    w=ordinate([(.158,0),(.31,.19),(.47,.36),(.59,.37),(.67,.24),(.718,.002)],t)
                    return pt(g,t,.906-w*(1-v),.014)
                face_mesh(mesh,rev,'optic_bright',samples(ilo,ihi,30),[0,.5,1],(g*.5,-.85,.05))
                for a in samples(ilo+.002,ihi-.002,max(3,int((ihi-ilo)*187))):
                    rod(mesh,[rev(a,v) for v in (.10,.5,.93)],.00072,'optic_flute',4)
        for t in [.773,.799,.825,.851,.877]:
            rod(mesh,[pt(g,t+.024*(v-.5),v,.0125) for v in (.27,.42,.64,.83)],.0016,'optic_facet',5)
    # Bright horizontal strip extends across the entire tailgate above the
    # lights. The veneer has a dark lower return and subtly convex front face.
    for a,b,key,d in [(0,1,'seal',.0029),(.08,.96,'chrome',.0068),(.09,.31,'optic_flute',.009)]:
        def bar(t,v):
            hi=1.070+.038*t*t
            return ctx.cap(-1,t,mix(hi-.031,hi,mix(a,b,v)),d+.0032*sin(pi*v))
        face_mesh(mesh,bar,key,samples(-1,1,82),[0,.38,.72,1],normal)
    # Textured black rear valance and inset red reflectors positioned low on
    # either side. The blue rocker continues under the sides of the taxi.
    def apron(t,v,off):
        a=abs(t)
        lo=.185+.016*a*a
        hi=ordinate([(0,.388),(.52,.390),(.72,.378),(.88,.324),(1,.235)],a)
        return ctx.cap(-1,t,mix(lo,hi,v),off)
    face_mesh(mesh,lambda a,b:apron(a,b,.004+b*.002),'black',samples(-1,1,80),samples(0,1,26),normal)
    # Shadow line at the liftgate opening. This same cut divides the moving
    # inner lamp from the moulding mounted on the rear quarter.
    gate=ctx.part('Tail • liftgate opening and e6 script')
    joint=begin+(1-begin)*(.481/shoulder)
    topx=abs(ctx.cap(-1,joint,1.031)[0])
    for g in (-1,1):
        contour=[(.548,.611),(.557,.680),(.585,.708),(.65,.720),
                 (.78,.733),(.921,topx-.015),(1.020,topx),(1.185,topx+.009)]
        flank=[ctx.rear(g*ordinate(contour,h),h,.0025) for h in samples(.548,1.185,65)]
        rod(gate,flank,.00195,'seal',6)
        # Painted edge below the boot opening catches a slim secondary highlight.
        h0=lambda x:.543+.005*(abs(x)/.611)**3
        rim=[ctx.rear(g*x,h0(x),.0028) for x in samples(0,.611,40)]
        rod(gate,rim,.0020,'seal',6)
        rod(gate,[ctx.rear(g*x,h0(x)-.0034,.0035) for x in samples(0,.596,40)],.0011,'white',5)
    # Small raised model badge on the lower right of the tailgate.
    def logo(x,y):return ctx.rear(-(.576+x),.623+y,.008)
    for line in [[(-.021,0),(-.005,0),(-.006,.006),(-.011,.010),(-.017,.010),(-.022,.006),
                  (-.024,-.001),(-.021,-.006),(-.013,-.008),(-.006,-.005)],
                 [(.017,.012),(.010,.013),(.005,.009),(.003,.002),(.004,-.005),
                  (.010,-.009),(.018,-.006),(.021,-.001),(.019,.004),(.012,.006),(.004,.002)]]:
        rod(gate,[logo(x,y) for x,y in line],.00155,'chrome',7)
    for g in (-1,1):
        def reflex(t,v):
            x=mix(.507,.781,t)
            h=.306+.005*t
            size=.026*max(.035,sin(pi*t)**.31)
            return ctx.rear(g*x,h+(v-.5)*size,.0128+.003*sin(pi*v))
        face_mesh(mesh,reflex,'optic_red',samples(0,1,34),[0,.12,.51,.88,1],(g*.4,-.9,0))
        for x in [.34,.77]:
            z=.498
            ring=[ctx.rear(g*x+.0078*cos(a),z+.0078*sin(a),.0036) for a in samples(0,2*pi,20)[:-1]]
            rod(mesh,ring+[ring[0]],.0008,'optic_well',5)
    # Tail-release button and rear-view camera under the chromed pressing.
    for x,w,key in [(.002,.032,'black'),(.025,.008,'optic_iris')]:
        face_mesh(mesh,lambda a,b:ctx.rear(x+w*a,1.029+.008*b,.009),key,
                  [-1,1],[-1,1],normal)
    emblem(ctx,-1,1.131)
    license_plinth(ctx,-1)


def build_optics(ctx):
    artist_mats(ctx.mats)
    grille(ctx)
    nose_wing(ctx)
    for side in (-1,1):
        headlamp(ctx,side)
    vent_inserts(ctx)
    emblem(ctx,1,.652)
    license_plinth(ctx,1)
    rear_fascia(ctx)
