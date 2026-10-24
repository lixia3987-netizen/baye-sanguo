# 时期二高清立绘生成记录

制作日期：2026-10-08。时期：2「曹操崛起」。人物标识均为标准资源的 0-based PersonID；对应原生头像资源为 49。身份参考与清单记录均已核对。标准 `libs/dat-mod.lib` SHA256 为 `3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e`。

每个人物通过 Codex 内置 `image_gen` 独立生成，`transparent_background:false`，每次仅传入下列本人物的时期二原生参考与时期一风格参考。先用 `view_image` 查看输入，再检查生成图。原生参考优先决定人物身份、头冠、须形、年龄与本时期装束；同人物的已接受时期一成品仅辅助面容连续性及写实电影画风。周瑜无时期一同人成品，曹操仅作光线、材质、画幅参考，不能借用其人物身份。

接受图按清单指定路径以原始 PNG 字节复制，未裁切、缩放、后处理或覆盖既有文件。实际输出为 1672×941 RGB、无透明通道；横向16:9请求产生不足1px的整数尺寸舍入差异，保留工具原尺寸。完整冠、头发与胡须的人工检查描述见各项；这些是生成素材核验，实际运行界面验收另记。

以下记录包含完整提示词、参考角色与哈希、内置原始输出路径、成品尺寸与哈希。拒收候选保留在原始生成目录，未进入 `hd/period-2/`。

## 接受素材

| PersonID | 人物 | 文件 | 尺寸 | PNG bytes | SHA256 |
| --- | --- | --- | --- | --- | --- |
| 11 | 马腾 | [hd/period-2/11-马腾.png](hd/period-2/11-马腾.png) | 1672×941 | 2276439 | `fb40055ae442449f0c7d65f5e30d0d01fe9ebb1d6651b9bbf268b604af7cbb88` |
| 101 | 庞德 | [hd/period-2/101-庞德.png](hd/period-2/101-庞德.png) | 1672×941 | 2237722 | `8e77cc6ad3c8ce050572e74e029c5e32afb862f6040a773df201b349826302f1` |
| 109 | 杨秋 | [hd/period-2/109-杨秋.png](hd/period-2/109-杨秋.png) | 1672×941 | 2098682 | `df852bc7c1ae88cb607fed62130bf9666de14993e11280cfb4ce2b03a894d5ed` |
| 106 | 梁兴 | [hd/period-2/106-梁兴.png](hd/period-2/106-梁兴.png) | 1672×941 | 2284421 | `2193c51e49e77c5aace51592caff455acee73b8ae9859b4f9dbcc2c52ff1c01c` |
| 1 | 曹操 | [hd/period-2/1-曹操.png](hd/period-2/1-曹操.png) | 1672×941 | 2098066 | `46f40cfef67b20102bb9635ec52572986a2863feebcdd5d81c82cde481fa25c4` |
| 2 | 刘备 | [hd/period-2/2-刘备.png](hd/period-2/2-刘备.png) | 1672×941 | 2127883 | `32f610893a31bcefd6df00b325c90a2aab96183db8710197d452b88ddae45cb6` |
| 31 | 关羽 | [hd/period-2/31-关羽.png](hd/period-2/31-关羽.png) | 1672×941 | 2201445 | `53a62a8fedb85621fbece7bccdc0e64245d5c8102c52c341f39267de0d993b9c` |
| 32 | 张飞 | [hd/period-2/32-张飞.png](hd/period-2/32-张飞.png) | 1672×941 | 2322531 | `919aa005615c245bf820ae08ad29896ff343acdf7a72c629bb6be8277b042509` |
| 182 | 诸葛亮 | [hd/period-2/182-诸葛亮.png](hd/period-2/182-诸葛亮.png) | 1672×941 | 2337496 | `2088996dae0b0e9d065ee659d1093b7161b42df43cfe26ac630f9bbb925531fb` |
| 78 | 周瑜 | [hd/period-2/78-周瑜.png](hd/period-2/78-周瑜.png) | 1672×941 | 2118888 | `bcb616bfba580661f6ec31b4c8346f32100c9e16306e340f2bb044b4802e3974` |
| 8 | 吕布 | [hd/period-2/8-吕布.png](hd/period-2/8-吕布.png) | 1672×941 | 2048304 | `ec778a4b6412c863d9dacb0b679133572e10a3d919569533afbe1bc4229c0daf` |

## 马腾 · PersonID 11

- 原生身份参考（输入1）：[refs/period-2/11-马腾.png](refs/period-2/11-马腾.png)，时期二，24×24；SHA256 `3bb0f9684e7727be1809ae34def94099ef4521a7cae4bb7cc0b0c41ba5ed13d9`。
- 同人物时期一/画风参考（输入2）：[hd/hd_p1_0005_马腾.png](hd/hd_p1_0005_马腾.png)，1280×720；SHA256 `dd470ee27ffaafd446cf4e79554379190d19cc23579aae215cd5d8b7a0181d1c`。
- 参数：`referenced_image_paths` 按以上输入1、输入2顺序；`transparent_background:false`。
- 实际参考路径1：`F:\project\baye-sanguo\assets\hd-portraits\refs\period-2\11-马腾.png`。
- 实际参考路径2：`F:\project\baye-sanguo\assets\hd-portraits\hd\hd_p1_0005_马腾.png`。
- 内置原始输出：`C:\Users\75112\.codex\generated_images\01a116ec-1a89-7021-bcba-ea589a792a30\exec-b234ded3-ff92-42c1-9f38-cee8f2816516.png`。
- 成品：[hd/period-2/11-马腾.png](hd/period-2/11-马腾.png)；1672×941，RGB PNG，2276439 bytes；SHA256 `fb40055ae442449f0c7d65f5e30d0d01fe9ebb1d6651b9bbf268b604af7cbb88`。
- 原始与项目成品逐字节相等；本次核对原生及风格参考 SHA256 未改变。

视觉检查：
Accepted third generation. Mature face, strong brows, moustache and long beard align with the native portrait and the accepted same-person period-1 styling. Complete crown, lateral pin, hair and beard are visible; a loose torso-up composition with breathing room and a quiet defocused corridor. No lettering, UI or extra people. Earlier two candidates were rejected for crown clipping and remain only in built-in original storage.

实际完整提示词：

```text
Use case: historical-scene.
Create ONE new realistic cinematic portrait of Ma Teng (马腾), Three Kingdoms game period 2 曹操崛起, native zero-based PersonID 11, in a wide horizontal 16:9 opaque canvas.
Reference roles: image 1 is his actual period-2 native 24×24 portrait and is the highest authority for the face, mature age, eyebrows, moustache, long beard and native period headgear/clothing. Image 2 is his accepted period-1 realistic portrait: use the same believable person's facial continuity and cinematic painting/rendering style, soft side light and material quality. Do NOT imitate image 2's crop, framing, backdrop composition or period-1 clothing over the native period-2 portrait.
CRITICAL FRAMING: a loose medium half-body portrait, including torso to the waist. Make the entire visible person occupy no more than 80% of the IMAGE HEIGHT. Place the top of the tallest crown at approximately y=12% of the canvas height, with an unmistakable empty background band above it; the headgear, lateral pin, hair and beard must all be completely inside the frame. The face itself occupies only about 25% of image height. Center him slightly left horizontally; show both shoulders and more torso. Never zoom into the face or touch the crown to the top edge.
A stern mature Chinese military officer in late Han armor and native-matching dark headgear, with lifelike weathered skin, strong eyebrows and the recognizable long beard. Restrained earthy dark gray and bronze costume, no fantasy armor. Soft cinematic side lighting and shallow depth of field, matching the established portrait set.
Background: a quiet softly blurred stone corridor, muted warm gray, unobtrusive and uncluttered; no prominent flags, people or combat. Exactly one officer.
No text, nameplates, Chinese characters, subtitles, UI frame, watermark, logo, signature, collage, inset reference or pixel art overlay. No face swap, youthful celebrity appearance, anime, modern objects, glasses, firearms or gore. This is a new high-definition portrait, not a copy or upscale of either input. Preserve a fully opaque backdrop.
```

## 庞德 · PersonID 101

- 原生身份参考（输入1）：[refs/period-2/101-庞德.png](refs/period-2/101-庞德.png)，时期二，24×24；SHA256 `b40381a82c5ffa4eeb77040945aea046daca3e60d4710c9c90a0025017c6513c`。
- 同人物时期一/画风参考（输入2）：[hd/hd_p1_0058_庞德.png](hd/hd_p1_0058_庞德.png)，1280×720；SHA256 `ba3ca8d20a8e480a6b3ee1be8fc67962969be8d0bed6bb43a2102a66f711d4eb`。
- 参数：`referenced_image_paths` 按以上输入1、输入2顺序；`transparent_background:false`。
- 实际参考路径1：`F:\project\baye-sanguo\assets\hd-portraits\refs\period-2\101-庞德.png`。
- 实际参考路径2：`F:\project\baye-sanguo\assets\hd-portraits\hd\hd_p1_0058_庞德.png`。
- 内置原始输出：`C:\Users\75112\.codex\generated_images\01a116ec-1a89-7021-bcba-ea589a792a30\exec-e77c0c94-4385-4d9e-94bc-a1f1b05051de.png`。
- 成品：[hd/period-2/101-庞德.png](hd/period-2/101-庞德.png)；1672×941，RGB PNG，2237722 bytes；SHA256 `8e77cc6ad3c8ce050572e74e029c5e32afb862f6040a773df201b349826302f1`。
- 原始与项目成品逐字节相等；本次核对原生及风格参考 SHA256 未改变。

视觉检查：
Accepted: angular mature face, dark structured crown, moustache and tapered beard retain native identity with same-person period-1 continuity. Headgear and beard are entirely within frame; shoulders and upper torso visible, neutral defocused corridor, soft cinematic side light. No text, UI or additional people.

实际完整提示词：

```text
Use case: historical-scene.
Create ONE new realistic cinematic chest-up / half-body portrait of Pang De (庞德), historical Three Kingdoms game period 2 “曹操崛起 / Rise of Cao Cao”, native zero-based PersonID 101, in a wide horizontal 16:9 opaque image.
Reference roles: image 1 is this exact person's actual period-2 native 24×24 portrait. It is the primary authority for facial identity, age, eyebrow/eye/nose shape, moustache/beard silhouette, hair and headgear outline, and the visible period costume. Image 2 is the accepted period-1 HD portrait of the same Pang De: use it for facial continuity and the established cinematic realism, soft lighting, skin/material texture and restrained palette. Do NOT imitate image 2's cropped framing or overwrite native period-2 clothing/headgear with the older costume; image 1 wins whenever details conflict.
FRAMING IS CRITICAL: a loose medium bust including substantial upper torso, never an extreme facial close-up or full-body figure. The face itself occupies roughly 25% of image height. The topmost headgear or hair is clearly below the upper frame, with 8–12% empty blurred background above it. Entire hat/helmet/crown, lateral ornaments, hair and beard must fit inside the canvas with breathing room. Both shoulders visible. Center slightly left horizontally. Ignore image 2's cropping.
Native identity interpretation: a stern mature male commander with strong angular brow and nose, moustache and a dark tapered beard, dark structured native headgear and an armored officer's bearing. Translate the low-resolution native head into believable human anatomy, preserving its recognisable outline and same-person continuity; do not invent a different attractive actor.
Period-appropriate late Eastern Han / Three Kingdoms clothing or armor guided by the native appearance. Restrained earthy gray, brown, bronze and cloth textures, natural lifelike skin, subtle weathering, consistent soft side light and shallow depth of field. Match the established realistic cinematic set, avoiding anime or cartoon aesthetics.
A simple quietly blurred stone or wooden corridor backdrop, muted and uncluttered, with no prominent flags, crowds, combat or distracting props. Exactly one person.
No text, characters, labels, nameplates, subtitles, signature, watermark, logo, border, UI, inset sprite, collage or split screen. No modern clothes, glasses, guns, fantasy armor, extra people, extra limbs or gore. Produce newly drawn high-definition art rather than duplicating or upscaling either reference. Keep the background opaque.
```

## 杨秋 · PersonID 109

- 原生身份参考（输入1）：[refs/period-2/109-杨秋.png](refs/period-2/109-杨秋.png)，时期二，24×24；SHA256 `1069873fd47bf787c97bfc75a95111cedb0c41dabc8cbdc3a5fb637fcdafad6b`。
- 同人物时期一/画风参考（输入2）：[hd/hd_p1_0066_杨秋.png](hd/hd_p1_0066_杨秋.png)，1280×720；SHA256 `f7dc35ced2587c9b452e1fde1277ec87b60b36cbbead47a5299fc06897feac0c`。
- 参数：`referenced_image_paths` 按以上输入1、输入2顺序；`transparent_background:false`。
- 实际参考路径1：`F:\project\baye-sanguo\assets\hd-portraits\refs\period-2\109-杨秋.png`。
- 实际参考路径2：`F:\project\baye-sanguo\assets\hd-portraits\hd\hd_p1_0066_杨秋.png`。
- 内置原始输出：`C:\Users\75112\.codex\generated_images\01a116ec-1a89-7021-bcba-ea589a792a30\exec-d6b2bf06-5508-4d27-bad0-c382559ef8f7.png`。
- 成品：[hd/period-2/109-杨秋.png](hd/period-2/109-杨秋.png)；1672×941，RGB PNG，2098682 bytes；SHA256 `df852bc7c1ae88cb607fed62130bf9666de14993e11280cfb4ce2b03a894d5ed`。
- 原始与项目成品逐字节相等；本次核对原生及风格参考 SHA256 未改变。

视觉检查：
Accepted: recognisable lean mature face, straight brows, slender curled moustache and tapered chin beard, with a complete dark structured crown. Both shoulders and chest are visible, and the quietly blurred corridor, natural skin and soft side lighting match the established period-1 rendering style. No text, UI or additional people.

实际完整提示词：

```text
Use case: historical-scene.
Create ONE new realistic cinematic chest-up / half-body portrait of Yang Qiu (杨秋), historical Three Kingdoms game period 2 “曹操崛起 / Rise of Cao Cao”, native zero-based PersonID 109, in a wide horizontal 16:9 opaque image.
Reference roles: image 1 is this exact person's actual period-2 native 24×24 portrait. It is the primary authority for facial identity, age, eyebrow/eye/nose shape, moustache/beard silhouette, hair and headgear outline, and the visible period costume. Image 2 is the accepted period-1 HD portrait of the same Yang Qiu: use it for facial continuity and the established cinematic realism, soft lighting, skin/material texture and restrained palette. Do NOT imitate image 2's cropped framing or overwrite native period-2 clothing/headgear with the older costume; image 1 wins whenever details conflict.
FRAMING IS CRITICAL: a loose medium bust including substantial upper torso, never an extreme facial close-up or full-body figure. The face itself occupies roughly 25% of image height. The topmost headgear or hair is clearly below the upper frame, with 8–12% empty blurred background above it. Entire hat/helmet/crown, lateral ornaments, hair and beard must fit inside the canvas with breathing room. Both shoulders visible. Center slightly left horizontally. Ignore image 2's cropping.
Native identity interpretation: a lean mature Chinese officer with straight strong eyebrows, narrow eyes, a slender curled moustache and short pointed chin beard, wearing the dark structured cap visible in the native portrait. Retain his recognisable narrow face and mildly angled head, with a gray high collar and restrained armored officer's clothing. Translate the low-resolution native head into believable human anatomy, preserving its recognisable outline and same-person continuity; do not invent a different attractive actor.
Period-appropriate late Eastern Han / Three Kingdoms clothing or armor guided by the native appearance. Restrained earthy gray, brown, bronze and cloth textures, natural lifelike skin, subtle weathering, consistent soft side light and shallow depth of field. Match the established realistic cinematic set, avoiding anime or cartoon aesthetics.
A simple quietly blurred stone or wooden corridor backdrop, muted and uncluttered, with no prominent flags, crowds, combat or distracting props. Exactly one person.
No text, characters, labels, nameplates, subtitles, signature, watermark, logo, border, UI, inset sprite, collage or split screen. No modern clothes, glasses, guns, fantasy armor, extra people, extra limbs or gore. Produce newly drawn high-definition art rather than duplicating or upscaling either reference. Keep the background opaque.
```

## 梁兴 · PersonID 106

- 原生身份参考（输入1）：[refs/period-2/106-梁兴.png](refs/period-2/106-梁兴.png)，时期二，24×24；SHA256 `b93b00b2be9fe95a36356f2e71296ce69b39721e4ddfd3221caab91cba622ef6`。
- 同人物时期一/画风参考（输入2）：[hd/hd_p1_0063_梁兴.png](hd/hd_p1_0063_梁兴.png)，1280×720；SHA256 `660fbbc55c24929e7afe9358a3a03e77b2efe67231e97a5a5631ca71c80b6b2e`。
- 参数：`referenced_image_paths` 按以上输入1、输入2顺序；`transparent_background:false`。
- 实际参考路径1：`F:\project\baye-sanguo\assets\hd-portraits\refs\period-2\106-梁兴.png`。
- 实际参考路径2：`F:\project\baye-sanguo\assets\hd-portraits\hd\hd_p1_0063_梁兴.png`。
- 内置原始输出：`C:\Users\75112\.codex\generated_images\01a116ec-1a89-7021-bcba-ea589a792a30\exec-34da174b-ec72-4b48-8804-0281560b603e.png`。
- 成品：[hd/period-2/106-梁兴.png](hd/period-2/106-梁兴.png)；1672×941，RGB PNG，2284421 bytes；SHA256 `2193c51e49e77c5aace51592caff455acee73b8ae9859b4f9dbcc2c52ff1c01c`。
- 原始与项目成品逐字节相等；本次核对原生及风格参考 SHA256 未改变。

视觉检查：
Accepted: broad mature warrior's face, strong brows, curved moustache and pointed dark beard align with his native head and same-person period-1 portrait. Entire structured hat and lateral ornament are visible; both armored shoulders and upper torso fit in the composition. Warm neutral corridor, soft side light, no letters, UI or extra people.

实际完整提示词：

```text
Use case: historical-scene.
Create ONE new realistic cinematic chest-up / half-body portrait of Liang Xing (梁兴), historical Three Kingdoms game period 2 “曹操崛起 / Rise of Cao Cao”, native zero-based PersonID 106, in a wide horizontal 16:9 opaque image.
Reference roles: image 1 is this exact person's actual period-2 native 24×24 portrait. It is the primary authority for facial identity, age, eyebrow/eye/nose shape, moustache/beard silhouette, hair and headgear outline, and the visible period costume. Image 2 is the accepted period-1 HD portrait of the same Liang Xing: use it for facial continuity and the established cinematic realism, soft lighting, skin/material texture and restrained palette. Do NOT imitate image 2's cropped framing or overwrite native period-2 clothing/headgear with the older costume; image 1 wins whenever details conflict.
FRAMING IS CRITICAL: a loose medium bust including substantial upper torso, never an extreme facial close-up or full-body figure. The face itself occupies roughly 25% of image height. The topmost headgear or hair is clearly below the upper frame, with 8–12% empty blurred background above it. The visible person occupies no more than 80% of canvas height, and the tallest point of the hat is at approximately y=12% with a clear uninterrupted band of background above it. Entire hat/helmet/crown, lateral ornaments, hair and beard must fit inside the canvas with breathing room. Both shoulders visible. Center slightly left horizontally. Ignore image 2's cropping.
Native identity interpretation: a stern middle-aged Chinese military officer with a broad strong-browed face, narrowed eyes, a curved dark moustache and full pointed chin beard, wearing his native dark structured hat and armor. Keep the mature warrior's face and head angle recognisable. Translate the low-resolution native head into believable human anatomy, preserving its recognisable outline and same-person continuity; do not invent a different attractive actor.
Period-appropriate late Eastern Han / Three Kingdoms clothing or armor guided by the native appearance. Restrained earthy gray, brown, bronze and cloth textures, natural lifelike skin, subtle weathering, consistent soft side light and shallow depth of field. Match the established realistic cinematic set, avoiding anime or cartoon aesthetics.
A simple quietly blurred stone or wooden corridor backdrop, muted and uncluttered, with no prominent flags, crowds, combat or distracting props. Exactly one person.
No text, characters, labels, nameplates, subtitles, signature, watermark, logo, border, UI, inset sprite, collage or split screen. No modern clothes, glasses, guns, fantasy armor, extra people, extra limbs or gore. Produce newly drawn high-definition art rather than duplicating or upscaling either reference. Keep the background opaque.
```

## 曹操 · PersonID 1

- 原生身份参考（输入1）：[refs/period-2/1-曹操.png](refs/period-2/1-曹操.png)，时期二，24×24；SHA256 `18846bdd8c718f770d9172adffd0dc0d4b369c016b4d2e117e895b169f214fed`。
- 同人物时期一/画风参考（输入2）：[hd/hd_p1_0001_曹操.png](hd/hd_p1_0001_曹操.png)，1280×720；SHA256 `e75fdd2ebeec7464e85291c99cd48cd2602d96f52963205899fc16e40fd11895`。
- 参数：`referenced_image_paths` 按以上输入1、输入2顺序；`transparent_background:false`。
- 实际参考路径1：`F:\project\baye-sanguo\assets\hd-portraits\refs\period-2\1-曹操.png`。
- 实际参考路径2：`F:\project\baye-sanguo\assets\hd-portraits\hd\hd_p1_0001_曹操.png`。
- 内置原始输出：`C:\Users\75112\.codex\generated_images\01a116ec-1a89-7021-bcba-ea589a792a30\exec-3908719d-7a53-4012-b73b-faf2d53a59b0.png`。
- 成品：[hd/period-2/1-曹操.png](hd/period-2/1-曹操.png)；1672×941，RGB PNG，2098066 bytes；SHA256 `46f40cfef67b20102bb9635ec52572986a2863feebcdd5d81c82cde481fa25c4`。
- 原始与项目成品逐字节相等；本次核对原生及风格参考 SHA256 未改变。

视觉检查：
Accepted: compact mature face, arched brows, thin moustache and short tapered beard retain Cao Cao's native appearance and accepted same-person continuity. Complete formal crown and both shoulders are visible in a loose chest-up composition, with muted formal robes and quiet corridor background. No text, UI or other people.

实际完整提示词：

```text
Use case: historical-scene.
Create ONE new realistic cinematic chest-up / half-body portrait of Cao Cao (曹操), historical Three Kingdoms game period 2 “曹操崛起 / Rise of Cao Cao”, native zero-based PersonID 1, in a wide horizontal 16:9 opaque image.
Reference roles: image 1 is this exact person's actual period-2 native 24×24 portrait. It is the primary authority for facial identity, age, eyebrow/eye/nose shape, moustache/beard silhouette, hair and headgear outline, and the visible period costume. Image 2 is the accepted period-1 HD portrait of the same Cao Cao: use it for the same face and established realistic cinematic styling, soft lighting, natural skin and cloth textures. Do NOT imitate image 2's cropped framing or overwrite native period-2 clothing/headgear with the older costume; image 1 wins whenever details conflict.
FRAMING IS CRITICAL: a loose medium bust including substantial upper torso, never an extreme facial close-up or full-body figure. The face itself occupies roughly 25% of image height. The topmost headgear or hair is clearly below the upper frame, with 8–12% empty blurred background above it. The visible person occupies no more than 80% of canvas height, and the tallest point of the crown is at approximately y=12% with a clear uninterrupted band of background above it. Entire hat/helmet/crown, lateral ornaments, hair and beard must fit inside the canvas with breathing room. Both shoulders visible. Center slightly left horizontally. Ignore image 2's cropping.
Native identity interpretation: a mature Chinese statesman and commander with a compact oval face, strong arched brows and alert narrow eyes, a thin dark moustache and short tapered chin beard. Preserve the native dark formal crown and the native dignified but forceful expression; his period-2 native clothing takes priority over older costume. Translate the low-resolution native head into believable human anatomy, preserving its recognisable outline and same-person continuity; do not invent a different attractive actor.
Period-appropriate late Eastern Han / Three Kingdoms clothing or armor guided by the native appearance. Restrained earthy gray, brown, bronze and cloth textures, natural lifelike skin, subtle weathering, consistent soft side light and shallow depth of field. Match the established realistic cinematic set, avoiding anime or cartoon aesthetics.
A simple quietly blurred stone or wooden corridor backdrop, muted and uncluttered, with no prominent flags, crowds, combat or distracting props. Exactly one person.
No text, characters, labels, nameplates, subtitles, signature, watermark, logo, border, UI, inset sprite, collage or split screen. No modern clothes, glasses, guns, fantasy armor, extra people, extra limbs or gore. Produce newly drawn high-definition art rather than duplicating or upscaling either reference. Keep the background opaque.
```

## 刘备 · PersonID 2

- 原生身份参考（输入1）：[refs/period-2/2-刘备.png](refs/period-2/2-刘备.png)，时期二，24×24；SHA256 `c8a1f5b85d94c9c65277073e971236e083267524fcf6bb9169574c878ed5f8f2`。
- 同人物时期一/画风参考（输入2）：[hd/hd_p1_0013_刘备.png](hd/hd_p1_0013_刘备.png)，1280×720；SHA256 `7a6a7b2698676a40ca89cd724a7c9ae95d3e6b8b1fdbae121ac07e676507449b`。
- 参数：`referenced_image_paths` 按以上输入1、输入2顺序；`transparent_background:false`。
- 实际参考路径1：`F:\project\baye-sanguo\assets\hd-portraits\refs\period-2\2-刘备.png`。
- 实际参考路径2：`F:\project\baye-sanguo\assets\hd-portraits\hd\hd_p1_0013_刘备.png`。
- 内置原始输出：`C:\Users\75112\.codex\generated_images\01a116ec-1a89-7021-bcba-ea589a792a30\exec-c980b6a3-de79-4b79-b04f-0eea5af1d44c.png`。
- 成品：[hd/period-2/2-刘备.png](hd/period-2/2-刘备.png)；1672×941，RGB PNG，2127883 bytes；SHA256 `32f610893a31bcefd6df00b325c90a2aab96183db8710197d452b88ddae45cb6`。
- 原始与项目成品逐字节相等；本次核对原生及风格参考 SHA256 未改变。

视觉检查：
Accepted: dignified elongated face, calm eyes, moustache and long tapered beard preserve the native Liu Bei identity and period-1 continuity. Entire formal crown and beard are contained in the frame, both shoulders and torso visible. Muted robes, soft natural skin and side lighting with a simple blurred corridor; no letters, UI or additional people.

实际完整提示词：

```text
Use case: historical-scene.
Create ONE new realistic cinematic chest-up / half-body portrait of Liu Bei (刘备), historical Three Kingdoms game period 2 “曹操崛起 / Rise of Cao Cao”, native zero-based PersonID 2, in a wide horizontal 16:9 opaque image.
Reference roles: image 1 is this exact person's actual period-2 native 24×24 portrait. It is the primary authority for facial identity, age, eyebrow/eye/nose shape, moustache/beard silhouette, hair and headgear outline, and the visible period costume. Image 2 is the accepted period-1 HD portrait of the same Liu Bei: preserve his facial continuity and the established cinematic realism, soft lighting, skin/material texture and restrained palette. Do NOT imitate image 2's cropped framing or overwrite native period-2 clothing/headgear with the older costume; image 1 wins whenever details conflict.
FRAMING IS CRITICAL: a loose medium bust including substantial upper torso, never an extreme facial close-up or full-body figure. The face itself occupies roughly 25% of image height. The topmost headgear or hair is clearly below the upper frame, with 8–12% empty blurred background above it. The visible person occupies no more than 80% of canvas height, and the tallest point of the crown is at approximately y=12% with a clear uninterrupted band of background above it. Entire hat/helmet/crown, lateral ornaments, hair and beard must fit inside the canvas with breathing room. Both shoulders visible. Center slightly left horizontally. Ignore image 2's cropping.
Native identity interpretation: a dignified mature Chinese leader with a gently elongated face, high straight brows, calm narrow eyes, a neat moustache and long full tapered dark beard. Preserve the native formal crown and facial proportions, with muted cloth robes appropriate to the native period appearance. Translate the low-resolution native head into believable human anatomy, preserving its recognisable outline and same-person continuity; do not invent a different attractive actor.
Period-appropriate late Eastern Han / Three Kingdoms clothing or armor guided by the native appearance. Restrained earthy gray, brown, bronze and cloth textures, natural lifelike skin, subtle weathering, consistent soft side light and shallow depth of field. Match the established realistic cinematic set, avoiding anime or cartoon aesthetics.
A simple quietly blurred stone or wooden corridor backdrop, muted and uncluttered, with no prominent flags, crowds, combat or distracting props. Exactly one person.
No text, characters, labels, nameplates, subtitles, signature, watermark, logo, border, UI, inset sprite, collage or split screen. No modern clothes, glasses, guns, fantasy armor, extra people, extra limbs or gore. Produce newly drawn high-definition art rather than duplicating or upscaling either reference. Keep the background opaque.
```

## 关羽 · PersonID 31

- 原生身份参考（输入1）：[refs/period-2/31-关羽.png](refs/period-2/31-关羽.png)，时期二，24×24；SHA256 `5f0336f89d935f9568744d2aaf05f7bb19a569c37ed492d3f528ed768f244126`。
- 同人物时期一/画风参考（输入2）：[hd/hd_p1_0089_关羽.png](hd/hd_p1_0089_关羽.png)，1280×720；SHA256 `d07917d012f038864f45008d0b5e855e3fae25f2f356803b8323424979a942ab`。
- 参数：`referenced_image_paths` 按以上输入1、输入2顺序；`transparent_background:false`。
- 实际参考路径1：`F:\project\baye-sanguo\assets\hd-portraits\refs\period-2\31-关羽.png`。
- 实际参考路径2：`F:\project\baye-sanguo\assets\hd-portraits\hd\hd_p1_0089_关羽.png`。
- 内置原始输出：`C:\Users\75112\.codex\generated_images\01a116ec-1a89-7021-bcba-ea589a792a30\exec-693b5fe6-d6c5-44ce-9345-9ee9efe25fa2.png`。
- 成品：[hd/period-2/31-关羽.png](hd/period-2/31-关羽.png)；1672×941，RGB PNG，2201445 bytes；SHA256 `53a62a8fedb85621fbece7bccdc0e64245d5c8102c52c341f39267de0d993b9c`。
- 原始与项目成品逐字节相等；本次核对原生及风格参考 SHA256 未改变。

视觉检查：
Accepted: imposing broad face, strong sloping brows, dark moustache and very long beard preserve Guan Yu's native identity and same-person period-1 styling. Complete green headgear, lateral pin and full beard fit within the image; both armored shoulders and torso visible. Quiet corridor background with no prominent flag, lettering, UI or other people.

实际完整提示词：

```text
Use case: historical-scene.
Create ONE new realistic cinematic chest-up / half-body portrait of Guan Yu (关羽), historical Three Kingdoms game period 2 “曹操崛起 / Rise of Cao Cao”, native zero-based PersonID 31, in a wide horizontal 16:9 opaque image.
Reference roles: image 1 is this exact person's actual period-2 native 24×24 portrait. It is the primary authority for facial identity, age, eyebrow/eye/nose shape, moustache/beard silhouette, hair and headgear outline, and the visible period costume. Image 2 is the accepted period-1 HD portrait of the same Guan Yu: use it for his recognisable face, long beard and the established cinematic realism, soft lighting, skin and armor texture. Do NOT imitate image 2's cropped framing or overwrite native period-2 clothing/headgear with the older costume; image 1 wins whenever details conflict.
FRAMING IS CRITICAL: a loose medium bust including substantial upper torso, never an extreme facial close-up or full-body figure. The face itself occupies roughly 25% of image height. The topmost headgear or hair is clearly below the upper frame, with 8–12% empty blurred background above it. The visible person occupies no more than 80% of canvas height, and the tallest point of the headgear is at approximately y=12% with a clear uninterrupted band of background above it. Entire hat/helmet/crown, lateral ornaments, hair and beard must fit inside the canvas with breathing room. Both shoulders visible. Center slightly left horizontally. Ignore image 2's cropping.
Native identity interpretation: a imposing mature Chinese warrior with a broad ruddy-toned face, exceptionally strong sloping brows and narrow stern eyes, a prominent dark moustache and very long dense dark beard. Preserve the native headgear outline and lateral ornament, with muted dark green cloth and late-Han armor where consistent with the native costume. The full beard must remain inside the image. Translate the low-resolution native head into believable human anatomy, preserving its recognisable outline and same-person continuity; do not invent a different attractive actor.
Period-appropriate late Eastern Han / Three Kingdoms clothing or armor guided by the native appearance. Restrained earthy gray, brown, bronze and cloth textures, natural lifelike skin, subtle weathering, consistent soft side light and shallow depth of field. Match the established realistic cinematic set, avoiding anime or cartoon aesthetics.
A simple quietly blurred stone or wooden corridor backdrop, muted and uncluttered, with no prominent flags, crowds, combat or distracting props. Exactly one person.
No text, characters, labels, nameplates, subtitles, signature, watermark, logo, border, UI, inset sprite, collage or split screen. No modern clothes, glasses, guns, fantasy armor, extra people, extra limbs or gore. Produce newly drawn high-definition art rather than duplicating or upscaling either reference. Keep the background opaque.
```

## 张飞 · PersonID 32

- 原生身份参考（输入1）：[refs/period-2/32-张飞.png](refs/period-2/32-张飞.png)，时期二，24×24；SHA256 `f71a24fe2b99268251a6047f9d7ded1b8ee898186b3e36e057af87b04acc8059`。
- 同人物时期一/画风参考（输入2）：[hd/hd_p1_0090_张飞.png](hd/hd_p1_0090_张飞.png)，1280×720；SHA256 `2930db46892eac95439878fbae29258ba58716fb75b8ee35c26cb9fdcce1ce8d`。
- 参数：`referenced_image_paths` 按以上输入1、输入2顺序；`transparent_background:false`。
- 实际参考路径1：`F:\project\baye-sanguo\assets\hd-portraits\refs\period-2\32-张飞.png`。
- 实际参考路径2：`F:\project\baye-sanguo\assets\hd-portraits\hd\hd_p1_0090_张飞.png`。
- 内置原始输出：`C:\Users\75112\.codex\generated_images\01a116ec-1a89-7021-bcba-ea589a792a30\exec-80f9c552-2860-4f57-8c6a-aaba79dd9dd6.png`。
- 成品：[hd/period-2/32-张飞.png](hd/period-2/32-张飞.png)；1672×941，RGB PNG，2322531 bytes；SHA256 `919aa005615c245bf820ae08ad29896ff343acdf7a72c629bb6be8277b042509`。
- 原始与项目成品逐字节相等；本次核对原生及风格参考 SHA256 未改变。

视觉检查：
Accepted: broad rugged face, thick sloping brows, intense eyes, dense moustache and bushy beard retain the native fierce Zhang Fei identity and accepted same-person style. Headgear, top hair and full beard remain within the image, both armored shoulders and upper torso visible. Quiet blurred architectural background replaces the earlier battle crowd; no letters, UI or additional people.

实际完整提示词：

```text
Use case: historical-scene.
Create ONE new realistic cinematic chest-up / half-body portrait of Zhang Fei (张飞), historical Three Kingdoms game period 2 “曹操崛起 / Rise of Cao Cao”, native zero-based PersonID 32, in a wide horizontal 16:9 opaque image.
Reference roles: image 1 is this exact person's actual period-2 native 24×24 portrait. It is the primary authority for facial identity, age, eyebrow/eye/nose shape, moustache/beard silhouette, hair and headgear outline, and the visible period costume. Image 2 is the accepted period-1 HD portrait of the same Zhang Fei: preserve this rugged person's facial continuity and established cinematic realism, soft lighting, skin, hair and armor textures. Do not import its battle crowd, waving flags, aggressive close crop or extra helmet ornaments when they differ from image 1. Do NOT imitate image 2's cropped framing or overwrite native period-2 clothing/headgear with the older costume; image 1 wins whenever details conflict.
FRAMING IS CRITICAL: a loose medium bust including substantial upper torso, never an extreme facial close-up or full-body figure. The face itself occupies roughly 25% of image height. The topmost headgear or hair is clearly below the upper frame, with 8–12% empty blurred background above it. The visible person occupies no more than 80% of canvas height, and the tallest point of the headgear or hair is at approximately y=12% with a clear uninterrupted band of background above it. Entire hat/helmet/crown, lateral ornaments, hair and beard must fit inside the canvas with breathing room. Both shoulders visible. Center slightly left horizontally. Ignore image 2's cropping.
Native identity interpretation: a powerfully built mature Chinese warrior with a broad rugged face, thick dramatically sloping brows, wide intense eyes and a dense dark moustache and full bushy beard. Preserve the native fierce expression, native hair silhouette and native headgear outline. Show the visible period costume as restrained late-Han dark armor and weathered cloth, never a generic handsome actor or different face. Translate the low-resolution native head into believable human anatomy, preserving its recognisable outline and same-person continuity; do not invent a different attractive actor.
Period-appropriate late Eastern Han / Three Kingdoms clothing or armor guided by the native appearance. Restrained earthy gray, brown, bronze and cloth textures, natural lifelike skin, subtle weathering, consistent soft side light and shallow depth of field. Match the established realistic cinematic set, avoiding anime or cartoon aesthetics.
A simple quietly blurred stone or wooden corridor backdrop, muted and uncluttered, with no prominent flags, crowds, combat or distracting props. Exactly one person.
No text, characters, labels, nameplates, subtitles, signature, watermark, logo, border, UI, inset sprite, collage or split screen. No modern clothes, glasses, guns, fantasy armor, extra people, extra limbs or gore. Produce newly drawn high-definition art rather than duplicating or upscaling either reference. Keep the background opaque.
```

## 马腾未采用候选

最初两次生成出现冠顶越出画面。两张原始候选均保留于内置生成目录，未写入成品路径；第3次按更松半身构图重新生成并接受。每次都仅使用马腾本人的时期二原生与时期一同人参考，路径、角色与哈希同上。

### 拒收候选 1

- 原始内置输出：`C:\Users\75112\.codex\generated_images\01a116ec-1a89-7021-bcba-ea589a792a30\exec-46212b70-bcf4-4618-a186-5ad5048fb244.png`。
- 1672×941，RGB PNG，2461091 bytes；SHA256 `7b48c0963a985c5643458bbdba81abda65b1e3fdf5f4eb365ba07503901e6b8e`。
- 视觉检查：冠顶被画幅裁掉，未采用；没有图像后处理。

实际完整提示词：

```text
Use case: historical-scene.
Asset type: one new high-definition game character bust portrait in a wide horizontal 16:9 canvas, matching the existing realistic cinematic Three Kingdoms portrait set.
Subject identity: Ma Teng (马腾), period 2 “Rise of Cao Cao” / 曹操崛起, native zero-based PersonID 11. Exactly one Chinese male officer.
Input image 1 is the actual period-2 24×24 black-and-white native head sprite. It is the primary identity and period-costume authority: preserve its facial structure, mature age, eyebrow/eye shape, nose, moustache, beard silhouette and headgear outline. Translate that sprite into believable human anatomy without turning it into a different officer.
Input image 2 is the accepted period-1 HD portrait of the same Ma Teng. Use it for continuity of the same person and especially the established realistic cinematic art style, natural skin texture, restrained cloth/metal textures, soft side lighting, contrast and warm earthy grading. Do not copy period-1 costume or headgear if they conflict with the actual period-2 native sprite; image 1 wins for identity details and period appearance.
Composition: wide horizontal 16:9, fully developed high-resolution image. Chest-up or half-body bust centered slightly left, large readable face, entire crown/headgear and beard inside the frame, both shoulders visible. No full-body figure. Keep a little headroom; do not clip the top of the headgear or beard.
Clothing: historically grounded late Eastern Han / Three Kingdoms officer clothing and armor, guided by the period-2 native head and the person's mature military appearance. No modern objects or fantasy armor.
Lighting and background: consistent soft side light, lifelike cinematic realism, restrained dark ochre/gray tones. A simple softly blurred military camp or stone corridor backdrop with shallow depth of field. Let the face dominate; no prominent banners, crowds, battle action or bright decorations.
Constraints: no text, calligraphy, name plate, subtitles, UI, border, signature, watermark, logo, split screen, reference inset or pixel-sprite overlay. Do not replicate the reference image itself as the output. No alternate identity, face swap, beautified young celebrity face, anime, cartoon, modern clothing, glasses, firearms, extra people or excessive gore. The background must be opaque, not transparent.
```

### 拒收候选 2

- 原始内置输出：`C:\Users\75112\.codex\generated_images\01a116ec-1a89-7021-bcba-ea589a792a30\exec-16fdcaa3-a8b5-4f1a-9417-5e7adc150606.png`。
- 1672×941，RGB PNG，2422359 bytes；SHA256 `53f0b0e52d4e9a95f011b513708ab90f6324e4d556aa00b9b1f8b3e7599674f4`。
- 视觉检查：冠顶被画幅裁掉，未采用；没有图像后处理。

实际完整提示词：

```text
Use case: historical-scene.
Asset type: one new high-definition game character bust portrait in a wide horizontal 16:9 canvas, matching the existing realistic cinematic Three Kingdoms portrait set.
Subject identity: Ma Teng (马腾), period 2 “Rise of Cao Cao” / 曹操崛起, native zero-based PersonID 11. Exactly one Chinese male officer.
Input image 1 is the actual period-2 24×24 black-and-white native head sprite. It is the primary identity and period-costume authority: preserve its facial structure, mature age, eyebrow/eye shape, nose, moustache, beard silhouette and headgear outline. Translate that sprite into believable human anatomy without turning it into a different officer.
Input image 2 is the accepted period-1 HD portrait of the same Ma Teng. Use it for continuity of the same person and especially the established realistic cinematic art style, natural skin texture, restrained cloth/metal textures, soft side lighting, contrast and warm earthy grading. Do not copy period-1 costume or headgear if they conflict with the actual period-2 native sprite; image 1 wins for identity details and period appearance.
Composition: wide horizontal 16:9, fully developed high-resolution image. A medium half-body portrait framed from the middle of the torso upwards, not an extreme facial close-up. The complete headgear top must end well below the top edge: reserve a clearly visible 8–12% band of empty blurred background above the tallest part of his crown. Head and beard together occupy roughly the central 60% of image height. Both armored shoulders and the complete lower tip of the beard must be visible within the canvas. Keep the man slightly left of center with balanced breathing room, never clip the crown, side pin or beard. No full-body figure.
Clothing: historically grounded late Eastern Han / Three Kingdoms officer clothing and armor, guided by the period-2 native head and the person's mature military appearance. No modern objects or fantasy armor.
Lighting and background: consistent soft side light, lifelike cinematic realism, restrained dark ochre/gray tones. A simple softly blurred military camp or stone corridor backdrop with shallow depth of field. Let the face dominate; no prominent banners, crowds, battle action or bright decorations.
Constraints: no text, calligraphy, name plate, subtitles, UI, border, signature, watermark, logo, split screen, reference inset or pixel-sprite overlay. Do not replicate the reference image itself as the output. No alternate identity, face swap, beautified young celebrity face, anime, cartoon, modern clothing, glasses, firearms, extra people or excessive gore. The background must be opaque, not transparent.
```

## 文件核验

时期二11张全部通过 PNG 完整解码检查，均为1672×941 RGB，不含 alpha 或 PNG transparency metadata；项目文件与内置原始输出逐字节相等。11张的原生与风格参考哈希均与生成前记录相同。既有14张时期一高清 PNG 已逐字节与当前 HEAD 比较，全部未改动。

## 其余三张的独立制作记录

这三张同样使用内置 `image_gen` 独立生成，`transparent_background:false`，所有本地输入在调用前实际 `view_image`，最终原图在调用输出后实际查看。原始生成 PNG 逐字节复制，未裁剪、缩放或转码；保留原 source。时期二的诸葛亮和吕布原生面容较年轻、少须，身份参考优先，已有 P1 仅作画风辅助。

### 182 诸葛亮

- 原生身份参考：`F:/project/baye-sanguo/assets/hd-portraits/refs/period-2/182-诸葛亮.png`，24×24，SHA-256 `707fbc370eccda004b5d6a84994388dc346a137d3d499edf651920361165b24e`。
- P1辅助参考：`F:/project/baye-sanguo/assets/hd-portraits/hd/hd_p1_0157_诸葛亮.png`，1280×720，SHA-256 `316c52a355b07a13afa8919e8741d8b4764b2b2e8861acf949f78070ad3474fa`；同名成品的画风，当前时期的脸/年龄/冠须优先。
- 原始内置 source：`C:/Users/75112/.codex/generated_images/01a116e2-c940-7931-9e13-0a495970c85f/exec-37795e16-2f84-46f4-91a4-d1e175a2ca90.png`。
- manifest 保存目标：`F:/project/baye-sanguo/assets/hd-portraits/hd/period-2/182-诸葛亮.png`。
- 原图与目标：PNG RGB、1672×941、2337496 字节，SHA-256 `2088996dae0b0e9d065ee659d1093b7161b42df43cfe26ac630f9bbb925531fb`；原始字节相同。
- 原图视觉检查：时期二原生头像为较稀疏的年轻书生轮廓，因此保留年轻脸、较轻须与素色头巾，不套时期一成熟长须/官冠。蓝灰衣袍、柔侧光及书斋竹影为画风辅助；完整头巾和肩胸可见。
- 调用参数：`referenced_image_paths` 按原生身份、P1辅助顺序；`transparent_background=false`，未传 `num_last_images_to_include`。

完整实际 prompt：

```text
Use case: historical-scene
Asset type: original HD portrait for the standard Three Kingdoms game, period 2, 0-based PersonID 182, 诸葛亮.
Input image 1: authoritative native engine 24×24 portrait F:/project/baye-sanguo/assets/hd-portraits/refs/period-2/182-诸葛亮.png. This particular period-2 sprite shows a sparse, youthful scholar's head, a lightly outlined face, modest dark hair/head covering and little facial hair. Read the actual sprite carefully. Preserve its visible youthful age, facial angle, face shape, hair and modest headgear; do not replace it with the mature long-bearded official in image 2.
Input image 2: accepted same-name period-1 HD portrait F:/project/baye-sanguo/assets/hd-portraits/hd/hd_p1_0157_诸葛亮.png. It is ONLY a supporting reference for the accepted restrained cinematic realism, natural skin/fabric and soft side light, not the current age, beard length or tall official crown.
Primary request: generate one genuine new high-resolution historical chest-up portrait of the young Chinese scholar 诸葛亮 with the actual period-2 native appearance. Thoughtful calm expression, delicate youthful facial features and simple traditional scholar attire, muted blue-grey fabric with pale crossed collar. Facial hair and head covering should follow image 1, with no invented large beard or elaborate court crown.
Composition/framing: horizontal landscape approximately16:9, one person, a relaxed chest-up portrait. Full hair/head covering and shoulders visible, at least 8 percent clear background above the head. Subject no more than 80 percent of the image height, readable in a small portrait UI.
Scene/backdrop: quiet softly blurred wooden study/veranda and distant bamboo, simple understated historical setting.
Lighting/mood: soft natural side light, realistic skin and fabric detail, gentle contrast, dignified quiet mood consistent with the existing HD family.
Constraints: actual period-2 native identity and youthful age first. P1 only guides rendering style, never overrides the sparse youthful head. Finished opaque PNG, no text, calligraphy, watermark, signature, UI frame, collage, multiple people, modern props, fantasy glow or exaggerated accessories. This is a true new HD portrait, never native pixel enlargement.
```

### 78 周瑜

- 原生身份参考：`F:/project/baye-sanguo/assets/hd-portraits/refs/period-2/78-周瑜.png`，24×24，SHA-256 `039510e7765a00f0d2fc53618ac9d0e8fea32fb3233bab5138390b9d4b34040d`。
- P1辅助参考：`F:/project/baye-sanguo/assets/hd-portraits/hd/hd_p1_0001_曹操.png`，1280×720，SHA-256 `e75fdd2ebeec7464e85291c99cd48cd2602d96f52963205899fc16e40fd11895`；仅曹操成品的渲染画风，绝不借用曹操身份。
- 原始内置 source：`C:/Users/75112/.codex/generated_images/01a116e2-c940-7931-9e13-0a495970c85f/exec-5a3d1758-86a4-4566-ab10-b204d1982feb.png`。
- manifest 保存目标：`F:/project/baye-sanguo/assets/hd-portraits/hd/period-2/78-周瑜.png`。
- 原图与目标：PNG RGB、1672×941、2118888 字节，SHA-256 `bcb616bfba580661f6ec31b4c8346f32100c9e16306e340f2bb044b4802e3974`；原始字节相同。
- 原图视觉检查：对应原生的年轻成人面容与少须/无浓须优先，未借用曹操成熟脸和胡须；暗色冠甲、柔侧光与安静宫廊江岸保持统一写实画风。初稿裁冠拒收，松构图新稿包含完整冠顶与留白。
- 调用参数：`referenced_image_paths` 按原生身份、P1辅助顺序；`transparent_background=false`，未传 `num_last_images_to_include`。

完整实际 prompt：

```text
Use case: historical-scene
Asset type: original HD portrait for the standard Three Kingdoms game, period 2, 0-based PersonID 78, 周瑜.
Input image 1: F:/project/baye-sanguo/assets/hd-portraits/refs/period-2/78-周瑜.png is the sole authoritative identity reference: an adult Chinese commander with a relatively youthful straight face, clear brows, little or no beard, and a dark historical cap/helmet. Preserve this native face, age, hair/headgear silhouette and calm gaze.
Input image 2: F:/project/baye-sanguo/assets/hd-portraits/hd/hd_p1_0001_曹操.png is ONLY a generic accepted rendering-style reference because no period-1 HD 周瑜 is available. Borrow the natural cinematic skin, fine cloth/metal detail, gentle side light and restrained palette. Do NOT copy 曹操's face, his mature age, moustache/goatee, high court crown, robe identity or pose. The depicted person must be 周瑜 as shown in image 1.
Primary request: generate a single genuine high-resolution chest-up historical portrait of 周瑜, a poised Chinese commander from the late Han/Three Kingdoms era, natural youthful adult face with no invented heavy beard, appropriate dark Han-era commander headgear, understated charcoal and muted blue armor/robe, confident calm intelligent eyes. Keep the native likeness rather than a generic celebrity.
Composition/framing: horizontal landscape approximately16:9. A relaxed bust with full headgear visible and at least 8 percent clear softly blurred background above it, single person, complete shoulders/chest, subject including headgear occupies at most 80 percent image height. Face crisp enough for a small game portrait.
Scene/backdrop: quiet softly blurred wooden military pavilion and distant river, no legible flags, no extra foreground people.
Lighting/mood: soft natural side light, natural skin and textured historical materials; realistic cinematic portrait matching the accepted game portrait family.
Constraints: identity exclusively from period-2 native ref; image2 style only. Opaque finished PNG, no text, calligraphy, labels, watermark, logos, frame, UI, collage, duplicate faces, modern objects, fantasy glow or crowded battle scene. Genuine new HD, never an enlarged native sprite.
Targeted correction: pull the camera substantially farther back. The subject, including the entire cap, occupies at most 70 percent of image height, with an unmistakable empty background band of at least 10 percent image height above the cap. No part of the crown may touch or cross any edge. Make his commander cap a modest dark historical cap faithful to image1; do not copy the very tall official crown in image2. Keep the clean-shaven native face, quiet youthful expression and realistic style.
```

### 8 吕布

- 原生身份参考：`F:/project/baye-sanguo/assets/hd-portraits/refs/period-2/8-吕布.png`，24×24，SHA-256 `12638f011a2ef8b510f86140291fbf6a4884e14a08d3722deb3b8274c53d8a16`。
- P1辅助参考：`F:/project/baye-sanguo/assets/hd-portraits/hd/hd_p1_0020_吕布.png`，1280×720，SHA-256 `e63384b470a20f841f7399f616fdb1b4d15a7672a5de956081d172788027e2a3`；同名成品的画风，当前时期的脸/年龄/冠须优先。
- 原始内置 source：`C:/Users/75112/.codex/generated_images/01a116e2-c940-7931-9e13-0a495970c85f/exec-2d71dbb2-9737-44c7-8650-7ec90fba877a.png`。
- manifest 保存目标：`F:/project/baye-sanguo/assets/hd-portraits/hd/period-2/8-吕布.png`。
- 原图与目标：PNG RGB、1672×941、2048304 字节，SHA-256 `ec778a4b6412c863d9dacb0b679133572e10a3d919569533afbe1bc4229c0daf`；原始字节相同。
- 原图视觉检查：原生年轻少须脸优先，未复制时期一成品的成熟长须；强眉、干净下颌、深色发饰、古代甲胄与红布衣领保持识别。初稿头饰越框拒收，最终松构图包含完整发饰、肩胸及自然双手，整体写实柔侧光。
- 调用参数：`referenced_image_paths` 按原生身份、P1辅助顺序；`transparent_background=false`，未传 `num_last_images_to_include`。

完整实际 prompt：

```text
Use case: historical-scene
Asset type: original HD portrait for the standard Three Kingdoms game, period 2, 0-based PersonID 8, 吕布.
Input image1: F:/project/baye-sanguo/assets/hd-portraits/refs/period-2/8-吕布.png is the sole authoritative current-period identity reference. The native face is youthful, rounded, clean-looking with strong brows and little facial hair, dark hair/head covering. Preserve its exact visible age, face, brows, eyes and hair/headgear silhouette. Do NOT invent a long full beard.
Input image2: F:/project/baye-sanguo/assets/hd-portraits/hd/hd_p1_0020_吕布.png is an accepted supporting style reference of the same named character. Use its realistic cinematic skin, fine armor textures, muted bronze and red accents, gentle side light and chest-up portrait quality. Its mature heavy beard and ornate helmet must not replace the current-period native features. Native image1 has priority for facial identity, age and headgear.
Primary request: one original high-resolution realistic portrait of the Chinese late-Han commander 吕布 according to the native period-2 face: a strong youthful adult face with clear intense eyes, firm brows and a composed confident expression, clean cheeks and chin or only the little facial hair actually visible in image1. Appropriate modest dark historical headgear/hair arrangement from the sprite, dark bronze historical lamellar armor with restrained crimson cloth detail.
Composition/framing: horizontal landscape approximately16:9, one person, comfortable chest-up bust. Entire head/headgear, both shoulders and chest inside the frame, at least 10 percent empty background above the head. Subject at most70 percent image height, face easy to recognize in the game UI. Do not crop hair or add oversized plumes.
Scene/backdrop: softly blurred open-air historical military pavilion and grey distant hills. Quiet low-detail background.
Lighting/mood: restrained realistic cinematic side light, natural skin/fabric/metal textures, muted period palette.
Constraints: period-2 native likeness, youth and headgear first; supporting P1 rendering style second. Opaque PNG with no names, text, calligraphy, watermark, signature, logo, UI frame, modern objects, fantasy glow, collage, duplicate faces, crowds or excessive ornament. Generate genuinely new HD, never upscale native pixels.
Mandatory framing correction for this new image: camera pulled much farther away into a relaxed waist-up portrait, NOT a face close-up. The whole person from waist to the top of hair ornament must occupy only 60 percent of the image height. Leave a clearly visible empty strip of blurred background across the top 15 percent of the image. Full modest hair ornament/topknot, all hair and any plume must fit well below that strip. No accessory touches the image edges. Keep the youthful clean-shaven native face, restrained dark headgear and accepted natural cinematic rendering.
```

### 周瑜的拒收首稿

`C:/Users/75112/.codex/generated_images/01a116e2-c940-7931-9e13-0a495970c85f/exec-d6b2c58c-aeb5-4cbf-b5ca-f2f1de40b23f.png`，1672×941，2231332 字节，SHA-256 `73a87be4e60209a57f13616ac9f5d3d259812cb9b0c2e23e53e9bdaba00fb9f0`。原图查看发现头冠/发饰越过上边缘，未写入生产路径；只对完整 prompt 追加松构图要求，使用原来两张参考重新独立生成，没有修改该候选。拒收 source 留存。

拒收首稿的完整实际 prompt：

```text
Use case: historical-scene
Asset type: original HD portrait for the standard Three Kingdoms game, period 2, 0-based PersonID 78, 周瑜.
Input image 1: F:/project/baye-sanguo/assets/hd-portraits/refs/period-2/78-周瑜.png is the sole authoritative identity reference: an adult Chinese commander with a relatively youthful straight face, clear brows, little or no beard, and a dark historical cap/helmet. Preserve this native face, age, hair/headgear silhouette and calm gaze.
Input image 2: F:/project/baye-sanguo/assets/hd-portraits/hd/hd_p1_0001_曹操.png is ONLY a generic accepted rendering-style reference because no period-1 HD 周瑜 is available. Borrow the natural cinematic skin, fine cloth/metal detail, gentle side light and restrained palette. Do NOT copy 曹操's face, his mature age, moustache/goatee, high court crown, robe identity or pose. The depicted person must be 周瑜 as shown in image 1.
Primary request: generate a single genuine high-resolution chest-up historical portrait of 周瑜, a poised Chinese commander from the late Han/Three Kingdoms era, natural youthful adult face with no invented heavy beard, appropriate dark Han-era commander headgear, understated charcoal and muted blue armor/robe, confident calm intelligent eyes. Keep the native likeness rather than a generic celebrity.
Composition/framing: horizontal landscape approximately16:9. A relaxed bust with full headgear visible and at least 8 percent clear softly blurred background above it, single person, complete shoulders/chest, subject including headgear occupies at most 80 percent image height. Face crisp enough for a small game portrait.
Scene/backdrop: quiet softly blurred wooden military pavilion and distant river, no legible flags, no extra foreground people.
Lighting/mood: soft natural side light, natural skin and textured historical materials; realistic cinematic portrait matching the accepted game portrait family.
Constraints: identity exclusively from period-2 native ref; image2 style only. Opaque finished PNG, no text, calligraphy, labels, watermark, logos, frame, UI, collage, duplicate faces, modern objects, fantasy glow or crowded battle scene. Genuine new HD, never an enlarged native sprite.
```

### 吕布的拒收首稿

`C:/Users/75112/.codex/generated_images/01a116e2-c940-7931-9e13-0a495970c85f/exec-1f7c8d16-28c0-4969-8d2c-69f9ea924c61.png`，1672×941，2296011 字节，SHA-256 `cdf2f9cec94e517b9673012b3f09ca619f89b9b6c78fe2fb816b51906bb9da50`。原图查看发现头冠/发饰越过上边缘，未写入生产路径；只对完整 prompt 追加松构图要求，使用原来两张参考重新独立生成，没有修改该候选。拒收 source 留存。

拒收首稿的完整实际 prompt：

```text
Use case: historical-scene
Asset type: original HD portrait for the standard Three Kingdoms game, period 2, 0-based PersonID 8, 吕布.
Input image1: F:/project/baye-sanguo/assets/hd-portraits/refs/period-2/8-吕布.png is the sole authoritative current-period identity reference. The native face is youthful, rounded, clean-looking with strong brows and little facial hair, dark hair/head covering. Preserve its exact visible age, face, brows, eyes and hair/headgear silhouette. Do NOT invent a long full beard.
Input image2: F:/project/baye-sanguo/assets/hd-portraits/hd/hd_p1_0020_吕布.png is an accepted supporting style reference of the same named character. Use its realistic cinematic skin, fine armor textures, muted bronze and red accents, gentle side light and chest-up portrait quality. Its mature heavy beard and ornate helmet must not replace the current-period native features. Native image1 has priority for facial identity, age and headgear.
Primary request: one original high-resolution realistic portrait of the Chinese late-Han commander 吕布 according to the native period-2 face: a strong youthful adult face with clear intense eyes, firm brows and a composed confident expression, clean cheeks and chin or only the little facial hair actually visible in image1. Appropriate modest dark historical headgear/hair arrangement from the sprite, dark bronze historical lamellar armor with restrained crimson cloth detail.
Composition/framing: horizontal landscape approximately16:9, one person, comfortable chest-up bust. Entire head/headgear, both shoulders and chest inside the frame, at least 10 percent empty background above the head. Subject at most70 percent image height, face easy to recognize in the game UI. Do not crop hair or add oversized plumes.
Scene/backdrop: softly blurred open-air historical military pavilion and grey distant hills. Quiet low-detail background.
Lighting/mood: restrained realistic cinematic side light, natural skin/fabric/metal textures, muted period palette.
Constraints: period-2 native likeness, youth and headgear first; supporting P1 rendering style second. Opaque PNG with no names, text, calligraphy, watermark, signature, logo, UI frame, modern objects, fantasy glow, collage, duplicate faces, crowds or excessive ornament. Generate genuinely new HD, never upscale native pixels.
```
