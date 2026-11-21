"""Generate original licence, fleet, model and roof-sign graphics for the Blender build."""
from pathlib import Path
import sys
from PIL import Image, ImageDraw, ImageFont

out = Path(sys.argv[1])
out.mkdir(exist_ok=True, parents=True)
fonts = Path("C:/Windows/Fonts")
font = str(fonts / "msyhbd.ttc")
latin = str(fonts / "bahnschrift.ttf")
plates = {
    "e6": ("粤B·D07631", "e6"),
    "model3": ("粤B·DF0386", "MODEL   3"),
    "tang": ("粤B·DA5283", "唐    TANG"),
    "mifa9": ("粤B·DF9162", "MAXUS   MIFA 9"),
    "civic": ("粤B·HK362", "C I V I C"),
    "mini": ("粤B·DG7986", "W U L I N G"),
}

def label(box, string, color, face=font, height=.76):
    left, top, right, bottom = box
    size = round((bottom-top)*height)
    while size > 7:
        f = ImageFont.truetype(face,size)
        bounds = draw.textbbox((0,0),string,font=f)
        if bounds[2]-bounds[0] < right-left-8:
            break
        size -= 1
    px = (left+right-bounds[2]-bounds[0])/2
    py = (top+bottom-bounds[3]-bounds[1])/2
    draw.text((px,py),string,fill=color,font=f)

for model, (reg, badge) in plates.items():
    image = Image.new("RGBA", (512,512))
    draw = ImageDraw.Draw(image)
    ev = model != "civic"
    for y in range(130):
        g = int(211-48*y/130)
        color = (int(222-116*y/130),g,int(203-87*y/130)) if ev else (31,66,139)
        draw.line((0,y,511,y),fill=color)
    draw.rounded_rectangle((5,5,506,124),7,outline=(40,65,42) if ev else "white",width=3)
    label((14,6,498,124),reg,(19,29,25) if ev else "white",height=.94)
    draw.rounded_rectangle((1,139,511,241),17,fill=(235,241,230),outline=(80,94,105),width=5)
    label((17,140,253,236),"深圳",(189,37,54),height=.94)
    draw.line((265,151,247,231), fill=(39,79,135),width=6)
    label((258,140,500,239),"TAXI",(29,70,128),latin,height=.98)
    label((1,252,286,348),"深 圳 出 租",(20,63,119),height=.86)
    label((270,259,510,342),"e TAXI",(15,75,126),latin,height=.85)
    label((0,353,512,414),"电 召   9 6 8 8 0",(255,228,120),height=.98)
    label((1,430,252,508),badge,(214,223,228),height=.94)
    emblem={"e6":"BYD","tang":"唐","mifa9":"MAXUS","civic":"H","model3":"T","mini":"五菱"}[model]
    label((265,430,510,508),emblem,(227,231,232),height=.99)
    image.save(out / (model + ".png"))
