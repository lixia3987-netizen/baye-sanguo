# MAIN 开场高清素材生成记录

日期：2026-10-08。使用内置 `image_gen.imagegen`，9次实际调用产生7张最终原图及2张拒收候选。五张背景为不透明RGB，两张正确的“霸”“业”标题为真实透明RGBA；生成尺寸保留，未裁切、拉伸、重编码或后处理。生产 PNG 逐 byte 等于各自原始输出，原输出保留在下列源路径。没有改变原生资源、引擎或游戏结果。

标准实际 LIB SHA-256：`3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e`。MAIN3/index0/kind1，范围0..8，9单元/7图片槽，完整payload11380 bytes，`fnv1a32:a5a91c68:11380`。背景逻辑尺寸160×96，标题5=52×64/mask1、6=59×49/mask1；坐标与全部单元由实际LIB读取，完整接线见manifest。生成图片是原生构图的HD美术解释，画布合成位置严格沿原生；没有宣称AI纹样逐像素复制。

生成前逐张查看输入。主任务独立查看全部7张最终输出及原生参考；“霸”和重新生成的“业”另经独立字形审查。槽1首版中心留白偏窄、槽6首版错误形似“止”，都拒收且未进入生产。以下完整记录区分原生构图、画风参考和拒收反例的角色。

## 七张已接入原图

```json
[
  {
    "picIndex": 0,
    "source": "C:\\Users\\75112\\.codex\\generated_images\\01a116e2-c940-7931-9e13-0a495970c85f\\exec-c154f3ef-cd0d-48cf-b510-f654870e26f7.png",
    "path": "assets/hd-spe/opening-3/picture-0.png",
    "width": 1619,
    "height": 971,
    "bytes": 3126376,
    "sha256": "ca8e3fdaa7d00c699ee5a78baf9767b281b4bd802880b17bdd04b2c7360c712c",
    "originalBytesPreserved": true,
    "mode": "RGB",
    "alphaZero": 0,
    "alphaNonZero": 1572049
  },
  {
    "picIndex": 1,
    "source": "C:\\Users\\75112\\.codex\\generated_images\\01a116e3-623c-7513-a5e0-580eb72033be\\exec-a326bd04-b265-4dce-8aea-fd8bdc31aeb7.png",
    "path": "assets/hd-spe/opening-3/picture-1.png",
    "width": 1619,
    "height": 971,
    "bytes": 2925930,
    "sha256": "950b18583e143b30d446b1ee696c5159eca8e0a5ce32661c0c2a668cfda3ca30",
    "originalBytesPreserved": true,
    "mode": "RGB",
    "alphaZero": 0,
    "alphaNonZero": 1572049
  },
  {
    "picIndex": 2,
    "source": "C:\\Users\\75112\\.codex\\generated_images\\01a116e3-623c-7513-a5e0-580eb72033be\\exec-d3a401ad-104d-4767-8173-1860cf74272e.png",
    "path": "assets/hd-spe/opening-3/picture-2.png",
    "width": 1619,
    "height": 972,
    "bytes": 3137328,
    "sha256": "c71a06decb6083f01e32c5316a9705d3d86fed1218ccc8fe326141c9647ee799",
    "originalBytesPreserved": true,
    "mode": "RGB",
    "alphaZero": 0,
    "alphaNonZero": 1573668
  },
  {
    "picIndex": 3,
    "source": "C:\\Users\\75112\\.codex\\generated_images\\01a116e3-623c-7513-a5e0-580eb72033be\\exec-26c040ed-b5cc-4335-b944-e1c2d99817d5.png",
    "path": "assets/hd-spe/opening-3/picture-3.png",
    "width": 1619,
    "height": 971,
    "bytes": 3222163,
    "sha256": "c5e54eab9d28dbf35352e424053c0ce1eaff0f98dd39b08309e43f4e2f3d7b12",
    "originalBytesPreserved": true,
    "mode": "RGB",
    "alphaZero": 0,
    "alphaNonZero": 1572049
  },
  {
    "picIndex": 4,
    "source": "C:\\Users\\75112\\.codex\\generated_images\\01a116e3-623c-7513-a5e0-580eb72033be\\exec-a50d2959-1ebf-4242-a987-53df7f9822d6.png",
    "path": "assets/hd-spe/opening-3/picture-4.png",
    "width": 1619,
    "height": 971,
    "bytes": 3336598,
    "sha256": "495e09b718b1fefe1db8fbe5c77d7c5de1af4518c837a38b2f3f6161b15eeb66",
    "originalBytesPreserved": true,
    "mode": "RGB",
    "alphaZero": 0,
    "alphaNonZero": 1572049
  },
  {
    "picIndex": 5,
    "source": "C:\\Users\\75112\\.codex\\generated_images\\01a116e2-c940-7931-9e13-0a495970c85f\\exec-c2e2b90b-95ac-40b5-b879-8ff49db26c8c.png",
    "path": "assets/hd-spe/opening-3/picture-5.png",
    "width": 1131,
    "height": 1391,
    "bytes": 2121734,
    "sha256": "938cb75bcf92012e5f4ea4ba3f83d9dae86e1836c0680862ae3c4a4f7ede6781",
    "originalBytesPreserved": true,
    "mode": "RGBA",
    "alphaZero": 874998,
    "alphaNonZero": 698223
  },
  {
    "picIndex": 6,
    "source": "C:\\Users\\75112\\.codex\\generated_images\\01a116e2-c940-7931-9e13-0a495970c85f\\exec-87a9a874-cac7-41ee-a042-bbee16c242dc.png",
    "path": "assets/hd-spe/opening-3/picture-6.png",
    "width": 1376,
    "height": 1143,
    "bytes": 1588240,
    "sha256": "abba246ea46c5294fe13793a0e2f5ef0e08cf997d2970452b62bc7ef34b36295",
    "originalBytesPreserved": true,
    "mode": "RGBA",
    "alphaZero": 1019823,
    "alphaNonZero": 552945
  }
]
```

## 主任务的四次实际调用

```json
{
  "picIndex": 0,
  "tool": "image_gen.imagegen",
  "prompt": "Use case: historical-scene. Asset type: 三国霸业 PC HD 开场 MAIN_SPE=3 的不透明背景图片槽0；这是5幅开合画面中的首幅静止图，不是分镜接触表。\nInput image 1 is the actual standard LIB's native 160×96 bitmap, used only for exact composition, panel positions, ornamental motifs and the closed state. Input image 2 is the accepted period-one Cao Cao HD portrait, used ONLY for the restrained historical rendering style, dark warm materials and antique-gold palette, never its person or portrait layout.\nCreate one high-resolution landscape image intended to map to the whole logical 160×96 stage (approximately 5:3). Faithfully reinterpret the native image's two tall symmetrical ornamental panels filling the left and right halves, with the narrow vertical central stiles and closed seam; keep the fixed, straight-on camera, full-height panels and native panel boundaries. The decoration should read as restrained Chinese cloud-and-dragon scroll carving or brocade, based on the repeated motifs in the tiny reference, with dark charcoal-brown surfaces and subtle aged bronze/gold relief. Use the accepted game's realistic historical painting treatment and subdued texture, with no scene change. The frame is a simple close view of the ornamental opening screen itself; no extra architecture, environment, people, horses, weapons, fire or story scene. Preserve enough dark contrast for separate title layers, but DO NOT paint title lettering into this background.\nConstraints: one single final background frame, completely opaque, all composition intact to the image bounds, no visible UI, no border card, no text, no Chinese characters, no logo, no watermark, no collage or multiple panels in a contact sheet. Do not simply upscale or copy the native pixels. Do not crop or alter any existing project image. Match the native closed panel geometry rather than inventing an unrelated cinematic cover.\n",
  "transparent_background": false,
  "referenced_image_paths": [
    "F:\\project\\baye-sanguo\\build\\hd-spe-native\\opening-3-picture-0.png",
    "F:\\project\\baye-sanguo\\assets\\hd-portraits\\hd\\hd_p1_0001_曹操.png"
  ],
  "inputs": [
    {
      "role": "Authoritative native slot0 composition",
      "path": "F:\\project\\baye-sanguo\\build\\hd-spe-native\\opening-3-picture-0.png",
      "bytes": 2549,
      "sha256": "fd436faf4c7132cbacc6563564c86decdda42bd32e2c35dc376984754d037adb",
      "width": 160,
      "height": 96,
      "mode": "RGBA",
      "alphaZero": 0,
      "alphaNonZero": 15360
    },
    {
      "role": "Accepted restrained historical colour/style only; never subject",
      "path": "F:\\project\\baye-sanguo\\assets\\hd-portraits\\hd\\hd_p1_0001_曹操.png",
      "bytes": 1227801,
      "sha256": "e75fdd2ebeec7464e85291c99cd48cd2602d96f52963205899fc16e40fd11895",
      "width": 1280,
      "height": 720,
      "mode": "RGB",
      "alphaZero": 0,
      "alphaNonZero": 921600
    }
  ],
  "output": {
    "path": "C:\\Users\\75112\\.codex\\generated_images\\01a116e2-c940-7931-9e13-0a495970c85f\\exec-c154f3ef-cd0d-48cf-b510-f654870e26f7.png",
    "bytes": 3126376,
    "sha256": "ca8e3fdaa7d00c699ee5a78baf9767b281b4bd802880b17bdd04b2c7360c712c",
    "width": 1619,
    "height": 971,
    "mode": "RGB",
    "alphaZero": 0,
    "alphaNonZero": 1572049
  },
  "accepted": true,
  "review": "Full opaque paired ornamental panels and narrow seam, no people or text; all original output bytes retained."
}
```

```json
{
  "picIndex": 5,
  "tool": "image_gen.imagegen",
  "prompt": "Use case: logo-brand, a faithful raster remake of an existing game title glyph. Asset type: transparent MAIN_SPE=3 title picture slot5 for 三国霸业 PC HD. Create exactly ONE Chinese character: \"霸\" (Unicode U+9738). No other characters, words, badges, background or UI.\nInput image 1 is the actual native transparent 52×64 bitmap of the character 霸, the authoritative reference for the correct character, readable stroke structure, full glyph outline and placement. Input image 2 is the selected HD opening background frame0, used ONLY for restrained antique-gold material and historical tone; do not include its door panels, pattern, background, scenery or centre seam in this glyph asset.\nDraw a single large, unmistakably correct Chinese brush-calligraphy 霸 on a genuinely transparent alpha background. Respect the original game's stout, energetic calligraphy and visible stroke hierarchy; polish the edges at high resolution rather than reproducing pixels. The strokes are aged light ivory with restrained antique-gold edge highlights and a very thin dark charcoal contour for contrast over dark opening panels. Keep this as elegant flat-to-subtle-relief game typography, no bulky 3D pedestal, props or swirls. Entire character visible, centred within a portrait canvas matching the native 52:64 (13:16) slot proportions, with small transparent safety margins on every side and no cropping of any stroke. Render one glyph only, not a contact sheet. Background must be actual transparency, no black/white/colour rectangle, painted checkerboard, drop-shadow field or watermark. Do not add 三国 or 业: they are separate from this precise native slot.\n",
  "transparent_background": true,
  "referenced_image_paths": [
    "F:\\project\\baye-sanguo\\build\\hd-spe-native\\opening-3-picture-5.png",
    "C:\\Users\\75112\\.codex\\generated_images\\01a116e2-c940-7931-9e13-0a495970c85f\\exec-c154f3ef-cd0d-48cf-b510-f654870e26f7.png"
  ],
  "inputs": [
    {
      "role": "Authoritative native simplified 霸 title silhouette and placement",
      "path": "F:\\project\\baye-sanguo\\build\\hd-spe-native\\opening-3-picture-5.png",
      "bytes": 837,
      "sha256": "c5dfc2860b11d1d010bbc84406df7acc34df348bde3c92f9e1fea5714131c1df",
      "width": 52,
      "height": 64,
      "mode": "RGBA",
      "alphaZero": 1195,
      "alphaNonZero": 2133
    },
    {
      "role": "Colour/material continuity only",
      "path": "C:\\Users\\75112\\.codex\\generated_images\\01a116e2-c940-7931-9e13-0a495970c85f\\exec-c154f3ef-cd0d-48cf-b510-f654870e26f7.png",
      "bytes": 3126376,
      "sha256": "ca8e3fdaa7d00c699ee5a78baf9767b281b4bd802880b17bdd04b2c7360c712c",
      "width": 1619,
      "height": 971,
      "mode": "RGB",
      "alphaZero": 0,
      "alphaNonZero": 1572049
    }
  ],
  "output": {
    "path": "C:\\Users\\75112\\.codex\\generated_images\\01a116e2-c940-7931-9e13-0a495970c85f\\exec-c2e2b90b-95ac-40b5-b879-8ff49db26c8c.png",
    "bytes": 2121734,
    "sha256": "938cb75bcf92012e5f4ea4ba3f83d9dae86e1836c0680862ae3c4a4f7ede6781",
    "width": 1131,
    "height": 1391,
    "mode": "RGBA",
    "alphaZero": 874998,
    "alphaNonZero": 698223
  },
  "accepted": true,
  "review": "Root and independent reviewer can read 霸; complete strokes and genuine alpha margins."
}
```

```json
{
  "picIndex": 6,
  "tool": "image_gen.imagegen",
  "prompt": "Use case: logo-brand, a faithful raster remake of an existing game title glyph. Asset type: transparent MAIN_SPE=3 title picture slot6 for 三国霸业 PC HD. Create exactly ONE simplified Chinese character: \"业\" (Unicode U+4E1A). Never use the traditional 業, never add 霸 or 三国, and never create a wordmark containing multiple characters.\nInput image 1 is the actual native transparent 59×49 bitmap of 业, authoritative for the exact simplified character, stout brushstroke layout, full outline and placement. Input image 2 is the selected HD transparent 霸 glyph from the same two-layer title, used ONLY for consistent ivory/aged-gold ink, delicate charcoal contour, brush texture and highlight treatment; do not copy its character or add its strokes. Input image 3 is the selected opaque HD opening background frame0, used only for historical colour/material harmony; do not include its panels, background or pattern.\nMake a single large readable calligraphic 业, matching the previous 霸 glyph's energetic Chinese brush style, warm aged-light-ivory surface and restrained antique-gold edge highlights with a very thin dark charcoal outline. Keep the original reference's recognizable central vertical structure, opposing upper strokes and broad lower baseline; correctness of 业 is more important than decoration. The whole glyph is centred on a transparent landscape canvas with approximately native 59:49 proportions; maintain small clear alpha margins on every side and never cut a stroke. No bulky stand, floating props, flourishes, scene, frame, UI, extra lettering or watermark. The background must be genuine alpha transparency including between the strokes, with no coloured rectangle and no checkerboard drawn into the picture. One final title-layer image, not a contact sheet.\n",
  "transparent_background": true,
  "referenced_image_paths": [
    "F:\\project\\baye-sanguo\\build\\hd-spe-native\\opening-3-picture-6.png",
    "C:\\Users\\75112\\.codex\\generated_images\\01a116e2-c940-7931-9e13-0a495970c85f\\exec-c2e2b90b-95ac-40b5-b879-8ff49db26c8c.png",
    "C:\\Users\\75112\\.codex\\generated_images\\01a116e2-c940-7931-9e13-0a495970c85f\\exec-c154f3ef-cd0d-48cf-b510-f654870e26f7.png"
  ],
  "inputs": [
    {
      "role": "Authoritative native simplified 业 title silhouette and placement",
      "path": "F:\\project\\baye-sanguo\\build\\hd-spe-native\\opening-3-picture-6.png",
      "bytes": 619,
      "sha256": "1761548c19c96a9dc40ea3007d6ba2e50981cf7c8d76975b8fdb8fb0f95d72ad",
      "width": 59,
      "height": 49,
      "mode": "RGBA",
      "alphaZero": 1379,
      "alphaNonZero": 1512
    },
    {
      "role": "Companion title style only, not its strokes",
      "path": "C:\\Users\\75112\\.codex\\generated_images\\01a116e2-c940-7931-9e13-0a495970c85f\\exec-c2e2b90b-95ac-40b5-b879-8ff49db26c8c.png",
      "bytes": 2121734,
      "sha256": "938cb75bcf92012e5f4ea4ba3f83d9dae86e1836c0680862ae3c4a4f7ede6781",
      "width": 1131,
      "height": 1391,
      "mode": "RGBA",
      "alphaZero": 874998,
      "alphaNonZero": 698223
    },
    {
      "role": "Historical colour only, not panels",
      "path": "C:\\Users\\75112\\.codex\\generated_images\\01a116e2-c940-7931-9e13-0a495970c85f\\exec-c154f3ef-cd0d-48cf-b510-f654870e26f7.png",
      "bytes": 3126376,
      "sha256": "ca8e3fdaa7d00c699ee5a78baf9767b281b4bd802880b17bdd04b2c7360c712c",
      "width": 1619,
      "height": 971,
      "mode": "RGB",
      "alphaZero": 0,
      "alphaNonZero": 1572049
    }
  ],
  "output": {
    "path": "C:\\Users\\75112\\.codex\\generated_images\\01a116e2-c940-7931-9e13-0a495970c85f\\exec-20f66b50-6600-4aeb-ac30-b67c0787c138.png",
    "bytes": 1575635,
    "sha256": "8fc4c1d21bc645d95fbff6029309f51763c622ebda5d83956e6df381b7ce996b",
    "width": 1376,
    "height": 1143,
    "mode": "RGBA",
    "alphaZero": 1028191,
    "alphaNonZero": 544577
  },
  "accepted": false,
  "review": "Rejected independently: one dominant upright makes this read 止, missing the two main uprights required for 业. No production use."
}
```

```json
{
  "picIndex": 6,
  "tool": "image_gen.imagegen",
  "prompt": "Use case: logo-brand. A faithful high-resolution raster remake of the game's transparent Chinese title glyph MAIN_SPE=3 picture6. Create exactly one simplified Chinese character 业 (Unicode U+4E1A), correct and instantly readable. Character correctness takes precedence over every decorative detail.\nImage 1 is the authoritative actual native 59×49 bitmap: preserve the whole character silhouette and its broad bottom horizontal stroke. Image 2 is the selected transparent 霸 title glyph, style reference ONLY: same ivory-gold brush texture, subtle aged gold edges and thin charcoal contour. Never copy 霸 or add any other letters. Image 3 is a rejected 业 attempt, supplied ONLY to identify the error to correct: it has one dominant central upright and much shorter left upright and reads like 止. DO NOT copy that incorrect stroke structure.\nDraw the correct simplified 业 with TWO prominent separate nearly equally tall upright vertical strokes, a small short diagonal stroke on the outer left, a small short diagonal stroke on the outer right, and the broad horizontal baseline joining the two uprights. Both main uprights must clearly extend high above both outer small strokes. Keep a clear gap between the two uprights above the baseline. Do not collapse the two main uprights into one. No middle horizontal crossbar. Never draw 止, 上, 並, or traditional 業.\nUse restrained energetic Chinese brush calligraphy; warm light ivory ink with antique gold highlights and a thin dark contour consistent with the companion 霸. Landscape composition approximately 59:49. Centre the entire single glyph with clear transparent margins; include every stroke without clipping. True transparent alpha around and between the strokes. No background, frame, platform, ornament, extra characters, watermark, fake checkerboard or contact sheet. Return one final transparent PNG title layer.\n",
  "transparent_background": true,
  "referenced_image_paths": [
    "F:\\project\\baye-sanguo\\build\\hd-spe-native\\opening-3-picture-6.png",
    "C:\\Users\\75112\\.codex\\generated_images\\01a116e2-c940-7931-9e13-0a495970c85f\\exec-c2e2b90b-95ac-40b5-b879-8ff49db26c8c.png",
    "C:\\Users\\75112\\.codex\\generated_images\\01a116e2-c940-7931-9e13-0a495970c85f\\exec-20f66b50-6600-4aeb-ac30-b67c0787c138.png"
  ],
  "inputs": [
    {
      "role": "Authoritative native 业 silhouette",
      "path": "F:\\project\\baye-sanguo\\build\\hd-spe-native\\opening-3-picture-6.png",
      "bytes": 619,
      "sha256": "1761548c19c96a9dc40ea3007d6ba2e50981cf7c8d76975b8fdb8fb0f95d72ad",
      "width": 59,
      "height": 49,
      "mode": "RGBA",
      "alphaZero": 1379,
      "alphaNonZero": 1512
    },
    {
      "role": "Companion title colour and brush texture only",
      "path": "C:\\Users\\75112\\.codex\\generated_images\\01a116e2-c940-7931-9e13-0a495970c85f\\exec-c2e2b90b-95ac-40b5-b879-8ff49db26c8c.png",
      "bytes": 2121734,
      "sha256": "938cb75bcf92012e5f4ea4ba3f83d9dae86e1836c0680862ae3c4a4f7ede6781",
      "width": 1131,
      "height": 1391,
      "mode": "RGBA",
      "alphaZero": 874998,
      "alphaNonZero": 698223
    },
    {
      "role": "Rejected example only; explicit stroke correction, not accepted structure",
      "path": "C:\\Users\\75112\\.codex\\generated_images\\01a116e2-c940-7931-9e13-0a495970c85f\\exec-20f66b50-6600-4aeb-ac30-b67c0787c138.png",
      "bytes": 1575635,
      "sha256": "8fc4c1d21bc645d95fbff6029309f51763c622ebda5d83956e6df381b7ce996b",
      "width": 1376,
      "height": 1143,
      "mode": "RGBA",
      "alphaZero": 1028191,
      "alphaNonZero": 544577
    }
  ],
  "output": {
    "path": "C:\\Users\\75112\\.codex\\generated_images\\01a116e2-c940-7931-9e13-0a495970c85f\\exec-87a9a874-cac7-41ee-a042-bbee16c242dc.png",
    "bytes": 1588240,
    "sha256": "abba246ea46c5294fe13793a0e2f5ef0e08cf997d2970452b62bc7ef34b36295",
    "width": 1376,
    "height": 1143,
    "mode": "RGBA",
    "alphaZero": 1019823,
    "alphaNonZero": 552945
  },
  "accepted": true,
  "review": "Independent review confirms 业: two separate prominent uprights, outer dots and broad bottom horizontal; every stroke complete."
}
```

## 背景槽1至4的完整调用记录

# R07 MAIN 开场背景生成记录

日期：2026-10-08。

本记录仅覆盖本代理负责的 MAIN_SPE=3/index0 图片槽1、2、3、4。使用内置 `image_gen.imagegen`，5次实际调用，4个最终候选和1个拒收候选；槽1因中央开合几何偏差重试一次。槽0由主任务提供作为固定画风参考，不计入这里的5次调用，其生成提示词由主任务单独记录。原生成源均保留，未删除、裁切、缩放、重编码或写入生产 assets；由主任务复制最终原始 PNG 字节并接入。

标准 LIB：`libs/dat-mod.lib`，207195 bytes，SHA-256 `3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e`。MAIN 完整 payload 11380 bytes，`fnv1a32:a5a91c68:11380`，SPERES 9个时间单元/7个图片槽。原生槽0..4尺寸均160×96、mask0；槽5为“霸”52×64/mask1，坐标20,15；槽6为“业”59×49/mask1，坐标90,25。背景生成不包含这两个标题，标题另由主任务生成/验证。

Fresh 解码审计：`build/r07-spe-resource-audit.json`，SHA-256 `18c9d8c46a362a5f7a19e245f54e24dffadad67e91ca68cf1eb82b3d2414ee09`。新解码七 MAIN 图逐 RGBA 像素与 `build/r07-opening-baseline/native-reference/MAIN3-picture-0..6.png` 一致；旧 `build/hd-spe-native` 仅调色不同，点阵与alpha一致。原生参考是实际格式逐位面解码，不是AI图或原生放大冒充HD。

## 固定槽0画风输入

```json
{
  "path": "C:/Users/75112/.codex/generated_images/01a116e2-c940-7931-9e13-0a495970c85f/exec-c154f3ef-cd0d-48cf-b510-f654870e26f7.png",
  "bytes": 3126376,
  "sha256": "ca8e3fdaa7d00c699ee5a78baf9767b281b4bd802880b17bdd04b2c7360c712c",
  "dimensions": [
    1619,
    971
  ],
  "mode": "RGB"
}
```

实际 view：旧暗铜材质、柔侧光、低亮度暗金云纹浮雕，中央窄直缝，面板边到边铺满。它只锁定材质、纹样和镜头，不覆盖后续槽的原生几何。

## 四个最终背景

| 槽 | 原始生成源文件名 | 原始尺寸 | 字节数 | SHA-256 |
| --- | --- | --- | --- | --- |
| 1 | exec-a326bd04-b265-4dce-8aea-fd8bdc31aeb7.png | 1619×971 RGB | 2925930 | 950b18583e143b30d446b1ee696c5159eca8e0a5ce32661c0c2a668cfda3ca30 |
| 2 | exec-d3a401ad-104d-4767-8173-1860cf74272e.png | 1619×972 RGB | 3137328 | c71a06decb6083f01e32c5316a9705d3d86fed1218ccc8fe326141c9647ee799 |
| 3 | exec-26c040ed-b5cc-4335-b944-e1c2d99817d5.png | 1619×971 RGB | 3222163 | c5e54eab9d28dbf35352e424053c0ce1eaff0f98dd39b08309e43f4e2f3d7b12 |
| 4 | exec-a50d2959-1ebf-4242-a987-53df7f9822d6.png | 1619×971 RGB | 3336598 | 495e09b718b1fefe1db8fbe5c77d7c5de1af4518c837a38b2f3f6161b15eeb66 |

所有最终原图超过100×100，四个哈希唯一，均与160×96原生参考不同。逻辑映射目标保持160×96，不通过离线resize修正生成器输出的一像素高度差。以下尺寸与哈希均从实际 PNG 原始字节计算。

## 槽1 最终调用（第二次，修正几何）

输出原文件：

```json
{
  "path": "C:/Users/75112/.codex/generated_images/01a116e3-623c-7513-a5e0-580eb72033be/exec-a326bd04-b265-4dce-8aea-fd8bdc31aeb7.png",
  "bytes": 2925930,
  "sha256": "950b18583e143b30d446b1ee696c5159eca8e0a5ce32661c0c2a668cfda3ca30",
  "dimensions": [
    1619,
    971
  ],
  "mode": "RGB"
}
```

实际调用参数：`transparent_background:false`；`num_last_images_to_include` 未使用；引用路径按以下顺序传入 `referenced_image_paths`。全部输入在本次生成前已使用 `view_image` 查看。

```json
[
  {
    "path": "F:/project/baye-sanguo/build/r07-spe-native/resource-3-index-0-picture-1.png",
    "bytes": 1786,
    "sha256": "4b00d9a976264116d70cc7f9c442216cab1b67d9a5c9c3dc7cff8e84cb392181",
    "dimensions": [
      160,
      96
    ],
    "mode": "RGBA",
    "rawSlotSha256": "26c6b10a02ba6bf1844c35fde9daef110adce351a0d86d5eece69dff743b5534",
    "role": "authoritative native slot1 geometry/spacing; not a style reference",
    "viewedBeforeCall": true
  },
  {
    "path": "C:/Users/75112/.codex/generated_images/01a116e2-c940-7931-9e13-0a495970c85f/exec-c154f3ef-cd0d-48cf-b510-f654870e26f7.png",
    "bytes": 3126376,
    "sha256": "ca8e3fdaa7d00c699ee5a78baf9767b281b4bd802880b17bdd04b2c7360c712c",
    "dimensions": [
      1619,
      971
    ],
    "mode": "RGB",
    "role": "accepted root HD slot0 material/palette/cloud pattern/camera only",
    "viewedBeforeCall": true
  }
]
```

完整 exact prompt：

```text
Use case: stylized-concept.
Asset type: exact composition replacement for one full-screen bitmap slot in the historical Three Kingdoms game Baye.
Primary request: Generate MAIN opening decorative panel picture slot 1, one independent still in the same five-frame sequence as the accepted HD slot 0. A landscape canvas matching the native 160:96 (5:3) full-stage composition, opaque.
Input images: Image 1 is the authoritative native slot 1 bitmap; use ONLY it to determine this frame's panel geometry, lateral spacing, symmetry, line positions and empty central band. Image 2 is the accepted HD slot 0; use it ONLY to lock the same aged dark bronze, subdued antique gold embossed cloud ornament, fine wear, subdued soft side lighting, straight-on camera and surface material. It must not override the slot 1 geometry.
Composition: preserve the native exact spatial relationship. Here the paired cloud-patterned panels have moved laterally toward the outside, leaving a broad unadorned central vertical band between their inner borders. Keep the cloud relief on both outer panel portions, retain the paired thin vertical inner border strips in the positions given by Image 1. The center is a flat, quiet dark bronze/lacquer interior surface, no doorway scenery and no vignette swallowing native details. Entire ornament panel area runs edge to edge and top to bottom like the supplied native bitmap, not a framed illustration floating on a background.
Style/material continuity: recreate the same repeating cloud curls and weathered dark-gold relief language of Image 2 at a consistent scale, contrast, line thickness and color. Only panel pose and open spacing change for this native frame. No narrative extrapolation.
Constraints: one complete landscape raster; straight-on view; no characters, people, horses, weapons, buildings, terrain, landscape or battle scene; no text, letters, calligraphy, title, logos, watermark, UI, captions or extra frames; no transparent background; do not add a literal room through the center; do not crop off or reposition the native structural borders. High detail without modern glossy gold.
Targeted geometry correction: the previous candidate made the plain central opening only about23% of canvas width, too narrow. Native source has strong full-height borders at logical x39/40 and48 on left, x111 and119 on right. Thus preserve plain center logical x49..110, approximately 39% of the whole width. Left cloud panel occupies outer x0..39 (about25% width), left border x40..48 (about6%); right border x111..119 (about6%), right cloud panel x120..159 (about25%). On a1619px-wide output, central plain interior begins near496px and ends near1123px, not at620..986. Move both inner borders outward to that corrected layout, keeping the same warm dark gold relief material and repeating cloud motifs. Both outer panels shrink in visible width rather than scaling all cloud ornaments larger. Native geometry Image1 controls the layout; style Image2 never changes the required center width.
```

实际 view：云纹双侧面板和直边框完整铺满画幅；修正版中央平素材质带明显拓宽，接近原生 x49..110 的约39%横向比例。暗金云纹、旧铜底材、柔侧光与槽0连续，无人、马、山水、文字或UI。并不宣称生成图与160×96点阵轮廓逐像素一致。

## 槽2 最终调用

输出原文件：

```json
{
  "path": "C:/Users/75112/.codex/generated_images/01a116e3-623c-7513-a5e0-580eb72033be/exec-d3a401ad-104d-4767-8173-1860cf74272e.png",
  "bytes": 3137328,
  "sha256": "c71a06decb6083f01e32c5316a9705d3d86fed1218ccc8fe326141c9647ee799",
  "dimensions": [
    1619,
    972
  ],
  "mode": "RGB"
}
```

实际调用参数：`transparent_background:false`；`num_last_images_to_include` 未使用；引用路径按以下顺序传入 `referenced_image_paths`。全部输入在本次生成前已使用 `view_image` 查看。

```json
[
  {
    "path": "F:/project/baye-sanguo/build/r07-spe-native/resource-3-index-0-picture-2.png",
    "bytes": 2972,
    "sha256": "a1a60745b2ff55a3ef602bbf7f4cb5f8f8c740665a4fabee3eeaadf549e0fbf6",
    "dimensions": [
      160,
      96
    ],
    "mode": "RGBA",
    "rawSlotSha256": "be7a35d076d000117156c2c29f5cc3ed6b899d6c002f1592f2c60d38e3306800",
    "role": "authoritative native slot2 geometry/dragon silhouette; not a style reference",
    "viewedBeforeCall": true
  },
  {
    "path": "C:/Users/75112/.codex/generated_images/01a116e2-c940-7931-9e13-0a495970c85f/exec-c154f3ef-cd0d-48cf-b510-f654870e26f7.png",
    "bytes": 3126376,
    "sha256": "ca8e3fdaa7d00c699ee5a78baf9767b281b4bd802880b17bdd04b2c7360c712c",
    "dimensions": [
      1619,
      971
    ],
    "mode": "RGB",
    "role": "accepted root HD slot0 fixed material/palette/cloud pattern/camera only",
    "viewedBeforeCall": true
  },
  {
    "path": "C:/Users/75112/.codex/generated_images/01a116e3-623c-7513-a5e0-580eb72033be/exec-a326bd04-b265-4dce-8aea-fd8bdc31aeb7.png",
    "bytes": 2925930,
    "sha256": "950b18583e143b30d446b1ee696c5159eca8e0a5ce32661c0c2a668cfda3ca30",
    "dimensions": [
      1619,
      971
    ],
    "mode": "RGB",
    "role": "accepted HD slot1 immediate preceding-frame material/pattern continuity",
    "viewedBeforeCall": true
  }
]
```

完整 exact prompt：

```text
Use case: stylized-concept.
Asset type: Baye Three Kingdoms game's MAIN opening full-stage decorative bitmap slot 2, one complete still of an existing native five-picture sequence.
Primary request: Render exactly the paired cloud/dragon ornament geometry of native reference Image 1 as high-detail aged dark bronze and subdued antique gold relief, on an opaque landscape 160:96 (5:3) canvas. Do not invent a narrative scene.
Input images: Image 1 is authoritative native slot 2 for this frame's shapes, positions, panel orientation, outer vertical borders and quiet central field. Image 2 is accepted HD slot 0 for material, cloud ornament scale, palette, soft side lighting, straight-on camera, restrained contrast, and fine wear ONLY. Image 3 is accepted HD slot 1 for immediate preceding-frame continuity of the exact same surface and repeating cloud pattern; it must not override slot 2 geometry.
Composition: retain the narrow outer cloud-patterned strips at far left/right and their thin straight vertical border lines from Image 1. Two ornate dragon-patterned paired panels appear inside these outer borders, with their long inner edges curving/angling away from the center, wider near the top and reaching closer toward the bottom-side borders, exactly following the native silhouette. Each angled panel carries dense intertwined dragon-and-cloud relief without turning into an actual creature in space. Leave a broad plain quiet dark-bronze center between the two inner diagonal/curved edges, matching Image 1. All geometric ornament fills the whole canvas edge-to-edge/top-to-bottom with no separate picture frame or scenery.
Continuity: same dark aged bronze backing and muted antique-gold cloud curls as Image 2 and3, the same scale and relief depth; add dragon relief only where the native slot 2 shows it, retaining its curves and placement. Keep outer ornament bands at the native positions, not a newly centered closed panel like Image 2.
Constraints: straight-on viewing of decorative panels; exactly one landscape raster still; no people, portraits, soldiers, horses, battle, weapon, room, building, mountains, trees, sky or landscape; no title, Chinese characters, letters, calligraphy, logo, watermark, UI, captions, modern glossy gold or extra frames; no transparent background. The native reference defines geometry, HD references define material only.
```

实际 view：两侧窄直框保留，内侧龙云鳞纹浮雕呈由上向下外展的双斜面，中央为平素旧铜区域；云卷和金铜色材与前两槽连续。龙纹是面板浮雕，未添加人马或场景。原始输出高度972是内置生成器结果，未裁切或缩放。

## 槽3 最终调用

输出原文件：

```json
{
  "path": "C:/Users/75112/.codex/generated_images/01a116e3-623c-7513-a5e0-580eb72033be/exec-26c040ed-b5cc-4335-b944-e1c2d99817d5.png",
  "bytes": 3222163,
  "sha256": "c5e54eab9d28dbf35352e424053c0ce1eaff0f98dd39b08309e43f4e2f3d7b12",
  "dimensions": [
    1619,
    971
  ],
  "mode": "RGB"
}
```

实际调用参数：`transparent_background:false`；`num_last_images_to_include` 未使用；引用路径按以下顺序传入 `referenced_image_paths`。全部输入在本次生成前已使用 `view_image` 查看。

```json
[
  {
    "path": "F:/project/baye-sanguo/build/r07-spe-native/resource-3-index-0-picture-3.png",
    "bytes": 3167,
    "sha256": "c8d373741395b45b7c396e6f85bffac73617ea39cb560c12178fd93cd8be802a",
    "dimensions": [
      160,
      96
    ],
    "mode": "RGBA",
    "rawSlotSha256": "288235440f36ccd47a0efb3ab78a00b27211575705aec55447d7b8be5faa0833",
    "role": "authoritative native slot3 geometry/dragon contours; not a style reference",
    "viewedBeforeCall": true
  },
  {
    "path": "C:/Users/75112/.codex/generated_images/01a116e2-c940-7931-9e13-0a495970c85f/exec-c154f3ef-cd0d-48cf-b510-f654870e26f7.png",
    "bytes": 3126376,
    "sha256": "ca8e3fdaa7d00c699ee5a78baf9767b281b4bd802880b17bdd04b2c7360c712c",
    "dimensions": [
      1619,
      971
    ],
    "mode": "RGB",
    "role": "accepted root HD slot0 fixed material/palette/cloud pattern/camera only",
    "viewedBeforeCall": true
  },
  {
    "path": "C:/Users/75112/.codex/generated_images/01a116e3-623c-7513-a5e0-580eb72033be/exec-d3a401ad-104d-4767-8173-1860cf74272e.png",
    "bytes": 3137328,
    "sha256": "c71a06decb6083f01e32c5316a9705d3d86fed1218ccc8fe326141c9647ee799",
    "dimensions": [
      1619,
      972
    ],
    "mode": "RGB",
    "role": "accepted HD slot2 immediate preceding-frame relief/motif continuity",
    "viewedBeforeCall": true
  }
]
```

完整 exact prompt：

```text
Use case: stylized-concept.
Asset type: Baye historical Three Kingdoms game, MAIN opening fullstage bitmap slot 3, independent still in the same native five-picture decorative sequence.
Primary request: Render the actual native slot 3 paired cloud/dragon panels as aged dark bronze and restrained antique gold embossed relief, opaque landscape 160:96 (5:3) canvas. Follow the exact native silhouettes and their placement.
Input images: Image 1 is the authoritative native slot 3; it alone dictates the evolving paired panel geometry, dragon contour, spacing, and plain central field. Image 2 is the accepted HD slot 0; it dictates only aged bronze surface, repeating cloud curls, dim warm antique-gold relief, wear, soft side lighting, straight-on camera, contrast and color. Image 3 is the accepted preceding HD slot 2, to retain material and repeating dragon/cloud motif continuity, while changing this frame's geometry according to Image 1.
Composition: preserve the narrow outer ornament strips with thin upright borders at both far sides from Image 1. Relative to preceding slot 2, the two central dragon-patterned decorative surfaces now project farther toward the center in the upper and middle portions, with broad curling dragon-relief silhouettes and sinuous inner edges matching the source; lower portions remain separated by a plain, widening central wedge. Dragons are integral embossed carvings on paired decorative surfaces, with Chinese dragon facial/body motifs where the native contour shows them, not free-flying animals. The native spatial structure is essential: do not output the same diagonal blank opening as slot 2 or the straight narrow seam of slot 0. Fill the entire stage edge-to-edge/top-to-bottom without a separate framed picture.
Continuity: same low-gloss dark bronze backing, weathered muted gold embossed cloud-and-dragon pattern; same scale of cloud ornament and soft side-light as Images 2 and3. Only the native surface shape and pose evolve, no global camera movement or palette shift. Central negative space stays flat dark bronze, not a room or scenery.
Constraints: one complete opaque wide raster; no people, portrait, army, horses, battle, weapons, architecture, landscape, sky, lettering, Chinese title characters, calligraphy, logos, watermark, UI, captions or extra frames. No transparency, no modern glossy gold, no new story content. Native Image1 determines the geometry; HD refs determine material only.
```

实际 view：双侧龍首和云纹浮雕向上/中部中央推进，中央下方留下逐渐扩大的平素区域，区别于槽2直斜边；窄直侧框、旧铜暗金、浮雕深度和光向连续。无额外文字、角色、地景或UI。

## 槽4 最终调用

输出原文件：

```json
{
  "path": "C:/Users/75112/.codex/generated_images/01a116e3-623c-7513-a5e0-580eb72033be/exec-a50d2959-1ebf-4242-a987-53df7f9822d6.png",
  "bytes": 3336598,
  "sha256": "495e09b718b1fefe1db8fbe5c77d7c5de1af4518c837a38b2f3f6161b15eeb66",
  "dimensions": [
    1619,
    971
  ],
  "mode": "RGB"
}
```

实际调用参数：`transparent_background:false`；`num_last_images_to_include` 未使用；引用路径按以下顺序传入 `referenced_image_paths`。全部输入在本次生成前已使用 `view_image` 查看。

```json
[
  {
    "path": "F:/project/baye-sanguo/build/r07-spe-native/resource-3-index-0-picture-4.png",
    "bytes": 3824,
    "sha256": "add22ee674913ee4b46f1c36149db702de5d4de639e7cf88a9f9f3ff05ce6d78",
    "dimensions": [
      160,
      96
    ],
    "mode": "RGBA",
    "rawSlotSha256": "a537f98ffe55f0047de085ae93707c5ec9021ce340b75aac9ce29bdfb0432e74",
    "role": "authoritative native slot4 geometry/central angular gaps; not a style reference",
    "viewedBeforeCall": true
  },
  {
    "path": "C:/Users/75112/.codex/generated_images/01a116e2-c940-7931-9e13-0a495970c85f/exec-c154f3ef-cd0d-48cf-b510-f654870e26f7.png",
    "bytes": 3126376,
    "sha256": "ca8e3fdaa7d00c699ee5a78baf9767b281b4bd802880b17bdd04b2c7360c712c",
    "dimensions": [
      1619,
      971
    ],
    "mode": "RGB",
    "role": "accepted root HD slot0 fixed material/palette/cloud pattern/camera only",
    "viewedBeforeCall": true
  },
  {
    "path": "C:/Users/75112/.codex/generated_images/01a116e3-623c-7513-a5e0-580eb72033be/exec-26c040ed-b5cc-4335-b944-e1c2d99817d5.png",
    "bytes": 3222163,
    "sha256": "c5e54eab9d28dbf35352e424053c0ce1eaff0f98dd39b08309e43f4e2f3d7b12",
    "dimensions": [
      1619,
      971
    ],
    "mode": "RGB",
    "role": "accepted HD slot3 immediate preceding-frame dragon faces/body/relief continuity",
    "viewedBeforeCall": true
  }
]
```

完整 exact prompt：

```text
Use case: stylized-concept.
Asset type: Baye historical Three Kingdoms game, MAIN opening fullstage decorative bitmap slot 4; one complete independent still, final ornament-pose picture of the native five-picture sequence.
Primary request: Render native reference Image1's exact densely curved paired dragon-patterned surface composition as weathered dark bronze and muted antique-gold embossed relief on an opaque wide 160:96 (5:3) canvas.
Input images: Image1 is authoritative native slot4 and controls the precise silhouettes, paired decorated surface orientation, central angular spacing, side border locations and motif placement. Image2 is accepted HD slot0, the fixed material/palette/light/camera/cloud-curl style reference only. Image3 is accepted preceding HD slot3, to keep the same sculpted Chinese dragon faces, sinuous scale-covered bodies, relief depth, fine wear and soft light consistent across frames; only Image1 defines this frame's shape.
Composition: retain the narrow outer cloud ornament strips and straight thin upright borders along both sides exactly as in Image1. In this frame the inner paired dragon-ornament surfaces extend and curl farther into the central stage, becoming the most densely filled pose of the sequence. The paired dragons' relief masses and angular/curved inner outlines approach and intertwine around the center, with the small irregular central gaps matching native Image1 instead of the broad empty central band in earlier slots. Follow the diagonal and curved edge transitions of the native source; keep the mirrored left/right decorative rhythm. Dragons remain surface relief in bronze, not living flying animals or figures in a setting. Show the whole stage edge-to-edge/top-to-bottom, straight-on, with no camera zoom or separate image frame.
Material continuity: same low-gloss dark aged bronze backing, antique gold cloud curls and dragon carving as Images2/3, with consistent ornament scale, light direction, warm restrained color and shadow strength. Keep the native arrangement intact, do not simply reuse slot3's broad plain lower wedge. Central remaining gaps are flat dark bronze, without room or landscape through them.
Constraints: exactly one complete wide opaque raster; no people, portrait, soldiers, horse, battle, weapon, room, architecture, scenery, sky, mountains, trees, Chinese title characters, letters, calligraphy, logo, watermark, UI, captions or extra frames; no transparent background, no bright modern polished gold, no new story elements. NativeImage1 controls geometry, HD images only lock design continuity.
```

实际 view：双侧浮雕进一步向中央汇聚，龙首、鳞身和云卷覆盖更密，中央余留不规则平素缝隙；与槽3保持同一材质、纹样尺度与镜头，符合原生最后密集姿态的方向。全幅主体完整，无文字、人物、马匹或风景。

## 槽1 拒收的首次调用

此输出仅作为保留来源，不作最终交付。首次画面材质与无文字检查通过，但中央平素开口约占23%横向幅宽；实际native槽1 full-height borders位于x40、48、111、119，平素中央x49..110约39%幅宽。差异影响这一帧开合几何，所以明确拒收并进行上述第二次内置调用。此原源未删除，不沿用“几何通过”的描述。

```json
{
  "path": "C:/Users/75112/.codex/generated_images/01a116e3-623c-7513-a5e0-580eb72033be/exec-9f723d7a-30c6-4855-89e3-73e7a7ae8d55.png",
  "bytes": 2835323,
  "sha256": "00291dab5336979e0d2f25ec6ecbd340c0e836dd8f802e44d5ea408b65316647",
  "dimensions": [
    1619,
    971
  ],
  "mode": "RGB"
}
```

原输入同槽1最终调用的两项参考及角色，第一次调用前均已 view。实际参数 `transparent_background:false`，`referenced_image_paths`：

```json
[
  "F:/project/baye-sanguo/build/r07-spe-native/resource-3-index-0-picture-1.png",
  "C:/Users/75112/.codex/generated_images/01a116e2-c940-7931-9e13-0a495970c85f/exec-c154f3ef-cd0d-48cf-b510-f654870e26f7.png"
]
```

完整 exact 首次 prompt：

```text
Use case: stylized-concept.
Asset type: exact composition replacement for one full-screen bitmap slot in the historical Three Kingdoms game Baye.
Primary request: Generate MAIN opening decorative panel picture slot 1, one independent still in the same five-frame sequence as the accepted HD slot 0. A landscape canvas matching the native 160:96 (5:3) full-stage composition, opaque.
Input images: Image 1 is the authoritative native slot 1 bitmap; use ONLY it to determine this frame's panel geometry, lateral spacing, symmetry, line positions and empty central band. Image 2 is the accepted HD slot 0; use it ONLY to lock the same aged dark bronze, subdued antique gold embossed cloud ornament, fine wear, subdued soft side lighting, straight-on camera and surface material. It must not override the slot 1 geometry.
Composition: preserve the native exact spatial relationship. Here the paired cloud-patterned panels have moved laterally toward the outside, leaving a broad unadorned central vertical band between their inner borders. Keep the cloud relief on both outer panel portions, retain the paired thin vertical inner border strips in the positions given by Image 1. The center is a flat, quiet dark bronze/lacquer interior surface, no doorway scenery and no vignette swallowing native details. Entire ornament panel area runs edge to edge and top to bottom like the supplied native bitmap, not a framed illustration floating on a background.
Style/material continuity: recreate the same repeating cloud curls and weathered dark-gold relief language of Image 2 at a consistent scale, contrast, line thickness and color. Only panel pose and open spacing change for this native frame. No narrative extrapolation.
Constraints: one complete landscape raster; straight-on view; no characters, people, horses, weapons, buildings, terrain, landscape or battle scene; no text, letters, calligraphy, title, logos, watermark, UI, captions or extra frames; no transparent background; do not add a literal room through the center; do not crop off or reposition the native structural borders. High detail without modern glossy gold.
```

## 跨帧静态视觉复查与边界

已按0→1→2→3→4逐张实际 view：同一旧铜暗金、云卷尺度、柔侧光和直视镜头保持；槽0窄中央缝、槽1宽中央平素带、槽2斜向龙云面、槽3中上部龙首推进、槽4更密中央龙纹为不同姿态。图像属于历史纹样面板的HD艺术解释，不宣称原生像素能证明字面“门扇”或“卷轴”机械；不添加人马或叙事风景。

这项复查仅为原始艺术候选的静态来源/构图审查，尚不是动画连播或实际玩法验收。原生单位顺序仍为图片0,1,2,3,4,0,5,6,6：后期重复槽0，叠加霸/业，再按原生计时清除。真实LCD显示与HD整层映射、冷启动预加载、timer合并commit、skip/end/fallback、两视口连播等由主任务及独立runtime专项验收；本记录不提前填写未执行的green/count。

资源审计的9张MAIN计数器离线合成参考只证明按C计数器和白色初始scratch的组合，并不冒充真实native callback。实际LCD palette的白bit为alpha0（0x00FFFFFF），PNG画布会将透明RGB归零；原生资源参考的mask0保持不透明白色阅读底，两者语义区分记录。未发原生键、未改引擎状态、未改LIB/C/WASM/8080服务。
