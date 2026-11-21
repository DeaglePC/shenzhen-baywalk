"""Photograph the normal daylight taxi entry and the garage side/rear controls.

    python scripts/capture_taxi.py http://127.0.0.1:5192 output

Works with either the built release or Vite. Only the HUD is hidden in the
street photograph; geometry, the vehicle, lights and renderer belong to the game.
"""
import argparse
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

def capture(base,output):
    output.mkdir(exist_ok=True,parents=True)
    errors=[]
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,executable_path=os.path.join(os.environ['ProgramFiles'],'Google/Chrome/Application/chrome.exe'),
            args=['--use-angle=d3d11','--ignore-gpu-blocklist','--disable-renderer-backgrounding'])
        page=browser.new_page(viewport={'width':1600,'height':1200},device_scale_factor=1)
        page.on('pageerror',lambda exc:errors.append(str(exc)))
        page.on('console',lambda msg:errors.append(msg.text) if msg.type=='error' else None)
        page.on('response',lambda resp:errors.append(f'{resp.status} {resp.url}') if resp.status>=400 else None)
        page.route('**/favicon.ico',lambda r:r.fulfill(status=204))
        page.add_init_script("""{
          const realFrame=requestAnimationFrame.bind(window);
          window.requestAnimationFrame=fn=>{
            // The world loop suspends when the document is hidden. Production
            // builds shorten its function name, but retain this visibility check.
            if (fn===window.photoFrame || (fn.length===1 && fn.toString().includes('document.hidden') && fn.toString().includes('requestAnimationFrame('))) {
              window.photoFrame=fn;return 0;
            }
            return realFrame(fn);
          };
        }""")
        page.goto(base+'/?walk=street&photo=1')
        page.wait_for_function("window.photoFrame && document.body.dataset.mode==='world' && document.querySelector('#loading').hidden",timeout=120000)
        assert page.locator('#periodName').inner_text()=='午后'
        page.wait_for_load_state('networkidle')
        page.add_style_tag(content='#hud,#topbar,#toast{visibility:hidden!important}')
        page.evaluate("""async()=>{let now=performance.now();for(let i=1;i<=90;i++){
          photoFrame(now+i*1000/60);if(i%5===0)await new Promise(requestAnimationFrame);}
          document.querySelector('#world canvas').getContext('webgl2').finish();}""")
        page.screenshot(path=output/'照片机位-登良路.png')
        page.goto(base+'/')
        page.locator('[data-action=garage]').click()
        page.wait_for_function("document.querySelector('.model-status')?.textContent.includes('拖动')",timeout=60000)
        page.add_style_tag(content="""
          .garage-stage{position:fixed!important;inset:0!important;width:100vw!important;height:100vh!important;z-index:10!important}
          .model-status,.model-caption,.taxi-angles{visibility:hidden!important}
          dialog{transform:none!important;position:static!important;overflow:visible!important}
        """)
        for view,label in [('photo','左前'),('side','正侧'),('rear','左后')]:
            page.locator(f'[data-angle={view}]').evaluate('b=>b.click()')
            page.evaluate("async()=>{for(let i=0;i<5;i++)await new Promise(requestAnimationFrame);document.querySelector('.garage-stage canvas').getContext('webgl2').finish();}")
            page.locator('.garage-stage canvas').screenshot(path=output/f'车辆图鉴-{label}.png')
        browser.close()
    if errors:raise RuntimeError(errors)

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('url');parser.add_argument('output',type=Path)
    args=parser.parse_args();capture(args.url.rstrip('/'),args.output)
