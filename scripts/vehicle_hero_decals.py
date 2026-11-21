"""Original print atlas for the close-up Shenzhen fleet taxi."""
from pathlib import Path
import sys
from math import exp
from PIL import Image, ImageDraw, ImageFont

out = Path(sys.argv[1]); out.mkdir(parents=True, exist_ok=True)
im = Image.new("RGBA", (1024,1024)); d = ImageDraw.Draw(im)
cn = "C:/Windows/Fonts/msyhbd.ttc"; cnreg = "C:/Windows/Fonts/msyh.ttc"
lat = "C:/Windows/Fonts/bahnschrift.ttf"

def label(rect, string, fill, font=cn):
    x,y,X,Y = rect
    for s in range(Y-y-2,5,-1):
        f = ImageFont.truetype(font,s)
        a,b,c,e = d.textbbox((0,0),string,font=f)
        if c-a < X-x-6 and e-b < Y-y-3: break
    d.text(((x+X-c-a)/2,(y+Y-e-b)/2),string,font=f,fill=fill)

# UV islands include the edges of the metal plate; the registration is fictional.
for y in range(184):
    value=y/184
    d.line((0,y,655,y),fill=(int(220-89*value),int(230-44*value),int(207-74*value),255))
d.rounded_rectangle((4,4,651,179),11,outline=(30,67,50,255),width=4)
label((9,6,649,175),"粤B·D07631",(24,39,29,255))
label((668,6,1019,178),"BYD",(230,237,238,255),lat)
for i in range(0,1024):
    vignette=abs(i-512)/512
    d.line((i,204,i,382),fill=(int(247-17*vignette),int(246-16*vignette),int(232-15*vignette),255))
d.rounded_rectangle((5,207,1019,379),24,outline=(171,175,166,255),width=4)
label((40,211,514,375),"深 圳",(186,44,53,255))
label((549,213,987,373),"TAXI",(31,68,128,255),lat)
label((4,402,482,569),"深 港",(22,57,114,255))
# A geometry-based circular fleet emblem with its own lettering.
d.rounded_rectangle((546,407,694,562),27,fill=(174,48,52,255))
d.rounded_rectangle((555,416,685,553),18,outline=(243,227,196,255),width=4)
label((564,423,677,542),"深",(254,242,219,255))
label((704,416,1019,555),"e6",(204,214,218,255),lat)
label((4,582,1019,712),"96880",(239,196,58,255),lat)
label((4,730,530,794),"深港－0763",(24,57,90,255))
label((546,730,1017,795),"电召服务  96880",(227,190,92,255),cnreg)
label((3,818,1018,890),"225 / 65 R17     RADIAL TUBELESS",(99,100,94,255),lat)
label((3,905,1018,989),"SHENZHEN TAXI",(20,62,95,255),lat)
im.save(out/"e6-hero.png")

# The four door pressings have a continuous printed paint mask. One UV metre has
# the same pixel density horizontally and vertically; neither lettering nor paint
# edges depend on cuts in the mesh.
waist=[(-2.04,1.036),(-1.7,1.056),(-1.16,1.054),(-.51,1.023),(.03,1.008),
       (.65,.991),(1.1,.976),(1.40,.956),(1.65,.924),(1.837,.866)]
def belt_at(s):
    for (a,h),(b,k) in zip(waist,waist[1:]):
        if s<=b:return h+(k-h)*(s-a)/(b-a)
    return waist[-1][1]
def bell(x,w):return exp(-(x/w)**2)
ns,nz=2048,520
for g,name in [(-1,"left"),(1,"right")]:
    side=Image.new("RGB",(ns,nz),(225,229,223));mask=ImageDraw.Draw(side)
    def to_pixel(s,z):
        u=(s+2)/3.837
        return (round((1-u if g==1 else u)*(ns-1)),round((1-(z-.15)/.97)*(nz-1)))
    for x in range(ns):
        u=x/(ns-1);s=-2+(1-u if g==1 else u)*3.837
        upper=belt_at(s)-.047-.091*bell(s+.70,.34)-.123*bell(s-.38,.42)-.015*bell(s+1.60,.37)
        lower=.245+.205*bell(s+.43,.65)+.042*bell(s+1.62,.42)+.145*bell(s+2.09,.30)-.026*bell(s-1.05,.34)
        mask.line((x,0,x,to_pixel(s,upper)[1]),fill=(17,121,185))
        mask.line((x,to_pixel(s,lower)[1],x,nz-1),fill=(17,121,185))
    def stamp(s,z,w,h,bounds):
        patch=im.crop(bounds)
        patch=patch.crop(patch.getchannel("A").getbbox())
        size=(round(w*ns/3.837),round(h*nz/.97));patch.thumbnail(size,Image.Resampling.LANCZOS)
        x,y=to_pixel(s,z)
        side.paste(patch,(x-patch.width//2,y-patch.height//2),patch)
    stamp(-.525,.694,.304,.128,(3,402,483,570))
    stamp(.493,.706,.116,.127,(545,406,696,563))
    stamp(-.474,.327,.423,.106,(3,581,1022,713))
    stamp(.492,.318,.568,.052,(545,729,1019,795))
    side.save(out/("e6-side-"+name+".png"),optimize=True)
