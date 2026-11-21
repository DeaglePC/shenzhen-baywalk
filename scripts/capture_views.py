"""Photograph the game's two existing viewpoints with a repeatable simulation clock.

Run against a Vite dev server for the chosen revision. Uses Python Playwright,
installed Chrome, and the application's own world, camera, renderer and controls.
"""
import argparse
import json
import os
from pathlib import Path

from playwright.sync_api import sync_playwright


def photograph(page, server, place_id, destination):
    page.goto(server + "/credits.html")
    page.evaluate("""async () => {
      const nativeFrame=requestAnimationFrame.bind(window);
      window.requestAnimationFrame=callback=>{
        if(callback.name==='render'){window.worldFrame=callback;return 0;}
        return nativeFrame(callback);
      };
      const {buildWorld}=await import('/src/world.js');
      window.mapData=await(await fetch('/data/shenzhen.json')).json();
      document.body.innerHTML='<div id="stage" style="position:fixed;inset:0"></div>';
      window.world=await buildWorld(document.querySelector('#stage'),mapData,{
        progress(){}, report(){}, step(){}, onCamera(){}
      });
      await world.city.ready;
    }""")
    page.wait_for_load_state("networkidle")
    page.wait_for_function("window.worldFrame && world.city.root.parent.children.filter(o=>o.isGroup).length>=12",
                           timeout=60000)
    state = page.evaluate("""async placeId => {
      const place=mapData.views.find(p=>p.id===placeId);
      world.moveTo(place);
      const start=performance.now();worldFrame(start);
      world.setPlaying(true);
      for(let frame=1; frame<=90; frame++){
        worldFrame(start+frame*1000/60);
        if(frame%6===0)await new Promise(requestAnimationFrame);
      }
      world.setPlaying(false);
      const c=world.camera,gl=world.renderer.getContext();
      return {view:placeId,position:c.position.toArray(),rotation:c.rotation.toArray(),
        fov:c.fov,aspect:c.aspect,near:c.near,far:c.far,sky:world.period,seconds:1.5,
        width:gl.drawingBufferWidth,height:gl.drawingBufferHeight,
        gpu:gl.getParameter(gl.getExtension('WEBGL_debug_renderer_info').UNMASKED_RENDERER_WEBGL)};
    }""", place_id)
    if (state["width"], state["height"]) != (2560, 1440):
        raise RuntimeError(f"Unexpected drawing buffer: {state}")
    page.screenshot(path=destination, type="png", animations="disabled")
    return state


if __name__ == "__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("server")
    parser.add_argument("output", type=Path)
    parser.add_argument("version", choices=["before","after"])
    parser.add_argument("--chrome", default=os.path.join(os.environ.get("ProgramFiles",""),"Google/Chrome/Application/chrome.exe"))
    args=parser.parse_args()
    args.output.mkdir(exist_ok=True, parents=True)
    records=[]
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path=args.chrome, headless=True,
            args=["--use-angle=d3d11","--ignore-gpu-blocklist","--disable-renderer-backgrounding"])
        for view in ["bridge","street"]:
            page=browser.new_page(viewport={"width":2560,"height":1440},device_scale_factor=1)
            errors=[]
            page.route("**/favicon.ico",lambda route:route.fulfill(status=204))
            page.on("response",lambda response:errors.append(f"{response.status} {response.url}") if response.status>=400 else None)
            page.on("pageerror",lambda e:errors.append(str(e)))
            page.on("console",lambda m:errors.append(m.text) if m.type=="error" else None)
            record=photograph(page,args.server.rstrip("/"),view,args.output/f"{view}-{args.version}.png")
            print(json.dumps(record,ensure_ascii=False),flush=True)
            if errors:
                raise RuntimeError(errors)
            records.append(record)
            page.close()
        browser.close()
    (args.output/f"camera-{args.version}.json").write_text(json.dumps(records,indent=2,ensure_ascii=False),encoding="utf8")
