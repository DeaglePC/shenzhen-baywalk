"""Match missing building heights to the CC BY 4.0 CMAB study (Zhang et al.).

Only the relevant Pearl River Delta shapefile/DBF members are read from the
Guangdong ZIP archive. Fetch compressed members in resumable HTTP ranges.
Requires requests, numpy, shapely. Data downloads are cached in system temp.
"""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import json
import math
import os
import struct
import tempfile
import time
import zlib

import numpy as np
import requests
from shapely.affinity import translate
from shapely.geometry import Polygon
from shapely.strtree import STRtree

from geodata import DEST, EXTENT, LON_M, LAT_M, ORIGIN, unproject

URL="https://ndownloader.figshare.com/files/53670575"
MEMBER="processed_zhusanjiaoyi20220302_all"
CACHE=Path(tempfile.gettempdir())/"sz-houhai-cmab-27992417"
EARTH=6378137


def read_range(start,end):
    for attempt in range(4):
        try:
            r=requests.get(f"{URL}?rangeStart={start}&rangeEnd={end}",
                           headers={"Range":f"bytes={start}-{end}"},timeout=(15,55))
            r.raise_for_status()
            if r.status_code!=206 or len(r.content)!=end-start+1:
                raise ValueError(f"Invalid range response at {start}")
            return r.content
        except (requests.RequestException,ValueError):
            if attempt==3:raise
            time.sleep(2**attempt)


def unpack_members():
    CACHE.mkdir(exist_ok=True)
    zip_size=2037563309
    directory=read_range(2037472535,zip_size-1)
    found={}
    for record in directory.split(b"PK\x01\x02")[1:]:
        length=struct.unpack_from("<H",record,24)[0]
        name=record[42:42+length].decode("utf-8").split("/")[-1]
        ext=Path(name).suffix
        if name!=MEMBER+ext or ext not in (".shp",".dbf"): continue
        offset=struct.unpack_from("<I",record,38)[0]
        size=struct.unpack_from("<I",record,16)[0]
        crc=struct.unpack_from("<I",record,12)[0]
        fname=CACHE/name
        found[ext]=fname
        if fname.is_file(): continue
        local=read_range(offset,offset+511)
        name_size,extra=struct.unpack_from("<HH",local,26)
        begin=offset+30+name_size+extra
        chunks=[(begin+i,min(begin+i+4*1024*1024-1,begin+size-1)) for i in range(0,size,4*1024*1024)]
        def download(span):
            a,b=span
            block=CACHE/f"{a}-{b}.part"
            if block.is_file() and block.stat().st_size==b-a+1:return block
            block.write_bytes(read_range(a,b))
            return block
        print("Caching",name,"%.0f MB"%(size/1e6),flush=True)
        scratch=fname.with_suffix(".tmp")
        checksum=0
        with ThreadPoolExecutor(max_workers=5) as pool, scratch.open("wb") as stream:
            inflater=zlib.decompressobj(-15)
            for block in pool.map(download,chunks):
                raw=inflater.decompress(block.read_bytes())
                checksum=zlib.crc32(raw,checksum)
                stream.write(raw)
            tail=inflater.flush()
            stream.write(tail)
            checksum=zlib.crc32(tail,checksum)
        if checksum!=crc:raise ValueError("Invalid member checksum")
        os.replace(scratch,fname)
    return found


def to_mercator(x,z):
    lon,lat=unproject(x,z)
    return EARTH*math.radians(lon),EARTH*math.asinh(math.tan(math.radians(lat)))


def from_mercator(points):
    px=(np.degrees(points[:,0]/EARTH)-ORIGIN[0])*LON_M
    pz=(ORIGIN[1]-np.degrees(np.arctan(np.sinh(points[:,1]/EARTH))))*LAT_M
    return np.column_stack((px,pz))


def read_shapes(paths):
    minx,miny=to_mercator(-EXTENT-30,EXTENT+30)
    maxx,maxy=to_mercator(EXTENT+30,-EXTENT-30)
    rows=[]
    with paths[".dbf"].open("rb") as table,paths[".shp"].open("rb") as shp:
        head=table.read(32)
        head_len,row_len=struct.unpack_from("<HH",head,8)
        offset=1
        fields={}
        while table.tell()<head_len-1:
            block=table.read(32)
            field=block[:11].split(b"\0")[0].decode()
            length=block[16]
            fields[field]=(offset,offset+length)
            offset+=length
        print("Fields",fields,flush=True)
        shp.seek(100)
        while record:=shp.read(8):
            rec_id,words=struct.unpack(">2I",record)
            data=shp.read(words*2)
            if len(data)<44:continue
            x1,y1,x2,y2=struct.unpack_from("<4d",data,4)
            if x2<minx or y2<miny or x1>maxx or y1>maxy:continue
            parts,points=struct.unpack_from("<2I",data,36)
            if parts!=1 or points<4:continue
            poly=Polygon(from_mercator(np.frombuffer(data,dtype="<f8",count=points*2,offset=48).reshape(-1,2)))
            if poly.area<12 or not poly.is_valid:continue
            table.seek(head_len+(rec_id-1)*row_len)
            row=table.read(row_len)
            atr={f:row[a:b].strip().decode("utf-8","replace") for f,(a,b) in fields.items()}
            rows.append((poly,atr,rec_id))
    return rows


def match_heights(rows,buildings):
    # Rasterizing both footprint sets on a 4 m grid and correlating their
    # high-pass masks yields this registration of the March 2022 roof image.
    rows=[(translate(p,xoff=8,yoff=-4),attr,i) for p,attr,i in rows]
    shapes=[r[0] for r in rows]
    tree=STRtree(shapes)
    matches=[]
    for b in buildings:
        p=Polygon(b["p"],b.get("holes"))
        if p.area<55 or b.get("minH",0)>1 or b["kind"] in ("roof","shed","hut","construction","carport","cabin"):continue
        choices=[]
        for i in tree.query(p,predicate="intersects"):
            q=shapes[i]
            overlap=p.intersection(q).area
            iou=overlap/(p.area+q.area-overlap)
            if iou<.25:continue
            choices.append((iou,i))
        choices.sort(reverse=True)
        if not choices: continue
        iou,i=choices[0]
        if len(choices)>1 and choices[1][0]>.70*iou:continue
        height=float(rows[i][1]["Height"])
        if not math.isfinite(height) or not 2.5<=height<=500:continue
        matches.append((b,iou,height,rows[i][2]))
    return matches


def match_repeated_footprints(buildings):
    residential={"apartments","residential","dormitory"}
    shapes=[Polygon(b["p"],b.get("holes")) for b in buildings]
    centers=[p.centroid for p in shapes]
    base=[translate(p,xoff=-c.x,yoff=-c.y) for p,c in zip(shapes,centers)]
    tree=STRtree(centers)
    results={}
    for n,b in enumerate(buildings):
        if b["kind"] not in residential or b.get("minH",0)>1: continue
        candidates=[]
        for i in tree.query(centers[n],predicate="dwithin",distance=160):
            ref=buildings[i]
            if n==i or b["id"]==ref["id"] or ref["kind"]!=b["kind"] or ref.get("minH",0)>1 or ref["heightSource"] not in ("height","levels"):continue
            if min(base[n].area,base[i].area)<.84*max(base[n].area,base[i].area):continue
            area=base[n].intersection(base[i]).area
            similarity=area/(base[n].area+base[i].area-area)
            if similarity<.85:continue
            candidates.append((centers[n].distance(centers[i]),float(ref["h"]),similarity,int(ref["id"])))
        candidates.sort()
        # Similar apartments in the same development often form identical
        # rows; reject ambiguous heights and lone moderately similar peers.
        peers=candidates[:4]
        if not peers:continue
        hs=[p[1] for p in peers]
        if max(hs)-min(hs)>max(3.5,np.median(hs)*.075):continue
        if len(peers)==1 and (peers[0][2]<.94 or peers[0][0]>70):continue
        results[n]=(round(float(np.median(hs)),1),peers[0][3])
    return results


if __name__=="__main__":
    paths={ext:CACHE/(MEMBER+ext) for ext in (".shp",".dbf")}
    if not all(p.is_file() for p in paths.values()):paths=unpack_members()
    rows=read_shapes(paths)
    print("Local footprints",len(rows),flush=True)
    buildings=json.loads((DEST/"shenzhen.json").read_text(encoding="utf-8"))["buildings"]
    matched=match_heights(rows,buildings)
    from collections import Counter
    from geodata import DEFAULT_HEIGHTS, height_key
    def validate(label,expected):
        obs=np.array([b["h"] for b,h in expected])
        est=np.array([h for b,h in expected])
        prior=np.array([DEFAULT_HEIGHTS.get(b["kind"],12) for b,h in expected])
        print(label,"controls",len(obs),"mean abs. difference model/baseline",
              round(np.mean(abs(est-obs)),1),round(np.mean(abs(prior-obs)),1))
    cmab=[m for m in matched if m[0]["kind"]=="apartments" and m[1]>=.50 and m[2]>=6]
    validate("CMAB",[(b,h) for b,iou,h,rec in cmab if b["heightSource"] in ("height","levels")])
    repeated=match_repeated_footprints(buildings)
    validate("Nearby",[(buildings[n],h) for n,(h,ref) in repeated.items() if buildings[n]["heightSource"] in ("height","levels")])
    enriched={}
    for b,iou,h,record in cmab:
        if b["heightSource"] not in ("height","levels"):
            enriched[height_key(b)]=[round(h,1),"CMAB",record,round(iou,3)]
    for n,(h,ref) in repeated.items():
        b=buildings[n]
        if b["heightSource"] not in ("height","levels"):
            enriched[height_key(b)]=[h,"nearby",ref]
    destination=Path(__file__).with_name("geoheight-matches.json")
    destination.write_text(json.dumps(enriched,separators=(",",":"),sort_keys=True),encoding="utf-8")
    print("Enrichment:",Counter(m[1] for m in enriched.values()))
