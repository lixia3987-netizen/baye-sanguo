# MAKER 制作群组高清素材生成记录

日期：2026-10-08。内置 `image_gen.imagegen` 1次实际调用，1张最终完整不透明原始PNG。主任务已实际 view 原输出，逐字确认五行文案、边框和两个小脸，接受本原图。复制到生产路径的文件逐byte等于内置生成器原始输出；原source保留，没有裁切、缩放、重编码、文字合成或外部CLI生成。

## 原生内容与身份

标准实际LIB：`libs/dat-mod.lib`，207195bytes，SHA-256 `3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e`。MAKER_SPE6/index0/kind1，96个位置/时间单元、1个图片槽，完整payload2413bytes，`fnv1a32:b961053e:2413`，payloadSHA-256 `1bf7052e0272c3ebcc4385b7716dfc9bf67465ecd007a5f894025e0c35ffc277`。

原生图片槽0为159×96/count1/mask0，全部unit为x0、y95→0、cdelay10、ndelay10、picIndex0。逻辑映射仍为159×96；生成器实际输出1614×975原尺寸保留，不将它改成预设尺寸。原生参考读取MSB-first点阵并以mask0不透明白底显示，已fresh逐RGBA核对真实payload。

文字是原生资源图的视觉转写，不能伪称LIB里存在对应GBK字符串、程序人物身份或语义字段。生成前对原生PNG及真实baseline经典hold截图整数放大复查，主任务独立核对同样文字：

```text
策划：BBK Game Group
程序：谢育虫
南方小鬼
美工：Sword.dy
2005年7月30日
```

程序署名末字原始低清字形曾被人工初读为“杰”，在任何生成前已更正为“虫”：真实像素有口/贯穿竖/下横与点，没有木+灬。本素材保留实际原署名“谢育虫”，没有按推测真实姓名改写；不存在使用错误署名的生成候选或额外调用。

Fresh审计：`build/r08-maker-resource-audit.json`（21137bytes，SHA-256 `eb47e9333f29f1e3cbe5c5d3b55c06980c7396a5bbe254ddaa11b53fbca2dcad`）与 `build/r08-maker-resource-audit.md`（4143bytes，SHA-256 `f1e4355a77e677a6fb4fb6f8b8a8d3930a90caad01d3c9454fb7fb718c552266`）。原始审计按gzip解压SHA保存在[MAKER验收档案](../../docs/validation/m4-maker-20261008.json)，与真实runtime结果分开记录。

## 唯一最终原图

```json
{
  "picIndex": 0,
  "source": "C:/Users/75112/.codex/generated_images/01a116e3-623c-7513-a5e0-580eb72033be/exec-2a1de3f0-c4b5-4456-bc71-be5f70d28176.png",
  "path": "assets/hd-spe/maker-6/picture-0.png",
  "width": 1614,
  "height": 975,
  "bytes": 3275767,
  "sha256": "91f0aedea0a34760282d43ce2470febe3a436c63e429bf333b14540f4e1c537c",
  "mode": "RGB",
  "opaque": true,
  "originalBytesPreserved": true,
  "logicalWidth": 159,
  "logicalHeight": 96,
  "nativeMask": 0,
  "actualBuiltinCalls": 1
}
```

最终PNG的SHA与原生2184byte参考不同，大小超过100×100，全部像素不透明。源未删除，目标按字节复制；没有把原生放大当成HD图。

## 本次输入及角色

以下顺序即 `referenced_image_paths` 的实际顺序。两个输入在生成前均用 `view_image` 实际查看；原生是内容/布局权威，MAIN只提供材质画风，不能修改文字、添加霸业标题或把云纹墙搬成署名主体。

```json
[
  {
    "path": "F:/project/baye-sanguo/build/r07-spe-native/resource-6-index-0-picture-0.png",
    "sha256": "8f80160866de44d2425ff62fb9078484aa3c8d4d3bcf92a5f5c44f19987a104e",
    "bytes": 2184,
    "dimensions": [
      159,
      96
    ],
    "mode": "RGBA",
    "role": "authoritative actual MAKER6 native bitmap: exact credit text, line hierarchy, indentation, frame, two mascots and geometry",
    "viewedBeforeGeneration": true
  },
  {
    "path": "F:/project/baye-sanguo/assets/hd-spe/opening-3/picture-0.png",
    "sha256": "ca8e3fdaa7d00c699ee5a78baf9767b281b4bd802880b17bdd04b2c7360c712c",
    "bytes": 3126376,
    "dimensions": [
      1619,
      971
    ],
    "mode": "RGB",
    "role": "accepted MAIN3 HD background0: bronze palette, material, fine wear and soft side-light only; does not override native credit content/layout",
    "viewedBeforeGeneration": true
  }
]
```

内置调用参数：`transparent_background:false`。未使用 `num_last_images_to_include`，未使用CLI、外部模型或图片后处理。

## 完整 exact prompt

```text
Use case: stylized-concept.
Asset type: one complete high-resolution opaque credit-panel bitmap replacing MAKER_SPE=6/resourceIndex0/picture0 in Baye, a historical Three Kingdoms game.
Primary request: create ONE full credit panel matching the actual native bitmap layout and two tiny mascot doodles, using the restrained weathered bronze and antique-gold visual language of the accepted MAIN opening artwork. The entire panel will map to the native159×96 logical footprint, so use a landscape159:96 aspect ratio and show the complete border and all text within the canvas.
Input images: Image1 is the authoritative native MAKER bitmap. It defines actual credited text, line hierarchy, indentation, positions, thin rectangular frame, narrow decorative side strips, and the two tiny faces. Its content must not be rewritten. Image2 is accepted MAIN opening background0 and is ONLY the palette/material/soft side-light/style reference. Do not copy its cloud-wall composition or replace the credit hierarchy with a story scene.
Text, exactly once each, precisely spelled with no quotation marks:
策划：BBK Game Group
程序：谢育虫
南方小鬼
美工：Sword.dy
2005年7月30日
Lettering requirements: simplified Chinese, clear unambiguous readable strokes. The programming name is exactly 谢育虫 — last character 虫 (insect, UnicodeU+866B), NOT 杰, NOT 蟲, NOT any presumed real name. 谢 is U+8C22; 育 is U+80B2. First English credit exactly BBK Game Group, including capitalization and spaces. Artist exactly Sword.dy with capitalS, lowercaseword, a full stop immediately before lowercase dy; no spaces around the dot. Date exactly2005年7月30日, no changed year/month/day or added zeroes. Render all five lines correctly, no extra line or text.
Native hierarchy and layout: planning line across the upper area, label at left followed by BBK Game Group. Next line: 程序： at left and 谢育虫 to its right. Directly below that name put 南方小鬼 aligned with the name start, with no repeated 程序 label. In the lower half: 美工： at left followed by Sword.dy. Last row at bottom, centered slightly to the right:2005年7月30日. Keep adequate readable spacing and margin, no clipped strokes or frame touching letters.
Mascots: on the right of the first programming-name row, one SMALL rounded face with two eyes, simple mouth and a short curled worm-like body/tail, matching Image1. On the right of the second programming-name row, one SMALL fluffy/ghost-shaped rounded outline face with simple dot eyes/mouth and open lower lobes, matching Image1. Both are tiny ornamental doodles, not new people, portraits, armies, company logos or large illustrated characters.
Visual treatment: quiet low-gloss aged dark bronze backing, subdued warm antique-gold/ivory lettering and thin carved border, fine wear and soft side-light consistent with Image2. Keep behind-text texture subtle and contrast strong so ALL names and date remain easily legible. Narrow decorative side strips and fine rectangular inner border follow Image1; ornament must never compete with the words. Flat straight-on complete panel, no camera perspective distortion.
Constraints: one landscape opaque PNG, full panel and border inside canvas, no transparent background, no extra title/header/subtitle, no 霸业 title, no logo beyond the exact credited wording, no dedication or new credits, no people/horses/weapon/battle/landscape/room/architecture/story, no watermark, no UI or caption, no invented text or corrected names/date. Native content is the authority, MAIN input supplies only bronze style.
```

## 实际视觉检查与验收边界

已实际 view 最终原source与复制文件，逐项核对：策划标签和“BBK Game Group”大写/空格准确；程序名为“谢育虫”，末字为虫；“南方小鬼”位于下一行并沿姓名位置缩进；美工标签与“Sword.dy”大小写、点号准确；日期为“2005年7月30日”。没有额外headline/logo、献辞、年份修正、霸业标题、人物、马匹、风景、UI或水印。

细矩形框和左右窄装饰条完整；圆脸带短弯小虫身体和下一行小鬼样脸分别在原生两个人名右侧，保持小符号层级。旧暗铜、暗金浮雕、柔侧光和细旧痕与MAIN成品相连，文字仍有明确对比和间隔。此图是原生署名板的HD美术解释，不宣称边饰和字体逐像素复制原159×96点阵。

本记录为来源、原字节与静态文字/构图检查。实际96unit滚动、自然结束后的静态等待、提前skip保持当前显示位置、经典/HD切换、未知实际LIB和customshowAbout回退、两视口可读性及真实输入生命周期由主任务接线和专项验收；本记录不提前宣称runtimegreen或计入尚未完成检查数。原生 `GamMakerInf` 忽略movie返回并运行 `GamDelay(5000,2)`，尾等是独立真实原生阶段，不能靠本地计时或菜单inactive猜测。没有发原生键、改LIB/C/WASM、改变玩法或触碰8080服务。
