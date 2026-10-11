# 大地图地理对齐说明（中国 LCC 全图）

HD 视觉地理以仓库中已有的 Wikimedia [China LCC topographic map - Without border](https://commons.wikimedia.org/wiki/File:China_LCC_topographic_map_-_Without_border.svg) 为主参考。作者为 Flappiefh（Natural Earth 数据），Augusta 89 制作去国界衍生，许可为 CC BY-SA 4.0。完整归属记录见 [reference/LICENSE.txt](reference/LICENSE.txt)。

本批沿用原有 [china-lcc-cities.json](china-lcc-cities.json)，不改地理投影、38 城 ID、名称、原生格坐标或经纬度定位。建安郡国图只作可选史实对照，见 [中国 LCC 城池对照](../../docs/china-lcc-city-alignment.md) 与 [建安郡国对照](../../docs/jianan-city-alignment.md)。

## 三种坐标各司其职

| 坐标 | 来源与用途 |
|---|---|
| 原生格 | `g_CityPositions` 和 `g_CityPos`；原引擎的格光标、城号和入城对齐 |
| LCC 世界像素 | `china-lcc-cities.json` 的 `hdX/hdY`；底图、装饰实例、道路和城标锚点 |
| 视口像素 | `(world - cameraOffset) * scale`；1920×1080 设计画布，再适配实际窗口 |

原生主图 `C_MAP` 是按原生地图宽度排列的 1-based 城号表。原生底图 `CITYMAP_TILE` 按格位置选择 16×16 图片槽，并未提供可直接投影到 LCC 的山、林、河语义表。战场地形也不承担主图定位。环境美术不能反过来修改原生格、入城目标、出征规则或归属。

## 投影与源栅格

沿用投影：

```text
+proj=eqdc +lat_1=22 +lat_2=50 +lon_0=105 +ellps=WGS84
```

SVG viewBox 为 1920×1654；出荷的完整源栅格为 3840×3309。没有为了 16:9 裁掉海南或源图南部。底图在源栅格以南延展同色海面到 3840×4000，使摄像机可以继续南移；这 691 像素不是从 Commons 源图取得的新增地理数据。许可记录说明了南侧定位小点的来源范围，不将它们说成源图自身的详细岛礁绘制。

沿用原有仿射与比例：

```text
x_svg =  3.842713776266e-04 * E + 1042.047274
y_svg = -3.871437493673e-04 * N + 2388.103445
worldX = x_svg / 1920 * 3840
worldY = y_svg / 1654 * 3309
```

城市锚点继续使用该表的既有结果，本批不重标定、不将城名画死进底图。

## 摄像机

世界矩形为 `fit.playableBounds = [0,0,3840,4000]`。1080p 画布是摄像机窗口；开局焦点围绕西凉—襄平—建业—成都，随后可以拖到云南、海南及南侧海面。

```text
scale ∈ [max(1920 / mapW, 1080 / mapH), 2.2]
offsetX ∈ [0, max(0, mapW - 1920 / scale)]
offsetY ∈ [0, max(0, mapH - 1080 / scale)]
screenX = (worldX - offsetX) * scale
screenY = (worldY - offsetY) * scale
```

拖动、松手和调整 scale 后都夹紧。视口从完整底图取样，四边不露出画布底色。1920×1080 与 1280×720 是同一设计画布的实际窗口验收范围，并不意味着把全国始终缩进一屏。

## manifest v7 环境对齐

`layers.environment` 的坐标系为 `china-lcc-raster-padded-v1`，`source` 为 `wikimedia-china-lcc-topographic`，`mapSize = [3840,4000]`，`rasterSize = [3840,3309]`。

| 层 | 图片像素 | 世界范围与实例 | opacity |
|---|---|---|---:|
| 河流 | 1920×1655 | 栅格映射到 `[0,0,3840,3309]` | 0.12 |
| 山峦 | 1254×1254 | 同一源栅格边界内的 10 个独立世界矩形 | 0.66 |
| 森林 | 1254×1254 | 同一源栅格边界内的 14 个独立世界矩形 | 0.62 |

河流的实际 PNG 高度是 1655，来自源图半尺度输出；必须以此真实尺寸和明确世界高度 3309 取样，不能简单假定整数 2 倍后拉到 4000。摄像机只看到世界矩形的一部分时，先求交集，再按原世界矩形换算源像素；位于 3309 以南的视口不绘制河流、山林装饰。山林实例先裁到源栅格，再裁到视口，源取样仍相对于未裁切的实例矩形，避免边缘图形被重拉伸。

这些山林是人工装饰放置，示意既有底图视觉，不是古代森林分布、地质测量或引擎地形分类。manifest 中海南 `[2370,3010,220,210]`、南侧海面 `[2760,3710,340,240]` 的区域框供源图和摄像机覆盖检查，也不是精确测绘边界。

堡城图片使用原有城市锚点；同一中性色原图供无主、己方和他方城使用，归属环由真实 `City.Belong` 驱动。道路和过河标记只作程序装饰，与上述环境图片、原生出征可达和地形代价分别处理。

## 来源与检查范围

`terrain/base_plains.jpg`、`reference/base_china_lcc_full.jpg` 与提取水体层保留 CC BY-SA 4.0 来源归属。新山林与堡城的完整生成提示词、原图路径、哈希和 alpha 检查见 [GENERATED-ART.md](GENERATED-ART.md)；它们未经图像后处理。

本次只更新说明与装饰清单语义，不修改地理表。图层单元测试与真实浏览器验收分别验证裁切、南侧海面、两分辨率显示和原生输入；具体通过记录由日志和证据文档承载。
