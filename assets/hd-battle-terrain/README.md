# PC 战场地形图集

`terrain-atlas-v1.png` 由内置图像生成一次绘制，按原始 PNG 字节保存。图集为 1536×1024，共六格，每格 512×512。第一排依次为草地、平原和河面。第二排依次为村庄、营寨和另一种河面纹理。棋盘取每格内侧 508×508 像素。

SHA-256 `72e03588bb79eaaf803fe185173d90d2d265d22f9046b390dcb895a559e1543a`

## 生成提示

```text
Use case: stylized-concept.
Asset type: one terrain texture atlas for a PC Three Kingdoms strategy game's native square battle grid.
Generate one opaque landscape 3:2 atlas of exactly six independent equal-sized square tiles in three columns and two rows. The divisions are precisely at x=1/3, x=2/3 and y=1/2 of the image. Each tile is filled edge to edge; no gutters, frames, outlines around tiles, text, labels, UI, numbers, watermarks, or objects crossing the divisions.
Top left: muted olive-green short grass with fine meadow texture, very few tiny tufts, quiet uniform value. Top center: warm desaturated ochre and sage plain with subtly curving narrow plough furrows, open flat ground. Top right: deep slate teal river surface entirely filled with water, delicate horizontal ripples, no shore or land.
Bottom left: small Han dynasty rural village, two modest clay-walled grey-tile-roof cottages with a short earth footpath on weathered olive-brown ground. Bottom center: an ancient Chinese field encampment with two distinct low tan cloth ridge tents and their small ground shadows on muted amber grass. Keep each village or camp grouped near the center and completely inside its tile with 13% padding on every side. Bottom right: a second quiet deep slate teal river surface, same palette and scale as top right, with slightly different gentle ripple placement, no shore or land.
Hand-painted muted topographic watercolor and soft ink, tactile paper grain, historic Chinese strategy-map style, near overhead view with shallow oblique roofs for legibility. Soft overcast lighting, medium-low contrast and controlled saturation so bright game-unit markers can sit above these backgrounds. No horizon, no sky, no figures, no modern structures, no borders, no text. Preserve all six tile assignments exactly.
```
