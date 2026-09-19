# 大地图地理对齐说明（中国 LCC 全图）

HD **视觉**地理以 Wikimedia
[China LCC topographic map - Without border](https://commons.wikimedia.org/wiki/File:China_LCC_topographic_map_-_Without_border.svg)
为**主参考**（Flappiefh / Natural Earth；Augusta 89 去国界衍生，**CC BY-SA 4.0**）。
投影：`+proj=eqdc +lat_1=22 +lat_2=50 +lon_0=105 +ellps=WGS84`。

建安郡国图（Esiymbro）只保留作**可选史实对照**（郡治名称匹配），不再当可玩底图。
见 [docs/china-lcc-city-alignment.md](../../docs/china-lcc-city-alignment.md)
与 [docs/jianan-city-alignment.md](../../docs/jianan-city-alignment.md)。

引擎 `g_CityPositions` 仍只用于 WASM 规则 / 格光标 / 入城对齐，**不改 dat.lib**。
城名由游戏绘制（`baye.getCityName`），底图本身无标注。

| 要素 | 布局 |
|------|------|
| 底图 | 中国 LCC 地形全图，SVG `1920×1654` 宽锁定 1920 后竖裁 `cropTop=145` → 1920×1080 |
| 黄河 / 长江 / 湖泊 / 海 | 源图水体（无国界、无文字） |
| 山脉 | 源图自身的分层设色 / 地形起伏 |
| 城标 | `china-lcc-cities.json`：史实经纬度经 eqdc 投到**本裁切栅格**，不是引擎格线性映射 |

## 授权

`base_plains.png` 与 `reference/base_china_lcc_1920.png` 是上述 Commons 作品的 1920×1080 衍生，仍按 **CC BY-SA 4.0** 署名。
`assets/hd-overworld/reference/LICENSE.txt`。
