"""Build the local metre-scale game map using OSM's public map API.

Requires Python, requests and shapely>=2. The nine small extracts are cached
in the system temp directory. Run from any directory to regenerate the data.
"""
import gzip
import json
import math
import re
import tempfile
import time
from collections import Counter
from pathlib import Path

import requests
from shapely import make_valid, set_precision
from shapely.geometry import LineString, Point, Polygon, box
from shapely.ops import polygonize, unary_union
from shapely.strtree import STRtree


ORIGIN = (113.94417, 22.51366)
ANGLE = math.radians(ORIGIN[1])
LON_M = 111412.84 * math.cos(ANGLE) - 93.5 * math.cos(3*ANGLE) + .118 * math.cos(5*ANGLE)
LAT_M = 111132.92 - 559.82 * math.cos(2*ANGLE) + 1.175 * math.cos(4*ANGLE)
EXTENT = 3200
WINDOW = box(-EXTENT,-EXTENT,EXTENT,EXTENT)
CACHE = Path(tempfile.gettempdir()) / "shenzhen-talent-park-osm-v1"
DEST = Path(__file__).resolve().parents[1] / "public" / "data"


def project(lon, lat):
    return (round((lon-ORIGIN[0])*LON_M, 2), round((ORIGIN[1]-lat)*LAT_M, 2))


def unproject(x,z):
    return ORIGIN[0]+x/LON_M, ORIGIN[1]-z/LAT_M


def fetch():
    CACHE.mkdir(exist_ok=True)
    elements = {key:{} for key in ("node","way","relation")}
    client = requests.Session()
    client.headers.update({"User-Agent":"ShenzhenBayWalk-geodata/1.0 (local geography visualization)"})
    for col in range(3):
        for row in range(3):
            xmin,ymax=unproject(-EXTENT+2*EXTENT*col/3,-EXTENT+2*EXTENT*row/3)
            xmax,ymin=unproject(-EXTENT+2*EXTENT*(col+1)/3,-EXTENT+2*EXTENT*(row+1)/3)
            bounds=f"{xmin:.7f},{ymin:.7f},{xmax:.7f},{ymax:.7f}"
            dest=CACHE/f"{bounds}.json.gz"
            if not dest.exists():
                url="https://api.openstreetmap.org/api/0.6/map.json?bbox="+bounds
                for attempt in range(4):
                    try:
                        print("Reading",bounds,flush=True)
                        res=client.get(url,timeout=120)
                        res.raise_for_status()
                        result=res.json()
                        with gzip.open(dest,"wt",encoding="utf-8") as out:
                            json.dump(result,out,ensure_ascii=False,separators=(",",":"))
                        break
                    except (requests.RequestException, ValueError):
                        if attempt==3: raise
                        time.sleep(2**attempt)
            with gzip.open(dest,"rt",encoding="utf-8") as file:
                for elm in json.load(file)["elements"]:
                    elements[elm["type"]][elm["id"]] = elm
    return elements


def components(geometry, wanted):
    if geometry.is_empty:
        return
    if geometry.geom_type==wanted:
        yield geometry
    elif hasattr(geometry,"geoms"):
        for sub in geometry.geoms:
            yield from components(sub,wanted)


def number(value, default=0):
    parsed=re.match(r"^-?\d+(?:\.\d+)?",str(value))
    return float(parsed[0]) if parsed else default


def coords(seq, closed=False):
    out=[]
    for x,y in seq:
        p=[round(x,1),round(y,1)]
        if not out or p!=out[-1]:
            out.append(p)
    if closed and out and out[0]==out[-1]:
        out.pop()
    return out


def ring_fields(poly):
    d={"p":coords(poly.exterior.coords,True)}
    holes=[coords(r.coords,True) for r in poly.interiors if Polygon(r).area>1]
    if holes: d["holes"]=holes
    return d


def height_key(building):
    p=Polygon(building["p"],building.get("holes"))
    return f'{building["id"]}/{round(p.centroid.x)}/{round(p.centroid.y)}/{round(p.area)}'


def polys(geom):
    if not geom.is_valid: geom=make_valid(geom)
    simplified=geom.intersection(WINDOW).simplify(.32)
    yield from (p for p in components(set_precision(simplified,.1),"Polygon") if p.area>2)


def area_class(t):
    if t.get("location") in ("underground","indoor") or number(t.get("layer"))<0:
        return None
    if t.get("building:part","no")!="no" or t.get("building","no")!="no":
        if number(t.get("level"))<0:return None
        return ("buildings",t.get("building",t.get("building:part","yes")))
    if t.get("natural")=="water" or t.get("waterway")=="riverbank" or t.get("landuse") in ("basin","reservoir") or t.get("leisure")=="swimming_pool":
        return ("water",t.get("water", "pool" if t.get("leisure")=="swimming_pool" else "water"))
    if t.get("man_made") in ("bridge","pier"): return ("decks",t["man_made"])
    if t.get("highway")=="pedestrian" or t.get("area:highway") in ("pedestrian","footway"):
        return ("land","plaza")
    if t.get("natural") in ("wood","scrub","wetland","grassland","bare_rock","sand","beach","shingle"):
        return ("land",t["natural"])
    if t.get("leisure") in ("park","garden","pitch","sports_centre","playground","golf_course","nature_reserve","recreation_ground","track","common"):
        return ("land",t["leisure"])
    if t.get("amenity")=="parking" and t.get("parking","surface")=="surface":return ("land","parking")
    if t.get("landuse"):return ("land",t["landuse"])
    if t.get("landcover"):return ("land",t["landcover"])


DEFAULT_HEIGHTS={"apartments":40,"residential":22,"commercial":30,"retail":12,
                 "industrial":9,"school":16,"university":21,"kindergarten":10,"hospital":24,
                 "roof":4,"shed":3,"hut":3,"house":8,"detached":8,"public":11,
                 "hotel":36,"office":28,"grandstand":9,"depot":7,"carport":3,"warehouse":9}


def attributes(key,kind,id_,t):
    item={"id":id_,"kind":kind}
    if name:=t.get("name:zh",t.get("name")): item["name"]=name
    if key=="buildings":
        min_h=number(t.get("min_height")) or number(t.get("building:min_level"))*3.1
        h=number(t.get("height"))
        levels=number(t.get("building:levels"))
        if h>0: item["heightSource"]="height"
        elif levels>0:
            item["heightSource"]="levels"
            h=levels*({"industrial":4,"commercial":3.9,"retail":4,"school":3.5}.get(kind,3.1))
        else:
            item["heightSource"]="estimated"
            h=DEFAULT_HEIGHTS.get(kind,12)
        item["h"]=round(max(min_h+1,h),1)
        if min_h: item["minH"]=round(min_h,1)
        for key,field in [("building:material","material"),("building:colour","color"),("roof:shape","roof")]:
            if t.get(key):item[field]=t[key]
    if t.get("surface"):item["surface"]=t["surface"]
    if t.get("sport"):item["sport"]=t["sport"]
    return item


ROAD_WIDTH={"motorway":11,"trunk":11,"primary":10.5,"secondary":8,"tertiary":7,"residential":6,
            "unclassified":6,"living_street":4.5,"service":4.2,"busway":4,"pedestrian":6,"footway":2.6,
            "cycleway":3,"steps":2.4,"path":1.8,"track":3.2}


def roadway(w,t,line,junctions):
    kind=t["highway"]
    if kind not in ROAD_WIDTH and not kind.endswith("_link"): return
    if t.get("tunnel","no")!="no" or t.get("covered")=="building_passage" and t.get("indoor")=="yes": return
    if t.get("location") in ("underground","indoor") or number(t.get("layer"))<0 or number(t.get("level"))<0 or t.get("indoor")=="yes":return
    lanes=number(t.get("lanes"))
    width=number(t.get("width")) or (max(2.7,3.25*lanes) if lanes else ROAD_WIDTH.get(kind,4.8))
    if w["id"]==562534109:width=13
    for seg in components(line.intersection(WINDOW),"LineString"):
        if seg.length<.5: continue
        raw=list(seg.coords)
        cuts=[0,*[i for i in range(1,len(raw)-1) if raw[i] in junctions],len(raw)-1]
        simplified=[raw[0]]
        for start,end in zip(cuts,cuts[1:]):
            simplified.extend(list(LineString(raw[start:end+1]).simplify(.25).coords)[1:])
        points=coords(simplified)
        if t.get("oneway")=="-1":points.reverse()
        d={"id":w["id"],"kind":kind,"p":points,"width":round(width,1),"name":t.get("name:zh",t.get("name","")),
           "oneway":t.get("oneway") in ("yes","true","1","-1") or (t.get("junction")=="roundabout" and t.get("oneway")!="no"),
           "layer":int(number(t.get("layer"))),"bridge":t.get("bridge","no")!="no"}
        if t.get("surface"):d["surface"]=t["surface"]
        if t.get("footway"):d["footway"]=t["footway"]
        if t.get("service"):d["service"]=t["service"]
        if t.get("access"):d["access"]=t["access"]
        if t.get("motor_vehicle"):d["motorVehicle"]=t["motor_vehicle"]
        if lanes:d["lanes"]=int(lanes)
        yield d


def build(elements):
    ways=elements["way"]
    projected={id_:project(n["lon"],n["lat"]) for id_,n in elements["node"].items()}
    usage=Counter(n for w in ways.values() if w.get("tags",{}).get("highway") for n in set(w["nodes"]))
    junctions={projected[n] for n,count in usage.items() if count>1 and n in projected}
    lines={}
    for id_,w in ways.items():
        nodes=w["nodes"]
        if len(nodes)>=2 and all(i in projected for i in nodes):
            lines[id_]=LineString([projected[i] for i in nodes])
    result={"origin":ORIGIN,"radius":3000,"extent":EXTENT,"projection":{"eastMetersPerDegree":LON_M,"northMetersPerDegree":LAT_M},
            "attribution":"© OpenStreetMap contributors, ODbL 1.0","land":[],"water":[],"roads":[],"buildings":[],"decks":[],"pois":[]}
    building_shapes=[]
    def store_shape(key,kind,id_,t,geom):
        attrs=attributes(key,kind,id_,t)
        for p in polys(geom):
            if key=="buildings":
                building_shapes.append((p,attrs,t.get("building:part","no")!="no"))
            else:result[key].append({**attrs,**ring_fields(p)})
    for r in elements["relation"].values():
        t=r.get("tags",{})
        if t.get("type")!="multipolygon" or not (cls:=area_class(t)):continue
        def rings(role):
            edges=[lines[m["ref"]] for m in r["members"] if m["type"]=="way" and m["role"] in role and m["ref"] in lines]
            return unary_union([make_valid(p) for p in polygonize(edges)]) if edges else Polygon()
        exterior=rings(("outer",""))
        if not exterior.is_empty: store_shape(*cls,-r["id"],t,exterior.difference(rings(("inner",))))

    for id_,w in ways.items():
        t=w.get("tags",{})
        if not t or id_ not in lines: continue
        line=lines[id_]
        if not line.intersects(WINDOW):continue
        area=line.is_closed and len(w["nodes"])>=4
        if t.get("highway") and t.get("area")!="yes" and not(area and t.get("highway")=="pedestrian"):
            result["roads"].extend(roadway(w,t,line,junctions))
        if area and (cls:=area_class(t)):store_shape(*cls,id_,t,Polygon(line.coords))

    # Keep detailed building parts with their floor elevations. Avoid drawing
    # their outline as a second, equal-height extrusion through the parts.
    # The landmark tower has a purpose-built architectural model downstream.
    tower=next((p for p,a,part in building_shapes if a["id"]==529272473),None)
    parts=[p for p,a,ispart in building_shapes if ispart and not(tower and tower.buffer(.6).covers(p))]
    index=STRtree(parts)
    for p,a,ispart in building_shapes:
        if ispart and tower and tower.buffer(.6).covers(p): continue
        if not ispart and a["id"]!=529272473:
            contained=[parts[i] for i in index.query(p) if p.buffer(.65).covers(parts[i])]
            if contained:
                leftover=p.difference(unary_union(contained))
                if leftover.area<p.area*.035:continue
                for q in polys(leftover):
                    if q.area>6:result["buildings"].append({**a,**ring_fields(q)})
                continue
        result["buildings"].append({**a,**ring_fields(p)})

    # OSM's oriented coastline always keeps sea on its right. In X-east /
    # Z-south coordinates that side has normal (-dz, dx).
    coast=[lines[w["id"]].intersection(WINDOW) for w in ways.values() if w["id"] in lines and w.get("tags",{}).get("natural")=="coastline"]
    segs=[]
    for c in coast:
        for part in components(c,"LineString"):
            for a,b in zip(part.coords,list(part.coords)[1:]):
                length=math.dist(a,b)
                if length:segs.append(Point((a[0]+b[0])/2-(b[1]-a[1])*.25/length,(a[1]+b[1])/2+(b[0]-a[0])*.25/length))
    samples=STRtree(segs)
    wet=[p for p in polygonize(unary_union([WINDOW.boundary,*coast])) if len(samples.query(p,predicate="contains"))>0]
    for sea in components(unary_union(wet),"Polygon"):
        result["water"].append({"id":0,"name":"深圳湾","kind":"ocean",**ring_fields(sea.simplify(.45))})

    for i,n in elements["node"].items():
        x,z=projected[i]
        if max(abs(x),abs(z))>EXTENT:continue
        t=n.get("tags",{})
        kind=next((t[k] for k in ("tourism","historic","amenity","highway","natural","shop","public_transport") if k in t),"")
        if kind in ("tree","street_lamp","bench","bus_stop","traffic_signals","crossing","artwork","viewpoint","monument","drinking_water","toilets","shelter","information","platform") or (kind and "name" in t):
            item={"kind":kind,"p":[round(x,1),round(z,1)]}
            if t.get("name"):item["name"]=t["name"]
            result["pois"].append(item)
    return result


if __name__=="__main__":
    elements=fetch()
    result=build(elements)
    matches=Path(__file__).with_name("geoheight-matches.json")
    if matches.exists():
        supplemental=json.loads(matches.read_text(encoding="utf-8"))
        for building in result["buildings"]:
            if building["heightSource"]=="estimated" and (row:=supplemental.get(height_key(building))):
                building["h"],building["heightSource"]=row[:2]
    result["landmarks"]={
        "tower":{"id":529272473,"name":"中国华润大厦","p":[-263.3,-456.8],"h":392.5},
        "stadium":{"id":-9244350,"name":"深圳湾体育场","p":[225.9,-769.2],"h":40},
        "starBridge":{"id":736632011,"name":"人才星光桥","p":[233.9,41.9],"pathId":562534109},
        "piBridge":{"id":570468707,"name":"π桥","p":[-49,334.1]},
        "culture":{"id":1441599159,"name":"深圳湾文化广场","p":[-405,-137]},
        "lake":{"id":-10175109,"name":"深圳湾内湖","p":[0,0]},
        "pavilion":{"id":571169618,"name":"求贤阁","p":[-455.3,223.6]},
    }
    result["views"]=[
        {"id":"bridge","name":"人才星光桥","x":213.6,"z":143.5,"lookX":-263.3,"lookZ":-456.8},
        {"id":"street","name":"登良路","x":-121.8,"z":-418.1,"lookX":-191,"lookZ":-451},
        {"id":"stadium","name":"深圳湾体育中心","x":234.1,"z":-597.2,"lookX":130,"lookZ":-812},
        {"id":"pi","name":"π桥","x":23,"z":345.6,"lookX":-48,"lookZ":319},
        {"id":"coastalCity","name":"海岸城街区","x":-1273.4,"z":-683.1,"lookX":-1285,"lookZ":-700},
        {"id":"seaBreeze","name":"海风运动广场","x":-200.5,"z":2815.9,"lookX":250,"lookZ":3500},
    ]
    DEST.mkdir(parents=True,exist_ok=True)
    target=DEST/"shenzhen.json"
    with open(target,"w",encoding="utf-8") as f:json.dump(result,f,ensure_ascii=False,separators=(",",":"))
    print("Wrote",target,target.stat().st_size,{k:len(v) for k,v in result.items() if isinstance(v,list)})
