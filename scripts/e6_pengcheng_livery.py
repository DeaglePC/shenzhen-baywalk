"""Generate clean print masters for the photographed Pengcheng e6, with system Python/Pillow.

    python scripts/e6_pengcheng_livery.py <atlas directory>

The colour separations and emblem curves were traced from the supplied Shenzhen taxi.
Boxes are in top-left-origin texture pixels. The Blender assembly imports only this layout.
"""
from pathlib import Path


SIZE = (2048, 1024)
BOXES = {
    "company": (8, 8, 922, 170),
    "emblem": (934, 8, 1226, 300),
    "call": (1240, 8, 2040, 140),
    "service": (1240, 156, 2040, 288),
    "speak": (8, 192, 920, 270),
    "hello": (8, 290, 1100, 382),
    "number": (1120, 310, 1744, 417),
    "sticker": (8, 408, 740, 652),
    "roof_city": (8, 692, 753, 1000),
    "roof_operator": (777, 692, 1522, 1000),
}


def generate(directory):
    from math import cos
    from PIL import Image, ImageDraw, ImageFont

    directory = Path(directory)
    directory.mkdir(parents=True, exist_ok=True)
    atlas = Image.new("RGBA", SIZE)
    navy = "#102b5a"
    ocher = "#af7323"
    fontdirs = (Path("C:/Windows/Fonts"), Path("/usr/share/fonts/truetype/dejavu"),
                Path("/usr/share/fonts/opentype/noto"))
    fonts = {
        "han": ("msyhbd.ttc", "simhei.ttf", "NotoSansCJK-Bold.ttc"),
        "light": ("msyh.ttc", "NotoSansCJK-Regular.ttc"),
        "latin": ("bahnschrift.ttf", "arial.ttf", "DejaVuSans.ttf"),
        "bold": ("arialbd.ttf", "DejaVuSans-Bold.ttf"),
        "slant": ("arialbi.ttf", "DejaVuSans-BoldOblique.ttf"),
        "thai": ("leelawad.ttf", "tahoma.ttf", "DejaVuSans.ttf"),
        "korean": ("malgunbd.ttf", "NotoSansCJK-Bold.ttc"),
        "arabic": ("tahoma.ttf", "DejaVuSans.ttf"),
    }

    def text(target, box, label, font="han", ink=navy, outline=None, stroke=0, italic=0):
        path = next((root / file for file in fonts[font] for root in fontdirs
                     if (root / file).exists()), None)
        if path is None:
            raise FileNotFoundError(f"Install a font for the '{font}' typeface: {fonts[font]}")
        face = ImageFont.truetype(str(path), 160)
        left, top, right, bottom = face.getbbox(label, stroke_width=stroke)
        source = Image.new("RGBA", (right-left+12, bottom-top+12))
        draw = ImageDraw.Draw(source)
        draw.text((6-left, 6-top), label, font=face, fill=ink, stroke_width=stroke, stroke_fill=outline)
        if italic:
            source = source.transform((source.width + int(source.height*italic), source.height),
                                      Image.Transform.AFFINE, (1, italic, -source.height*italic, 0, 1, 0),
                                      Image.Resampling.BICUBIC)
        source = source.crop(source.getbbox())
        x0, y0, x1, y1 = box
        target.alpha_composite(source.resize((x1-x0,y1-y0), Image.Resampling.LANCZOS), (x0, y0))

    def slot(name, size, painter):
        canvas = Image.new("RGBA", size)
        painter(canvas)
        x0, y0, x1, y1 = BOXES[name]
        atlas.alpha_composite(canvas.resize((x1-x0,y1-y0), Image.Resampling.LANCZOS), (x0, y0))

    # Four asymmetrical, crossing open ribbons. Coordinates follow the rectified door emblem.
    def emblem(im):
        d = ImageDraw.Draw(im)
        def shape(start, pieces, colour):
            pts = [start]
            for a,b,c in pieces:
                p = pts[-1]
                for n in range(1,31):
                    t=n/30
                    pts.append(tuple((1-t)**3*p[k] + 3*t*(1-t)**2*a[k] +
                                     3*t*t*(1-t)*b[k] + t**3*c[k] for k in (0,1)))
            d.polygon([(x-22,y-30) for x,y in pts], fill=colour)
        shape((151,229), [((81,185),(116,96),(195,62)),((278,23),(398,45),(414,127)),
                          ((409,128),(406,125),(402,123)),((382,51),(276,52),(217,83)),
                          ((168,108),(145,164),(196,209)),((183,217),(159,226),(151,229))], "#034f45")
        shape((225,259), [((314,258),(372,218),(399,174)),((402,173),(406,172),(409,173)),
                          ((388,223),(306,271),(225,259))], "#034f45")
        shape((232,170), [((244,160),(249,145),(257,138)),((318,113),(404,115),(452,157)),
                          ((496,198),(500,255),(449,301)),((490,227),(460,177),(394,161)),
                          ((350,148),(309,158),(275,177)),((261,177),(245,174),(232,170))], "#a5242c")
        shape((113,317), [((128,272),(192,222),(305,220)),((256,229),(164,239),(128,314)),
                          ((125,317),(119,318),(113,317))], "#15264d")
        shape((119,354), [((137,404),(224,439),(304,409)),((358,389),(384,323),(332,276)),
                          ((345,268),(355,262),(372,252)),((435,297),(411,389),(349,420)),
                          ((259,461),(128,436),(114,355)),((116,354),(118,354),(119,354))], "#183466")
        shape((77,177), [((20,232),(21,300),(80,332)),((139,365),(205,364),(250,343)),
                         ((255,341),(258,343),(263,346)),((273,334),(279,320),(291,311)),
                         ((268,309),(255,304),(240,299)),((242,304),(244,309),(246,313)),
                         ((204,335),(142,335),(92,309)),((50,285),(46,225),(77,177))], "#ba862d")
    slot("emblem", (478,420), emblem)
    slot("company", (900,160), lambda im: text(im,(3,3,897,157),"深圳巴士集团","han",navy))

    def calls(im, service=False):
        if service:
            text(im, (4,4,199,60), "服 务", "han", ocher)
            text(im, (4,71,199,127), "监 督", "han", ocher)
        else:
            d=ImageDraw.Draw(im)
            d.rounded_rectangle((0,2,197,60), radius=13, fill=ocher)
            text(im,(17,12,178,48),"TAXI","bold","#fff6cb")
            text(im,(6,72,194,128),"电 召","han",ocher)
        text(im,(215,3,796,130),"12328" if service else "95128","latin",ocher)
    slot("call",(800,132),calls)
    slot("service",(800,132),lambda im:calls(im,True))

    def band(im, hello=False):
        # White perimeter around the narrow blue script remains legible on the blue belt.
        def lettering(box,label,face="slant",skew=0):
            text(im,box,label,face,"#4980b0","#f0f0e4",6,skew)
        if hello:
            lettering((1,2,192,87),"你好","han",.17)
            lettering((207,8,490,81),"Hello")
            lettering((500,11,686,46),"Bonjour")
            lettering((501,50,678,82),"Привет")
            lettering((690,16,845,48),"안녕하세요","korean")
            lettering((680,49,823,77),"สวัสดี","thai")
            lettering((829,48,957,78),"مرحبا","arabic")
            lettering((965,56,1085,80),"Hola...")
        else:
            lettering((4,5,190,38),"我会说","han",.15)
            lettering((4,42,191,73),"多种语言","light",.15)
            lettering((210,4,905,74),"I speak your language...")
    slot("speak",(912,78),band)
    slot("hello",(1092,92),lambda im:band(im,True))
    def number(im):
        text(im,(4,4,171,101),"鹏程","han","#345989")
        text(im,(180,8,619,102),"AT-099","bold","#345989")
    slot("number",(624,107),number)

    def permits(im):
        d=ImageDraw.Draw(im)
        d.rounded_rectangle((81,2,266,162),17,"#dedfe8",outline="#8aaac2",width=7)
        d.ellipse((120,16,227,119),outline="#275688",width=13)
        d.arc((140,38,211,105),180,444,fill="#58768e",width=7)
        text(im,(114,129,234,150),"深圳市出租汽车","han","#245282")
        d.rounded_rectangle((288,66,472,156),9,"#b6ddd8",outline="#63a4a8",width=5)
        text(im,(298,79,459,105),"纯电动出租车","han","#326e81")
        for i in range(3):
            by=179; bx=5+i*229
            d.rounded_rectangle((bx,by,bx+208,242),8,"#dab47e",outline="#946939",width=4)
            d.rectangle((bx+12,by+9,bx+51,by+49),outline="#946939", width=3)
            d.ellipse((bx+23,by+16,bx+42,by+36),outline="#956d43",width=3)
            d.line((bx+65,by+19,bx+194,by+19),fill="#a68158",width=4)
            d.line((bx+65,by+33,bx+151,by+33),fill="#b18a5e",width=3)
    slot("sticker",(732,244),permits)

    def roof(im, operator):
        d=ImageDraw.Draw(im)
        field = "#13334a" if operator else "#a81613"
        d.rounded_rectangle((3,3,742,305),radius=26,fill=field,outline="#dfad40",width=5)
        text(im,(46,29,700,275),"鹏 程" if operator else "深 圳","han","#ffdc68","#8e692a",1)
    slot("roof_city",(745,308),lambda im:roof(im,False))
    slot("roof_operator",(745,308),lambda im:roof(im,True))
    atlas.save(directory/"pengcheng-print.png",optimize=True)

    # Face of the animated sign caught during multiplex refresh. All primary CJK
    # strokes survive at a distance, while at close range each diode is separate.
    led=Image.new("RGB",(512,272),"#111c19")
    mask=Image.new("RGBA",(132,58))
    text(mask,(9,3,123,40),"空 车","han","#ffffff")
    text(mask,(31,44,103,56),"FOR  HIRE","bold","#a8c8a8")
    mask=mask.getchannel("A").resize((66,32),Image.Resampling.LANCZOS)
    d=ImageDraw.Draw(led)
    d.rounded_rectangle((0,0,511,271),17,outline="#303833",width=6)
    for iy in range(32):
        for ix in range(66):
            value=mask.getpixel((ix,iy))/255
            x=15+ix*7.37; y=12+iy*7.8
            factor=(.85+.15*cos(iy*1.8))*(.67 if iy>23 else 1)
            fill=tuple(round(a+(b-a)*value*factor) for a,b in zip((25,42,35),(59,242,119)))
            d.ellipse((x,y,x+5.7,y+5.7),fill=fill)
            if value>.52:
                d.ellipse((x+1.3,y+.8,x+3.8,y+2.8),fill=(86,233,129) if iy<=23 else (46,142,90))
    led.save(directory/"pengcheng-led.png",optimize=True)

    # Plate: pale top, green foot, embossed narrow new-energy characters and the
    # small round separator. The optical assembly provides the plate frame/bolts.
    plate=Image.new("RGBA",(1024,300)); d=ImageDraw.Draw(plate)
    keys=[(0,(203,216,204)),(.26,(153,209,176)),(.55,(68,191,137)),(1,(7,161,102))]
    for y in range(300):
        n=y/299
        (a,c),(b,e)=next((k0,k1) for k0,k1 in zip(keys,keys[1:]) if n<=k1[0])
        d.line((0,y,1023,y),fill=tuple(round(i+(j-i)*(n-a)/(b-a)) for i,j in zip(c,e)))
    d.rounded_rectangle((2,2,1021,297),13,outline="#31473c",width=5)
    d.rounded_rectangle((7,7,1016,292),10,outline="#d1dfc9",width=4)
    text(plate,(23,48,132,247),"粤","light","#152a20")
    # Curved DIN-like forms with straight stems; the photograph's digits are
    # much narrower and more vertical than a generic computer sans-serif.
    boxes=[(143,31,248,261),(296,30,401,260),(412,30,515,260),(533,30,636,260),
           (655,30,758,260),(774,30,879,260),(891,30,1000,260)]
    for glyph,box in zip("BC53270",boxes):
        x,y,X,Y=box
        text(plate,(x+2,y+2,X+2,Y+2),glyph,"latin","#c5d8bc")
        text(plate,box,glyph,"latin","#131e18")
    d.ellipse((251,126,288,167), fill="#1b7966",outline="#5ca4a1",width=4)
    d.arc((256,130,283,160),201,351,fill="#c4b663",width=3)
    d.polygon([(258,149),(269,138),(281,148),(277,151),(262,151)],fill="#bfd2ba")
    d.line((260,155,280,155),fill="#adbda7",width=3)
    plate.convert("RGB").save(directory/"pengcheng-plate.png",optimize=True)


if __name__ == "__main__":
    import sys
    generate(sys.argv[1])
