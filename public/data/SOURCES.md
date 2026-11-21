# 深圳后海地图数据

《深圳湾漫游》使用 © OpenStreetMap contributors 的地理数据。转换后的地理数据库 `shenzhen.json` 按 [Open Database License 1.0](https://opendatacommons.org/licenses/odbl/1-0/) 提供。[OpenStreetMap 版权与署名](https://www.openstreetmap.org/copyright)

地物来自 [OpenStreetMap 地图 API](https://wiki.openstreetmap.org/wiki/API_v0.6)。原点取 WGS84 东经 113.94417°、北纬 22.51366°，在人才公园内湖内。X 向东，Z 向南，一个单位约为一米。原点周围东、西、南、北各取 3,200 米，以覆盖整个半径 3,000 米的圆及边缘余量。局部投影采用 WGS84 原点的经纬度米制比例。生成脚本为 `scripts/geodata.py`。

路网保留原始形状、通行方向、桥面层级和可用的名称。缺少宽度标签时，用车道数或道路类型估算。建筑数据包含原始轮廓、院落洞和可用的体块信息。389 个体块有标注高度，2,061 个体块用标注层数换算高度，152 个住宅体块采用 CMAB 独立研究模型的高度，7 个体块根据邻近同形住宅估高，1,677 个体块按建筑用途估算。各体块的 `heightSource` 标注依据。编号为正数时对应 OSM way，为负数时其绝对值对应 OSM relation。地图中的树和街道实物模型另行渲染，取景点为体验设计选取。

- [深圳人才公园边界](https://www.openstreetmap.org/relation/18459537)
- [深圳湾内湖与七个岛屿内环](https://www.openstreetmap.org/relation/10175109)
- [人才星光桥桥面](https://www.openstreetmap.org/way/736632011)
- [中国华润大厦建筑轮廓和高度](https://www.openstreetmap.org/way/529272473)
- [深圳湾体育场建筑轮廓](https://www.openstreetmap.org/relation/9244350)
- [深圳市南山区政府的人才公园介绍](https://www.szns.gov.cn/mlns/stns/lc/csgy/content/post_12595660.html)

## 建筑高度补充

152 个住宅高度改编自 Yecheng Zhang、Huimin Zhao、Ying Long（2025）的 *CMAB: A Multi-Attribute Building Dataset of China*，使用 Figshare 第七版广东分区、珠三角 2022 年 3 月 2 日屋顶图幅及其高度预测。研究数据按 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) 提供。生成脚本对齐屋顶和建筑轮廓，选择唯一对应且多边形交并比至少为 0.5 的住宅。用本区域 280 个已有高度或层数的匹配住宅作对照，预测值与地图参考值的平均绝对差为 9.5 米。[原始数据](https://doi.org/10.6084/m9.figshare.27992417.v7) · [研究论文](https://doi.org/10.1038/s41597-025-04730-5)

7 个重复住宅体块的高度取自 160 米内、轮廓形状与占地面积相近的同类建筑。生成脚本检查有标签的邻楼高度是否相近。仅存在一个参照时，要求在 70 米内且平移对准后的轮廓交并比至少为 0.94。对 807 个已有高度或楼层的住宅逐一隐藏自身标签后，平均绝对差为 0.3 米。这个数值只描述本区域符合上述重复形状条件的样本。

`scripts/geoheight.py` 可重算匹配表 `scripts/geoheight-matches.json`。其中记录建筑几何指纹、高度和来源分类，并保留 CMAB 的 shapefile 记录号与轮廓交并比，或供参照的邻楼 OSM 编号。

## 卫星影像

`houhai-sentinel.webp` 含经裁切、重投影和压缩的 Copernicus Sentinel 2025 数据（Contains modified Copernicus Sentinel data 2025）。影像使用 2025 年 12 月 9 日拍摄的 Sentinel-2C Level-2A 真彩色波段，场景为 `S2C_49QGE_20251209_0_L2A`。原始空间分辨率为 10 米。输出贴图上北下南，覆盖 6,400 × 6,400 米。可用 `scripts/geosatellite.py` 重建。[原始场景元数据](https://earth-search.aws.element84.com/v1/collections/sentinel-2-l2a/items/S2C_49QGE_20251209_0_L2A) · [Sentinel-2 Cloud-Optimized GeoTIFF 数据来源](https://registry.opendata.aws/sentinel-2-l2a-cogs/)

## 树冠与绿化

`houhai-canopy.json` 改编自 Meta and World Resources Institute (WRI), 2026, *Version 2 High Resolution Canopy Height Maps (CHMv2)*，许可为 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)。Source imagery for CHM © 2016 Vantor. Accessed 21 November 2026. [数据说明](https://registry.opendata.aws/dataforgood-fb-forestsv2/) · [原始栅格](https://dataforgood-fb-data.s3.amazonaws.com/forests/v2/global/dinov3_global_chm_v2_ml3/chm/1321222320.tif)

生成脚本 `scripts/geocanopy.py` 将树冠高度预测栅格采样到本地 2 米网格，识别局部树冠峰点，滤除落在水体、建筑、道路和运动场等位置的候选点。本区域检测到 14,129 个候选树冠。按距公园的距离加权抽取 9,000 个位置供渲染，保留各点的预测高度。树种、树形和树干在渲染阶段表现。
