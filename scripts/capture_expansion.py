"""Check and photograph the free-flight, climate and Model 3 player entry points."""
import argparse
import os
from pathlib import Path
from playwright.sync_api import sync_playwright


def frames(page, count=6):
    page.evaluate("""n=>new Promise(done=>{
      function next(){if(--n<=0){done();return;}requestAnimationFrame(next);}
      requestAnimationFrame(next);
    })""",count)


def photograph(page, path):
    style=page.add_style_tag(content='#hud,#topbar,#toast{visibility:hidden!important}')
    frames(page)
    page.screenshot(path=path)
    style.evaluate('s=>s.remove()')


def enter(page, base, query):
    page.goto(base+'/?'+query,wait_until='domcontentloaded')
    page.wait_for_selector('#hud:visible',timeout=120000)
    page.wait_for_selector('#loading',state='hidden')
    page.wait_for_load_state('networkidle')
    frames(page)


def select(page, kind, value):
    panel=page.locator('#climatePanel')
    if not panel.is_visible():
        page.get_by_role('button',name='天气与四季',exact=True).click()
    button=panel.locator(f'[data-{kind}="{value}"]')
    button.click()
    page.wait_for_function("(args)=>document.querySelector(args).getAttribute('aria-pressed')==='true'",arg=f'[data-{kind}="{value}"]')
    page.locator('#closeClimate').click()


def verify(page,base,out,part):
    if part in ('all','stadium'):
        enter(page,base,'walk=stadium&camera=drone')
        assert page.locator('#drone').get_attribute('aria-pressed')=='true'
        photograph(page,out/'春茧-无人机.png')
        altitude=lambda:int(page.locator('#altitude').inner_text().split()[0])
        height=altitude()
        page.keyboard.down('e')
        page.wait_for_function('h=>parseInt(document.querySelector("#altitude").value)>h+4',arg=height)
        page.keyboard.up('e');page.keyboard.down('q')
        page.wait_for_function('h=>parseInt(document.querySelector("#altitude").value)<=h',arg=height)
        page.keyboard.up('q')
        bearing=page.locator('#bearing').inner_text()
        page.mouse.move(720,330);page.mouse.down();page.mouse.move(882,325,steps=6);page.mouse.up()
        page.wait_for_function('b=>document.querySelector("#bearing").textContent!==b',arg=bearing)
        page.keyboard.down('w');frames(page,15);page.keyboard.up('w')
        page.keyboard.press('f');assert page.locator('#flightInfo').is_hidden()
        page.locator('#aerial').click();assert page.locator('#cameraName').inner_text()=='落地步行'
        page.keyboard.press('f');assert page.locator('#flightInfo').is_visible()
        enter(page,base,'walk=field');photograph(page,out/'春茧-场内.png')
        print('Aerial, stadium field, drone lift/descend, yaw, travel, landing and orbit handoff OK',flush=True)
    if part in ('all','weather'):
        enter(page,base,'walk=bridge&weather=aurora&season=winter')
        assert page.locator('#periodName').inner_text()=='极光夜'
        photograph(page,out/'星光桥-极光夜.png')
        select(page,'weather','snow');assert not page.locator('#period').is_disabled()
        frames(page,30);photograph(page,out/'星光桥-冬雪.png')
        select(page,'weather','rain');select(page,'season','autumn')
        photograph(page,out/'星光桥-秋雨.png')
        select(page,'weather','clear')
        enter(page,base,'walk=garden')
        for season in ('spring','summer','autumn','winter'):
            select(page,'season',season)
            frames(page,12);photograph(page,out/('同机位-'+season+'.png'))
        print('Four seasons, clear/rain/snow, aurora night and restored daylight control OK',flush=True)
    if part in ('all','vehicles'):
        enter(page,base,'walk=model3');assert 'Model 3' in page.locator('#locality').inner_text()
        photograph(page,out/'Model3-登良路.png')
        page.goto(base+'/?inspect=model3')
        page.wait_for_function("document.querySelector('.model-status')?.textContent.includes('拖动')",timeout=90000)
        assert '2875' in page.locator('.model-caption').inner_text()
        page.add_style_tag(content="""
          .garage-stage{position:fixed!important;inset:0!important;width:100vw!important;height:100vh!important;z-index:10!important}
          .model-status,.model-caption,.taxi-angles{visibility:hidden!important}
          dialog{transform:none!important;position:static!important;overflow:visible!important}
        """)
        for angle in ('front','side','rear','wheel'):
            page.locator(f'[data-angle="{angle}"]').evaluate('b=>b.click()')
            frames(page);page.locator('.garage-stage canvas').screenshot(path=out/f'Model3-{angle}.png')
        print('Detailed Model 3 at curb and in gallery, four independent inspection angles OK',flush=True)


if __name__=='__main__':
    ap=argparse.ArgumentParser();ap.add_argument('url');ap.add_argument('output',type=Path)
    ap.add_argument('--part',choices=['all','vehicles','stadium','weather'],default='all')
    args=ap.parse_args();args.output.mkdir(parents=True,exist_ok=True)
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path=os.path.join(os.environ['ProgramFiles'],'Google/Chrome/Application/chrome.exe'),headless=True,
            args=['--use-angle=d3d11','--ignore-gpu-blocklist','--disable-renderer-backgrounding'])
        page=browser.new_page(viewport={'width':1600,'height':1000},device_scale_factor=1)
        errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
        page.on('response',lambda r:errors.append(f'{r.status} {r.url}') if r.status>=400 else None)
        page.route('**/favicon.ico',lambda r:r.fulfill(status=204))
        verify(page,args.url.rstrip('/'),args.output,args.part)
        if errors:raise RuntimeError(errors)
        browser.close()
