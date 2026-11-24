const STORAGE_KEY = 'baywalk.lang';

function detectInitialLang() {
  try {
    const q = new URLSearchParams(location.search).get('lang');
    if (q === 'en' || q === 'zh') return q;
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'en' || saved === 'zh') return saved;
  } catch {}
  return 'zh';
}

let currentLang = detectInitialLang();
const listeners = new Set();

export function getLang() {
  return currentLang;
}

export function isEnglish() {
  return currentLang === 'en';
}

export function setLang(lang) {
  const next = lang === 'en' ? 'en' : 'zh';
  if (next === currentLang) return;
  currentLang = next;
  try { localStorage.setItem(STORAGE_KEY, next); } catch {}
  document.documentElement.lang = next === 'en' ? 'en' : 'zh-CN';
  for (const fn of listeners) fn(next);
}

export function toggleLang() {
  setLang(currentLang === 'en' ? 'zh' : 'en');
}

export function onLangChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Initialize <html lang> immediately
if (typeof document !== 'undefined') {
  document.documentElement.lang = currentLang === 'en' ? 'en' : 'zh-CN';
}

const DICT = {
  zh: {
    pageTitle: '深圳漫游 · BAYWALK',
    pageDesc: '在深圳人才公园与后海街区之间自由漫步，探索深圳湾的道路、车辆与城市天际线。',
    coverAria: '深圳人才公园星光桥与后海天际线夜景灯光秀实机画面',
    eyebrowLeft: '开放世界',
    eyebrowRight: '城市探索',
    headline: '深圳漫游',
    subtitleMain: 'SHENZHEN',
    subtitleAccent: 'FREE ROAM',
    lead: '从人才公园出发，沿着深圳湾的街道自由漫步。',
    startRoam: '开始漫游',
    resumeRoam: '继续漫游',
    fieldMap: '区域地图',
    flyStadium: '航拍春茧',
    autoTourEntry: '自动航拍巡航',
    compareEntry: '查看实机画面对比',
    factStart: '起始地点',
    factRadius: '探索半径',
    factRadiusUnit: '公里',
    factScale: '地理比例',
    brandAria: '漫游首页',
    brandSub: '城市漫游计划',
    navAria: '工具栏',
    vehicles: '车辆图鉴',
    langSwitchLabel: 'Switch to English',
    langSwitchText: 'EN',
    soundOnTitle: '开启环境音',
    soundOffTitle: '关闭环境音',
    helpTitle: '操作指南',
    fullscreenTitle: '全屏',
    exitFullscreenTitle: '退出全屏',
    compassAria: '朝向',
    miniMapAria: '打开区域地图',
    periodAria: '切换日照',
    climateAria: '天气与四季',
    headlightsAria: '切换汽车车灯',
    headlightsTitle: '汽车车灯 (L)',
    headlightsShortOn: '车灯开',
    headlightsShortOff: '车灯',
    headlightsOn: '车灯：开',
    headlightsOff: '车灯：关',
    toastHeadlightsOn: '汽车车灯已开启',
    toastHeadlightsOff: '汽车车灯已关闭',
    switchingSky: (name) => name ? `正在切换${name}…` : '正在切换场景光线…',
    droneTitle: '自由无人机 (F)',
    droneEnter: '无人机',
    droneExit: '退出飞行',
    tourTitle: '自动无人机巡航 (G)',
    tourEnter: '自动巡航',
    tourExit: '退出巡航',
    tourBadge: '自动巡航',
    tourPause: '暂停',
    tourResume: '继续',
    tourTakeover: '接管飞行',
    tourClean: '纯净画面',
    tourShowHud: '显示界面 (H)',
    tourToastStart: (name) => `已开启自动巡航：${name}`,
    tourToastStop: '已退出自动无人机巡航',
    hintTour: '空格 暂停/继续 · F 接管自由飞行 · H 隐藏/显示界面 · G 退出巡航',
    aerialEnter: '鸟瞰',
    walkLand: '落地步行',
    menu: '菜单',
    climateHead: '天气与四季',
    closeClimateAria: '关闭天气设置',
    periodPanelHead: '日照与时段',
    closePeriodAria: '关闭日照设置',
    periodLegend: '时段',
    nightSkyLegend: '夜空',
    moonShown: '月亮：显示',
    moonHidden: '月亮：隐藏',
    toastMoonOn: '已显示月亮',
    toastMoonOff: '已隐藏月亮',
    weatherLegend: '天气',
    seasonLegend: '季节',
    weatherClear: '晴朗',
    weatherRain: '阵雨',
    weatherSnow: '降雪',
    weatherAurora: '极光夜',
    seasonSpring: '春',
    seasonSummer: '夏',
    seasonAutumn: '秋',
    seasonWinter: '冬',
    climateShortClear: '晴',
    climateShortRain: '雨',
    climateShortSnow: '雪',
    climateShortAurora: '极光',
    flightBadge: '自由飞行',
    liftUp: '升',
    liftDown: '降',
    liftUpAria: '无人机上升',
    liftDownAria: '无人机下降',
    lockMouse: '单击锁定鼠标',
    lockPending: '正在锁定鼠标…',
    lockDeniedBtn: '重试锁定鼠标',
    lockUnsupported: '此窗口不支持鼠标锁定。可复制下方地址到独立浏览器。',
    lockDeniedMsg: '此窗口未允许鼠标锁定。可重试，或复制下方地址到独立浏览器。',
    openEdge: '在 Edge 中打开此场景',
    sceneAddressAria: '可复制的场景地址',
    hintDroneDesktop: 'WASD 飞行 · 空格 / E 上升 · Q / C 下降 · Shift 加速 · Esc 释放鼠标',
    hintDroneTouch: '左侧摇杆飞行 · 升降键调高度 · 拖动环顾',
    hintAerial: '拖动环绕 · 缩放查看全景',
    hintWalkDesktop: 'WASD 移动 · 锁定后移动鼠标环顾 · Esc 释放鼠标',
    hintWalkTouch: '左侧摇杆移动 · 拖动屏幕环顾',
    talentReaderSummary: '人物文献导览',
    touchpadAria: '移动摇杆',
    loadingHeading: '正在进入深圳湾',
    loadingDefault: '读取地理数据…',
    loadingMap: '读取人才公园与后海地理数据…',
    loadingWebGL: '初始化 WebGL 渲染器…',
    loadingCity: '构建建筑、步道与湖岸…',
    loadingVehicles: '装载深圳出租车与城市车流…',
    loadingProbes: '采集玻璃与车漆的街区反射…',
    loadingWater: '准备湖面倒影与街景…',
    loadingReady: '进入漫游',
    loadingFail: '场景载入失败。请使用开启硬件加速的 Chrome 或 Edge，或刷新后重试。',
    backHome: '返回首页',
    closeAria: '关闭',
    mouseSensitivity: '鼠标灵敏度',
    resetDefault: '恢复默认',
    panelReading: '正在读取…',
    panelLoadFail: '资源载入失败，请关闭后重试。车辆图鉴需要浏览器支持 WebGL 2。',
    panelMapTitle: '区域地图',
    panelGarageTitle: '车辆图鉴',
    panelTalentTitle: '星光桥人物',
    panelHelpTitle: '操作指南',
    panelPauseTitle: '漫游菜单',
    toastSoundOn: '环境音已开启',
    toastSoundOff: '环境音已关闭',
    toastSoundErr: '浏览器未能播放音频',
    toastFullscreenErr: '当前窗口不支持全屏',
    toastSkyErr: '天空资源读取失败，请重试',
    toastWeatherErr: '天气资源读取失败，请重试',
    toastMapErr: '地图读取失败，请点击开始漫游重试。',
    toastCtrlHint: '无人机请用 Q 或 C 下降（按 Ctrl+W 会触发浏览器关闭标签页）',
    toastContextLost: '图形渲染上下文中断，正在尝试自动恢复…',
    toastContextRestored: '图形渲染已恢复',
    errMapFetch: '地图数据读取失败',
    errNoWalkable: '附近没有可步行的落点，请选择另一条街道。',
    canvasAria: '深圳湾实时三维漫游，WASD 移动，移动鼠标环顾，Esc 释放鼠标',
    localitySports: '深圳湾体育中心',
    localityTalentPark: '人才公园',
    localityHouhai: '南山后海',
    atlasCanvasAria: '深圳湾区域地图',
    atlasZoomIn: '放大',
    atlasZoomOut: '缩小',
    atlasDestinations: '漫游地点',
    atlasHint: '拖动平移，滚轮缩放。点击地图可选择其他街道。',
    atlasStartHere: '从这里出发',
    atlasCustomStreet: '自选街道',
    garageLoading: '载入模型…',
    garageTitle: '城市车辆 · 6 款',
    garageDragHint: '拖动旋转 · 滚轮缩放',
    garageLoadFail: '模型载入失败，点击车型重试',
    garageModel3Extra: '　轴距 2875 mm · 深圳新能源绿牌',
    garageAnglePhoto: '照片角度',
    garageAngleFront: '前 3/4',
    garageAngleSide: '正侧面',
    garageAngleRear34: '后 3/4',
    garageAngleRear: '车尾',
    garageAngleTail: '车尾特写',
    garageAngleWheel: '轮毂',
    garageSourcePrefix: '查看官网',
    garageSourceSuffix: '原图 ↗',
    helpHtml:
      '<div class="panel-pad">' +
      '<div class="help-row"><span><kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> / 方向键</span><span>步行移动</span></div>' +
      '<div class="help-row"><span><kbd>Shift</kbd> + 移动</span><span>快步</span></div>' +
      '<div class="help-row"><span>移动鼠标 / 拖动触屏</span><span>环顾四周</span></div>' +
      '<div class="help-row"><span>单击街景 / <kbd>Esc</kbd></span><span>锁定 / 释放鼠标</span></div>' +
      '<div class="help-row"><span><kbd>M</kbd> / <kbd>V</kbd></span><span>区域地图 / 鸟瞰</span></div>' +
      '<div class="help-row"><span>鸟瞰时拖动 / 滚轮</span><span>环绕 / 缩放</span></div>' +
      '<div class="help-row"><span>鸟瞰时右键拖动</span><span>平移落地点</span></div>' +
      '<div class="help-row"><span><kbd>F</kbd></span><span>起飞 / 退出自由无人机</span></div>' +
      '<div class="help-row"><span><kbd>G</kbd></span><span>开启 / 退出自动无人机巡航</span></div>' +
      '<div class="help-row"><span><kbd>H</kbd></span><span>纯净画面（隐藏 / 显示界面）</span></div>' +
      '<div class="help-row"><span><kbd>空格</kbd> <kbd>E</kbd> / <kbd>Q</kbd> <kbd>C</kbd></span><span>无人机升降（避免误触 Ctrl+W），按住 Shift 加速</span></div>' +
      '<div class="help-row"><span>季节与天气按钮</span><span>选择四季、雨雪和极光夜</span></div>' +
      '<div class="help-row"><span><kbd>L</kbd> / 车灯按钮</span><span>开启 / 关闭汽车车灯</span></div>' +
      '<p class="note">手机使用左侧摇杆移动，飞行时右侧可调节高度。通过区域地图可以前往其他街区。日照按钮可切换午后、日落、蓝调和夜晚。</p>' +
      '<div class="credits">地理数据 © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap 贡献者</a>。卫星影像来自 Copernicus Sentinel。建筑高度部分按楼层及用途估算，车辆为按公开尺寸重建的外观模型。启动画面为实机渲染截图。<br><a href="/credits.html" target="_blank" rel="noopener">查看数据与素材来源</a></div>' +
      '</div>',
    talentSearchLabel: '查找人物或柱号',
    talentSearchPlaceholder: '方滨兴、A-29…',
    talentScopeAria: '名录范围',
    talentScopeAll: '全部人物',
    talentScopeDocs: (n) => `文献补录 · ${n} 位`,
    talentSurveyNote: (deck, shore) => `2026 年 11 月 22 日实拍。桥面 ${deck} 根，南岸步道 ${shore} 根。序号按拍摄顺序排列，同排先右后左。A 编号来自 2021 年旧名录。`,
    talentRef2021: '2021 年桥头名录',
    talentRefDeck: '2024 年桥面',
    talentRefSide: '2024 年桥侧',
    talentDiagramDeck: '桥面柱位图',
    talentDiagramShore: '南岸步道柱位图',
    talentDiagramNote: '从上往下沿拍摄方向行进，图右对应行进方向右手边。点击序号查看实拍。',
    talentHistorical: '历史名录',
    talentOldCode: (c) => `旧编号 ${c}`,
    talentUnlocated: '本次实拍未定位',
    talentExcerptPrefix: '当日柱面摘录　',
    talentTranscriptPrefix: '早期影像读文　',
    talentAliasPrefix: '蓝牌写作　',
    talentBtnVisit: '前往铭牌',
    talentBtnReverse: '查看另一面',
    talentBtnPortrait: '近看肖像',
    talentBtnInscription: '近看铭文',
    talentBtnZoomPhoto: '放大实拍铭牌',
    talentBtnRead: '边看边读',
    talentBtnOrigPhoto: '现场原照',
    talentNoMatch: '没有找到匹配的人物或柱号。',
    talentPlaqueSuffix: ' · 柱面说明',
    talentVideoRef: '桥头名录原片',
    talentCompareRef: '实拍与游戏近照',
    talentWangJianNote: '历史参考肖像取自 2010 年深圳华大总部合影。',
    talentWangJianRef: '2010 年合影与署名',
    evSitePartial: '实柱肖像仅核到局部',
    evOrigPhoto: '有现场原照',
    evSiteStudy: '肖像据实柱重绘',
    evPublicPortrait: '肖像据公开人物照重绘',
    evInscVerified: '实柱铭文可核，肖像待核',
    evPartialInsc: '已核到部分刻字',
    evPending: '柱面肖像与铭文待核',
  },
  en: {
    pageTitle: 'Shenzhen Baywalk · Free Roam',
    pageDesc: 'Walk or fly freely across Shenzhen Talent Park and Houhai, exploring waterfront promenades, streets, vehicles, and the Shenzhen Bay skyline.',
    coverAria: 'In-engine night skyline screenshot of Starlight Bridge and Houhai towers across Shenzhen Talent Lake',
    eyebrowLeft: 'OPEN WORLD',
    eyebrowRight: 'URBAN EXPLORATION',
    headline: 'SHENZHEN',
    subtitleMain: 'BAYWALK',
    subtitleAccent: 'FREE ROAM',
    lead: 'Start at Shenzhen Talent Park and roam freely along the waterfront and streets of Shenzhen Bay.',
    startRoam: 'Start Roaming',
    resumeRoam: 'Resume Roaming',
    fieldMap: 'Field Map',
    flyStadium: 'Fly over Spring Cocoon',
    autoTourEntry: 'Auto Drone Tour',
    compareEntry: 'Real-world comparison',
    factStart: 'START POINT',
    factRadius: 'RADIUS',
    factRadiusUnit: 'km',
    factScale: 'SCALE',
    brandAria: 'Home',
    brandSub: 'CITY FREE ROAM',
    navAria: 'Toolbar',
    vehicles: 'Vehicles',
    langSwitchLabel: '切换到中文',
    langSwitchText: '中文',
    soundOnTitle: 'Enable ambience',
    soundOffTitle: 'Mute ambience',
    helpTitle: 'Field Guide',
    fullscreenTitle: 'Fullscreen',
    exitFullscreenTitle: 'Exit fullscreen',
    compassAria: 'Heading',
    miniMapAria: 'Open field map',
    periodAria: 'Switch time of day',
    climateAria: 'Weather & Seasons',
    headlightsAria: 'Toggle vehicle headlights',
    headlightsTitle: 'Headlights (L)',
    headlightsShortOn: 'Lights On',
    headlightsShortOff: 'Lights',
    headlightsOn: 'Headlights: ON',
    headlightsOff: 'Headlights: OFF',
    toastHeadlightsOn: 'Vehicle headlights turned on',
    toastHeadlightsOff: 'Vehicle headlights turned off',
    switchingSky: (name) => name ? `Switching to ${name}…` : 'Updating sky & lighting…',
    droneTitle: 'Free Drone (F)',
    droneEnter: 'Drone',
    droneExit: 'Land Drone',
    tourTitle: 'Auto Drone Tour (G)',
    tourEnter: 'Auto Tour',
    tourExit: 'Stop Tour',
    tourBadge: 'AUTO TOUR',
    tourPause: 'Pause',
    tourResume: 'Resume',
    tourTakeover: 'Take Over',
    tourClean: 'Hide HUD',
    tourShowHud: 'Show HUD (H)',
    tourToastStart: (name) => `Auto drone tour started: ${name}`,
    tourToastStop: 'Auto drone tour stopped',
    hintTour: 'Space Pause/Resume · F Take Over Drone · H Toggle Clean View · G Stop Tour',
    aerialEnter: 'Aerial',
    walkLand: 'Walk',
    menu: 'Menu',
    climateHead: 'Weather & Seasons',
    closeClimateAria: 'Close weather panel',
    periodPanelHead: 'Time of Day',
    closePeriodAria: 'Close time of day panel',
    periodLegend: 'Period',
    nightSkyLegend: 'Night Sky',
    moonShown: 'Moon: Visible',
    moonHidden: 'Moon: Hidden',
    toastMoonOn: 'Moon visible',
    toastMoonOff: 'Moon hidden',
    weatherLegend: 'Weather',
    seasonLegend: 'Season',
    weatherClear: 'Clear',
    weatherRain: 'Rain',
    weatherSnow: 'Snow',
    weatherAurora: 'Aurora',
    seasonSpring: 'Spring',
    seasonSummer: 'Summer',
    seasonAutumn: 'Autumn',
    seasonWinter: 'Winter',
    climateShortClear: 'Clear',
    climateShortRain: 'Rain',
    climateShortSnow: 'Snow',
    climateShortAurora: 'Aurora',
    flightBadge: 'FREE FLIGHT',
    liftUp: 'UP',
    liftDown: 'DN',
    liftUpAria: 'Ascend drone',
    liftDownAria: 'Descend drone',
    lockMouse: 'Click to lock mouse',
    lockPending: 'Locking mouse…',
    lockDeniedBtn: 'Retry mouse lock',
    lockUnsupported: 'Pointer lock is unavailable here. Copy the URL below into a standalone browser.',
    lockDeniedMsg: 'Pointer lock was declined. Retry, or copy the URL below into a standalone browser.',
    openEdge: 'Open in Microsoft Edge',
    sceneAddressAria: 'Copyable scene URL',
    hintDroneDesktop: 'WASD Fly · Space / E Up · Q / C Down · Shift Boost · Esc Release Mouse',
    hintDroneTouch: 'Left stick to fly · Up/Down for altitude · Drag to look',
    hintAerial: 'Drag to orbit · Scroll to zoom',
    hintWalkDesktop: 'WASD Move · Move mouse to look · Esc Release Mouse',
    hintWalkTouch: 'Left stick to move · Drag screen to look',
    talentReaderSummary: 'Plaque Guide',
    touchpadAria: 'Movement joystick',
    loadingHeading: 'Entering Shenzhen Bay',
    loadingDefault: 'Loading map data…',
    loadingMap: 'Loading Talent Park & Houhai map data…',
    loadingWebGL: 'Initializing WebGL renderer…',
    loadingCity: 'Building architecture, walkways & lake shores…',
    loadingVehicles: 'Loading Shenzhen taxis & street traffic…',
    loadingProbes: 'Capturing glass & car reflections…',
    loadingWater: 'Preparing lake reflections & streetscapes…',
    loadingReady: 'Entering free roam',
    loadingFail: 'Failed to load the scene. Use Chrome or Edge with hardware acceleration, or refresh to retry.',
    backHome: 'Back to Home',
    closeAria: 'Close',
    mouseSensitivity: 'Mouse Sensitivity',
    resetDefault: 'Reset',
    panelReading: 'Loading…',
    panelLoadFail: 'Failed to load resource. Close and retry. Vehicle Collection requires WebGL 2.',
    panelMapTitle: 'Field Map',
    panelGarageTitle: 'Vehicle Collection',
    panelTalentTitle: 'Starlight Bridge',
    panelHelpTitle: 'Field Guide',
    panelPauseTitle: 'Free Roam Menu',
    toastSoundOn: 'Ambience enabled',
    toastSoundOff: 'Ambience muted',
    toastSoundErr: 'Browser blocked audio playback',
    toastFullscreenErr: 'Fullscreen is not supported in this window',
    toastSkyErr: 'Failed to load sky assets. Please retry.',
    toastWeatherErr: 'Failed to load weather assets. Please retry.',
    toastMapErr: 'Failed to load map data. Click Start Roaming to retry.',
    toastCtrlHint: 'Use Q or C to descend (Ctrl+W closes the browser tab)',
    toastContextLost: 'WebGL context lost, attempting to recover…',
    toastContextRestored: 'Graphics rendering restored',
    errMapFetch: 'Failed to fetch map data',
    errNoWalkable: 'No walkable spot nearby. Please pick another street.',
    canvasAria: 'Shenzhen Bay real-time 3D free roam. WASD to move, move mouse to look, Esc to release mouse.',
    localitySports: 'Shenzhen Bay Sports Center',
    localityTalentPark: 'Shenzhen Talent Park',
    localityHouhai: 'Houhai, Nanshan',
    atlasCanvasAria: 'Shenzhen Bay area map',
    atlasZoomIn: 'Zoom in',
    atlasZoomOut: 'Zoom out',
    atlasDestinations: 'Destinations',
    atlasHint: 'Drag to pan, scroll to zoom. Click the map to pick any street.',
    atlasStartHere: 'Start Here',
    atlasCustomStreet: 'Selected Street',
    garageLoading: 'Loading model…',
    garageTitle: 'City Vehicles · 6 Models',
    garageDragHint: 'Drag to orbit · Scroll to zoom',
    garageLoadFail: 'Failed to load model. Click a vehicle to retry.',
    garageModel3Extra: '  Wheelbase 2875 mm · Shenzhen EV Plate',
    garageAnglePhoto: 'Photo Angle',
    garageAngleFront: 'Front 3/4',
    garageAngleSide: 'Side',
    garageAngleRear34: 'Rear 3/4',
    garageAngleRear: 'Rear',
    garageAngleTail: 'Tail Detail',
    garageAngleWheel: 'Wheel',
    garageSourcePrefix: 'Official ',
    garageSourceSuffix: ' studio view ↗',
    helpHtml:
      '<div class="panel-pad">' +
      '<div class="help-row"><span><kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> / Arrows</span><span>Walk</span></div>' +
      '<div class="help-row"><span><kbd>Shift</kbd> + Move</span><span>Brisk Walk</span></div>' +
      '<div class="help-row"><span>Move Mouse / Drag Touch</span><span>Look Around</span></div>' +
      '<div class="help-row"><span>Click Scene / <kbd>Esc</kbd></span><span>Lock / Release Mouse</span></div>' +
      '<div class="help-row"><span><kbd>M</kbd> / <kbd>V</kbd></span><span>Field Map / Aerial View</span></div>' +
      '<div class="help-row"><span>Aerial Drag / Wheel</span><span>Orbit / Zoom</span></div>' +
      '<div class="help-row"><span>Aerial Right-Drag</span><span>Pan Landing Point</span></div>' +
      '<div class="help-row"><span><kbd>F</kbd></span><span>Toggle Free Drone</span></div>' +
      '<div class="help-row"><span><kbd>G</kbd></span><span>Toggle Auto Drone Tour</span></div>' +
      '<div class="help-row"><span><kbd>H</kbd></span><span>Toggle Clean View (Hide / Show HUD)</span></div>' +
      '<div class="help-row"><span><kbd>Space</kbd> <kbd>E</kbd> / <kbd>Q</kbd> <kbd>C</kbd></span><span>Drone Up / Down (Shift to boost)</span></div>' +
      '<div class="help-row"><span>Weather &amp; Seasons</span><span>Switch seasons, rain, snow &amp; aurora</span></div>' +
      '<div class="help-row"><span><kbd>L</kbd> / Lights</span><span>Toggle vehicle headlights</span></div>' +
      '<p class="note">On mobile, use the left joystick to move and the right buttons for drone altitude. Use the Field Map to jump to other districts, and the Sun button to cycle Afternoon, Sunset, Blue Hour, and Night.</p>' +
      '<div class="credits">Map data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>. Satellite imagery from Copernicus Sentinel. Building heights are partly estimated from floor counts; vehicles are exterior reconstructions from public dimensions. Cover image is an in-engine screenshot.<br><a href="/credits.html" target="_blank" rel="noopener">Data &amp; asset credits</a></div>' +
      '</div>',
    talentSearchLabel: 'Search figure or column ID',
    talentSearchPlaceholder: 'Fang Binxing, A-29…',
    talentScopeAria: 'Directory filter',
    talentScopeAll: 'All Figures',
    talentScopeDocs: (n) => `Documented · ${n}`,
    talentSurveyNote: (deck, shore) => `Field survey on Nov 22, 2026: ${deck} columns on the bridge deck, ${shore} along the south promenade. Ordered along the survey walk (right before left). A-codes come from the 2021 directory.`,
    talentRef2021: '2021 Bridge Directory',
    talentRefDeck: '2024 Bridge Deck',
    talentRefSide: '2024 Bridge Side',
    talentDiagramDeck: 'Bridge Deck Column Map',
    talentDiagramShore: 'South Promenade Column Map',
    talentDiagramNote: 'Top to bottom follows the survey walk; right side matches your right hand. Click a number to inspect.',
    talentHistorical: 'Archive',
    talentOldCode: (c) => `Legacy ID ${c}`,
    talentUnlocated: 'Not located in latest survey',
    talentExcerptPrefix: 'Plaque excerpt: ',
    talentTranscriptPrefix: 'Earlier photo transcript: ',
    talentAliasPrefix: 'Blue board spelling: ',
    talentBtnVisit: 'Visit Plaque',
    talentBtnReverse: 'Reverse Side',
    talentBtnPortrait: 'Portrait',
    talentBtnInscription: 'Inscription',
    talentBtnZoomPhoto: 'Original Photo',
    talentBtnRead: 'Read & View',
    talentBtnOrigPhoto: 'Field Photo',
    talentNoMatch: 'No matching figure or column ID found.',
    talentPlaqueSuffix: ' · Column Plaque',
    talentVideoRef: '2021 Directory Video',
    talentCompareRef: 'Real vs. In-Game Closeup',
    talentWangJianNote: 'Historical portrait reference from a 2010 group photo at BGI Shenzhen HQ.',
    talentWangJianRef: '2010 Group Photo & Credit',
    evSitePartial: 'Partial on-site portrait verified',
    evOrigPhoto: 'On-site photo verified',
    evSiteStudy: 'Portrait redrawn from column',
    evPublicPortrait: 'Portrait redrawn from public photo',
    evInscVerified: 'Inscription verified, portrait pending',
    evPartialInsc: 'Partial inscription verified',
    evPending: 'Portrait & inscription pending',
  },
};

export function t(key, ...args) {
  const val = DICT[currentLang]?.[key] ?? DICT.zh[key] ?? key;
  return typeof val === 'function' ? val(...args) : val;
}

const PERIOD_EN = {
  日落: 'Sunset',
  午后: 'Afternoon',
  湖岸阴天: 'Overcast',
  蓝调: 'Blue Hour',
  夜晚: 'Night',
  极光夜: 'Aurora',
};

export function periodLabel(zhName) {
  if (currentLang !== 'en') return zhName;
  return PERIOD_EN[zhName] || zhName;
}

const VIEW_EN = {
  bridge: 'Starlight Bridge',
  street: 'Dengliang Rd',
  stadium: 'Shenzhen Bay Sports Center',
  pi: 'Pi Bridge (π Bridge)',
  coastalCity: 'Coastal City',
  seaBreeze: 'Sea Breeze Sports Plaza',
  field: 'Spring Cocoon · Arena',
  tidal: 'Tidal Square · Lakefront',
  signals: 'Keyuan S. & Dengliang Junction',
  monuments: 'Talent Merit Wall · Pioneers',
  flowerbed: 'Talent Lake · Floral Emblem',
  'flowerbed-lake': 'Talent Lake · Waterfront Lawn',
  volcengine: 'Jinghu Tower · Volcengine',
  'star-south': 'Starlight Bridge · South Walk',
  garden: 'Talent Park · Woodland Path',
  'palm-grove': 'Talent Park · Palm Grove',
  'sw-blossoms': 'Talent Park · Silk Floss Walk',
  'north-ramp': 'Talent Park · North Switchback Ramp',
  model3: 'Dengliang Rd · Model 3',
  tencent: 'Tencent Binhai Mansion',
  'tencent-entry': 'Tencent Binhai · West Plaza',
  'haitian-road': 'Tencent Binhai · Haitian 2nd Rd',
  'houhai-bridge': 'Shahe W. Rd · Houhai Bridge',
  'wenxin-road': 'Coastal City · Wenxin 4th Rd',
  'coast-walk': 'Coastal City · Skywalk',
  'bay-pier': 'Shenzhen Bay · North Pier',
  curve: 'Shuangqu Bridge',
  'bridge-entry': 'Starlight Bridge · South Approach',
  skyline: 'Talent Lake · Skyline Light Show',
  loop: 'Future Wisdom Skybridge',
  onebay: 'One Shenzhen Bay · Aerial',
  t7: 'One Shenzhen Bay · Tower 7',
  pavilion: 'Qiuxian Pavilion',
  hall: 'Qunying Hall',
  sail: 'Sail Tower',
};

export function placeLabel(view) {
  if (!view) return '';
  if (currentLang !== 'en') return view.name;
  if (view.id === 'talent' && view.personEnglish) {
    return (view.onDeck ? 'Starlight Bridge · ' : 'Starlight South · ') + view.personEnglish;
  }
  if (view.id === 'custom') return view.name === '自选街道' ? t('atlasCustomStreet') : view.name;
  return VIEW_EN[view.id] || view.name;
}

const VEHICLE_EN = {
  e6: { name: 'BYD e6 · Pengcheng Shenzhen Taxi', type: 'Taxi' },
  model3: { name: 'Tesla Model 3 · Highland', type: 'Sedan' },
  tang: { name: 'Urban SUV', type: 'SUV' },
  mifa9: { name: 'Executive MPV', type: 'MPV' },
  civic: { name: 'Compact Sedan', type: 'Sedan' },
  mini: { name: 'Compact Hatchback', type: 'Hatchback' },
};

const VEHICLE_TYPE_ZH = ['出租车', '轿车', 'SUV', 'MPV', '轿车', '两厢车'];

export function vehicleName(v) {
  if (currentLang === 'en' && VEHICLE_EN[v.id]) return VEHICLE_EN[v.id].name;
  return v.name;
}

export function vehicleType(v, index) {
  if (currentLang === 'en' && VEHICLE_EN[v.id]) return VEHICLE_EN[v.id].type;
  return VEHICLE_TYPE_ZH[index] || '';
}
