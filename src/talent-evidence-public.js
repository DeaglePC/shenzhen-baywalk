// These articles establish membership. Only lettering read on an individual
// physical column belongs in inscription, never the biography in an article.
const university = {
  sourceTitle: '香港中文大学（深圳）· 2017 年度新闻回顾',
  sourceUrl: 'https://tencentlab.cuhk.edu.cn/zh-hans/news/4856',
};
const anniversary = {
  sourceTitle: '香港经济导报 · 港中大（深圳）建校十周年家长徒步现场，2024-01-13',
  sourceUrl: 'https://www.jdonline.com.hk/content_85488.html',
};
const opening = {
  sourceTitle: '开园现场回顾 · 深圳人才公园开园了，到人才星光桥上见',
  sourceUrl: 'https://k.sina.com.cn/article_6630392851_18b33c41300100bpzl.html',
};
const artisans = {
  sourceTitle: '深圳市国资委 · 2024-12-10 技能人才星光柱启动',
  sourceUrl: 'https://gzw.sz.gov.cn/gzrc/rczx/content/post_11905125.html',
};
const skillsWeek = {
  sourceTitle: '深圳市人民政府 · 第四届深圳工匠活动周启动',
  sourceUrl: 'https://www.sz.gov.cn/cn/xxgk/zfxxgj/zwdt/content/post_11887670.html',
};
const eveningWalk = {
  sourceTitle: 'Time Walker · 2021 年深圳人才公园实地步行',
  sourceUrl: 'https://www.youtube.com/watch?v=YaOHuAAV-lQ',
};
const yangcheng = {
  sourceTitle: '羊城晚报 · 视频打卡深圳红色史迹：深圳人才公园，摄影王磊，2021-10-22',
  sourceUrl: 'https://ycpai.ycwb.com/ycppad/content/2021-10/22/content_40344700.html',
};

export const publicEvidence = {
  'xu-yangsheng': {
    ...yangcheng, sourceTime: 25.6, sourceSize: [1920, 1080],
    photoCrop: [866, 396, 1111, 768], corroboration: [eveningWalk, university, anniversary],
    portrait: '/talent/research-public/xu-yangsheng.png', portraitKind: 'site-study',
    inscription: ['徐扬生'],
    inscriptionFragments: [
      {line: 3, text: '中国工程院', rightMissing: true},
      {line: 4, text: '香港中文大学（深圳', rightMissing: true},
    ],
    evidenceNote: '近景可辨 A-15。羊城晚报画面展示了面部、微笑、领带和左肩。Time Walker 20:29 展示绕到柱侧的另一肩及姓名末字，49:12 再次拍到同一人。',
  },
  'luo-zhiquan': {
    ...eveningWalk, sourceUrl: eveningWalk.sourceUrl + '&t=1233s', sourceTime: 1233.5,
    sourceSize: [3840, 2160], photoCrop: [2774, 1112, 3042, 1441],
    corroboration: [university, anniversary],
    portrait: '/talent/research-public/luo-zhiquan.png', portraitKind: 'site-study',
    inscriptionFragments: [{line: 1, text: '罗智', rightMissing: true}],
    evidenceNote: '2021 年蓝牌 A-16；步行连续镜头到达该柱。正面刻像完整，衣领、点纹领带和双肩均可分辨。姓名末字和下方小字落在低照度区域。',
  },
  'tang-shuxian': {
    ...eveningWalk, sourceUrl: eveningWalk.sourceUrl + '&t=2966s', sourceTime: 2967,
    sourceSize: [3840, 2160], photoCrop: [358, 266, 510, 735], corroboration: [university],
    portrait: '/talent/research-public/tang-shuxian-visible.png', portraitKind: 'site-study-partial',
    inscriptionFragments: [{line: 1, text: '唐', rightMissing: true}],
    evidenceNote: '2021 年 A-21。镜头依次经过 A-20 郑健超、刻「唐」字的眼镜人像与 A-23 伯纳德·罗兹曼。保留实拍可见的发梢、半边镜框和西服，柱面远侧透明。',
  },
  'zhu-shiping': {...university, corroboration: [opening]},
  'yuan-geng': {...opening},
  'zhou-chuangbin': {...artisans, corroboration: [skillsWeek]},
  'wang-jiantao': {...artisans, corroboration: [skillsWeek]},
  'xu-zhenghe': {
    ...opening, portrait:'/talent/research-public/xu-zhenghe-visible.png',portraitKind:'site-study-partial',
    corroboration:[{sourceTitle:'Time Walker · A-32 之后的徐姓人物实柱',sourceUrl:eveningWalk.sourceUrl+'&t=1306s'}],sourceSize: [640, 452], photoCrop: [286, 94, 373, 166],
    physicalImage: 'https://k.sinaimg.cn/n/front/292/w640h452/20181105/wb9K-hnknmqx0100251.jpg/w700d1q75cms.jpg?by=cms_fixed_width',
    inscription: ['徐政和', 'Xu Zhenghe', '加拿大工程院院士'],
    evidenceNote: '照片水印为「头条号 / 升职文化」。镜头完整记录了姓名、英文拼写及职衔，画幅上边缘裁掉了大半个头像。21:46 走桥实拍在 A-32 之后拍到「徐」姓刻像，对照 A 区名录，这一段的徐姓人为 A-35。发线、衣领和可见半面按该侧拍重绘。',
  },
};

export const publicMembers = [
  {
    id: 'lin-haihui', name: '林海晖', english: 'Lin Haihui', role: '材料学专家',
    sourceTitle: '深圳市卫光生物制品股份有限公司《关于董事会换届选举的公告》· 林海晖简历，第 8 页',
    sourceUrl: 'https://static.cninfo.com.cn/finalpage/2021-11-24/1211685081.PDF#page=8',
    date: '2018', basis: '披露简历记载，他于 2018 年获选深圳市人才公园星光柱首批人物。',
    portrait: null, inscription: null, position: null,
  },
  {
    id: 'tang-benzhong', name: '唐本忠', english: 'Ben Zhong Tang', role: '香港中文大学（深圳）教授',
    ...anniversary, date: '2024-01-13', basis: '报道记载，家长途经人才公园时看到的星光柱人物包括唐本忠。',
    portrait: null, inscription: null, position: null,
  },
];
