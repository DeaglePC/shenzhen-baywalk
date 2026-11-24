"""Sample the lawn and shingle materials from the numbered park photographs."""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import map_coordinates

out = Path(__file__).resolve().parents[1] / 'public/city'
photos = Path(sys.argv[1])
lake = Image.open(next(photos.glob('2-*.jpg'))).convert('RGB')


def tile(name, crops, size, patch, seed):
    rng = np.random.default_rng(seed)
    sources = [np.asarray(lake.crop(box).resize(res, Image.Resampling.BICUBIC))
               for box, res in crops]
    result = np.zeros((size, size, 3))
    norm = np.zeros((size, size))
    window = np.outer(np.hanning(patch), np.hanning(patch))
    axis = np.arange(patch)
    for y in range(0, size, patch//2):
        for x in range(0, size, patch//2):
            src = sources[rng.integers(len(sources))]
            i = rng.integers(src.shape[0]-patch+1)
            j = rng.integers(src.shape[1]-patch+1)
            crop = src[i:i+patch, j:j+patch]
            if rng.random() < .5:
                crop = crop[:, ::-1]
            idx = np.ix_((axis+y) % size, (axis+x) % size)
            result[idx] += window[..., None]*crop
            norm[idx] += window
    Image.fromarray((result/norm[..., None]).astype('uint8')).save(
        out / f'flowerbed-{name}.webp', quality=92)


tile('lawn', [((422, 580, 751, 713), (300, 240)),
              ((462, 556, 785, 643), (286, 192))], 512, 64, 823)
tile('shingle', [((185, 452, 347, 466), (162, 40)),
                 ((82, 448, 154, 456), (72, 32)),
                 ((782, 444, 851, 452), (69, 32))], 256, 32, 427)

# Build a transparent hanging spray, sampling the leaf palette inside the crown.
rng = np.random.default_rng(3165)
crown = np.asarray(lake.crop((449, 350, 511, 417)), dtype=float)
palette = crown[(crown[:,:,1] > crown[:,:,2]+10) & (crown[:,:,1] > 29)]
shoot = Image.new('RGBA', (256, 384))
draw = ImageDraw.Draw(shoot)
for k in range(12):
    side = 1 if k%2 else -1
    start = np.array([128., 16.+k*13.])
    end = np.array([128.+side*(104-k*4), 201.+k*14.])
    def twig(t):
        return start+(end-start)*t+[side*21*np.sin(np.pi*t), -21*np.sin(np.pi*t)]
    draw.line([tuple(twig(t)) for t in np.linspace(0,1,13)], fill=(63,60,36,255),width=2)
    for j in range(21):
        t=(j+.5)/21; a=twig(t)
        d=np.array([(-1 if j%2 else 1)*rng.uniform(8,18), rng.uniform(12,27)])*(1-.36*t)
        w=np.array([-d[1],d[0]])*.15
        rgb=np.clip(palette[rng.integers(len(palette))]*rng.uniform(1.3,1.76)+[2,4,1],0,255).astype(int)
        draw.polygon([tuple(q) for q in (a,a+.27*d+w,a+.64*d+w*.8,a+d,a+.53*d-w,a+.2*d-w*.6)],
                     fill=(*rgb,255))
shoot.save(out/'flowerbed-shoot.webp', quality=95)

# A diffuse overcast sky from clear strips above the treeline in the photographs.
# The hemispheres share a soft horizon and converge to one colour at the pole.
h,w=512,1024
row,col=np.mgrid[0:h,0:w]
elev=(.5-(row+.5)/h)*np.pi
az=(col+.5)/w*2*np.pi
weight=np.zeros((h,w));sky=np.zeros((h,w,3))
for number,heading,box in [(1,.72,(35,8,1240,220)),(4,2.29,(18,9,1252,355)),
                            (2,3.86,(20,5,1247,190)),(3,5.43,(38,8,1230,198))]:
    patch=np.array(Image.open(next(photos.glob(f'{number}-*.jpg'))).convert('RGB').crop(box))/255
    delta=np.angle(np.exp(1j*(az-heading)))
    blend=np.clip(1-np.abs(delta)/1.58,0,1)**2
    u=np.clip(.5+delta/3.16,0,1)*(patch.shape[1]-1)
    v=np.clip(1-elev/.68,0,1)*(patch.shape[0]-1)
    for channel in range(3):
        sky[:,:,channel]+=blend*map_coordinates(patch[:,:,channel],[v,u],order=1)
    weight+=blend
sky/=weight[:,:,None]
pole=np.clip((elev-1.1)/.45,0,1)[:,:,None]
sky=np.clip(.78+1.42*(sky*(1-pole)+pole*np.array([.81,.84,.88])-.78),0,1)**2.2*1.38
below=np.clip(-elev/.30,0,1)[:,:,None]
sky=sky*(1-below)+below*np.array([.21,.23,.19])
mantissa,exp=np.frexp(sky.max(axis=2))
rgbe=np.dstack([sky*(mantissa*256/sky.max(axis=2))[:,:,None],exp+128]).clip(0,255).astype('uint8')
with (out.parent/'media/flowerbed-overcast.hdr').open('wb') as f:
    f.write(f'#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y {h} +X {w}\n'.encode())
    for scan in rgbe:
        f.write(bytes([2,2,w>>8,w&255]))
        for plane in scan.T:
            for start in range(0,w,128):
                block=plane[start:start+128];f.write(bytes([len(block)]));f.write(block.tobytes())
