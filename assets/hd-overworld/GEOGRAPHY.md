# 大地图地理对齐说明（建安郡国图）

HD **视觉**地理以 Wikimedia **Jian'an Commanderies**（219 CE，Esiymbro，CC BY-SA 4.0）为严格参考。
城标、山河湖海、海岸都跟这张图的相对位置走，不再使用引擎 12×8 压缩格来摆 HD 城点。

引擎 `g_CityPositions` 仍只用于 WASM 规则 / 格光标 / 入城对齐，**不改 dat.lib**。

详见 [docs/jianan-city-alignment.md](../../docs/jianan-city-alignment.md)。

| 要素 | 布局 |
|------|------|
| 底图 | 建安图 16:9 裁切后 **去字**（郡名/州名/图例/比例尺已 inpaint），只留地形与水体，1920×1080 |
| 黄河 / 长江 / 淮河 / 湖泊 / 海 | 来自该图水体 |
| 山脉 | 该图自身的 shaded relief（秦岭、太行、南岭、四川缘等） |
| 城标 | `jianan-cities.json` 的史实 UV，不是引擎格线性映射 |

## 授权

`base_plains.png` 是 Esiymbro 建安图的 **去标注衍生图**（inpaint 掉原图文字与图例），仍按 **CC BY-SA 4.0** 署名。
完整带字参考图只放在 `assets/hd-overworld/reference/`，不进可玩 HD 底图。
`assets/hd-overworld/reference/LICENSE.txt`。
