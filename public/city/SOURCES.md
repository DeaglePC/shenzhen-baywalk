# 渲染素材与重建说明

春茧屋盖、东侧体育场开口、跑道与两座室内场馆的位置参照本项目的 OpenStreetMap 场地多边形。银白色镂空外壳、中央广场和沿屋盖渐变的网孔参考设计方照片及项目介绍。局部剖面、坐席排布与构件断面属于外观重建。[佐藤综合计画设计档案](https://www.axscom.jp/legacy/en/project/no03341/) · [深圳市南山区政府场馆资料](https://www.szns.gov.cn/mlns/whns/tycg/content/post_12589347.html)。

游戏中的 2024 Tesla Model 3 使用 RBLXSupercars 创作、brandonleong28 上传的开放许可模型。项目按 4.72 米车长统一缩放，在 Blender 中拆分可转动车轮，添加前后深圳新能源绿牌，并从同一网格制作中远景版本。登良路、车辆图鉴及道路车流均使用此模型。[Sketchfab 模型](https://sketchfab.com/3d-models/tesla-model-3-2024-36c52f3f89f6439c90310f14e8ff33f2) · [带署名的源文件](https://github.com/erictfree/Carbon-Footprint-AI-Visualizer/tree/af4bef33ca371b24c1f043486f09a13571f4919b/models/tesla-model-3-2024) · [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)。

城市 SUV、商务 MPV、三厢轿车和紧凑两厢车使用 Comrade1280 的 *Generic passenger car pack*。项目使用 TUM-VT 保存的原版车身、轮毂与贴图，调整车漆、坐标和轮轴，添加虚构深圳蓝牌，并从同一车身制作远景网格。车辆图鉴与道路共用同一份资产。[原作者作品](https://sketchfab.com/3d-models/generic-passenger-car-pack-20f9af9b8a404d5cb022ac6fe87f21f5) · [模型源文件](https://github.com/TUM-VT/Sumonity-PassengerCars/tree/92be5975162ff9348c96d76dd6077321dce013dc) · [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)。


城市建筑平面、道路、岸线、卫星正射底图和树冠观测来源见 [地理数据说明](../data/SOURCES.md)。

* 近景铺装使用 Poly Haven 发布的 CC0 材质，分别为 [Asphalt 04](https://polyhaven.com/a/asphalt_04)、[Rectangular Paving](https://polyhaven.com/a/rectangular_paving)、[Grass Ground](https://polyhaven.com/a/grass_ground) 和 [Concrete Floor 02](https://polyhaven.com/a/concrete_floor_02)。项目中的本地 WebP 做过压缩与调色。春茧球场草纹衍生自 Grass Ground，海之门铺装衍生自 Rectangular Paving；近处草丝与跑道胶粒通过程序着色。
* 近景阔叶树来自 Poly Haven 两株扫描树木，按距离显示树干、分枝和有深度的叶簇，棕榈采用三维叶片与树干。远景采用 [Jacaranda Tree](https://polyhaven.com/a/jacaranda_tree)、[Island Tree 01](https://polyhaven.com/a/island_tree_01)、[Island Tree 02](https://polyhaven.com/a/island_tree_02)、[Shrub 02](https://polyhaven.com/a/shrub_02) 和 [Shrub 03](https://polyhaven.com/a/shrub_03) 的透明图像。[树木加工和来源说明](../foliage/SOURCES.md)
* 天际线以外的山地采用 [AWS Terrain Tiles](https://registry.opendata.aws/terrain-tiles/) 的 Terrarium 高程图层，在公园中心外延约 22 公里，按 220 米网格采样。图源包括 Mapzen 以及该数据集列出的上游机构。
* 湖面和登良路近景积水使用 [Three.js Reflector](https://github.com/mrdoob/three.js/blob/dev/examples/jsm/objects/Reflector.js) 投影场景倒影。湖面的细波叠加了 [waternormals.jpg](https://github.com/mrdoob/three.js/blob/dev/examples/textures/waternormals.jpg)。湖岸深浅采用地图岸线及七个岛屿轮廓计算，岛缘石块和草丛为程序布置。
* 星光桥木面使用 Poly Haven 的 CC0 [Wood Floor Deck](https://polyhaven.com/a/wood_floor_deck)，桥栏、灯柱和铭牌为几何与材质重建。参考[深圳市城市设计促进中心的人才公园项目资料](https://www.szdesigncenter.com/tgspy)。
* 春笋模型依据实测标注高度和 [KPF 对外框柱与收分轮廓的说明](https://www.kpf.com/project/china-resources-tower)。春茧模型基于地图馆体坐标，以及[深圳市南山区政府对场馆结构的说明](https://www.szns.gov.cn/mlns/whns/tycg/content/post_12589347.html)。两座地标均为原创几何重建。
* 深圳湾文化广场采用五个地图屋顶轮廓和 [MAD 发布的设计资料与平剖面](https://www.i-mad.com/articles/shenzhen-bay-culture-square-completion)，重建九个馆体石形、支承结构和侧窗。
* 登良路蓝白出租车依据项目提供的深圳巴士集团鹏程实车照片建模。车身侧视轮廓、4,695 × 1,810 × 1,670 mm 外廓、2,800 mm 轴距和 215/55 R17 轮胎参考[比亚迪第二代 e6 原厂尺寸图](https://sg.byd.com/wp-content/uploads/2021/11/BYD-e6-Spec-Sheet-Sime-Darby-2th-Nov-2021.pdf)。左前照片用于校对前脸、车灯、顶灯和侧面涂装，车尾与内饰由同代车型资料补全。照片机位按轮圈和车牌估算透视。
* 车辆图鉴和 Blender 摄影棚使用 Sergej Majboroda 拍摄的 CC0 环境光照 [Urban Courtyard 02](https://polyhaven.com/a/urban_courtyard_02)。登良路内的车漆及玻璃使用游戏实际街景的局部反射。
* 普通建筑的外立面、窗饰、店铺、吊顶、照明、桥梁细部、园林家具、树种和模型布置经过艺术化处理。模型没有逐栋现场扫描，地表局部坡道与楼梯以简化高度处理。
* 办公、住宅与酒店外墙使用 ambientCG 的 CC0 材质 [Facade 005](https://ambientcg.com/view?id=Facade005)、[Facade 015](https://ambientcg.com/view?id=Facade015)、[Facade 017](https://ambientcg.com/view?id=Facade017)、[Facade 019 A](https://ambientcg.com/view?id=Facade019A) 和 [Facade 020 A](https://ambientcg.com/view?id=Facade020A)，包括本地颜色、法线和粗糙度贴图。


### 人才公园与后海建筑本次校准

求贤阁、群英荟及风帆塔采用地图的平面轮廓与[照明设计项目实景](https://www.elicht.com/view/19573.html)。群英荟下层和上层分别使用两条相互重叠的测绘轮廓。阅览室书架、不可见的内墙、构件截面和局部高度依图估计。

春笋与深圳湾一号八座塔楼参考 [KPF 春笋](https://www.kpf.com/project/china-resources-tower)、[KPF 深圳湾一号](https://www.kpf.com/project/one-shenzhen-bay)、[KPF 东立面与总图](https://www.kpf.com/wp-content/uploads/imported-files/AP202103_KPF_OSB_P176-183.pdf)及[主体钢构项目资料](https://www.szgsin.com/en/projects/shenzhen-bay-one/)。春茧使用[建筑师实景](https://www.axscom.jp/legacy/en/project/no03341/)和[海之门透明屏供货方现场摄影](https://cn.unilumin.com/news/company_4172.html)。室内和背街面的局部做法、平台高度、钢板厚度及板缝为依据外观的估算。

文化广场的自然白花岗岩细条覆面依据[MAD 建成实景](https://www.i-mad.com/articles/shenzhen-bay-culture-square-completion)重建。颗粒、微表面法线和粗糙度来自 [Poly Haven Granite Tile 04](https://polyhaven.com/a/granite_tile_04) 的 CC0 素材，截取石板内部、重新调色并沿展馆曲面分缝。普通街区楼宇依地图用途、尺寸和楼层排布窗间墙；[Facade019A](https://ambientcg.com/view?id=Facade019A) 和 [Facade020A](https://ambientcg.com/view?id=Facade020A) 为 ambientCG CC0 通用材质，未逐栋拍摄。

T7 临湖主立面使用钉钉于 2022 年 1 月 1 日拍摄的 [Shenzhen Talents Park 18](https://commons.wikimedia.org/wiki/File:Shenzhen_Talents_Park_18.jpg)。本地 t7-east-elevation.webp 已按窗带内缘校正透视，分离既有天空倒影，保留窗格、设备层百叶与冠部标识。原作与此衍生纹理采用 [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)。转动视角时，玻璃反射来自三维场景。

星光桥的分叉桥墩与桥边纵梁参考项目所存的桥侧实拍。π 桥栏杆分列圆周率小数点后 2017 位。双曲桥桥面、未来智汇廊桥与园内栈桥沿地图轮廓或中心线建模。灯具功率、护栏截面与桥下构件间距为场景估计。[公园设计师导览](https://www.szdesigncenter.com/tgspy)

星光桥南、北桥头沿 OpenStreetMap 中与主桥相接的园路分岔布置。桥侧的浅色分缝封边、斜腹杆、下弦钢管及分叉支撑参考[桥侧实拍](https://commons.wikimedia.org/wiki/File:SHENZHEN_TALENTS_PARK_(25).jpg)。引坡高度、桥台尺寸、挡墙铺砌及跑道转弯半径为场景估算。

腾讯滨海大厦以米建模。双塔沿地图中心和朝向配准，南塔高 245.78 米，北塔高 194.75 米。标准层长宽按结构工程师发表的近似值，分别取 95 × 30 米和 76 × 30 米。楼层数量采用建成后项目资料的 50 层及 38 层。大堂与三段连廊沿地图轮廓配准，连廊底面及顶面采用地图的 14–35 米、95.8–121.8 米、152.8–175.8 米。[幕墙工程论文](https://global.ctbuh.org/resources/papers/2976-paper34-v2.pdf) · [结构工程论文及标准层平面](https://global.ctbuh.org/resources/papers/2933-paper71-v2.pdf) · [建成项目回顾](https://global.ctbuh.org/resources/papers/3644-Ward_TencentSeafrontTowers.pdf)

向外折出的玻璃单元、塔间平整幕墙、连廊端部大窗和铜色铝遮阳百叶按实景和幕墙说明建模。模型采用建成回顾所述最大 0.9 米外挑。每块玻璃的组合顺序、百叶间距、空中花园种植及灯光节目为实景近似。[NBBJ 建成实景](https://www.nbbj.cn/work/tencent-global-headquarters/) · [幕墙顾问 Inhabit](https://inhabitgroup.com/project/tencent-seafront-tower-shenzhen-prc/)

南塔南面靠西的白色英文字、裙房西南面横向百叶上的蓝色双语字、西广场深灰石座上的浅色双语字，分别使用实体字面和侧壁。塔冠与裙房朝向依据 Charlie fong 2020 年 12 月的航拍；2026 年 11 月发布的实地探访照片可辨认裙房和广场两种做法。字形轮廓取自 2017 版腾讯双语字标，用于识别实景建筑。字座、笔画厚度、夜间灯色及修剪绿化按照片比例估算。[2020 年航拍](https://commons.wikimedia.org/wiki/File:Tencent_binghai_building202012_(cropped).jpg) · [现场探访与入口照片](https://note.com/routexstartups/n/n4cee544dcc48) · [字标轮廓来源](https://commons.wikimedia.org/wiki/File:Tencent_logo_2017.svg) · [腾讯品牌资料](https://www.tencent.com/zh-cn/newsroom/media-resources/)

海天二路弯道、支路开口、公共步行广场、篮球场地与公交站点采用 OpenStreetMap 数据。2022 年 12 月百度全景可辨认白色球场围网、沿路树列、自行车停放、黄色路边线和入口网格标线。西广场铺装与绿地关系也参考航片。现地随时可能变化的车辆、绿化、街具和漆线位置采用代表性布置。[百度地图海天二路全景](https://map.baidu.com/@12684171.86,2558588.18,21z#panoid=0900570012221203144907994AC&panotype=street&heading=295&pitch=0) · [海天二路地图中心线](https://www.openstreetmap.org/way/830807174) · [篮球场轮廓](https://www.openstreetmap.org/way/543268967) · [西广场轮廓](https://www.openstreetmap.org/way/1434393000) · [Esri World Imagery](https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer)


后海天际线灯光参考用户提供的夜景画面。春笋的金色翼柱和塔冠、星光桥的黄色穿孔灯柱和蓝色桥侧灯按画面调色。蓝青与紫红之间的流光为漫游场景编排，所有建筑共用节目时钟，隔湖倒影实时取自三维场景。

星光桥的深色宽扶手、倾斜的不锈钢栏柱、横向钢索和蓝色慢跑带参考 Dinkun Chen 的步行视角照片。伸缩缝、柱脚和灯杆检修盖为近距离漫游补充的构造近似。[星光桥实拍](https://commons.wikimedia.org/wiki/File:SHENZHEN_TALENTS_PARK_(58).jpg)

路名牌的双面文字和道路方位参照深圳公开资料，牌面朝向由本地道路数据计算。路灯、雨水口和检查井按街道尺度布置，具体点位为模拟。[深圳市交通标志和标线设置技术规程](https://zjj.sz.gov.cn/attachment/1/1457/1457791/11386390.pdf) · [深圳市地名志](https://pnr.sz.gov.cn/attachment/1/1442/1442495/10537363.pdf)

## 潮汐广场及对岸天际线

潮汐广场的岸线、伸向湖面的观景台和十四片三角膜顶取自本地 OpenStreetMap 轮廓。用户实拍照片 4 至 6、10、12 至 14 和两段现场视频用于校准滨水步道、阶梯、膜面曲率、斜桅、黑色系缆柱、展墙和植栽。驿站门楣、功勋墙图文和部分远处楼体字标采用这些照片中可见的局部，保留原图的辨识度。[深圳市城市设计促进中心 · 深圳人才公园](https://www.szdesigncenter.com/tgspy)

景湖大厦的主体按约 150 米建模。楼顶火山引擎及英文字标、邻楼的 AAC Technologies、中国海油、Hisense 等标识依据照片 5、6 放置。中建科工、低楼金字和南侧远楼字标使用矫正透视的局部图。施工楼与瑞声楼的基底、幕墙分格，以及照片遮挡的立面按街块和视线估算。文化广场北馆的石壳、玻璃基座与椭圆天窗以照片 6 及建筑师的建成资料为参考。[中国建筑 · 字节跳动后海中心竣工](https://www.cscec.com/xwzx_new/zqydt_new/202503/3861360.html) · [后海中心设计招标与周边关系](https://www.tenderstream.com/assets/tenders/2020/202007/1594630058_2860_opentenderfortheconceptualschematicdesignofbytedancehouhaicentreproject.pdf) · [MAD · 深圳湾文化广场](https://www.i-mad.com/articles/shenzhen-bay-culture-square-completion)

《领航者》和《弄潮儿》按地图中的作品点位布置。前者结合照片 1 至 3 的正侧背视图，后者使用照片 7 的临水视角。两个 GLB 由人物轮廓截面、重建的前后深度及照片里的青铜纹理生成，背面或下身受到遮挡的部分按可见比例补全。生成脚本为 scripts/park_bronzes.py。

## 内湖东北岸花草字

花坛的位置和朝向依据内湖东北岸花圃轮廓及航拍影像。模型以中文所在的弧形草坡为基准，上下两层共用左右端线，英文首尾按湖边观景点的视角与中文对齐。笔画和植栽材质取自根据用户照片 1、4、5 生成的正视还原图，由 `scripts/park_flowerbed.py` 提取。坡高、种植槽深度和近景花叶尺寸按照片估算。[OpenStreetMap 花圃轮廓](https://www.openstreetmap.org/way/775214603) · [Esri World Imagery](https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer)

照片 1、4、5 提供了灰色条石、蓝色跑道、折臂灯和左端卷纹绿篱的形状。照片 2、3 用于还原临湖草坪、岸边树、低灌木与碎石滩。步道走向、坡后林地及三座石滩使用地图轮廓，树高、草坡起伏和灯距按画面比例估算。`scripts/flowerbed_landscape.py` 从现场照片取样草色、卵石及叶片颜色，并重建这两个入口的阴天光照。[湖滨步道](https://www.openstreetmap.org/way/537564125) · [中段碎石滩](https://www.openstreetmap.org/way/735037204) · [坡后林地](https://www.openstreetmap.org/way/775214605)

## 路口信号设备

信号路口、道路走向和人行横道取自项目的 OpenStreetMap 路网。机动车横排箭头灯、路边行人灯，以及抓拍横杆的枪机、补光器和球机参考用户提供的福中三路街景制作。各路口杆位和灯组按游戏道路宽度布置，放行顺序和时长由本地交通模拟控制。

## 公园雕塑、城市入口与细部复原

《领航者》与求贤阁题名石采用项目现场原片。最初《弄潮儿》照片的玻璃栏杆遮挡了下身，实机发现拼接衣褶有断层。最终游戏使用无遮挡旧照生成的全身版本。三组功勋墙的人物尺度按现有基座作图像估算。领航者去除了模型背后的多余人形。每件作品均含近景与简化网格，切换距离为 42 米。单张照片没有覆盖的背面属于重建推断。[三组功勋墙现场照片](https://ishare.ifeng.com/c/s/7nxP8gnLlkX)

百杰山和人才雕塑园的牛憨笨、袁庚、爱因斯坦、牛顿、焦耳、孔子、三位发明家与“两弹一星”群像，按作者标注位置和作品外形核对后提取轮廓生成。照片记录了座椅、半球、圆球、坐立关系等特征。材质、背面与基座尺寸由游戏复原，相关牌文未逐字复刻。《本地郎》依据船形构图，《外来妹》依据骑行群像。游戏文件包含重新生成的网格及本地材质。[百杰山与公园现场图集](https://www.meipian.cn/530rt6ds) · [两组草坪雕塑现场图](https://www.sohu.com/a/431961449_185397)

人才公园二期的彩色字参考五个实体汉字的分离笔画及约两米高度。礁石广场表现波纹渐变砖阵，广场中心使用地图点位，外缘为估算。双手爱心、开屏孔雀、智慧之门及 IT 人拱形依据现场图复原。孔雀的脚接到已有木栈台。语录石的传统字形依据石面照片，字形排版为重排。智汇廊桥选择有报道佐证的两处城市名，两地距离为大圆距离取整。[二期设计团队](https://mooool.com/shenzhen-talent-park-phase-ii-by-aube-conception.html) · [南山区发布](https://www.szns.gov.cn/english/news/content/post_11703736.html) · [广场铺砖现场报道](https://www.sohu.com/a/823028226_121124668) · [语录石及中心广场](https://www.dutenews.com/n/article/8467902) · [语录石现场照片](https://k.sina.cn/article_6224090615_p172fc15f700100em4u.html) · [智汇廊桥报道](https://www.dutenews.com/n/article/8489794)

大运主火炬塔表现 26 册红色花岗岩叠书和 26 米总高。各册的横向尺寸、转角和台基为模型估算。深圳大学时光广场日晷的石砌台身、倾斜晷面和晷针依据校园公开照片。蛇口自贸区入口依据实拍蓝色不对称拱门、标识和地图道路尺度，南海大道车流从拱下通过。[火炬塔设计资料](https://gdxk.southcn.com/attachment/0/14/14623/770114.pdf) · [深圳大学校园照片](https://en.szu.edu.cn/About/About2.htm) · [时光广场实地记录](https://hqb.szu.edu.cn/info/1028/2041.htm) · [自贸区入口现场照片](https://www.eyeshenzhen.com/content/2020-05/18/content_23162575.htm)

