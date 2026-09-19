# 大地图地理对齐说明（中国 LCC 全图）

HD **视觉**地理以 Wikimedia
[China LCC topographic map - Without border](https://commons.wikimedia.org/wiki/File:China_LCC_topographic_map_-_Without_border.svg)
为**主参考**（Flappiefh / Natural Earth；Augusta 89 去国界衍生，**CC BY-SA 4.0**）。
投影：`+proj=eqdc +lat_1=22 +lat_2=50 +lon_0=105 +ellps=WGS84`。

**全图范围**含海南岛与南海（南沙一带），**不做 16:9 南裁**。
可玩纹理是全 SVG 的 3840×3309 栅格，南侧再垫一层同色海面到 3840×4000
（Wikimedia 图幅南缘在海南以南不远；南沙礁盘在该比例下为亚像素，用定位点标出）。
1080p 画布只是**摄像机窗口**。
开局对准西凉–襄平–建业–成都一带，不把全国塞进一屏。拖动平移，边界夹紧。

建安郡国图只作**可选史实对照**。见
[docs/china-lcc-city-alignment.md](../../docs/china-lcc-city-alignment.md)
与 [docs/jianan-city-alignment.md](../../docs/jianan-city-alignment.md)。

引擎 `g_CityPositions` 仍只用于 WASM 规则 / 格光标 / 入城对齐，**不改 dat.lib**。
城名由游戏绘制（`baye.getCityName`），底图本身无标注。

| 要素 | 布局 |
|------|------|
| 底图 | 中国 LCC 全图（含海南）+ 南海垫高，3840×4000，无竖裁 |
| 视口 | 1920×1080 摄像机；`offsetX/offsetY` + scale，可拖动 |
| 开局焦点 | 西凉–襄平–建业–成都（中东部三国核心） |
| 黄河 / 长江 / 湖泊 / 海 | 源图水体（无国界、无文字） |
| 山脉 | 源图自身的分层设色 / 地形起伏 |
| 城标 | `china-lcc-cities.json` 地图坐标；绘制为 `map - camera` |

## 授权

`terrain/base_plains.jpg` 与 `reference/base_china_lcc_full.jpg` 是上述 Commons 作品的全图衍生，**CC BY-SA 4.0**。
`assets/hd-overworld/reference/LICENSE.txt`。
