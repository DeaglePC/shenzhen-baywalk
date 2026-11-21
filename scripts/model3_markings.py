"""Produce original plate artwork and the moulded sidewall of a 235/45R18 tyre."""
from pathlib import Path
import math, sys
import numpy as np
from PIL import Image,ImageDraw,ImageFont,ImageFilter

out=Path(sys.argv[1]);out.mkdir(exist_ok=True,parents=True)
fonts=Path("C:/Windows/Fonts")
def font(face,size):return ImageFont.truetype(str(fonts/face),size)
size=(960,280)
yy,xx=np.mgrid[0:size[1],0:size[0]]
mix=(.53*xx/size[0]+.47*yy/size[1])[...,None]
paper=np.array((226,244,215))*(1-mix)+np.array((106,199,130))*mix
plate=Image.fromarray(paper.astype("uint8"));d=ImageDraw.Draw(plate)
d.rounded_rectangle((8,8,951,271),15,outline=(42,55,44),width=6)
d.rounded_rectangle((15,15,944,264),11,outline=(177,216,177),width=2)
for char,cx in zip("粤BD03726",(85,195,350,454,559,663,767,870)):
    f=font("msyhbd.ttc" if char=="粤" else "arialbd.ttf",144 if char=="粤" else 156)
    d.text((cx,135),char,font=f,anchor="mm",fill=(26,36,32),stroke_width=1,stroke_fill=(22,31,27))
d.ellipse((245,114,281,150),outline=(36,81,49),width=4)
d.polygon([(252,135),(266,121),(263,132),(274,130),(260,145),(264,135)],fill=(49,95,58))
plate.save(out/"model3-street-plate.png",optimize=True)

# A purpose-drawn standby screen, lit like the IPB11 reference. The schematic
# map, car plan and icon strip are model artwork and do not use website pixels.
screen=Image.new("RGB",(768,432),(225,226,228));ui=ImageDraw.Draw(screen)
ui.rectangle((252,0,768,386),fill=(212,214,217))
for j in range(7):
    pts=[(251,22+j*62),(303,42+j*49),(385,35+j*53),(450,30+j*54),
         (514,52+j*50),(601,59+j*51),(717,46+j*51),(774,77+j*49)]
    ui.line(pts,fill=(232,233,234),width=5,joint="curve")
for j in range(6):
    pts=[(282+j*83,-5),(261+j*84,74),(286+j*81,152),(309+j*75,210),(283+j*86,312),(308+j*88,391)]
    ui.line(pts,fill=(230,231,231),width=4,joint="curve")
ui.line([(291,299),(352,236),(420,214),(461,158),(505,148),(557,116),(643,100),(721,57)],
        fill=(152,171,185),width=6,joint="curve")
ui.rounded_rectangle((274,22,557,52),14,fill=(246,246,246))
ui.text((294,28),"Search",font=font("arial.ttf",16),fill=(83,85,89))
ui.text((22,19),"P",font=font("arialbd.ttf",27),fill=(53,55,59))
ui.text((53,27),"R  N  D",font=font("arial.ttf",15),fill=(118,121,124))
ui.rounded_rectangle((83,90,161,255),34,fill=(78,82,86),outline=(66,67,70),width=3)
ui.rounded_rectangle((94,125,149,205),20,fill=(44,49,54),outline=(123,126,128),width=3)
ui.rounded_rectangle((30,312,211,353),16,fill=(205,210,216))
ui.text((73,321),"Model 3",font=font("arial.ttf",17),fill=(72,75,79))
ui.rectangle((0,386,768,432),fill=(26,27,29))
for j in range(9):
    x=103+j*69;ui.rounded_rectangle((x,398,x+15,413),4,fill=(133+6*(j%3),143+5*(j%4),153+5*(j%3)))
screen.save(out/"model3-touchscreen.png",optimize=True)

n=1152;cx=cy=n/2;rad=n/2
height=Image.new("L",(n,n),128);hdraw=ImageDraw.Draw(height)
def ringtext(label,angle,radius,sz,spacing=1.5):
    f=font("arialbd.ttf",sz)
    advance=[f.getlength(c)+spacing for c in label]
    q=math.radians(angle)-sum(advance)/(radius*2)
    for c,step in zip(label,advance):
        a=q+step/(2*radius);q+=step/radius
        if c.isspace():continue
        char=Image.new("L",(sz*2,sz*2),0)
        ImageDraw.Draw(char).text((sz,sz),c,anchor="mm",fill=220,font=f)
        char=char.rotate(-math.degrees(a)-90,resample=Image.Resampling.BICUBIC)
        height.paste(186,(round(cx+radius*math.cos(a)-sz),round(cy+radius*math.sin(a)-sz)),char)
ringtext("235/45 R18   98V", -88,rad*.828,32,1.1)
ringtext("RADIAL  TUBELESS",92,rad*.829,25,2)
ringtext("OUTSIDE",10,rad*.82,17,1.9)
ringtext("EXTRA  LOAD",179,rad*.82,16,1.3)
for i in range(48):
    a=2*math.pi*i/48
    for aa in (a,a+.008):
        hdraw.line([(cx+r*math.cos(aa),cy+r*math.sin(aa)) for r in (rad*.915,rad*.93)],fill=141,width=2)
arr=np.array(height.filter(ImageFilter.GaussianBlur(.62)),dtype=float)
dc,dr=np.gradient(arr)
normal=np.stack((-dr*.046,dc*.046,np.ones_like(arr)),axis=2)
normal/=np.linalg.norm(normal,axis=2)[...,None]
Image.fromarray(np.uint8((normal*.5+.5)*255)).save(out/"model3-tyre-normal.png",optimize=True)
base=46+(arr-128)*.20
colour=np.stack((base,base,base+.8),axis=2)
Image.fromarray(np.uint8(np.clip(colour,0,255))).save(out/"model3-tyre-wall.png",optimize=True)
