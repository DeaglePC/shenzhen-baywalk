"""Generate a north-up RGB ground texture from the public Sentinel-2 archive.

Dependencies: rasterio, numpy, Pillow, requests, shapely. Reads only the
window used by the game, with GDAL HTTP range requests to a cloud GeoTIFF.
"""
import numpy as np
import rasterio
from PIL import Image
from rasterio.enums import Resampling
from rasterio.transform import from_bounds
from rasterio.warp import reproject, transform_bounds
from rasterio.windows import Window, from_bounds as window_from_bounds

from geodata import DEST, EXTENT, unproject

COLLECTION="https://sentinel-cogs.s3.us-west-2.amazonaws.com/sentinel-s2-l2a-cogs"
SCENE="49/Q/GE/2025/12/S2C_49QGE_20251209_0_L2A"
URL=f"{COLLECTION}/{SCENE}/TCI.tif"


def main():
    xmin,ymin=unproject(-EXTENT,EXTENT)
    xmax,ymax=unproject(EXTENT,-EXTENT)
    bounds=(xmin,ymin,xmax,ymax)
    length=640
    result=np.zeros((3,length,length),dtype="uint8")
    with rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR",GDAL_HTTP_CONNECTTIMEOUT="20",
                      GDAL_HTTP_TIMEOUT="60",GDAL_HTTP_MAX_RETRY="2"):
        with rasterio.open(URL) as src:
            local=transform_bounds("EPSG:4326",src.crs,*bounds)
            win=window_from_bounds(*local,transform=src.transform)
            win=Window(int(win.col_off)-2,int(win.row_off)-2,int(win.width)+5,int(win.height)+5)
            data=src.read((1,2,3),window=win)
            reproject(data,result,src_transform=src.window_transform(win),src_crs=src.crs,
                      dst_transform=from_bounds(*bounds,length,length),dst_crs="EPSG:4326",
                      resampling=Resampling.bilinear)
    texture=Image.fromarray(np.moveaxis(result,0,2))
    path=DEST/"houhai-sentinel.webp"
    texture.save(path,format="WEBP",quality=94,method=6)
    print(path,path.stat().st_size,"bytes")


if __name__=="__main__": main()
