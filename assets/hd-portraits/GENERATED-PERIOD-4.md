# 时期 4 的三张试点 HD 立绘生成记录

日期：2026-10-08。标准实际 LIB SHA-256：`3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e`。

本批使用内置 `image_gen`，每人独立调用，`transparent_background:false`。原生 `refs/period-4/` 的 24×24 PNG 是身份与时期装束依据；同人物的已接受 P1 HD 仅辅助画风和人物连续性。每个本地输入均先经 `view_image` 检查。未使用 CLI/API 替代，也未改原生参考、manifest 身份或引擎产物。

最终 PNG 从各次内置生成的默认 `C:/Users/75112/.codex/generated_images/` 目录逐字节复制到 manifest 既定路径，逐张原始输出路径见下文，原始候选留存。庞德首稿在交叉目检中发现裁冠，已重新独立生成并记录拒收。真实尺寸均为 1672×941（工具的近 16:9 输出）、RGB 不透明；没有裁切、缩放、转码或后处理。视觉检查是素材检查，真实游戏身份与回退由本批浏览器证据另行记录。

| 人物 / 0-based ID | 成品 | 宽 × 高 | 字节 | PNG SHA-256 |
|---|---|---|---:|---|
| 庞德 / 13 | [13-庞德.png](hd/period-4/13-庞德.png) | 1672×941 | 2226799 | `d8e0cd26c60b4b1438503bb35b0b2c6ee502c076ef06abe7e0a06c11c0960222` |
| 诸葛亮 / 72 | [72-诸葛亮.png](hd/period-4/72-诸葛亮.png) | 1672×941 | 2348284 | `638c412475aea1860a3456e7b4ee4902ba17a47d3758c20748bf5561ab4771bc` |
| 孙权 / 2 | [2-孙权.png](hd/period-4/2-孙权.png) | 1672×941 | 2107379 | `674e90bcc67f23a0a825aab5b755b50bbe7ac7ab3582f13887838825fcb3bdff` |

## 庞德 / period 4 / PersonID 13

日期：2026-10-08。时期4「三足鼎立」，0-based PersonID13。使用内置 `image_gen` 单人物独立调用，`transparent_background:false`，输入仅为时期四原生庞德与已接受的时期一同人画风参考；未使用 CLI、图像编辑、裁切、缩放、转码或扩大原生参考。两个本地输入已在调用前通过 `view_image` 查看。

### 输入与参数

- 输入1 / 身份与本时期装束优先：`F:/project/baye-sanguo/assets/hd-portraits/refs/period-4/13-庞德.png`，24×24，399 bytes，SHA256 `b40381a82c5ffa4eeb77040945aea046daca3e60d4710c9c90a0025017c6513c`。
- 输入2 / 同人连续性与电影写实画风辅助：`F:/project/baye-sanguo/assets/hd-portraits/hd/hd_p1_0058_庞德.png`，1280×720，1510681 bytes，SHA256 `ba3ca8d20a8e480a6b3ee1be8fc67962969be8d0bed6bb43a2102a66f711d4eb`。其近景裁冠不应被继承。
- `referenced_image_paths` 按以上输入1、输入2顺序；`transparent_background:false`；未传入 `num_last_images_to_include`。

### 旧候选退役

- 原始内置输出：`C:/Users/75112/.codex/generated_images/01a116e2-c940-7931-9e13-0a495970c85f/exec-69e853e0-b022-4720-9758-94eb3b5bfcff.png`。
- 当时 target：`F:/project/baye-sanguo/assets/hd-portraits/hd/period-4/13-庞德.png`。
- 1672×941 RGB PNG，2386840 bytes；SHA256 `7b71371bf9206b182a169a5d47a02f74c95b24ddde282d1051923cc933adfe47`。
- 替换前已核对当时 target 与旧 source 逐字节相等。旧 source 保留在原内置生成目录。
- 实际缺陷：冠体中央上方弧面延伸到图像 y=0，x600..775 范围内帽面被顶边切断；完整冠顶轮廓不可见。这是实际裁冠，不能因仅缺顶部留白而接受。

旧候选完整实际 prompt：

```text
Use case: historical-scene
Asset type: finished HD portrait for the Three Kingdoms game, standard LIB period 4, 0-based PersonID 13, 庞德.
Input image 1 is the authoritative native 24×24 portrait for period 4 / 庞德 / PersonID 13. Read its visible facial shape, mature age, strong brow, moustache and beard, and dark high cap carefully. This input controls identity and the period-specific headgear; do not substitute another general.
Input image 2 is an accepted period-1 HD portrait of the SAME person, 庞德. It is a supporting style and same-person continuity reference, not an edit target. Match its restrained cinematic realism, natural skin and fabric detail, soft side light, and muted historical palette. Preserve the current period-4 native characteristics whenever the two references differ.
Primary request: create one original high-definition, realistic chest-up portrait of 庞德 from the late Han / Three Kingdoms era. A rugged mature Chinese general, broad face, intense brows, dark moustache and full beard, dark tall Han-era cap and practical dark lamellar armor with a worn cloth cloak. His face is calm, resolute, and distinct rather than an idealized celebrity.
Composition/framing: horizontal landscape image, approximately 16:9. One person only, chest and shoulders visible; leave room around the complete crown and beard. Face clear at small game UI size. Match the accepted portrait family; no cropped headgear.
Scene/backdrop: softly blurred mountain military camp with subdued warm grey-brown tones, no readable banners or additional foreground people.
Lighting/mood: soft natural side light, realistic textured skin, gentle contrast, no dramatic supernatural glow.
Constraints: actual facial identity, age, beard and headgear from native period 4 first; same-person continuity second; natural historical materials. Finished opaque background, no frame, no text, no names, no logo, no watermark, no UI, no collage, no duplicated faces, no modern clothing or fantasy armor. Produce a genuine new high-resolution image; do not enlarge or repaint the native pixels into a pixel-art asset.
```

### 新接受原图

- 原始内置输出：`C:\Users\75112\.codex\generated_images\01a116ec-1a89-7021-bcba-ea589a792a30\exec-dd32b8ec-a15c-4cb0-8e70-d10c574c423e.png`。
- manifest 同一保存目标：`F:/project/baye-sanguo/assets/hd-portraits/hd/period-4/13-庞德.png`。
- 1672×941 RGB PNG，2226799 bytes；SHA256 `d8e0cd26c60b4b1438503bb35b0b2c6ee502c076ef06abe7e0a06c11c0960222`。
- 先查看生成原图，再查看保存后的 target；二者逐字节相等。只替换本批新建的这个 target，原生与时期一参考均未改动。
- 实际视觉检查：Accepted correction: relaxed waist-up composition, complete rounded tall crown and its side outlines fully below the top edge, complete hair and tapered beard, both shoulders and substantial torso visible. Mature strong face, heavy brows, moustache and beard retain the native Pang De and accepted same-person period-1 rendering style. Natural weathered skin, dark practical armor and worn cloak, quiet defocused mountain pavilion. No lettering, UI, crowd or extra people; no crop/resize/post-processing.

新调用完整实际 prompt：

```text
Use case: historical-scene.
Create ONE genuinely new realistic cinematic portrait of Pang De (庞德), historical Three Kingdoms game period 4 "三足鼎立", native zero-based PersonID 13, in a wide horizontal 16:9 opaque PNG.
Reference roles and priority:
Image 1 is the actual period-4 native 24×24 portrait for 庞德 / PersonID 13. It is the authoritative identity reference for his mature strong face, heavy brows, moustache and full tapered beard, dark tall structured cap and visible period costume.
Image 2 is the accepted period-1 HD portrait of this same Pang De, ONLY for same-person facial continuity, realistic cinematic skin, natural cloth/metal textures, muted historical palette and soft side lighting. DO NOT copy its close crop or cut-off crown, its battle crowd or flags, or use older costume over the current native reference. Image 1 always takes priority for period identity and headgear.
MANDATORY SPATIAL COMPOSITION: pull the camera far back into a relaxed waist-up portrait. The entire visible figure from the waist to the TOP of the crown occupies ONLY 60 percent of canvas height. Position the TOPMOST crown point at y=15 percent of the canvas height. The top 15 percent must be an unmistakable continuous strip of quietly blurred BACKGROUND with absolutely NO hat, hair, pin, ornament or body in that strip. His face itself occupies only about 18–22 percent of canvas height. Complete crown including its curved upper arc, side outlines and any pin, all hair and entire beard must remain well INSIDE every frame edge. Both shoulders and substantial upper torso visible. Center the figure slightly left horizontally. No face close-up and no cropped crown.
Depict a stern rugged mature Chinese military commander with a broad brow, narrow resolute eyes, a dark curved moustache and full pointed dark beard. Preserve the recognizable face and native headgear silhouette, not a generic beautiful actor. Practical historical late-Han lamellar armor and a worn cloth cloak in muted charcoal, bronze and earthy gray-brown, respecting the native period-4 appearance.
Consistent soft natural side light, realistic weathered skin and materials, restrained cinematic contrast, shallow depth of field. A simple quiet defocused mountain pavilion or stone corridor, with no prominent flags, armies, foreground people or props.
Exactly one historical officer. No lettering, Chinese characters, nameplate, subtitles, watermark, signature, logo, UI frame, inset sprite, split screen, collage, modern clothing, glasses, guns, fantasy armor, exaggerated glow, extra limbs or gore. Generate original high-definition artwork rather than duplicating or upscaling either reference. Keep an opaque finished background.
```

## 诸葛亮 / period 4 / PersonID 72

- 身份参考：`assets/hd-portraits/refs/period-4/72-诸葛亮.png`，24×24，SHA-256 `1d65c6fd0fb986134515f816bd19a6101fa7dccf56c7ba89c302fdf4463d38cc`。
- 同人画风参考：`assets/hd-portraits/hd/hd_p1_0157_诸葛亮.png`，1280×720，SHA-256 `316c52a355b07a13afa8919e8741d8b4764b2b2e8861acf949f78070ad3474fa`。
- 原始内置输出：`C:/Users/75112/.codex/generated_images/01a116e2-c940-7931-9e13-0a495970c85f/exec-75897ea0-e389-4ca3-8fb7-ca647a9bfa11.png`。
- 成品：`assets/hd-portraits/hd/period-4/72-诸葛亮.png`，1672×941 RGB，2348284 字节，SHA-256 `638c412475aea1860a3456e7b4ee4902ba17a47d3758c20748bf5561ab4771bc`；与原始输出字节一致。
- 原图实际查看结果：成熟清瘦脸、长须与文士冠对应原生特征，蓝灰衣领和羽扇保持人物识别；松构图包含冠顶、横簪及上方留白，虚化山雾统一画风。初稿裁冠，拒收后重新生成。

完整实际提交提示词：

```text
Use case: historical-scene
Asset type: finished HD portrait for the Three Kingdoms game, standard LIB period 4, 0-based PersonID 72, 诸葛亮.
Input image 1: authoritative original engine portrait, native 24×24, period 4 / PersonID 72 / 诸葛亮. Preserve this person's slender mature face, visible brow and nose proportions, thoughtful eyes, moustache and narrow longer beard, and the actual period-specific dark scholar crown. Native facial details and period attire take precedence.
Input image 2: accepted period-1 HD portrait of the SAME 诸葛亮, supporting same-person continuity and visual style only. Match its realistic cinematic skin, restrained blue-grey robe textures, soft natural side light and quiet misty backdrop; do not copy its age or crown details when they conflict with the period-4 native reference.
Primary request: create one genuine original high-resolution realistic portrait of this Chinese late-Han/Three-Kingdoms scholar and strategist. Calm intelligent mature expression, slim face, subtle age lines, neatly kept moustache and tapered longer dark beard with modest grey, appropriate black scholar crown, layered muted blue-grey historical robe and pale crossed collar. A small white feather fan may sit near the lower chest edge.
Composition/framing: horizontal landscape approximately 16:9, a single chest-up person, full crown including any pin and beard visible with comfortable space above the head. Simple complete chest and shoulders, readable face at small game UI sizes. Keep his appearance distinguishable from generals and from other court officials.
Scene/backdrop: softly blurred cool mountain mist and faint wooden pavilion. Atmospheric but subordinate to the face.
Lighting/mood: gentle natural side light, natural skin and fine fabric grain, quiet dignified mood. Consistent cinematic realism with the accepted portrait family.
Constraints: native period-4 identity and headgear first; supporting same-person style second. Finished opaque image. No text, calligraphy, labels, logos, watermark, frame, UI, collage, duplicate people, modern items, fantasy glow, or exaggerated accessories. Do not upscale or turn the pixel reference into pixel art; generate a true new high-resolution portrait.
Composition correction for this new generation: the crown must NOT touch the image border. Use a noticeably looser bust composition, camera pulled back, subject including his entire tall hat occupies at most 80 percent of the image height. Leave an obvious band of empty softly blurred background above the complete crown, at least 8 percent of the image height. All of the hat and horizontal hairpin remain comfortably inside the frame. Keep the same native identity and realistic style.
```

## 孙权 / period 4 / PersonID 2

- 身份参考：`assets/hd-portraits/refs/period-4/2-孙权.png`，24×24，SHA-256 `4133015bd026dea546f0cfa87ae1e46c92b61c3ea1a45d8c43b325c1c86abf1a`。
- 同人画风参考：`assets/hd-portraits/hd/hd_p1_0055_孙权.png`，1280×720，SHA-256 `f279cd93659697b8037858a9f960c5947d90d0153477ded78dd0410165d52390`。
- 原始内置输出：`C:/Users/75112/.codex/generated_images/01a116e2-c940-7931-9e13-0a495970c85f/exec-4d9177d9-b437-43eb-b53a-359147414584.png`。
- 成品：`assets/hd-portraits/hd/period-4/2-孙权.png`，1672×941 RGB，2107379 字节，SHA-256 `674e90bcc67f23a0a825aab5b755b50bbe7ac7ab3582f13887838825fcb3bdff`；与原始输出字节一致。
- 原图实际查看结果：成年面容、眉眼、短尖须及黑冠与对应原生和同人 P1 连续；深蓝黑衣领、柔侧光与宫廊江岸虚化背景统一画风，冠顶、胡须及双肩未裁断。

完整实际提交提示词：

```text
Use case: historical-scene
Asset type: finished HD portrait for the Three Kingdoms game, standard LIB period 4, 0-based PersonID 2, 孙权.
Input image 1: authoritative 24×24 engine portrait of period-4 孙权 / PersonID 2. It controls actual facial identity, head angle, eyebrows, nose, moustache, short tapered beard and dark cap. Maintain the adult period-4 age and the native facial proportions.
Input image 2: accepted period-1 HD portrait of the SAME 孙权. Supporting same-person continuity and cinematic realistic style, not an edit target or an identity replacement. Keep him recognizably the same man as this portrait, naturally a little more mature in period 4; the native current-period details take priority.
Primary request: one original high-definition realistic chest-up portrait of the Chinese Three Kingdoms ruler 孙权. Watchful thoughtful eyes, adult angular face, restrained moustache and short pointed beard, dignified dark Han-era formal crown and subdued deep blue-black historical court robe with fine woven detail and modest armor detail.
Composition/framing: horizontal landscape approximately 16:9. One figure only. A relaxed bust composition, whole crown and beard with at least 8 percent of the image height as empty background above the crown; the figure including his crown occupies no more than 80 percent of the image height. Both shoulders and part of chest visible; no cropped headgear. Face remains clear at small game portrait size.
Scene/backdrop: gently blurred wooden palace veranda looking onto a misty river, a faint distant historical boat, no extra foreground people. Background secondary to the face.
Lighting/mood: natural soft side light, realistic skin and fabric, calm strong presence. Match accepted HD portraits' cinematic realism and restrained muted palette.
Constraints: current-period native identity and age first; same-person reference style second. Opaque finished image, no frame, text, labels, signatures, watermark, UI, collage, extra faces, modern props, fantasy glow or bright exaggerated armor. Genuine new high-resolution imagery, not a native pixel enlargement.
```

## 拒收候选

诸葛亮首张 `C:/Users/75112/.codex/generated_images/01a116e2-c940-7931-9e13-0a495970c85f/exec-8d1f45c0-75f9-43d0-a425-c44f9500c7a4.png`，1672×941，2411790 字节，SHA-256 `4482f4f44dbcc3733a15a2e9388ac94317e9b661c0049c9539ddcea40e657b0a`。原图查看发现冠顶越过上边缘，因此没有写入生产路径。仅在完整提示词末尾追加松构图要求后独立重新生成，未编辑该候选。

首张完整提示词：

```text
Use case: historical-scene
Asset type: finished HD portrait for the Three Kingdoms game, standard LIB period 4, 0-based PersonID 72, 诸葛亮.
Input image 1: authoritative original engine portrait, native 24×24, period 4 / PersonID 72 / 诸葛亮. Preserve this person's slender mature face, visible brow and nose proportions, thoughtful eyes, moustache and narrow longer beard, and the actual period-specific dark scholar crown. Native facial details and period attire take precedence.
Input image 2: accepted period-1 HD portrait of the SAME 诸葛亮, supporting same-person continuity and visual style only. Match its realistic cinematic skin, restrained blue-grey robe textures, soft natural side light and quiet misty backdrop; do not copy its age or crown details when they conflict with the period-4 native reference.
Primary request: create one genuine original high-resolution realistic portrait of this Chinese late-Han/Three-Kingdoms scholar and strategist. Calm intelligent mature expression, slim face, subtle age lines, neatly kept moustache and tapered longer dark beard with modest grey, appropriate black scholar crown, layered muted blue-grey historical robe and pale crossed collar. A small white feather fan may sit near the lower chest edge.
Composition/framing: horizontal landscape approximately 16:9, a single chest-up person, full crown including any pin and beard visible with comfortable space above the head. Simple complete chest and shoulders, readable face at small game UI sizes. Keep his appearance distinguishable from generals and from other court officials.
Scene/backdrop: softly blurred cool mountain mist and faint wooden pavilion. Atmospheric but subordinate to the face.
Lighting/mood: gentle natural side light, natural skin and fine fabric grain, quiet dignified mood. Consistent cinematic realism with the accepted portrait family.
Constraints: native period-4 identity and headgear first; supporting same-person style second. Finished opaque image. No text, calligraphy, labels, logos, watermark, frame, UI, collage, duplicate people, modern items, fantasy glow, or exaggerated accessories. Do not upscale or turn the pixel reference into pixel art; generate a true new high-resolution portrait.
```
