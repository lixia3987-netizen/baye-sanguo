# 武将立绘 img2img 提示

身份参考只用 `refs/period-{时期}/{personId}-{姓名}.png`。那是引擎画到 `#lcd` 左上角 `24 * dotSize` 的原头像：`baye.drawImage(0, 0, GEN_HEADPIC1 + g_PIdx, 0, personIndex, 1)`，`GEN_HEADPIC1` 是 47，时期 1 的 resid 是 48。不要拿 `querySelector('canvas')` 裁到的 HD 大地图（接近全黑），不要拿别的武将，不要拿海报脸替换。生成文件放到清单里的 `hd` 路径（同样的时期和 personId）。没有参考图就不要生成。

时期：1 董卓弄权 · 2 曹操崛起 · 3 赤壁之战 · 4 三足鼎立（界面里也叫三国鼎立）。

## 中文

正向：

> 以参考头像为同一人，画一张三国武将半身像 / 胸像。保留五官、胡须、头盔或冠、年龄感，不要改成另一个人。服饰符合该历史时期（东汉末到三国），布料和铠甲有轻度质感。背景简洁：竹林、宫廊或战场远景，浅景深，不要堆满旗帜和杂兵。光线统一，柔和侧光。画面干净，无现代文字、水印、签名、边框 UI。

负向：

> 换脸，另一名武将，现代服装，眼镜，手表，枪械，照片水印，Logo，字幕，乱码汉字，多余手指，卡通贴纸边框，鲜血特写，拥挤战场。

img2img：参考图权重高于文案。降噪不要高到认不出原头像。同一时期用同一套光线和画幅，方便界面并排。

## English

Positive:

> Same person as the reference head sprite. Three Kingdoms officer, half-body or bust. Keep facial structure, beard, helmet or crown, and age. Do not invent a different identity. Period costume from the late Han through the Three Kingdoms. Tasteful background only: bamboo, a palace corridor, or a battlefield in soft bokeh — uncluttered. Consistent soft side light. No modern text, watermark, signature, or UI frame.

Negative:

> different face, different officer, modern clothes, glasses, firearm, watermark, logo, subtitles, garbled characters, extra fingers, sticker border, crowded melee.

Keep the reference likeness. Do not raise denoise until the face no longer matches the dumped head.

## 输出

- 路径与 `assets/hd-portraits/manifest.json` 的 `hd` 字段一致，例如 `hd/period-1/5-马腾.png`
- 也可以额外放 `hd/period-{时期}/{personId}.png`，壳会把它当作无名额的后备
- 不要把生成图放进 `refs/`。`refs/` 只收引擎实拍

## 2026-10-08：其余时期的制作方式

使用内置 `image_gen`，每个时期与人物独立调用，`transparent_background:false`；先查看所有本地输入。对应时期的原生头像优先决定面容、年龄、胡须与头冠，已有同人物的时期一高清图只辅助人物连续性和已接受的写实电影画风。周瑜没有时期一成品，仅以曹操成品辅助光线、材质与画幅，提示词明确不借用曹操的脸、胡须或装束。

画幅请求横向约16:9，半身、柔侧光、简洁虚化背景；完整头冠和胡须必须在框内。出现裁冠时以更松构图重新生成，保留拒收原始候选。最终使用工具原生 PNG，真实输出为1672×941；不为凑1280×720而裁切或缩放，也不把24×24参考放大记作高清成品。

完整实际提示词、各参考图角色与哈希、原始内置输出路径、成品尺寸/哈希与逐图视觉检查见 [时期二](GENERATED-PERIOD-2.md)、[时期三](GENERATED-PERIOD-3.md)、[时期四](GENERATED-PERIOD-4.md)。[素材对照页](review.html)按真实时期与0-based人物ID展示原生参考和完整成品。
