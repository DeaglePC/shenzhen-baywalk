# 渲染素材与重建说明

春茧屋盖、东侧体育场开口、跑道与两座室内场馆的位置参照本项目的 OpenStreetMap 场地多边形。银白色镂空外壳、中央广场和沿屋盖渐变的网孔参考设计方照片及项目介绍。局部剖面、坐席排布与构件断面属于外观重建。[佐藤综合计画设计档案](https://www.axscom.jp/legacy/en/project/no03341/) · [深圳市南山区政府场馆资料](https://www.szns.gov.cn/mlns/whns/tycg/content/post_12589347.html)。

特斯拉 Model 3 采用中国官网后轮驱动版。车长、宽（带镜及不带镜）、车高、轴距、前后悬和轮距均以厂家尺寸表为基准；玻璃、覆盖件、灯具及光子轮毂在 Blender 中参考官方图重新塑形。街头车型使用场景编排的车牌。[车型官网](https://www.tesla.cn/model3) · [特斯拉中国车主手册尺寸表](https://www.tesla.cn/ownersmanual/model3/zh_cn/GUID-56562137-FC31-4110-A13C-9A9FC6657BF0.html) · [原厂外观照片](https://digitalassets.tesla.com/tesla-contents/image/upload/Model-3-Exterior-Desktop-NA.jpg)。

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
