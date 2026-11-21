# 渲染素材与重建说明

城市建筑平面、道路、岸线、卫星正射底图和树冠观测来源见 [地理数据说明](../data/SOURCES.md)。

* 近景铺装使用 Poly Haven 发布的 CC0 材质，分别为 [Asphalt 04](https://polyhaven.com/a/asphalt_04)、[Rectangular Paving](https://polyhaven.com/a/rectangular_paving)、[Grass Ground](https://polyhaven.com/a/grass_ground) 和 [Concrete Floor 02](https://polyhaven.com/a/concrete_floor_02)。项目中的本地 WebP 做过压缩与调色。
* 树木远景采用 Poly Haven 的 [Jacaranda Tree](https://polyhaven.com/a/jacaranda_tree)、[Island Tree 01](https://polyhaven.com/a/island_tree_01)、[Island Tree 02](https://polyhaven.com/a/island_tree_02)、[Shrub 02](https://polyhaven.com/a/shrub_02) 和 [Shrub 03](https://polyhaven.com/a/shrub_03) 资产预览制成的透明材质，近景棕榈采用程序化三维叶片与树干。物种、姿态与街道设施位置由场景生成。
* 天际线以外的山地采用 [AWS Terrain Tiles](https://registry.opendata.aws/terrain-tiles/) 的 Terrarium 高程图层，在公园中心外延约 22 公里，按 220 米网格采样。图源包括 Mapzen 以及该数据集列出的上游机构。
* 水面基于 Three.js 的 [Water](https://github.com/mrdoob/three.js/blob/dev/examples/jsm/objects/Water.js) 与 [waternormals.jpg](https://github.com/mrdoob/three.js/blob/dev/examples/textures/waternormals.jpg)，对着色、反射频率和湖水色彩进行了适配。
* 春笋模型依据实测标注高度和 [KPF 对外框柱与收分轮廓的说明](https://www.kpf.com/project/china-resources-tower)。春茧模型基于地图馆体坐标，以及[深圳市南山区政府对场馆结构的说明](https://www.szns.gov.cn/mlns/whns/tycg/content/post_12589347.html)。两座地标均为原创几何重建。
* 普通建筑的外立面、窗饰、店铺、吊顶、照明、桥梁细部、园林家具、树种和模型布置经过艺术化处理。模型没有逐栋现场扫描，地表局部坡道与楼梯以简化高度处理。
* 办公、住宅与酒店外墙使用 ambientCG 的 CC0 材质 [Facade 005](https://ambientcg.com/view?id=Facade005)、[Facade 015](https://ambientcg.com/view?id=Facade015)、[Facade 017](https://ambientcg.com/view?id=Facade017)、[Facade 019 A](https://ambientcg.com/view?id=Facade019A) 和 [Facade 020 A](https://ambientcg.com/view?id=Facade020A)，包括本地颜色、法线和粗糙度贴图。
