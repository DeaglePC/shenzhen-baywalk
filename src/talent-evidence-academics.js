const visitorPhoto = {
  sourceUrl: 'https://m.ctrip.com/webapp/you/comment/detail/4977342/11/169862226.html',
  sourceTitle: '紅氿 · 深圳人才公园夜间胡海与孟建民两柱同框，2022年3月',
  physicalImage: 'https://dimg04.c-ctrip.com/images/0104d120009d87gil7355.jpg',
  sourceSize: [1080, 1920],
  portraitKind: 'site-study',
};

// Crop coordinates refer to pixels [left, top, right, bottom] of the linked original.
// Transcribed fragments are separate from complete inscription lines.
function fromWalk(id,t,fields){
  return {portrait:'/talent/research-academics/'+id+'-visible.png',portraitKind:'site-study-partial',
    sourceUrl:'https://www.youtube.com/watch?v=YaOHuAAV-lQ&t='+Math.floor(t)+'s',sourceTitle:'Time Walker · 2021 年 4K 走桥实拍',
    ...fields};
}
export const academicEvidence = {
  'chen-guoliang':fromWalk('chen-guoliang',1211.3,{
    inscriptionFragments:[{line:1,text:'陈国',rightMissing:true},{line:2,text:'Chen Guo',rightMissing:true},{line:3,text:'中国科学',rightMissing:true},{line:4,text:'深圳大学计算机',rightMissing:true}],
    evidenceNote:'20:11 的实柱可见侧分发、鼻梁及托着下巴的手。姓名和机构的末端绕到柱背。'}),
  'deng-xingwang':fromWalk('deng-xingwang',1223.2,{
    inscriptionFragments:[{line:1,text:'邓兴',rightMissing:true},{line:2,text:'Deng Xing',rightMissing:true},{line:3,text:'美国',rightMissing:true},{line:4,text:'深圳作物分子设计',rightMissing:true}],
    evidenceNote:'20:23 可见一侧眉眼、面颊、西服及领带，刻字右端绕过柱面。'}),
  'fan-dianyuan':fromWalk('fan-dianyuan',1223.9,{
    inscriptionFragments:[{line:1,text:'范滇',rightMissing:true}],
    evidenceNote:'20:23.9 摄影者走过 A-13 后，后方刻像露出侧分发、下颌与敞领。同蓝牌 A-14 交叉核对姓名。'}),
  'chen-shiyi':fromWalk('chen-shiyi',1236.4,{
    corroboration:[{sourceTitle:'Time Walker · 第二次走过 A-17',sourceUrl:'https://www.youtube.com/watch?v=YaOHuAAV-lQ&t=2956s'}],
    inscription:['陈十一','Chen Shi Yi','中国科学院院士','南方科技大学讲席教授'],
    evidenceNote:'20:36 可读四行铭文及衣领，49:16.5 的第二次经过另见发际、左耳与一侧眉眼。远侧脸部仍待正面资料。'}),
  'hu-hai': {
    ...visitorPhoto,
    name: '胡海', english: 'Hu Hai',
    role: '半导体激光芯片研发人员，深圳瑞波光电子有限公司总经理',
    identityUrl: 'https://www.gdlaser.org.cn/index/news/details/id/2222.html',
    portrait: '/talent/research-academics/hu-hai.png',
    inscription: ['胡海', 'Hu Hai'],
    inscriptionFragments: [{ line: 3, text: '院高端半导体激光研究中心', leftMissing: true, rightMissing: true }],
    photoCrop: [5, 0, 600, 1510],
  },
  'meng-jianmin': {
    ...visitorPhoto,
    name: '孟建民', english: 'Meng Jianmin',
    role: '中国工程院院士，建筑师',
    portrait: '/talent/research-academics/meng-jianmin.png',
    inscription: ['孟建民', 'Meng Jianmin'],
    photoCrop: [729, 760, 834, 1000],
    evidenceNote: '同一张照片右后的柱面，姓名亦见2021年蓝色名牌A-27。英文据对应拼写及原照词形交叉辨认。',
  },
  'esteban-busso': {
    name: '埃斯特班·布索', english: 'Esteban Pedro Busso',
    sourceUrl: 'https://www.meipian.cn/5g8pbtxq',
    sourceTitle: '孙文喜 · 深圳市人才公园，湿木栈道西装人物侧拍',
    physicalImage: 'https://ss-mpvolc.meipian.me/users/23652391/origin6d5814c5e56bcde5cd7291bb7f9e31e2mpand__jpg.heic',
    identityUrl: 'https://homepage.hit.edu.cn/estebanpedrobusso',
    sourceSize: [2000, 2668],
    portrait: '/talent/research-academics/esteban-busso-visible.png',
    portraitKind: 'site-study-partial',
    photoCrop: [45, 420, 590, 1440],
    inscriptionFragments: [
      { line: 1, text: 'Esteban Pe', rightMissing: true },
      { line: 2, text: '英国皇家', rightMissing: true },
      { line: 3, text: '哈尔滨工业', rightMissing: true },
    ],
    evidenceNote: '圆柱右缘绕至背面。重绘保留可见一侧的眉眼、髭须、领带和一侧肩线，其余透明。',
  },
};
