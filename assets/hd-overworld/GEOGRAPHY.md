# 大地图地理对齐说明（建安郡国图）

HD **视觉**地理以 Wikimedia **Jian'an Commanderies**（219 CE，Esiymbro，CC BY-SA 4.0）为严格参考。
城标、山河湖海、海岸都跟这张图的相对位置走，不再使用引擎 12×8 压缩格来摆 HD 城点。

引擎 `g_CityPositions` 仍只用于 WASM 规则 / 格光标 / 入城对齐，**不改 dat.lib**。

详见 [docs/jianan-city-alignment.md](../../docs/jianan-city-alignment.md)。

| 要素 | 布局 |
|------|------|
| 底图 | 建安图 16:9 裁切（凉州→岭南，黄河·长江核心），1920×1080 |
| 黄河 / 长江 / 淮河 / 湖泊 / 海 | 来自该图水体 |
| 山脉 | 该图自身的 shaded relief（秦岭、太行、南岭、四川缘等） |
| 城标 | `jianan-cities.json` 的史实 UV，不是引擎格线性映射 |

## 授权

衍生底图遵循 CC BY-SA 4.0，署名 Esiymbro / Wikimedia Commons。
`assets/hd-overworld/reference/LICENSE.txt`。
