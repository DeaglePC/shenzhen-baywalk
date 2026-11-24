# 人才公园与登良路的树木

近景阔叶树使用 Rob Tuytel 扫描和处理、Rico Cilliers 清理和处理的 *Island Tree 01* 和 *Island Tree 02*。原始模型及材质由 Poly Haven 以 CC0 发布。树干保留实木分叉，配有树皮颜色和法线贴图。原始树冠中的细枝和叶片经空间分组，沿三个方向烘焙为带透明轮廓的彩色纹理。两株树分别采用 169 个和 247 个空间簇。重建工具位于 `scripts/foliage_build.py`。[Island Tree 01](https://polyhaven.com/a/island_tree_01) · [Island Tree 02](https://polyhaven.com/a/island_tree_02) · [Poly Haven 素材许可](https://polyhaven.com/license)

走近树木时，模型使用扫描原件中独立的叶片和细枝。两株近景模型分别保留 24,216 和 16,356 片弯曲的叶片，以及原件中 8,357 和 5,541 根细枝。枝干横截面沿原始网格提取。叶色、透明轮廓和叶脉来自原件的纹理。中远景使用树冠簇和树冠图像。树下表土取材于项目已有的 [Grass Ground](https://polyhaven.com/a/grass_ground)，林下草叶和落叶为程序建模。树形、朝向和树种搭配经过美术处理。登良路辅路外侧的行道树种植穴、护桩和沿阶草根据路侧空间布置。

除全图区的 9,000 个候选点外，内湖近岸与登良路附近另选取 121 个较矮或较小的树冠峰点，来自同一份 Meta / WRI 卫星树冠高度预测。补点位于已有树点之外，并避让建筑、水体及标绘道路。源研究为 *Version 2 High Resolution Canopy Height Maps (CHMv2)*（Meta and WRI，2026），按 CC BY 4.0 发布。Source imagery for CHM © 2016 Vantor. Accessed 21 November 2026. [树冠资料说明](../data/SOURCES.md) · [数据来源](https://registry.opendata.aws/dataforgood-fb-forestsv2/) · [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)

公园边界内另补入 56 个树冠峰点和 633 个连续林冠内的候选树位。后者依据连续的预测冠高与株距布置。可通过 `python scripts/geocanopy.py --park-infill` 从相同数据重建，近景网格和纹理可通过 `python scripts/foliage_build.py --close-only` 重建。

人才公园的灌木与草丛共用 `understory.webp`。枝梢和草簇从 Poly Haven 的 CC0 模型沿多个方向烘焙，近处的独立叶片保留叶脉，弯折草叶使用单根草叶的纹理。运行 `python scripts/shrub_sprays.py` 可重建图集。[Shrub 04](https://polyhaven.com/a/shrub_04) · [Grass Medium 01](https://polyhaven.com/a/grass_medium_01) · [Grass Medium 02](https://polyhaven.com/a/grass_medium_02) · [CC0 许可](https://polyhaven.com/license)
