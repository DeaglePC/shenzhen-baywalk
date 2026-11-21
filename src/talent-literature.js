// Each entry pairs a report naming the honoree with a source for the biography.
// The biography belongs to the visitor guide. Physical lettering has its own sources.
const opening = {
  date: '2017 年开园',
  account: '记者卢兴求在开园回顾中，逐一点到了桥上的这批人物。',
  title: '开园报道',
  url: 'https://k.sina.com.cn/article_6630392851_18b33c41300100bpzl.html',
};
const shenzhenUniversity = {
  date: '2018 年校方记载',
  account: '深圳大学图书馆在《星光桥上的辉煌深大星》中列出了桥上的深大人物，其中有蔡志明、牛憨笨和李景镇。',
  title: '深圳大学图书馆',
  url: 'https://www.sohu.com/a/283345806_771119',
};
const craftWeek = {
  date: '2024 年 12 月 10 日',
  account: '第四届深圳工匠活动周在人才公园星光大道启动技能人才星光柱，首批两位工匠是周创彬和王建涛。',
  title: '深圳市政府 · 活动记录',
  url: 'https://www.sz.gov.cn/cn/xxgk/zfxxgj/zwdt/content/post_11887670.html',
};

export const literature = {
  'zhu-shiping': {
    membership: {
      date: '2017 年校方记载',
      account: '香港中文大学（深圳）的年度回顾列有朱世平。2021 年桥头蓝色名录把他列在 A-36。',
      title: '港中大（深圳）年度回顾',
      url: 'https://tencentlab.cuhk.edu.cn/zh-hans/news/4856',
    },
    bio: '朱世平研究聚合反应工程。2017 年回国加入香港中文大学（深圳），继续从事高分子材料研究和教学。',
    profile: ['港中大（深圳）理工学院', 'https://sse.cuhk.edu.cn/faculty/zhushiping'],
  },
  'yuan-geng': {
    membership: opening,
    bio: '1979 年，袁庚参与筹建蛇口工业区。今天沿深圳湾向西走到蛇口，就能看到这段改革开放历史发生的地方。',
    profile: ['深圳市档案馆', 'https://www.szdag.gov.cn/dawh/tqssn/content/post_931794.html'],
  },
  'wang-jian': {
    membership: opening,
    bio: '汪建于 1999 年参与创办华大基因。2007 年，他来到深圳筹建深圳华大基因研究院。',
    profile: ['华大集团人物档案', 'https://www.genomics.cn/team/info.aspx?itemid=196'],
  },
  'cai-zhiming': {
    membership: shenzhenUniversity,
    bio: '蔡志明是泌尿外科教授、主任医师，曾任深圳市第二人民医院院长，研究泌尿生殖系统肿瘤。',
    profile: ['深圳大学医学部', 'https://med.szu.edu.cn/icc/rcdw/lctd/ystd/content_8439'],
  },
  'niu-hanben': {
    membership: shenzhenUniversity,
    bio: '牛憨笨研究物理电子学，以高速变像管记录肉眼无法分辨的瞬间。1997 年当选中国工程院院士。',
    profile: ['中国工程院院士馆', 'https://www.cae.cn/cae/html/main/colys/90182197.html'],
  },
  'li-jingzhen': {
    membership: shenzhenUniversity,
    bio: '李景镇于 1993 年从西安来到深圳大学。他参与建设光学专业，长期研究如何用超高速摄影记录瞬态过程。',
    profile: ['李景镇本人口述', 'https://www.sznews.com/news/content/mb/2021-11/19/content_24752734.htm'],
  },
  'zhou-chuangbin': {
    membership: craftWeek,
    bio: '周创彬于 1991 年到大亚湾核电站工作，从事核电机组调试。2018 年获中华技能大奖。',
    profile: ['中国广核集团人物报道', 'https://www.cgnpc.com.cn/cgn/c100930/2020-01/20/content_b4f2a50b709548da89333f03b37ee68b.shtml'],
  },
  'wang-jiantao': {
    membership: craftWeek,
    bio: '王建涛于 1996 年进入大亚湾核电站，从检修学徒做起，专攻发电机检修。2021 年获中华技能大奖。',
    profile: ['王建涛在母校的口述', 'https://www.zepc.edu.cn/info/1743/53618.htm'],
  },
};

export function literatureLocation(record) {
  if (record.survey) return record.survey.code + ' · 2021 年名录编号';
  const area = record.literature.membership === craftWeek ? '星光大道' : '星光桥';
  return area + ' · 实地柱号待核，此处为展示位';
}
