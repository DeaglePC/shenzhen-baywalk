/** On-site observations and published membership evidence for the Shenzhen Talent Park Starlight Bridge. */
import {bridgeSurvey} from './talent-survey.js';
import {academicEvidence} from './talent-evidence-academics.js';
import {publicEvidence,publicMembers} from './talent-evidence-public.js';
import {literature} from './talent-literature.js';

export const talentSources = {
  puiUniversity: {title:'香港中文大学（深圳） · 裴有康（David Y. H. Pui）',url:'https://sse.cuhk.edu.cn/faculty/puiyouhong'},
  board2021: bridgeSurvey.source,
  design: { title: '深圳市城市设计促进中心 · 公园设计师实地导览', url: 'https://www.szdesigncenter.com/tgspy' },
  hk2024: { title: '香港商报 · 春笋凌空去 英才逐浪来，2024-05-12 A8', url: 'https://www.hkcd.com.hk/pdf/202405/0512/ha08512c.pdf' },
  launch: { title: '现场报道 · 深圳人才公园开园了，到人才星光桥上见', url: 'https://k.sina.com.cn/article_6630392851_18b33c41300100bpzl.html' },
  cuhk: { title: '香港中文大学（深圳）· 2017年度新闻回顾', url: 'https://polysz.cuhk.edu.cn/zh-hans/news/4856' },
  szu: { title: '深圳大学图书馆订阅号 · 星光桥上的辉煌深大星', url: 'https://www.sohu.com/a/283345806_771119' },
  city: { title: '深圳市城市管理和综合执法局 · 千园之城大创意', url: 'https://cgj.sz.gov.cn/ydmh/mtxc/content/post_11949575.html' },
  count2023: { title: '南方+ · 现场报道2023年新增45位、累计114位', url: 'https://static.nfapp.southcn.com/content/202302/22/c7383336.html' },
  skills: { title: '深圳市国资委 · 2024年技能人才星光柱启动', url: 'https://gzw.sz.gov.cn/gzrc/rczx/content/post_11905125.html' },
  video2022: { title: '在深圳城市号 · 2022年星光柱实物特写', url: 'https://www.youtube.com/watch?v=2SPTI3Ex_FQ' },
  chenBusso: { title: '游客相册 · 陈晓红正面与 Esteban Pedro Busso 侧面实物', url: 'https://www.meipian.cn/5g8pbtxq' },
  busso: { title: '哈尔滨工业大学个人主页 · Esteban Pedro Busso', url: 'https://homepage.hit.edu.cn/estebanpedrobusso' },
  walk2025: { title: 'Walking Log · 2025年7月27日实地步行', url: 'https://www.youtube.com/watch?v=zT0Reiyb-nQ&t=1597s' },
  baseSlogan:{title:'白天走桥实拍 · 柱脚「圳等您来」，14:46',url:'https://www.youtube.com/watch?v=Qshw0gnMrck&t=886s'},
  hitszFang: {title:'哈尔滨工业大学（深圳） · 计算机科学与技术学院方滨兴教授',url:'https://csen.hitsz.edu.cn/info/1026/1916.htm'},
  fang: { title: 'Wargaz · 方滨兴星光柱现场摄影，2022年12月19日', url: 'https://commons.wikimedia.org/wiki/File:Fang_Binxing_portrait_in_Shenzhen_Talent_Park.jpg' },
  wu: { title: '游客实拍 · 吴云东星光柱', url: 'https://touch.travel.qunar.com/comment/10161936709' },
  walkway: { title: 'Dinkun Chen · 桥面与跑道，2024年12月1日', url: 'https://commons.wikimedia.org/wiki/File:SHENZHEN_TALENTS_PARK_(58).jpg' },
  elevation: { title: 'Dinkun Chen · 桥梁侧面，2024年12月1日', url: 'https://commons.wikimedia.org/wiki/File:SHENZHEN_TALENTS_PARK_(25).jpg' },
};

export const talentBridgePhotos = [
  { image: '/talent/bridge-walkway-2024.webp', source: 'walkway', description: '沿木栈道望向北端，湖在左、跑道在右。' },
  { image: '/talent/bridge-elevation-2024.webp', source: 'elevation', description: '桥面、柱列、斜撑及水中的桥墩。' },
];

const licensedPortraitIds = new Set([
  'robert-grubbs', 'shuji-nakamura', 'arieh-warshel', 'paul-lauterbur',
  'barry-marshall', 'andre-geim', 'brian-kobilka', 'ma-huateng',
  'wang-jian',
]);

function member(id, name, english, role, sourceIds, details = {}) {
  const portrait = licensedPortraitIds.has(id) ? `/talent/${id}-portrait.png` : null;
  return { id, name, english, role, sourceIds, image: null, portrait, portraitKind: portrait ? 'licensed-portrait' : null, inscription: null, position: null, ...details };
}

function filmed(id, name, english, role, second, subtitle, inscription = [name], extraSources = []) {
  return member(id, name, english, role, ['video2022', ...extraSources], {
    sourceTime: second,
    portrait: `/talent/${id}-study.png`,
    portraitKind: 'site-study',
    inscription,
    videoCaption: [name, ...subtitle],
    position: { side: 'west', date: '2022', basis: '画面朝后海及春笋，柱后可见湖面；剪辑未保留柱位间隔。' },
  });
}

// role is a concise identification. Only inscription contains directly read plaque lettering.
// The array order is for the index; it does not encode the physical order of the columns.
const existingRecords = [
  member('robert-grubbs', '罗伯特·格拉布斯', 'Robert H. Grubbs', '2005年诺贝尔化学奖得主', ['city'], {
    position: { reportedOrder: 1, basis: '现场记者记为第一位，未指明桥端或侧面。' },
  }),
  member('shuji-nakamura', '中村修二', 'Shuji Nakamura', '2014年诺贝尔物理学奖得主', ['city'], {
    position: { near: 'robert-grubbs', basis: '现场报道记为与格拉布斯排在一起。' },
  }),
  member('arieh-warshel', '阿里耶·瓦谢尔', 'Arieh Warshel', '2013年诺贝尔化学奖得主', ['city', 'cuhk'], {
    position: { near: 'robert-grubbs', basis: '现场报道记为与格拉布斯排在一起。' },
  }),
  member('paul-lauterbur', '保罗·劳特伯', 'Paul C. Lauterbur', '2003年诺贝尔生理学或医学奖得主', ['city']),
  member('barry-marshall', '巴里·马歇尔', 'Barry Marshall', '2005年诺贝尔生理学或医学奖得主', ['city']),
  member('andre-geim', '安德烈·海姆', 'Andre Geim', '2010年诺贝尔物理学奖得主', ['city']),
  member('brian-kobilka', '布莱恩·科比尔卡', 'Brian K. Kobilka', '2012年诺贝尔化学奖得主', ['cuhk']),
  member('xu-yangsheng', '徐扬生', 'Xu Yangsheng', '中国工程院院士，香港中文大学（深圳）校长', ['cuhk']),
  member('luo-zhiquan', '罗智泉', 'Luo Zhiquan', '香港中文大学（深圳）教授', ['cuhk']),
  member('tang-shuxian', '唐叔贤', 'Tang Shuxian', '香港中文大学（深圳）教授', ['cuhk']),
  member('zhu-shiping', '朱世平', 'Zhu Shiping', '香港中文大学（深圳）教授', ['cuhk', 'launch']),
  member('yuan-geng', '袁庚', 'Yuan Geng', '蛇口工业区建设者', ['launch']),
  member('ma-huateng', '马化腾', 'Ma Huateng', '腾讯公司主要创办人之一', ['launch']),
  member('chen-shiyi', '陈十一', 'Chen Shiyi', '中国科学院院士', ['launch']),
  member('wang-jian', '汪建', 'Wang Jian', '华大基因联合创始人', ['launch']),
  member('cai-zhiming', '蔡志明', 'Cai Zhiming', '深圳大学医学专家', ['launch', 'szu']),
  member('xu-zhenghe', '徐政和', 'Xu Zhenghe', '南方科技大学教授', ['launch']),
  member('deng-xingwang', '邓兴旺', 'Deng Xingwang', '植物生物学家', ['launch']),
  member('niu-hanben', '牛憨笨', 'Niu Hanben', '中国工程院院士，物理电子学专家', ['szu']),
  member('chen-guoliang', '陈国良', 'Chen Guoliang', '中国科学院院士，计算机专家', ['szu']),
  member('fan-dianyuan', '范滇元', 'Fan Dianyuan', '中国工程院院士，激光技术专家', ['szu']),
  member('li-jingzhen', '李景镇', 'Li Jingzhen', '深圳大学超高速成像与光学研究者', ['szu']),
  filmed('wang-shi', '王石', 'Wang Shi', '万科集团创始人', 1, ['万科集团创始人'], ['王石', 'Wang Shi']),
  filmed('ma-weihua', '马蔚华', 'Ma Weihua', '招商银行原行长', 4, ['原招商银行行长']),
  filmed('wang-wenyin', '王文银', 'Wang Wenyin', '正威国际集团创始人', 6, ['正威国际集团创始人']),
  filmed('ma-mingzhe', '马明哲', 'Ma Mingzhe', '中国平安保险集团董事长', 10, ['平安保险集团董事长']),
  filmed('teng-jinguang', '滕锦光', 'Teng Jinguang', '中国科学院院士，曾任南方科技大学副校长', 15, ['中国科学院院士', '南方科技大学副校长']),
  filmed('wang-haijiang', '王海江', 'Wang Haijiang', '加拿大工程院院士，南方科技大学讲席教授', 18, ['加拿大工程院院士', '南方科技大学讲席教授']),
  {...filmed('pei-youkang','裴友康','David Y. H. Pui','美国国家工程院院士，香港中文大学（深圳）教授',21,['美国国家工程院院士','香港中文大学（深圳）教授'],['裴友康'],['puiUniversity']),
    aliases:['裴有康'],readingNote:'2021 年桥头名录与现场短片写作「裴友康」，校方教师主页写作「裴有康」。'},
  filmed('chen-xiaohong', '陈晓红', 'Chen Xiaohong', '中国工程院院士', 25, ['中国工程院院士'], ['陈晓红', 'Chen Xiaohong', '中国工程院院士', '深圳大学教授'], ['chenBusso']),
  filmed('yu-qifeng', '于起峰', 'Yu Qifeng', '中国科学院院士', 28, ['中国科学院院士', '深圳大学教授']),
  member('wu-yundong', '吴云东', 'Wu Yundong', '中国科学院院士', ['wu'], {
    portrait: '/talent/wu-yundong-study.png',
    portraitKind: 'site-study',
    inscription: ['吴云东', 'Wu Yundong', '中国科学院院士', '北京大学深圳研究生院院长'],
    position: { side: 'west', basis: '实物照片中柱后为春笋及湖面。' },
  }),
  member('esteban-busso', '埃斯特班·布索', 'Esteban Pedro Busso', '英国皇家工程院院士，哈尔滨工业大学（深圳）教授', ['chenBusso', 'busso']),
  member('fang-binxing', '方滨兴', 'Fang Binxing', '中国工程院院士', ['fang','hitszFang','baseSlogan'], {
    faceTexture: '/talent/fang-binxing-face.webp',
    image: '/talent/fang-binxing-site.webp',
    portrait: '/talent/fang-binxing-engraving.png',
    portraitKind: 'site-engraving',
    inscription: ['方滨兴', 'Fang Binxing', '中国工程院院士', '哈尔滨工业大学（深圳）计算机科学与技术学院'],
    readingNote: '下行中段据实照，机构全称据哈工大核对，转角外的职衔待核。柱脚「深爱人才　圳等您来」据方、徐两柱所见及当年公开标语补全。',
    position: { side: 'west', cameraLonLat: [113.946403,22.513033], cameraXZ: [229.8,69.4], date: '2022-12-19', basis: 'EXIF为相机坐标；面朝后海岸拍摄，桥心附近的西侧柱。' },
  }),
  member('zhou-chuangbin', '周创彬', 'Zhou Chuangbin', '中国广核集团高技能人才，中华技能大奖获得者', ['skills']),
  member('wang-jiantao', '王建涛', 'Wang Jiantao', '中国广核集团高技能人才，中华技能大奖获得者', ['skills']),
];

const registry=new Map(existingRecords.map(record=>[record.id,record]));
function recordFor(id,fields){
  if(!registry.has(id))registry.set(id,member(id,fields.name,fields.english||'',fields.role||'',[]));
  return registry.get(id);
}
function linkEvidence(record,title,url){
  if(!url || record.sourceIds.some(key=>talentSources[key]?.url===url))return;
  const id='reference-'+record.id+'-'+record.sourceIds.length;
  talentSources[id]={title,url};record.sourceIds.push(id);
}
for(const entry of publicMembers){
  const record=recordFor(entry.id,entry);
  linkEvidence(record,entry.sourceTitle,entry.sourceUrl);
}
for(const mark of bridgeSurvey.columns){
  const record=recordFor(mark.id,mark);
  record.survey=mark;record.sourceIds.push('board2021');
}
for(const collection of [academicEvidence,publicEvidence]){
  for(const [id,entry] of Object.entries(collection)){
    const record=recordFor(id,entry);
    for(const key of ['portrait','portraitKind','faceTexture','sourceSize','inscription','inscriptionFragments','physicalImage','photoCrop','evidenceNote','role','english','readingNote']){
      if(entry[key]!=null)record[key]=entry[key];
    }
    linkEvidence(record,entry.sourceTitle,entry.sourceUrl);
    for(const ref of entry.corroboration||[])linkEvidence(record,ref.sourceTitle,ref.sourceUrl);
  }
}
for(const [id,entry] of Object.entries(literature)){
  registry.get(id).literature=entry;
}
export const talentRecords=[...registry.values()].sort((a,b)=>(a.survey?.number??Infinity)-(b.survey?.number??Infinity));
