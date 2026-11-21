"""World-aligned, original softbox reflection studio for the Model 3 configurator.

Generate a Radiance RGBE map using linear light values. The long reflection
cards run parallel to the wheelbase. Used for the native studio and WebGL.
"""
from pathlib import Path
import sys
import numpy as np

target=Path(sys.argv[1])
width,height=1024,512
u=(np.arange(width)+.5)/width
v=(np.arange(height)+.5)/height
az=(u-.5)*2*np.pi
el=(.5-v)*np.pi
e,a=np.meshgrid(el,az,indexing="ij")
x,y,z=np.cos(e)*np.cos(a),np.sin(e),np.cos(e)*np.sin(a)
def step(x,w):
    q=np.clip(x/w*.5+.5,0,1)
    return q*q*(3-2*q)
def band(x,lo,hi,soft):return step(x-lo,soft)*step(hi-x,soft)
# A neutral horizon, floor roll-off, and a silver overhead diffusion sheet.
haze=.069+.290*step(-y-.12,.48)+.220*step(y-.43,.41)
value=haze+.13*np.exp(-((y+.63)/.33)**2)
# Broad uninterrupted high-key strips with a narrow lower card; the bright
# lower edge defines the stamped sill rather than washing out the door face.
for side,strength in [(1,2.1),(-1,2.1)]:
    near=step(side*x-.25,.22)
    value+=strength*near*band(y,.26,.64,.075)
    value+=.36*near*band(y,-.117,-.091,.014)*step(.80-np.abs(z),.14)
    value+=3.4*near*band(y,.727,.855,.037)*step(.71-np.abs(z),.14)
# Long ceiling sheet and bow-shaped kick across the hood and front shoulder.
value+=2.40*step(y-.80,.17)*band(x,-.68,.38,.14)
value+=1.05*step(np.abs(z)-.57,.19)*band(y,.40,.62,.097)
# Lens-aligned measurements of the PN01 paint in the three factory views
# constrain the angular output of each studio card. Interpolating in elevation
# and azimuth leaves the long reflection continuous across panel boundaries.
elevations=np.array([-75,-45,-23,-8,8,23,40,58,78])
yaws=np.arange(0,181,30)
card_gain=np.array([
    [.78,.74,.73,.76,.79,.82,.85], [.48,.80,.52,.79,.82,1.05,.97],
    [.34,.39,.65,.64,.50,.45,.55], [.38,.40,.86,.64,.68,.41,.62],
    [.73,.78,.69,.67,.62,.89,.64], [.40,.25,.21,.32,.18,.23,.36],
    [.28,.23,.07,.22,.11,.34,.36], [.36,.34,.23,.30,.25,.33,.26],
    [.38,.37,.33,.23,.22,.22,.22],
])
yaw=np.degrees(np.arctan2(np.abs(x[height//2]),z[height//2]))
azimuth_gain=np.array([np.interp(yaw,yaws,row) for row in card_gain])
gains=np.stack([np.interp(np.degrees(el),elevations,column) for column in azimuth_gain.T],axis=1)
value*=gains
# A pale low front card defines the shallow, grilleless bumper's front face.
value+=.31*step(z-.68,.23)*band(y,-.14,.16,.115)
colour=np.stack((value*.989,value*.992,value*1.022),axis=-1)
target.parent.mkdir(parents=True,exist_ok=True)
mantissa,exponent=np.frexp(colour.max(axis=-1))
channels=np.zeros((height,width,4),np.uint8)
channels[:,:,:3]=np.floor(colour*2**(8-exponent[:,:,None].astype(float))).astype(np.uint8)
channels[:,:,3]=(128+exponent).astype(np.uint8)
def encode(scan):
    result=bytearray();literal=bytearray();i=0
    def flush():
        if literal:result.extend((len(literal),));result.extend(literal);literal.clear()
    while i<len(scan):
        run=1
        while i+run<len(scan) and run<127 and scan[i+run]==scan[i]:run+=1
        if run>=4:
            flush();result.extend((128+run,scan[i]));i+=run
        else:
            literal.append(scan[i]);i+=1
            if len(literal)==128:flush()
    flush();return result
with target.open("wb") as f:
    f.write(f"#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y {height} +X {width}\n".encode())
    for row in channels:
        f.write(bytes((2,2,width>>8,width&255)))
        for c in range(4):f.write(encode(row[:,c]))
