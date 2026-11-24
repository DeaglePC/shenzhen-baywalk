"""Sample regional tree crowns from the WRI / Meta canopy height model (CC BY).

Run after geodata.py. Requires rasterio, scipy, numpy and shapely. Raster
heights are model predictions. Crown centres are detected local maxima rather
than surveyed stem positions. Output retains a detailed park and a lighter
representation toward the edge of the walkable region.
"""
import json
import sys
from pathlib import Path
from tempfile import gettempdir

import numpy as np
import rasterio
from rasterio.enums import Resampling
from rasterio.features import rasterize
from rasterio.transform import from_bounds
from rasterio.warp import reproject, transform_bounds
from rasterio.windows import Window, from_bounds as window_from_bounds
from scipy.ndimage import gaussian_filter, maximum_filter
from scipy.spatial import cKDTree
from shapely.geometry import Polygon, LineString

from geodata import DEST, EXTENT, unproject

URL=("https://dataforgood-fb-data.s3.amazonaws.com/forests/v2/global/"
     "dinov3_global_chm_v2_ml3/chm/1321222320.tif")
PIXEL=2
SIZE=2*EXTENT//PIXEL


def height_grid():
    cache=Path(gettempdir())/"shenzhen-talent-park-chmv2-2m.npy"
    if cache.exists():return np.load(cache)
    bounds=(*unproject(-EXTENT,EXTENT),*unproject(EXTENT,-EXTENT))
    heights=np.zeros((SIZE,SIZE),dtype="uint8")
    with rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR",GDAL_HTTP_TIMEOUT="60",
                      GDAL_HTTP_MULTIRANGE="YES",GDAL_HTTP_MAX_RETRY="2"):
        with rasterio.open(URL) as src:
            local=transform_bounds("EPSG:4326",src.crs,*bounds)
            win=window_from_bounds(*local,transform=src.transform)
            win=Window(int(win.col_off)-3,int(win.row_off)-3,int(win.width)+7,int(win.height)+7)
            data=src.read(1,window=win)
            reproject(data,heights,src_transform=src.window_transform(win),src_crs=src.crs,
                      dst_transform=from_bounds(*bounds,SIZE,SIZE),dst_crs="EPSG:4326",
                      resampling=Resampling.bilinear)
    np.save(cache,heights)
    return heights


def exclusion_mask(map_):
    masks=[]
    for k in ("buildings","water","decks","land"):
        for f in map_[k]:
            if k=="land" and f["kind"] not in ("pitch","playground","plaza","parking","construction"):continue
            if k=="buildings" and f.get("minH",0)>3:continue
            masks.append(Polygon(f["p"],f.get("holes")).buffer(1))
    for r in map_["roads"]:
        masks.append(LineString(r["p"]).buffer(r["width"]*.5+1,quad_segs=2))
    # Local map Z increases down; raster row zero is the northern boundary.
    transform=rasterio.Affine(PIXEL,0,-EXTENT,0,PIXEL,-EXTENT)
    return rasterize(((g,1) for g in masks),out_shape=(SIZE,SIZE),transform=transform,
                     fill=0,dtype="uint8",all_touched=True).astype(bool)


def park_infill():
    """Sample additional peaks and contiguous wooded areas inside the park."""
    data=json.loads((DEST/"shenzhen.json").read_text(encoding="utf-8"))
    park=next(f for f in data["land"] if f["kind"]=="park" and "人才公园" in f.get("name",""))
    raster=rasterize([(Polygon(park["p"],park.get("holes")),1)],out_shape=(SIZE,SIZE),
                     transform=rasterio.Affine(PIXEL,0,-EXTENT,0,PIXEL,-EXTENT),dtype="uint8")
    heights=height_grid()
    trend=gaussian_filter(heights.astype("float32"),.8)
    score=trend+np.random.default_rng(391).random(heights.shape,dtype="float32")*.03
    available=(raster!=0)&~exclusion_mask(data)&(heights<32)
    peaks=(score==maximum_filter(score,5))&(trend>=3.6)&available
    original=json.loads((DEST/"houhai-canopy.json").read_text())["trees"]
    local=json.loads((DEST.parents[1]/"src"/"foliage-samples.json").read_text())
    previous=cKDTree(np.asarray(original+local)[:,:2])
    added=[]
    # An unbroken canopy can contain several trees but have only one local maximum.
    # Fill uncovered portions only where a neighbourhood is consistently wooded.
    wooded=(gaussian_filter((heights>=4).astype("float32"),2.5)>.75)&(trend>=4.5)&available
    for candidates in (peaks,wooded):
        rows,cols=np.where(candidates)
        for i in np.argsort(-score[rows,cols],kind="stable"):
            y,x=rows[i],cols[i]
            point=(int(x*PIXEL-EXTENT+PIXEL/2),int(y*PIXEL-EXTENT+PIXEL/2))
            height=int(heights[y,x]);spacing=max(4.5,min(9,height*.65))
            if candidates is wooded:spacing=max(6.5,height*.83)
            if previous.query(point)[0]<spacing:continue
            if any((px-point[0])**2+(pz-point[1])**2<max(spacing,h*.65)**2 for px,pz,h in added):continue
            added.append([*point,height])
        if candidates is peaks:peak_count=len(added)
    path=DEST.parents[1]/"src"/"park-infill.json"
    path.write_text(json.dumps(added,separators=(",",":")),encoding="utf-8")
    print("Park infill:",peak_count,"peaks and",len(added)-peak_count,"sites in continuous canopy",flush=True)


def main():
    heights=height_grid()
    map_=json.loads((DEST/"shenzhen.json").read_text(encoding="utf-8"))
    unavailable=exclusion_mask(map_)
    trend=gaussian_filter(heights.astype("float32"),.9)
    rng=np.random.default_rng(391)
    score=trend+rng.random(trend.shape,dtype="float32")*.03
    # Compare neighbourhood peaks before applying exclusions to keep a crown
    # centred on its apex and avoid creating new apexes next to road cut-outs.
    ys,xs=np.where((score==maximum_filter(score,7))&(trend>3.2)&(heights<48)&~unavailable)
    xyz=np.column_stack((xs*PIXEL-EXTENT+PIXEL/2,ys*PIXEL-EXTENT+PIXEL/2,heights[ys,xs]))
    # Weight selections toward the core park, keeping a random spatial sample
    # throughout the region. Heights are retained unchanged after sampling.
    distance=np.hypot(xyz[:,0],xyz[:,1])
    weights=np.maximum(.07,1/(1+(distance/1120)**2))
    count=min(9000,len(xyz))
    idx=rng.choice(len(xyz),size=count,replace=False,p=weights/weights.sum())
    output=xyz[idx].astype(int)
    rng.shuffle(output)
    payload={"source":"Meta and WRI, CHMv2 (2026), CC BY 4.0","pixelMeters":2,
             "count":count,"detected":len(xyz),"trees":output.tolist()}
    path=DEST/"houhai-canopy.json"
    path.write_text(json.dumps(payload,separators=(",",":")),encoding="utf-8")
    print("Detected",len(xyz),"selected",len(output),"in central 650m:",int((distance[idx]<650).sum()),
          "height min/median/max:",np.percentile(output[:,2],[0,50,100]),flush=True)


if __name__=="__main__":
    if "--park-infill" in sys.argv:park_infill()
    else:main()
