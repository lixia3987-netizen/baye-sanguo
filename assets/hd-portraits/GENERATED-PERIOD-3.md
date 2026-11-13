# 第三时期 HD 人物立绘生成记录

日期：2026-10-08。时期：3「赤壁之战」。标准 LIB SHA-256：`3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e`。

范围为已接受 manifest 的 11 个第三时期试点，PersonID 为零基索引。首轮 11 次内置生成后，交叉原图复审发现 7 张冠/缨实际越框；这些首稿已拒收，分别独立再生成 1 次并原字节替换本批尚未提交的新建目标。共 18 次调用、11 张最终交付与 7 张拒收首稿。杨秋134、关羽79、诸葛亮90、孙权6的冠帽轮廓完整，保留首稿；接近边缘本身没有误判为裁切。

## 生成方法与边界

全部使用内置 `image_gen.imagegen`，每人每次独立调用，`transparent_background: false`。未使用 CLI/API、图像拼接、裁剪、缩放、重编码或原生24×24放大。最终 PNG 从 `$CODEX_HOME/generated_images` 按字节复制至 manifest 指定目标，所有原 source（包括拒收首稿）仍留存。每个最终目标与相应原 source 逐字节一致。

每次生成前均用 `view_image` 查看该时期的原生 24×24 肖像与已接受同名 P1 HD；周瑜没有 P1 试点，使用 P1 曹操仅作渲染画风。原生第三时期决定脸、冠帽、胡须和年龄可辨轮廓，P1只辅助电影写实、材质和柔侧光，不覆写当前时期身份或服装。7 次修正只追加松构图要求，重新生成完整原图，没有修改旧输出。提示中的60%主体和15%上方留白是生成要求；验收依实际原图确认完整冠/缨在框内，不把提示比例伪称精确实测。

依据 `assets/hd-portraits/PROMPT.md` 与技能 `C:/Users/75112/.codex/skills/.system/imagegen/SKILL.md`。以下记录包含所有实际完整提示词、输入角色、参考 SHA、source、最终尺寸与 SHA。原生24像素只能支持可辨身份方向，不能据此承诺照片级人物逐像素等价。原图素材检查不等于真实游戏身份/出战验收；地图、原生菜单和战场挂载结果另由真实 runtime 证据记录。

## 最终交付清单

| PersonID | 人物 | 最终目标 | 原始像素 | 字节数 | 最终 SHA-256 | 本轮状态 |
| --- | --- | --- | --- | --- | --- | --- |
| 6 | 孙权 | [6-孙权.png](hd/period-3/6-孙权.png) | 1672×941 RGB | 2139262 | `bb91833252ec7e8454d6307f1297a3c3188cd26790c15caa5bdd53dd0d0e41c6` | 完整首稿保留 |
| 7 | 马腾 | [7-马腾.png](hd/period-3/7-马腾.png) | 1672×941 RGB | 2201462 | `5225ddfc81d6842a19e3a7c0d4d9d4c7642ef13eaedef4572992c8fb8d1568f5` | 冠/缨越框首稿拒收后独立重生成 |
| 126 | 庞德 | [126-庞德.png](hd/period-3/126-庞德.png) | 1672×941 RGB | 2270954 | `1b5cf39df730336fc9eab161cfb79cd240e24d624ce9f506b17bc59d4ace64d2` | 冠/缨越框首稿拒收后独立重生成 |
| 134 | 杨秋 | [134-杨秋.png](hd/period-3/134-杨秋.png) | 1672×941 RGB | 2265978 | `218cfecc0e498ccc7c81557234fe442c8dc9b1f2ad695a2106d126c618394a38` | 完整首稿保留 |
| 131 | 梁兴 | [131-梁兴.png](hd/period-3/131-梁兴.png) | 1672×941 RGB | 2084077 | `e17ce0a0a532398bd5961ea0493cd69362a56d74a2e9d5e68303fd92965f3c36` | 冠/缨越框首稿拒收后独立重生成 |
| 4 | 曹操 | [4-曹操.png](hd/period-3/4-曹操.png) | 1672×941 RGB | 1867602 | `c4052fc2c2c197026a3e8e3be909b13094b14c0b4134db875db921448d474480` | 冠/缨越框首稿拒收后独立重生成 |
| 5 | 刘备 | [5-刘备.png](hd/period-3/5-刘备.png) | 1672×941 RGB | 2276994 | `53327267000a021cb09e8a5c9e085c888489e41f63d9f4284c0a75941ace6e6a` | 冠/缨越框首稿拒收后独立重生成 |
| 79 | 关羽 | [79-关羽.png](hd/period-3/79-关羽.png) | 1672×941 RGB | 2502937 | `ec730ec188b01d9ee80c6c52045b688ff9b1eeb15e512f17e63cd1096a2bea38` | 完整首稿保留 |
| 80 | 张飞 | [80-张飞.png](hd/period-3/80-张飞.png) | 1672×941 RGB | 2384867 | `41b70a084f8fd28040aba5c05cfe13c1a3e761083c18f036156e39494f80c1c9` | 冠/缨越框首稿拒收后独立重生成 |
| 90 | 诸葛亮 | [90-诸葛亮.png](hd/period-3/90-诸葛亮.png) | 1672×941 RGB | 2301661 | `c7095a2cce45d16d915771d0d3858f1733195cc3a2dddb72d216d74096c185bb` | 完整首稿保留 |
| 104 | 周瑜 | [104-周瑜.png](hd/period-3/104-周瑜.png) | 1672×941 RGB | 2014389 | `40d027b881019716318b0b436836bbc54ec22694bfe74e6389dd2eecd34e33fa` | 冠/缨越框首稿拒收后独立重生成 |

## 最终原始来源、参考与完整提示

### 6 孙权 · 最终成品

- 原生身份参考（输入1）：`F:/project/baye-sanguo/assets/hd-portraits/refs/period-3/6-孙权.png`；24×24；SHA-256 `4133015bd026dea546f0cfa87ae1e46c92b61c3ea1a45d8c43b325c1c86abf1a`。
- 已接受 P1 同名画风参考（输入2）：`F:/project/baye-sanguo/assets/hd-portraits/hd/hd_p1_0055_孙权.png`；1280×720；SHA-256 `f279cd93659697b8037858a9f960c5947d90d0153477ded78dd0410165d52390`。
- 原始内置 source：`C:/Users/75112/.codex/generated_images/01a116e3-623c-7513-a5e0-580eb72033be/exec-cf431a36-44ba-4c65-892e-e09100db2755.png`。
- manifest 保存目标：`F:/project/baye-sanguo/assets/hd-portraits/hd/period-3/6-孙权.png`。
- PNG / RGB / 1672×941 / 2139262 bytes；source 与当前目标的 SHA-256 均为 `bb91833252ec7e8454d6307f1297a3c3188cd26790c15caa5bdd53dd0d0e41c6`，二者逐字节一致。
- 视觉检查：已 view_image 检查原生24×24与同名P1参考，再检查生成原图。单一人物半身胸像、成人年龄、黑色冠帽、细须与短颏须、柔和侧光、真实皮肤/衣甲纹理，虚化宫廊及江岸背景，无文字、水印、签名或UI。P1只作画风与同人物辅助；原生头像低分辨率，不能据此承诺照片级身份逐像素等价。根任务已 view 原图并通过首张画风检查。 本轮交叉复审再次view成品：圆冠/帽的最高点接近上边缘，但完整轮廓仍在图内；贴边没有误判为实际裁切，保留首稿原字节。

调用：`referenced_image_paths` 按上述原生、P1顺序；`transparent_background=false`，未传 `num_last_images_to_include`。该人物只有首轮1次调用。

完整实际提交 prompt：

```text
Use case: historical-scene
Asset type: 原创 HD 三国人物立绘，第三时期「赤壁之战」，孙权，manifest period=3/personId=6。
Primary request: 以图1真正原生24×24头像为同一人，生成一张高质量写实电影感半身胸像。请认真读图1的脸型、五官、眉眼、胡须轮廓、冠帽和年龄感；保留其身份与头部姿态，不把他换成别的武将。
Input images: 图1 F:/project/baye-sanguo/assets/hd-portraits/refs/period-3/6-孙权.png 是身份与第三时期冠帽/胡须的唯一原生依据。图2 F:/project/baye-sanguo/assets/hd-portraits/hd/hd_p1_0055_孙权.png 是已接受的同名第一时期HD画风参考，只参考真实皮肤、柔和侧光、历史材质、电影质感与半身构图；不是第三时期服装或冠帽的覆写来源。人物具体特征优先图1。
Scene/backdrop: 东汉末三国时期简洁宫廊或江岸远景，浅景深柔焦，只需安静低细节背景，不堆满旗帜或杂兵。
Subject: 中国三国人物孙权，成人男性。面部、冠帽、胡须和年龄按图1可辨轮廓，还原为自然可信的真实人物；历史衣袍或衣甲有细致但克制的织物与金属质感。
Style/medium: 与图2一致的写实电影历史人物胸像，非卡通、非油画滤镜；自然毛发与皮肤微纹理，柔和侧光，端正可信表情。
Composition/framing: 16:9横向原始画幅，单独一人，完整冠帽留有顶端呼吸空间，头部与肩胸清楚、主体居中偏近景。直接生成16:9原图，不加信箱黑边，不裁切或拉伸参考头像，不做原生像素图放大。
Constraints: 身份依据图1；P1只作画风辅助。保留第三时期原生头部特征。无文字、无现代物品、无水印、无签名、无边框或UI。背景不透明。
Avoid: 换脸、另一武将、现代服装、眼镜、手表、枪械、卡通贴纸、鲜血特写、拥挤战场、多人物、乱码文字。
```

### 7 马腾 · 最终成品

- 原生身份参考（输入1）：`F:/project/baye-sanguo/assets/hd-portraits/refs/period-3/7-马腾.png`；24×24；SHA-256 `3bb0f9684e7727be1809ae34def94099ef4521a7cae4bb7cc0b0c41ba5ed13d9`。
- 已接受 P1 同名画风参考（输入2）：`F:/project/baye-sanguo/assets/hd-portraits/hd/hd_p1_0005_马腾.png`；1280×720；SHA-256 `dd470ee27ffaafd446cf4e79554379190d19cc23579aae215cd5d8b7a0181d1c`。
- 原始内置 source：`C:/Users/75112/.codex/generated_images/01a116e3-623c-7513-a5e0-580eb72033be/exec-313c9895-34b9-49ad-afae-0bdc949e805f.png`。
- manifest 保存目标：`F:/project/baye-sanguo/assets/hd-portraits/hd/period-3/7-马腾.png`。
- PNG / RGB / 1672×941 / 2201462 bytes；source 与当前目标的 SHA-256 均为 `5225ddfc81d6842a19e3a7c0d4d9d4c7642ef13eaedef4572992c8fb8d1568f5`，二者逐字节一致。
- 视觉检查：修正前已再次查看原生24×24身份图与同名P1画风图；新原图经view_image确认高冠、横簪及头脸全部在画幅内，冠上约一成以上自然背景，主体从完整冠饰到胸腰可见，长须、年长面容及衣甲保持原生人物方向。单人电影柔侧光，远山江岸低细节背景，无文字、水印或UI；未裁切/缩放，原始bytes保存。旧首稿高冠越过上边缘，现列拒收而非最终交付。

调用：`referenced_image_paths` 按上述原生、P1顺序；`transparent_background=false`，未传 `num_last_images_to_include`。本次是该人物的第2次独立生成；首稿详见下方拒收记录。

完整实际提交 prompt：

```text
Use case: historical-scene
Asset type: 原创 HD 三国人物立绘，第三时期「赤壁之战」，马腾，period=3/personId=7。
Primary request: 以图1原生24×24头像为同一人，生成写实电影感半身胸像。图1的脸型、五官、眉眼、胡须、冠帽轮廓、年龄感和头部姿态优先，不能换成别的武将。
Input images: 图1 F:/project/baye-sanguo/assets/hd-portraits/refs/period-3/7-马腾.png 是本人物第三时期身份与冠帽/胡须的原生依据。图2 F:/project/baye-sanguo/assets/hd-portraits/hd/hd_p1_0005_马腾.png 是已接受的同名第一时期 HD，只辅助电影写实画风、自然肤质、历史材质、柔侧光和半身构图；不得直接将 P1 服装/冠帽覆写到时期3。
Subject: 马腾，成熟略年长的中国男性，宽厚面部、浓眉、严肃沉稳眼神、浓密长须与鬓发按图1。头部较低平横额带的冠帽轮廓以图1为准，不直接照搬P1高冠；保持原生可辨年龄感，不能年轻化。
Scene/backdrop: 东汉末三国时期的简洁远山或宫廊，浅景深虚化，安静低细节，不堆旗帜杂兵。
Style/medium: 与图2一致的写实历史电影人物胸像，真实毛发、自然皮肤微纹理，古代衣甲与布料有克制的质感，统一柔和侧光。
Composition/framing: 直接生成16:9横向原始画幅，单独一人，完整冠帽留出上方空间，头部肩胸清楚。不可加黑边、拼贴、裁伸像素头像或以24像素放大当HD。
Constraints: 身份特征优先图1；P1仅画风辅助。无现代物品、无文字、水印、签名、边框和UI；背景不透明。
Avoid: 不同人物、换脸、现代服装、眼镜、手表、枪械、卡通贴纸、鲜血特写、拥挤战场、多余肢体、乱码文字。
Composition correction, highest priority: 拍摄距离拉远，松构图，完整帽冠、发簪、缨羽和鬓发全部保留在原图内。人物（含完整冠饰至胸腰部）只占约60%画高，上方保留至少15%画高的自然背景空间。画幅上边缘绝不能碰到或切掉冠顶、缨羽、发髻或发饰，不用放大人物填满画面。This is a new original full composition: the entire hat/crown and plume must fit comfortably inside the frame, with at least 15% natural background above the highest point. Camera pulled back; subject occupies only about 60% of canvas height. No cropping, reframing, editing or resizing an old output. Keep the character's native face, age, beard and headgear identity, image 2 only for rendering style; all other historical realism and no-text/no-UI constraints remain.
```

### 126 庞德 · 最终成品

- 原生身份参考（输入1）：`F:/project/baye-sanguo/assets/hd-portraits/refs/period-3/126-庞德.png`；24×24；SHA-256 `b40381a82c5ffa4eeb77040945aea046daca3e60d4710c9c90a0025017c6513c`。
- 已接受 P1 同名画风参考（输入2）：`F:/project/baye-sanguo/assets/hd-portraits/hd/hd_p1_0058_庞德.png`；1280×720；SHA-256 `ba3ca8d20a8e480a6b3ee1be8fc67962969be8d0bed6bb43a2102a66f711d4eb`。
- 原始内置 source：`C:/Users/75112/.codex/generated_images/01a116e3-623c-7513-a5e0-580eb72033be/exec-7799de2f-27d6-442c-b4e9-5ee58ea86ecb.png`。
- manifest 保存目标：`F:/project/baye-sanguo/assets/hd-portraits/hd/period-3/126-庞德.png`。
- PNG / RGB / 1672×941 / 2270954 bytes；source 与当前目标的 SHA-256 均为 `1b5cf39df730336fc9eab161cfb79cd240e24d624ce9f506b17bc59d4ace64d2`，二者逐字节一致。
- 视觉检查：修正前再次查看本时期原生24×24身份图和同名P1画风；新原始PNG经view_image确认完整高冠、发带与鬓发都在画幅内，冠顶上方约一成画高自然背景，胸腰衣甲可见，浓眉、成熟脸与胡须保留。单人柔侧光、低细节山河背景，无文字、水印、UI；没有裁切/缩放或重编码。旧首稿高冠越框，记录为拒收。

调用：`referenced_image_paths` 按上述原生、P1顺序；`transparent_background=false`，未传 `num_last_images_to_include`。本次是该人物的第2次独立生成；首稿详见下方拒收记录。

完整实际提交 prompt：

```text
Use case: historical-scene
Asset type: 原创 HD 三国人物立绘，第三时期「赤壁之战」，庞德，period=3/personId=126。
Primary request: 以图1原生24×24头像为同一人，生成写实电影感半身胸像。脸型、五官、眉眼、胡须、冠帽/头盔轮廓、年龄感及头部姿态必须优先遵循图1，不能替换为另一人物。
Input images: 图1 F:/project/baye-sanguo/assets/hd-portraits/refs/period-3/126-庞德.png 是本人物第三时期身份与冠帽/胡须的原生依据。图2 F:/project/baye-sanguo/assets/hd-portraits/hd/hd_p1_0058_庞德.png 是已接受同名P1 HD，只辅助电影写实画风、自然肤质、历史材质、柔侧光及半身构图；不能把P1服装或冠帽直接覆写到时期3。
Subject: 庞德，中国成年男性武将，硬朗宽面、浓眉严肃眼神，唇上须与浓密颏须，头冠的额带和顶部形状按图1，真实年龄感，不年轻化成少年。古代军官衣甲与朴素外袍符合东汉末三国。
Scene/backdrop: 简洁远山或军营远景，浅景深虚化，低细节，不堆旗帜或杂兵。
Style/medium: 与图2一致的历史电影写实胸像，自然毛发和皮肤微纹理，轻度旧化布料/金属衣甲、统一柔侧光。
Composition/framing: 直接生成16:9横向原始画幅；单人半身，头部与肩胸清楚，冠帽顶部有留白，不加黑边，不拼贴或裁伸24像素头像。
Constraints: 图1决定身份与时期3头部特征，P1仅画风辅助。背景不透明。无文字、水印、签名、边框、UI和现代物品。
Avoid: 换脸、另一武将、现代服装、眼镜、手表、枪械、卡通贴纸、多余手指、鲜血特写、拥挤战场或乱码文字。
Composition correction, highest priority: 拍摄距离拉远，松构图，完整帽冠、发簪、缨羽和鬓发全部保留在原图内。人物（含完整冠饰至胸腰部）只占约60%画高，上方保留至少15%画高的自然背景空间。画幅上边缘绝不能碰到或切掉冠顶、缨羽、发髻或发饰，不用放大人物填满画面。This is a new original full composition: the entire hat/crown and plume must fit comfortably inside the frame, with at least 15% natural background above the highest point. Camera pulled back; subject occupies only about 60% of canvas height. No cropping, reframing, editing or resizing an old output. Keep the character's native face, age, beard and headgear identity, image 2 only for rendering style; all other historical realism and no-text/no-UI constraints remain.
```

### 134 杨秋 · 最终成品

- 原生身份参考（输入1）：`F:/project/baye-sanguo/assets/hd-portraits/refs/period-3/134-杨秋.png`；24×24；SHA-256 `1069873fd47bf787c97bfc75a95111cedb0c41dabc8cbdc3a5fb637fcdafad6b`。
- 已接受 P1 同名画风参考（输入2）：`F:/project/baye-sanguo/assets/hd-portraits/hd/hd_p1_0066_杨秋.png`；1280×720；SHA-256 `f7dc35ced2587c9b452e1fde1277ec87b60b36cbbead47a5299fc06897feac0c`。
- 原始内置 source：`C:/Users/75112/.codex/generated_images/01a116e3-623c-7513-a5e0-580eb72033be/exec-84409f98-0ecd-4ebb-9d3e-ef3bbe1af69f.png`。
- manifest 保存目标：`F:/project/baye-sanguo/assets/hd-portraits/hd/period-3/134-杨秋.png`。
- PNG / RGB / 1672×941 / 2265978 bytes；source 与当前目标的 SHA-256 均为 `218cfecc0e498ccc7c81557234fe442c8dc9b1f2ad695a2106d126c618394a38`，二者逐字节一致。
- 视觉检查：生成前已 view 原生24×24与同名P1，生成后 view 原始 PNG。成年面孔、侧转神态、细唇须与尖长颏须、完整黑冠，电影写实软侧光及虚化宫廊远山；单人半身无文字/UI/水印。原生低分辨率不提供照片级身份精确性。 本轮交叉复审再次view成品：冠轮廓完整且有少量上方背景。

调用：`referenced_image_paths` 按上述原生、P1顺序；`transparent_background=false`，未传 `num_last_images_to_include`。该人物只有首轮1次调用。

完整实际提交 prompt：

```text
Use case: historical-scene
Asset type: 原创HD三国人物立绘，第三时期「赤壁之战」，杨秋，period=3/personId=134。
Primary request: 图1原生24×24头像为同一人的唯一时期3身份依据，生成写实电影感半身胸像，保持其脸型、眉眼、头部侧转、唇须与颏须、冠帽和成年年龄感。
Input images: 图1 F:/project/baye-sanguo/assets/hd-portraits/refs/period-3/134-杨秋.png 是第三时期真实原生头像，决定身份与头部特征。图2 F:/project/baye-sanguo/assets/hd-portraits/hd/hd_p1_0066_杨秋.png 是已接受的同名P1 HD，只提供自然皮肤/毛发、历史质感、柔侧光及电影胸像画风，不覆写时期3冠帽与衣装。
Subject: 杨秋，中国成年武将；脸有明确轮廓、细而上扬的唇须与尖长颏须，严肃但自然的目光，按图1保留侧转姿态和束发冠帽轮廓。衣甲是东汉末三国历史军官衣袍与铠甲。
Scene/backdrop: 简洁宫廊或远山背景，低细节浅景深柔焦，不堆旗帜杂兵。
Style/medium: 图2一致的历史电影写实单人胸像，自然肤质、发丝，古代织物与金属有轻度真实纹理，统一柔和侧光，不是卡通或像素放大。
Composition/framing: 直接生成16:9宽横幅原图，单人半身，完整头冠有顶部呼吸空间，肩胸清楚；不加黑边、不拼贴、不裁伸原生头像。
Constraints: 图1身份优先，P1仅画风辅助。不透明背景；无文字、水印、签名、边框UI、现代服装或物品。
Avoid: 换脸、另一武将、幼年化、眼镜、手表、枪械、卡通贴纸、多余手指、鲜血特写、拥挤战场、乱码汉字。
```

### 131 梁兴 · 最终成品

- 原生身份参考（输入1）：`F:/project/baye-sanguo/assets/hd-portraits/refs/period-3/131-梁兴.png`；24×24；SHA-256 `b93b00b2be9fe95a36356f2e71296ce69b39721e4ddfd3221caab91cba622ef6`。
- 已接受 P1 同名画风参考（输入2）：`F:/project/baye-sanguo/assets/hd-portraits/hd/hd_p1_0063_梁兴.png`；1280×720；SHA-256 `660fbbc55c24929e7afe9358a3a03e77b2efe67231e97a5a5631ca71c80b6b2e`。
- 原始内置 source：`C:/Users/75112/.codex/generated_images/01a116e3-623c-7513-a5e0-580eb72033be/exec-5a9d915e-ca8a-4f7a-b86c-91d9d3dbedf3.png`。
- manifest 保存目标：`F:/project/baye-sanguo/assets/hd-portraits/hd/period-3/131-梁兴.png`。
- PNG / RGB / 1672×941 / 2084077 bytes；source 与当前目标的 SHA-256 均为 `e17ce0a0a532398bd5961ea0493cd69362a56d74a2e9d5e68303fd92965f3c36`，二者逐字节一致。
- 视觉检查：重试前已view本时期24×24身份图与同名P1辅助图；新原图再经view_image确认高冠整个上轮廓、后簪/发带与头脸都在画幅内，冠上约一成自然背景，肩胸和腰带可见。成熟面容、眉眼、短尖颏须方向保持，历史衣甲与柔侧光一致，无文字/UI/水印；原始PNG无裁切/缩放/重编码。旧首稿冠顶越框，现记录为拒收。

调用：`referenced_image_paths` 按上述原生、P1顺序；`transparent_background=false`，未传 `num_last_images_to_include`。本次是该人物的第2次独立生成；首稿详见下方拒收记录。

完整实际提交 prompt：

```text
Use case: historical-scene
Asset type: 原创 HD 三国人物立绘，第三时期「赤壁之战」，梁兴，period=3/personId=131。
Primary request: 以图1真正原生24×24头像为同一人生成电影写实半身胸像，图1的脸型、眉眼、表情/侧转姿态、唇须与颏须轮廓、冠帽和年龄感优先，不换成另一个武将。
Input images: 图1 F:/project/baye-sanguo/assets/hd-portraits/refs/period-3/131-梁兴.png 是本人物第三时期原生身份依据。图2 F:/project/baye-sanguo/assets/hd-portraits/hd/hd_p1_0063_梁兴.png 是已接受同名 P1 HD，只辅助电影写实画风、自然皮肤毛发、历史衣甲质感、柔侧光与半身构图；不得将P1衣装冠帽或长胡须直接覆写到图1时期3。
Subject: 梁兴，中国成年男性军官，面部有成熟的眉骨、颧面和唇部轮廓，保留图1自然表情、略侧转的头姿；胡须长度和额带/冠帽依图1可辨轮廓，不凭P1加长。古代衣甲符合东汉末三国历史。
Scene/backdrop: 简洁柔焦远山或宫廊，低细节浅景深，不堆旗帜和杂兵。
Style/medium: 与图2连续的历史电影写实胸像，皮肤微纹理和自然发丝，布料/金属有轻度真实质感，柔和侧光；非卡通、非像素放大。
Composition/framing: 直接生成16:9横向原始宽幅，单独一人、半身肩胸完整，冠帽顶部有留白；不加黑边、不裁伸参考头像或拼贴。
Constraints: 图1决定身份和时期3头部，P1仅画风辅助。背景不透明；无文字、水印、签名、边框、UI、现代服装或物件。
Avoid: 换脸、另一武将、幼年化、现代眼镜、手表、枪械、卡通贴纸、多余手指、鲜血特写、拥挤战场、乱码汉字。
Composition correction, highest priority: 拍摄距离拉远，松构图，完整帽冠、发簪、缨羽和鬓发全部保留在原图内。人物（含完整冠饰至胸腰部）只占约60%画高，上方保留至少15%画高的自然背景空间。画幅上边缘绝不能碰到或切掉冠顶、缨羽、发髻或发饰，不用放大人物填满画面。This is a new original full composition: the entire hat/crown and plume must fit comfortably inside the frame, with at least 15% natural background above the highest point. Camera pulled back; subject occupies only about 60% of canvas height. No cropping, reframing, editing or resizing an old output. Keep the character's native face, age, beard and headgear identity, image 2 only for rendering style; all other historical realism and no-text/no-UI constraints remain.
```

### 4 曹操 · 最终成品

- 原生身份参考（输入1）：`F:/project/baye-sanguo/assets/hd-portraits/refs/period-3/4-曹操.png`；24×24；SHA-256 `18846bdd8c718f770d9172adffd0dc0d4b369c016b4d2e117e895b169f214fed`。
- 已接受 P1 同名画风参考（输入2）：`F:/project/baye-sanguo/assets/hd-portraits/hd/hd_p1_0001_曹操.png`；1280×720；SHA-256 `e75fdd2ebeec7464e85291c99cd48cd2602d96f52963205899fc16e40fd11895`。
- 原始内置 source：`C:/Users/75112/.codex/generated_images/01a116e2-c940-7931-9e13-0a495970c85f/exec-ffea0505-9f23-4d88-ae11-963f4a621e37.png`。
- manifest 保存目标：`F:/project/baye-sanguo/assets/hd-portraits/hd/period-3/4-曹操.png`。
- PNG / RGB / 1672×941 / 1867602 bytes；source 与当前目标的 SHA-256 均为 `c4052fc2c2c197026a3e8e3be909b13094b14c0b4134db875db921448d474480`，二者逐字节一致。
- 视觉检查：新最终原图由根任务生成前view原生时期3身份图和同名P1辅助，随后两代理实际view原始PNG。完整黑冠及额带在画幅内，顶部有自然背景；成熟眉眼、唇须/短颏须、历史衣袍、柔侧光与宫廊柔焦保持一致，无文字、水印或UI。松构图到腰部；原始PNG未裁切、缩放或重编码。旧首稿高冠越框，不能作为构图通过证据。

调用：`referenced_image_paths` 按上述原生、P1顺序；`transparent_background=false`，未传 `num_last_images_to_include`。本次是该人物的第2次独立生成；首稿详见下方拒收记录。

完整实际提交 prompt：

```text
Use case: historical-scene
Asset type: 原创HD三国人物立绘，第三时期「赤壁之战」，曹操，period=3/personId=4。
Primary request: 图1原生24×24头像是时期3曹操身份依据，生成同一人的写实电影半身胸像。保持脸型、眉眼、目光、唇须及短颏须、冠帽轮廓与成熟年龄感，不换脸或年轻化。
Input images: 图1 F:/project/baye-sanguo/assets/hd-portraits/refs/period-3/4-曹操.png 是第三时期真实原生头像，身份/胡须/冠帽优先。图2 F:/project/baye-sanguo/assets/hd-portraits/hd/hd_p1_0001_曹操.png 为同名P1已接受HD，仅辅助电影写实画风、自然皮肤、历史材质、柔侧光与胸像构图；不得拿P1服饰覆写第三时期。
Subject: 曹操，中国成熟男性，精明沉稳眼神、清楚眉骨与颧面、唇上须及短尖颏须按图1，束发冠帽以原生形状为准。东汉末三国历史衣袍/军官衣甲，低调、真实，无幻想夸张盔饰。
Scene/backdrop: 简洁古代宫廊或帐内远景，浅景深虚化，柔和安静，低细节，不堆杂兵旗帜。
Style/medium: 与图2连续的历史电影写实肖像，自然毛发和皮肤微纹理，织物/金属衣甲轻度真实质感，统一柔侧光。
Composition/framing: 16:9横向原始宽画幅，单人半身，完整头冠有顶端呼吸空间，肩胸清楚；不加黑边、不拼贴或裁伸原生像素图。
Constraints: 图1身份与时期特征优先，P1仅画风辅助。不透明背景；无文字、水印、签名、现代物品、边框和UI。
Avoid: 换脸、另一武将、幼年化、现代服装、眼镜、手表、枪械、卡通貼纸、多余手指、鲜血特写、拥挤战场、乱码文字。
Mandatory new framing requirement: create a much looser waist-up portrait, pull the camera far back. The entire figure from waist to the highest point of the crown must occupy only 60 percent of image height. Across the top 15 percent of the image there is only softly blurred background. The FULL crown, with its rounded top silhouette and all pins, must fit well below that empty band. No headgear or hair is allowed to touch or cross any image edge. Keep the actual native period-3 facial identity, age, beard and headgear, and the accepted cinematic realistic style. A face close-up that crops the hat is unacceptable.
```

### 5 刘备 · 最终成品

- 原生身份参考（输入1）：`F:/project/baye-sanguo/assets/hd-portraits/refs/period-3/5-刘备.png`；24×24；SHA-256 `c8a1f5b85d94c9c65277073e971236e083267524fcf6bb9169574c878ed5f8f2`。
- 已接受 P1 同名画风参考（输入2）：`F:/project/baye-sanguo/assets/hd-portraits/hd/hd_p1_0013_刘备.png`；1280×720；SHA-256 `7a6a7b2698676a40ca89cd724a7c9ae95d3e6b8b1fdbae121ac07e676507449b`。
- 原始内置 source：`C:/Users/75112/.codex/generated_images/01a116e2-c940-7931-9e13-0a495970c85f/exec-0b268438-cf50-46e2-8e37-ced32735538b.png`。
- manifest 保存目标：`F:/project/baye-sanguo/assets/hd-portraits/hd/period-3/5-刘备.png`。
- PNG / RGB / 1672×941 / 2276994 bytes；source 与当前目标的 SHA-256 均为 `53327267000a021cb09e8a5c9e085c888489e41f63d9f4284c0a75941ace6e6a`，二者逐字节一致。
- 视觉检查：新最终原图由根任务生成前view原生时期3身份图和同名P1辅助，随后两代理实际view原始PNG。完整高冠、额带及发带均在画幅内，冠上有自然背景；成熟温厚面容、唇须与自然垂颏须、历史衣袍和柔侧光保留，肩胸与腰带可見。没有文字、水印或UI；原始PNG未裁切、缩放或重编码。旧首稿冠顶越框，不能作为构图通过证据。

调用：`referenced_image_paths` 按上述原生、P1顺序；`transparent_background=false`，未传 `num_last_images_to_include`。本次是该人物的第2次独立生成；首稿详见下方拒收记录。

完整实际提交 prompt：

```text
Use case: historical-scene
Asset type: 原创 HD 三国人物立绘，第三时期「赤壁之战」，刘备，period=3/personId=5。
Primary request: 图1真实原生24×24头像是本时期人物身份依据，生成同一人的电影写实半身胸像。保留脸型、眉眼、唇须、垂颏须、头冠/束发轮廓、成熟年龄感与头部姿态，不换脸。
Input images: 图1 F:/project/baye-sanguo/assets/hd-portraits/refs/period-3/5-刘备.png 是时期3原生身份与头部特征依据。图2 F:/project/baye-sanguo/assets/hd-portraits/hd/hd_p1_0013_刘备.png 是同名P1已接受HD，只用于自然肤质、历史衣料质感、柔侧光、电影写实半身构图与同人物辅助；不能把P1时期衣装覆写到时期3。
Subject: 刘备，中国成熟男性，温厚而沉稳眉眼，唇上胡须与较长自然垂颏须按图1，冠帽与额带以原生轮廓为准，保留时期3年龄感。衣袍符合东汉末三国，不加入超出原生轮廓的夸张饰物。
Scene/backdrop: 简洁古代宫廊或自然远山，低细节浅景深虚化，不堆旗帜杂兵。
Style/medium: 与图2一致的历史电影写实胸像，自然发丝与皮肤细纹，历史布料有克制的真实质感，统一柔和侧光。
Composition/framing: 原始16:9宽横幅，单独一人半身肩胸，头冠顶部留有呼吸空间；不加信箱黑边，不拼贴、不裁伸或放大24像素图冒充HD。
Constraints: 图1身份与时期3冠须优先，P1仅画风辅助。背景不透明；无现代文字、水印、签名、UI边框和现代物品。
Avoid: 另一武将、换脸、幼年化、现代服装、眼镜、手表、枪械、卡通贴纸、多余手指、鲜血特写、拥挤战场、乱码汉字。
Mandatory new framing requirement: pull the camera back into a relaxed waist-up half-body portrait. The complete figure from waist to the highest crown point occupies about 60 percent of image height. Leave a clearly visible band of softly blurred background across the top 15 percent of the image. The FULL crown silhouette, any pins and all hair must fit below that band with comfortable margin. Nothing on the head touches or crosses a frame edge. Preserve the actual native period-3 facial identity, age and beard, and the accepted realistic cinematic family style. Keep the image one historical person only; no close-up that clips his crown.
```

### 79 关羽 · 最终成品

- 原生身份参考（输入1）：`F:/project/baye-sanguo/assets/hd-portraits/refs/period-3/79-关羽.png`；24×24；SHA-256 `5f0336f89d935f9568744d2aaf05f7bb19a569c37ed492d3f528ed768f244126`。
- 已接受 P1 同名画风参考（输入2）：`F:/project/baye-sanguo/assets/hd-portraits/hd/hd_p1_0089_关羽.png`；1280×720；SHA-256 `d07917d012f038864f45008d0b5e855e3fae25f2f356803b8323424979a942ab`。
- 原始内置 source：`C:/Users/75112/.codex/generated_images/01a116e3-623c-7513-a5e0-580eb72033be/exec-6f4a967f-7c96-4bf3-930e-c4761d6816aa.png`。
- manifest 保存目标：`F:/project/baye-sanguo/assets/hd-portraits/hd/period-3/79-关羽.png`。
- PNG / RGB / 1672×941 / 2502937 bytes；source 与当前目标的 SHA-256 均为 `ec730ec188b01d9ee80c6c52045b688ff9b1eeb15e512f17e63cd1096a2bea38`，二者逐字节一致。
- 视觉检查：生成前已 view 原生时期3与同名P1，生成后 view 原始 PNG。成年宽面、浓长眉与长须、冠帽和古代衣甲，柔侧光自然肤质、简洁竹林柔焦背景，单人半身无文字/UI/水印。低分辨率原生只支持可辨轮廓，不是照片级身份oracle。 本轮交叉复审再次view成品：圆冠/帽的最高点接近上边缘，但完整轮廓仍在图内；贴边没有误判为实际裁切，保留首稿原字节。

调用：`referenced_image_paths` 按上述原生、P1顺序；`transparent_background=false`，未传 `num_last_images_to_include`。该人物只有首轮1次调用。

完整实际提交 prompt：

```text
Use case: historical-scene
Asset type: 原创HD三国人物立绘，第三时期「赤壁之战」，关羽，period=3/personId=79。
Primary request: 以图1原生24×24头像为同一人，生成电影写实半身胸像。保留其宽脸、浓长眉、眼形/目光、长胡须、冠帽额带与成熟年龄轮廓，不换脸。
Input images: 图1 F:/project/baye-sanguo/assets/hd-portraits/refs/period-3/79-关羽.png 为时期3本人物真实原生头像，身份、头冠和须形优先。图2 F:/project/baye-sanguo/assets/hd-portraits/hd/hd_p1_0089_关羽.png 是已接受同名P1 HD，只参考自然肤质、毛发、历史材质、柔侧光、电影写实胸像画风；不得将P1时期衣服或冠帽直接覆写图1。
Subject: 关羽，中国成熟男性，坚毅沉稳，图1可辨浓眉与长垂须，眉眼及颊面按原生轮廓还原，冠帽/额带也按图1。东汉末三国军官衣袍或衣甲，克制真实，无幻想装饰。
Scene/backdrop: 简洁竹林或古代宫廊，浅景深柔焦，安静低细节，不堆旗帜杂兵。
Style/medium: 与图2一致的历史电影写实胸像，自然发丝和皮肤细纹、轻度真实织物与金属材质，统一柔和侧光，非卡通像素风。
Composition/framing: 原始16:9宽横幅，单独一人半身，长须和肩胸清楚，冠帽顶端留白；不加黑边、不拼贴、不裁伸或像素放大当HD。
Constraints: 图1时期3身份优先，P1仅画风辅助。不透明背景；无文字、水印、签名、UI边框、现代物品。
Avoid: 换脸、另一武将、年轻化、眼镜、手表、枪械、现代服装、卡通贴纸、多余手指、鲜血特写、拥挤战场、乱码汉字。
```

### 80 张飞 · 最终成品

- 原生身份参考（输入1）：`F:/project/baye-sanguo/assets/hd-portraits/refs/period-3/80-张飞.png`；24×24；SHA-256 `f71a24fe2b99268251a6047f9d7ded1b8ee898186b3e36e057af87b04acc8059`。
- 已接受 P1 同名画风参考（输入2）：`F:/project/baye-sanguo/assets/hd-portraits/hd/hd_p1_0090_张飞.png`；1280×720；SHA-256 `2930db46892eac95439878fbae29258ba58716fb75b8ee35c26cb9fdcce1ce8d`。
- 原始内置 source：`C:/Users/75112/.codex/generated_images/01a116e3-623c-7513-a5e0-580eb72033be/exec-10500e71-78e4-445d-8cda-cdfaeac67b97.png`。
- manifest 保存目标：`F:/project/baye-sanguo/assets/hd-portraits/hd/period-3/80-张飞.png`。
- PNG / RGB / 1672×941 / 2384867 bytes；source 与当前目标的 SHA-256 均为 `41b70a084f8fd28040aba5c05cfe13c1a3e761083c18f036156e39494f80c1c9`，二者逐字节一致。
- 视觉检查：生成前再次view时期3原生24×24张飞身份图与同名P1辅助图；新原图再经view_image确认完整金冠顶、黑缨、发丝主体、脸和肩胸在画幅内，金冠顶上有自然背景，未碰上边缘。保持粗眉、虬髯、张口表情及历史重甲，单人半身胸腰构图、柔侧光和低细节山水背景，无文字/UI/水印；原始PNG没有裁切/缩放/重编码。旧首稿金冠顶和黑缨越过上边缘，现记录为拒收。

调用：`referenced_image_paths` 按上述原生、P1顺序；`transparent_background=false`，未传 `num_last_images_to_include`。本次是该人物的第2次独立生成；首稿详见下方拒收记录。

完整实际提交 prompt：

```text
Use case: historical-scene
Asset type: 原创HD三国人物立绘，第三时期「赤壁之战」，张飞，period=3/personId=80。
Primary request: 图1真实原生24×24头像决定同一人的身份，生成电影写实半身胸像；图1的粗犷脸型、浓眉眼、髭须/颊须形状、冠帽或头盔、年龄感与表情优先。
Input images: 图1 F:/project/baye-sanguo/assets/hd-portraits/refs/period-3/80-张飞.png 是时期3张飞的原生身份与头部依据。图2 F:/project/baye-sanguo/assets/hd-portraits/hd/hd_p1_0090_张飞.png 为已接受同名P1 HD，只提供电影写实材质、自然皮肤毛发、历史衣甲、柔侧光及胸像画风；不能直接覆写P1服装/头盔或夸张怒吼表情到时期3。
Subject: 张飞，中国成年壮实武将，宽阔面部、浓重眉眼、浓密的唇髭和颊须，真实强壮而不怪物化，脸/冠帽与表情按图1轮廓，古代衣甲符合东汉末三国。
Scene/backdrop: 简洁远山或古代宫廊，浅景深虚化，低细节，不堆旗帜杂兵，不画拥挤大战。
Style/medium: 与图2统一的历史电影写实半身胸像，粗厚自然须发和皮肤微纹理、轻度真实布料与金属质感，柔侧光，不是卡通。
Composition/framing: 直接生成16:9横向原始宽幅，单独一人肩胸清楚，头冠/盔顶留有空间；不加黑边、不拼贴、不裁伸或放大原生头像当HD。
Constraints: 图1时期3身份/表情优先，P1仅画风辅助。不透明背景；无现代物品、文字、水印、签名、边框UI。
Avoid: 换脸、另一武将、瘦弱少年、现代衣服、眼镜、手表、枪械、卡通贴纸、多余手指、鲜血特写、拥挤战场、乱码汉字。
Composition correction, highest priority: 拍摄距离拉远，松构图，完整帽冠、发簪、缨羽和鬓发全部保留在原图内。人物（含完整冠饰至胸腰部）只占约60%画高，上方保留至少15%画高的自然背景空间。画幅上边缘绝不能碰到或切掉冠顶、缨羽、发髻或发饰，不用放大人物填满画面。This is a new original full composition: the entire hat/crown and plume must fit comfortably inside the frame, with at least 15% natural background above the highest point. Camera pulled back; subject occupies only about 60% of canvas height. No cropping, reframing, editing or resizing an old output. Keep the character's native face, age, beard and headgear identity, image 2 only for rendering style; all other historical realism and no-text/no-UI constraints remain.
```

### 90 诸葛亮 · 最终成品

- 原生身份参考（输入1）：`F:/project/baye-sanguo/assets/hd-portraits/refs/period-3/90-诸葛亮.png`；24×24；SHA-256 `1d65c6fd0fb986134515f816bd19a6101fa7dccf56c7ba89c302fdf4463d38cc`。
- 已接受 P1 同名画风参考（输入2）：`F:/project/baye-sanguo/assets/hd-portraits/hd/hd_p1_0157_诸葛亮.png`；1280×720；SHA-256 `316c52a355b07a13afa8919e8741d8b4764b2b2e8861acf949f78070ad3474fa`。
- 原始内置 source：`C:/Users/75112/.codex/generated_images/01a116e3-623c-7513-a5e0-580eb72033be/exec-919785ed-3e6c-46ed-935a-a12b9cf9c6a1.png`。
- manifest 保存目标：`F:/project/baye-sanguo/assets/hd-portraits/hd/period-3/90-诸葛亮.png`。
- PNG / RGB / 1672×941 / 2301661 bytes；source 与当前目标的 SHA-256 均为 `c7095a2cce45d16d915771d0d3858f1733195cc3a2dddb72d216d74096c185bb`，二者逐字节一致。
- 视觉检查：生成前已 view 原生时期3与同名P1，生成后 view 原始 PNG。成年清秀面部、沉静眉眼、细唇须与尖颏须、文士冠帽和衣袍，柔侧光自然肤质、简洁虚化宫廊远山，半身无文字/UI/水印。原生24像素只支持可辨轮廓，不是照片级身份oracle。 本轮交叉复审再次view成品：圆冠/帽的最高点接近上边缘，但完整轮廓仍在图内；贴边没有误判为实际裁切，保留首稿原字节。

调用：`referenced_image_paths` 按上述原生、P1顺序；`transparent_background=false`，未传 `num_last_images_to_include`。该人物只有首轮1次调用。

完整实际提交 prompt：

```text
Use case: historical-scene
Asset type: 原创HD三国人物立绘，第三时期「赤壁之战」，诸葛亮，period=3/personId=90。
Primary request: 图1原生24×24头像决定同一人时期3的面部身份，生成电影写实半身胸像。保留清秀脸型、眉眼、唇须/尖颏须、文士冠帽轮廓、头部侧转与原生年龄感，不将人物老化。
Input images: 图1 F:/project/baye-sanguo/assets/hd-portraits/refs/period-3/90-诸葛亮.png 为第三时期诸葛亮真实原生身份依据，面容冠帽须形和年龄优先。图2 F:/project/baye-sanguo/assets/hd-portraits/hd/hd_p1_0157_诸葛亮.png 是同名P1已接受HD，只辅助电影写实画风、柔侧光、自然肤质、历史布料和半身构图；不能将P1服饰、冠帽或额外年龄皱纹覆写到时期3。
Subject: 诸葛亮，中国成年文士，清秀修长面部、平静聪慧眉眼、细唇须与自然尖颏须依图1，真实年龄按原生头像而非增添灰须。束发文士冠帽以图1为准，东汉末三国历史衣袍，温雅自然。
Scene/backdrop: 简洁柔焦远山或古代宫廊，浅景深低细节，不堆旗帜杂兵。
Style/medium: 与图2一致的历史电影写实胸像，自然皮肤细纹、发丝与胡须，织物有克制的真实质感，统一柔和侧光，不是卡通或像素放大。
Composition/framing: 16:9原始横向宽幅，单独一人半身肩胸，完整冠帽顶部留空间；不加黑边、不拼贴、不裁伸或放大原生24像素当HD。
Constraints: 图1时期3身份/年龄优先，P1仅画风辅助。不透明背景；无文字、水印、签名、边框UI、现代物品。
Avoid: 换脸、另一武将、强行老化、现代服装、眼镜、手表、枪械、卡通贴纸、多余手指、鲜血特写、拥挤战场、乱码文字。
```

### 104 周瑜 · 最终成品

- 原生身份参考（输入1）：`F:/project/baye-sanguo/assets/hd-portraits/refs/period-3/104-周瑜.png`；24×24；SHA-256 `039510e7765a00f0d2fc53618ac9d0e8fea32fb3233bab5138390b9d4b34040d`。
- 已接受 P1 曹操仅画风参考（输入2）：`F:/project/baye-sanguo/assets/hd-portraits/hd/hd_p1_0001_曹操.png`；1280×720；SHA-256 `e75fdd2ebeec7464e85291c99cd48cd2602d96f52963205899fc16e40fd11895`。
- 原始内置 source：`C:/Users/75112/.codex/generated_images/01a116e2-c940-7931-9e13-0a495970c85f/exec-341df14d-8361-4527-a76c-278d760068a6.png`。
- manifest 保存目标：`F:/project/baye-sanguo/assets/hd-portraits/hd/period-3/104-周瑜.png`。
- PNG / RGB / 1672×941 / 2014389 bytes；source 与当前目标的 SHA-256 均为 `40d027b881019716318b0b436836bbc54ec22694bfe74e6389dd2eecd34e33fa`，二者逐字节一致。
- 视觉检查：新最终原图由根任务生成前view周瑜时期3原生身份图、P1曹操仅作渲染画风，随后两代理实际view原始PNG。完整冠顶及横簪均在画幅内，顶部有自然背景；年轻清秀成年面容与整洁无长须下颌依原生，未套曹操成熟须发。单人历史衣袍/衣甲、电影柔侧光、柔焦江岸，无文字、水印或UI；原始PNG未裁切、缩放或重编码。旧首稿冠上部越框，现拒收。

调用：`referenced_image_paths` 按上述原生、P1顺序；`transparent_background=false`，未传 `num_last_images_to_include`。本次是该人物的第2次独立生成；首稿详见下方拒收记录。

完整实际提交 prompt：

```text
Use case: historical-scene
Asset type: 原创HD三国人物立绘，第三时期「赤壁之战」，周瑜，period=3/personId=104。
Primary request: 只以图1原生24×24周瑜头像决定人物身份，生成同一人的电影写实半身胸像。必须保留其较年轻的成年面容、修长轮廓、清楚眉眼、整洁下颌、冠帽/额带形状和原生年龄感。
Input images: 图1 F:/project/baye-sanguo/assets/hd-portraits/refs/period-3/104-周瑜.png 是本人物时期3真实原生身份参考，脸、冠帽、胡须与年龄完全优先。图2 F:/project/baye-sanguo/assets/hd-portraits/hd/hd_p1_0001_曹操.png 是已接受P1「曹操」HD，人物不是周瑜！图2只能参考电影写实渲染、自然肤质、历史布料金属材质、柔侧光、简洁虚化背景与半身构图。严禁复制曹操的脸、成熟年龄、黑冠造型、唇须或尖颏须。
Subject: 周瑜，中国较年轻的成年军官，清秀而沉稳的眉眼，整洁修长下颌，无图2曹操式山羊须或浓胡须；严格依图1可辨轮廓。束发与头冠/额带采用图1的周瑜轮廓，衣袍/衣甲符合东汉末三国，古代织物与金属真实克制。
Scene/backdrop: 简洁宫廊或江岸远景，浅景深柔焦，低细节，不堆旗帜杂兵。
Style/medium: 仅与图2共享历史电影写实质感和柔和侧光，自然皮肤/发丝，不是卡通或另一名武将，不添加现代妆造。
Composition/framing: 直接生成16:9横向原始宽幅，单独一人半身，头部与肩胸清楚，完整冠帽顶端留空间；不加黑边、不拼贴、不裁伸或放大原生24像素作为HD。
Constraints: 图1是唯一身份依据，图2曹操只作画风，绝不能混入曹操脸/须/年龄/冠帽。不透明背景；无文字、水印、签名、边框、UI或现代物品。
Avoid: 曹操面容、曹操胡须、老化、换脸、另一武将、现代服装、眼镜、手表、枪械、卡通贴纸、多余手指、鲜血特写、拥挤战场、乱码文字。
Mandatory new framing requirement: camera pulled back to a relaxed waist-up half-body portrait, with the complete person including crown occupying about60 percent image height. The top15 percent of the frame contains only softly blurred background. ALL of 周瑜's native historical crown/headgear, pins and hair must be entirely visible below that empty band; nothing on the head may touch or cross any image edge. Maintain the actual youthful, clean-shaven native 周瑜 face. The 曹操 reference is rendering style ONLY, never 曹操's mature face, beard or taller official crown. The result must be a genuine new original HD image with complete crown, not a crop of the preceding portrait.
```

## 7 张拒收首稿（保留原 source 和完整旧 prompt）

首轮视觉描述遗漏了上边缘裁冠/缨问题，现明确纠正。下列 source 仍保留，曾原字节用于本批目标；目标现在已由上文最终成品替换，下面的旧 SHA 不代表当前生产目标，也不构成完整构图通过证据。没有删除、裁切或编辑拒收 source。

### 7 马腾 · 拒收首稿

- 原生身份参考（输入1）：`F:/project/baye-sanguo/assets/hd-portraits/refs/period-3/7-马腾.png`；24×24；SHA-256 `3bb0f9684e7727be1809ae34def94099ef4521a7cae4bb7cc0b0c41ba5ed13d9`。
- 已接受 P1 同名画风参考（输入2）：`F:/project/baye-sanguo/assets/hd-portraits/hd/hd_p1_0005_马腾.png`；1280×720；SHA-256 `dd470ee27ffaafd446cf4e79554379190d19cc23579aae215cd5d8b7a0181d1c`。
- 原始首稿 source：`C:/Users/75112/.codex/generated_images/01a116e3-623c-7513-a5e0-580eb72033be/exec-94d85fcc-cedc-4f8d-91f9-a9282ad9d7c3.png`。
- 首稿 PNG / RGB / 1672×941 / 2286659 bytes；SHA-256 `d4006c6e34dfcbe39213555d12c2abb324934c9fb3ec748a487cda04607f6a66`。
- 原先使用目标：`F:/project/baye-sanguo/assets/hd-portraits/hd/period-3/7-马腾.png`；当前已替换为上文最终成品。
- 拒收原因：高冠的上半部越过画幅上边缘。脸/年龄/须发仍可用于身份方向观察，但冠饰完整性不合格；原来的视觉通过描述已撤回。

调用：`referenced_image_paths` 按原生、P1顺序；`transparent_background=false`；该人物首轮1次调用。

完整原始提交 prompt（原样保留）：

```text
Use case: historical-scene
Asset type: 原创 HD 三国人物立绘，第三时期「赤壁之战」，马腾，period=3/personId=7。
Primary request: 以图1原生24×24头像为同一人，生成写实电影感半身胸像。图1的脸型、五官、眉眼、胡须、冠帽轮廓、年龄感和头部姿态优先，不能换成别的武将。
Input images: 图1 F:/project/baye-sanguo/assets/hd-portraits/refs/period-3/7-马腾.png 是本人物第三时期身份与冠帽/胡须的原生依据。图2 F:/project/baye-sanguo/assets/hd-portraits/hd/hd_p1_0005_马腾.png 是已接受的同名第一时期 HD，只辅助电影写实画风、自然肤质、历史材质、柔侧光和半身构图；不得直接将 P1 服装/冠帽覆写到时期3。
Subject: 马腾，成熟略年长的中国男性，宽厚面部、浓眉、严肃沉稳眼神、浓密长须与鬓发按图1。头部较低平横额带的冠帽轮廓以图1为准，不直接照搬P1高冠；保持原生可辨年龄感，不能年轻化。
Scene/backdrop: 东汉末三国时期的简洁远山或宫廊，浅景深虚化，安静低细节，不堆旗帜杂兵。
Style/medium: 与图2一致的写实历史电影人物胸像，真实毛发、自然皮肤微纹理，古代衣甲与布料有克制的质感，统一柔和侧光。
Composition/framing: 直接生成16:9横向原始画幅，单独一人，完整冠帽留出上方空间，头部肩胸清楚。不可加黑边、拼贴、裁伸像素头像或以24像素放大当HD。
Constraints: 身份特征优先图1；P1仅画风辅助。无现代物品、无文字、水印、签名、边框和UI；背景不透明。
Avoid: 不同人物、换脸、现代服装、眼镜、手表、枪械、卡通贴纸、鲜血特写、拥挤战场、多余肢体、乱码文字。
```

### 126 庞德 · 拒收首稿

- 原生身份参考（输入1）：`F:/project/baye-sanguo/assets/hd-portraits/refs/period-3/126-庞德.png`；24×24；SHA-256 `b40381a82c5ffa4eeb77040945aea046daca3e60d4710c9c90a0025017c6513c`。
- 已接受 P1 同名画风参考（输入2）：`F:/project/baye-sanguo/assets/hd-portraits/hd/hd_p1_0058_庞德.png`；1280×720；SHA-256 `ba3ca8d20a8e480a6b3ee1be8fc67962969be8d0bed6bb43a2102a66f711d4eb`。
- 原始首稿 source：`C:/Users/75112/.codex/generated_images/01a116e3-623c-7513-a5e0-580eb72033be/exec-b85f92d4-c67a-49e4-8fa1-bbb2b7c57f7c.png`。
- 首稿 PNG / RGB / 1672×941 / 2360969 bytes；SHA-256 `e970f38f68dbb20a4d84973da76a5db582aa0226de0a70252a96e4a680f7af0b`。
- 原先使用目标：`F:/project/baye-sanguo/assets/hd-portraits/hd/period-3/126-庞德.png`；当前已替换为上文最终成品。
- 拒收原因：高冠的顶部轮廓越过画幅上边缘。脸/年龄/须发仍可用于身份方向观察，但冠饰完整性不合格；原来的视觉通过描述已撤回。

调用：`referenced_image_paths` 按原生、P1顺序；`transparent_background=false`；该人物首轮1次调用。

完整原始提交 prompt（原样保留）：

```text
Use case: historical-scene
Asset type: 原创 HD 三国人物立绘，第三时期「赤壁之战」，庞德，period=3/personId=126。
Primary request: 以图1原生24×24头像为同一人，生成写实电影感半身胸像。脸型、五官、眉眼、胡须、冠帽/头盔轮廓、年龄感及头部姿态必须优先遵循图1，不能替换为另一人物。
Input images: 图1 F:/project/baye-sanguo/assets/hd-portraits/refs/period-3/126-庞德.png 是本人物第三时期身份与冠帽/胡须的原生依据。图2 F:/project/baye-sanguo/assets/hd-portraits/hd/hd_p1_0058_庞德.png 是已接受同名P1 HD，只辅助电影写实画风、自然肤质、历史材质、柔侧光及半身构图；不能把P1服装或冠帽直接覆写到时期3。
Subject: 庞德，中国成年男性武将，硬朗宽面、浓眉严肃眼神，唇上须与浓密颏须，头冠的额带和顶部形状按图1，真实年龄感，不年轻化成少年。古代军官衣甲与朴素外袍符合东汉末三国。
Scene/backdrop: 简洁远山或军营远景，浅景深虚化，低细节，不堆旗帜或杂兵。
Style/medium: 与图2一致的历史电影写实胸像，自然毛发和皮肤微纹理，轻度旧化布料/金属衣甲、统一柔侧光。
Composition/framing: 直接生成16:9横向原始画幅；单人半身，头部与肩胸清楚，冠帽顶部有留白，不加黑边，不拼贴或裁伸24像素头像。
Constraints: 图1决定身份与时期3头部特征，P1仅画风辅助。背景不透明。无文字、水印、签名、边框、UI和现代物品。
Avoid: 换脸、另一武将、现代服装、眼镜、手表、枪械、卡通贴纸、多余手指、鲜血特写、拥挤战场或乱码文字。
```

### 131 梁兴 · 拒收首稿

- 原生身份参考（输入1）：`F:/project/baye-sanguo/assets/hd-portraits/refs/period-3/131-梁兴.png`；24×24；SHA-256 `b93b00b2be9fe95a36356f2e71296ce69b39721e4ddfd3221caab91cba622ef6`。
- 已接受 P1 同名画风参考（输入2）：`F:/project/baye-sanguo/assets/hd-portraits/hd/hd_p1_0063_梁兴.png`；1280×720；SHA-256 `660fbbc55c24929e7afe9358a3a03e77b2efe67231e97a5a5631ca71c80b6b2e`。
- 原始首稿 source：`C:/Users/75112/.codex/generated_images/01a116e3-623c-7513-a5e0-580eb72033be/exec-5609782e-90b8-4c3d-b4a6-f7d14a001aef.png`。
- 首稿 PNG / RGB / 1672×941 / 2245615 bytes；SHA-256 `9cc80f41255e5eae094f53510861c33a247ac2474a63ff8780a3d7c90626199d`。
- 原先使用目标：`F:/project/baye-sanguo/assets/hd-portraits/hd/period-3/131-梁兴.png`；当前已替换为上文最终成品。
- 拒收原因：高冠顶端越过画幅上边缘。脸/年龄/须发仍可用于身份方向观察，但冠饰完整性不合格；原来的视觉通过描述已撤回。

调用：`referenced_image_paths` 按原生、P1顺序；`transparent_background=false`；该人物首轮1次调用。

完整原始提交 prompt（原样保留）：

```text
Use case: historical-scene
Asset type: 原创 HD 三国人物立绘，第三时期「赤壁之战」，梁兴，period=3/personId=131。
Primary request: 以图1真正原生24×24头像为同一人生成电影写实半身胸像，图1的脸型、眉眼、表情/侧转姿态、唇须与颏须轮廓、冠帽和年龄感优先，不换成另一个武将。
Input images: 图1 F:/project/baye-sanguo/assets/hd-portraits/refs/period-3/131-梁兴.png 是本人物第三时期原生身份依据。图2 F:/project/baye-sanguo/assets/hd-portraits/hd/hd_p1_0063_梁兴.png 是已接受同名 P1 HD，只辅助电影写实画风、自然皮肤毛发、历史衣甲质感、柔侧光与半身构图；不得将P1衣装冠帽或长胡须直接覆写到图1时期3。
Subject: 梁兴，中国成年男性军官，面部有成熟的眉骨、颧面和唇部轮廓，保留图1自然表情、略侧转的头姿；胡须长度和额带/冠帽依图1可辨轮廓，不凭P1加长。古代衣甲符合东汉末三国历史。
Scene/backdrop: 简洁柔焦远山或宫廊，低细节浅景深，不堆旗帜和杂兵。
Style/medium: 与图2连续的历史电影写实胸像，皮肤微纹理和自然发丝，布料/金属有轻度真实质感，柔和侧光；非卡通、非像素放大。
Composition/framing: 直接生成16:9横向原始宽幅，单独一人、半身肩胸完整，冠帽顶部有留白；不加黑边、不裁伸参考头像或拼贴。
Constraints: 图1决定身份和时期3头部，P1仅画风辅助。背景不透明；无文字、水印、签名、边框、UI、现代服装或物件。
Avoid: 换脸、另一武将、幼年化、现代眼镜、手表、枪械、卡通贴纸、多余手指、鲜血特写、拥挤战场、乱码汉字。
```

### 4 曹操 · 拒收首稿

- 原生身份参考（输入1）：`F:/project/baye-sanguo/assets/hd-portraits/refs/period-3/4-曹操.png`；24×24；SHA-256 `18846bdd8c718f770d9172adffd0dc0d4b369c016b4d2e117e895b169f214fed`。
- 已接受 P1 同名画风参考（输入2）：`F:/project/baye-sanguo/assets/hd-portraits/hd/hd_p1_0001_曹操.png`；1280×720；SHA-256 `e75fdd2ebeec7464e85291c99cd48cd2602d96f52963205899fc16e40fd11895`。
- 原始首稿 source：`C:/Users/75112/.codex/generated_images/01a116e3-623c-7513-a5e0-580eb72033be/exec-1d6f4cf4-e73b-4941-910f-f2daa65699a3.png`。
- 首稿 PNG / RGB / 1672×941 / 2278113 bytes；SHA-256 `12e1db2c984380a84f821bdbe2ea4f27628fa3c04c1cb4463f1af6d2c6c7c57c`。
- 原先使用目标：`F:/project/baye-sanguo/assets/hd-portraits/hd/period-3/4-曹操.png`；当前已替换为上文最终成品。
- 拒收原因：高冠的上半部越过画幅上边缘。脸/年龄/须发仍可用于身份方向观察，但冠饰完整性不合格；原来的视觉通过描述已撤回。

调用：`referenced_image_paths` 按原生、P1顺序；`transparent_background=false`；该人物首轮1次调用。

完整原始提交 prompt（原样保留）：

```text
Use case: historical-scene
Asset type: 原创HD三国人物立绘，第三时期「赤壁之战」，曹操，period=3/personId=4。
Primary request: 图1原生24×24头像是时期3曹操身份依据，生成同一人的写实电影半身胸像。保持脸型、眉眼、目光、唇须及短颏须、冠帽轮廓与成熟年龄感，不换脸或年轻化。
Input images: 图1 F:/project/baye-sanguo/assets/hd-portraits/refs/period-3/4-曹操.png 是第三时期真实原生头像，身份/胡须/冠帽优先。图2 F:/project/baye-sanguo/assets/hd-portraits/hd/hd_p1_0001_曹操.png 为同名P1已接受HD，仅辅助电影写实画风、自然皮肤、历史材质、柔侧光与胸像构图；不得拿P1服饰覆写第三时期。
Subject: 曹操，中国成熟男性，精明沉稳眼神、清楚眉骨与颧面、唇上须及短尖颏须按图1，束发冠帽以原生形状为准。东汉末三国历史衣袍/军官衣甲，低调、真实，无幻想夸张盔饰。
Scene/backdrop: 简洁古代宫廊或帐内远景，浅景深虚化，柔和安静，低细节，不堆杂兵旗帜。
Style/medium: 与图2连续的历史电影写实肖像，自然毛发和皮肤微纹理，织物/金属衣甲轻度真实质感，统一柔侧光。
Composition/framing: 16:9横向原始宽画幅，单人半身，完整头冠有顶端呼吸空间，肩胸清楚；不加黑边、不拼贴或裁伸原生像素图。
Constraints: 图1身份与时期特征优先，P1仅画风辅助。不透明背景；无文字、水印、签名、现代物品、边框和UI。
Avoid: 换脸、另一武将、幼年化、现代服装、眼镜、手表、枪械、卡通貼纸、多余手指、鲜血特写、拥挤战场、乱码文字。
```

### 5 刘备 · 拒收首稿

- 原生身份参考（输入1）：`F:/project/baye-sanguo/assets/hd-portraits/refs/period-3/5-刘备.png`；24×24；SHA-256 `c8a1f5b85d94c9c65277073e971236e083267524fcf6bb9169574c878ed5f8f2`。
- 已接受 P1 同名画风参考（输入2）：`F:/project/baye-sanguo/assets/hd-portraits/hd/hd_p1_0013_刘备.png`；1280×720；SHA-256 `7a6a7b2698676a40ca89cd724a7c9ae95d3e6b8b1fdbae121ac07e676507449b`。
- 原始首稿 source：`C:/Users/75112/.codex/generated_images/01a116e3-623c-7513-a5e0-580eb72033be/exec-3e8465c4-c69a-41b7-93fb-f6419a49d487.png`。
- 首稿 PNG / RGB / 1672×941 / 2292895 bytes；SHA-256 `9bfbc0a8d59d6314a8132b03af36e1861c75216fc9d9f33e874e3293a9e5c1bb`。
- 原先使用目标：`F:/project/baye-sanguo/assets/hd-portraits/hd/period-3/5-刘备.png`；当前已替换为上文最终成品。
- 拒收原因：冠顶及上部装饰越过画幅上边缘。脸/年龄/须发仍可用于身份方向观察，但冠饰完整性不合格；原来的视觉通过描述已撤回。

调用：`referenced_image_paths` 按原生、P1顺序；`transparent_background=false`；该人物首轮1次调用。

完整原始提交 prompt（原样保留）：

```text
Use case: historical-scene
Asset type: 原创 HD 三国人物立绘，第三时期「赤壁之战」，刘备，period=3/personId=5。
Primary request: 图1真实原生24×24头像是本时期人物身份依据，生成同一人的电影写实半身胸像。保留脸型、眉眼、唇须、垂颏须、头冠/束发轮廓、成熟年龄感与头部姿态，不换脸。
Input images: 图1 F:/project/baye-sanguo/assets/hd-portraits/refs/period-3/5-刘备.png 是时期3原生身份与头部特征依据。图2 F:/project/baye-sanguo/assets/hd-portraits/hd/hd_p1_0013_刘备.png 是同名P1已接受HD，只用于自然肤质、历史衣料质感、柔侧光、电影写实半身构图与同人物辅助；不能把P1时期衣装覆写到时期3。
Subject: 刘备，中国成熟男性，温厚而沉稳眉眼，唇上胡须与较长自然垂颏须按图1，冠帽与额带以原生轮廓为准，保留时期3年龄感。衣袍符合东汉末三国，不加入超出原生轮廓的夸张饰物。
Scene/backdrop: 简洁古代宫廊或自然远山，低细节浅景深虚化，不堆旗帜杂兵。
Style/medium: 与图2一致的历史电影写实胸像，自然发丝与皮肤细纹，历史布料有克制的真实质感，统一柔和侧光。
Composition/framing: 原始16:9宽横幅，单独一人半身肩胸，头冠顶部留有呼吸空间；不加信箱黑边，不拼贴、不裁伸或放大24像素图冒充HD。
Constraints: 图1身份与时期3冠须优先，P1仅画风辅助。背景不透明；无现代文字、水印、签名、UI边框和现代物品。
Avoid: 另一武将、换脸、幼年化、现代服装、眼镜、手表、枪械、卡通贴纸、多余手指、鲜血特写、拥挤战场、乱码汉字。
```

### 80 张飞 · 拒收首稿

- 原生身份参考（输入1）：`F:/project/baye-sanguo/assets/hd-portraits/refs/period-3/80-张飞.png`；24×24；SHA-256 `f71a24fe2b99268251a6047f9d7ded1b8ee898186b3e36e057af87b04acc8059`。
- 已接受 P1 同名画风参考（输入2）：`F:/project/baye-sanguo/assets/hd-portraits/hd/hd_p1_0090_张飞.png`；1280×720；SHA-256 `2930db46892eac95439878fbae29258ba58716fb75b8ee35c26cb9fdcce1ce8d`。
- 原始首稿 source：`C:/Users/75112/.codex/generated_images/01a116e3-623c-7513-a5e0-580eb72033be/exec-5819fa48-9b9e-4b91-bc49-c9434ef78568.png`。
- 首稿 PNG / RGB / 1672×941 / 2461171 bytes；SHA-256 `e339943c8e2512b0baeaa9f542f9e831e9e1ed493bea5607014b95f9ed1781e6`。
- 原先使用目标：`F:/project/baye-sanguo/assets/hd-portraits/hd/period-3/80-张飞.png`；当前已替换为上文最终成品。
- 拒收原因：金冠顶与黑缨明显越过画幅上边缘。脸/年龄/须发仍可用于身份方向观察，但冠饰完整性不合格；原来的视觉通过描述已撤回。

调用：`referenced_image_paths` 按原生、P1顺序；`transparent_background=false`；该人物首轮1次调用。

完整原始提交 prompt（原样保留）：

```text
Use case: historical-scene
Asset type: 原创HD三国人物立绘，第三时期「赤壁之战」，张飞，period=3/personId=80。
Primary request: 图1真实原生24×24头像决定同一人的身份，生成电影写实半身胸像；图1的粗犷脸型、浓眉眼、髭须/颊须形状、冠帽或头盔、年龄感与表情优先。
Input images: 图1 F:/project/baye-sanguo/assets/hd-portraits/refs/period-3/80-张飞.png 是时期3张飞的原生身份与头部依据。图2 F:/project/baye-sanguo/assets/hd-portraits/hd/hd_p1_0090_张飞.png 为已接受同名P1 HD，只提供电影写实材质、自然皮肤毛发、历史衣甲、柔侧光及胸像画风；不能直接覆写P1服装/头盔或夸张怒吼表情到时期3。
Subject: 张飞，中国成年壮实武将，宽阔面部、浓重眉眼、浓密的唇髭和颊须，真实强壮而不怪物化，脸/冠帽与表情按图1轮廓，古代衣甲符合东汉末三国。
Scene/backdrop: 简洁远山或古代宫廊，浅景深虚化，低细节，不堆旗帜杂兵，不画拥挤大战。
Style/medium: 与图2统一的历史电影写实半身胸像，粗厚自然须发和皮肤微纹理、轻度真实布料与金属质感，柔侧光，不是卡通。
Composition/framing: 直接生成16:9横向原始宽幅，单独一人肩胸清楚，头冠/盔顶留有空间；不加黑边、不拼贴、不裁伸或放大原生头像当HD。
Constraints: 图1时期3身份/表情优先，P1仅画风辅助。不透明背景；无现代物品、文字、水印、签名、边框UI。
Avoid: 换脸、另一武将、瘦弱少年、现代衣服、眼镜、手表、枪械、卡通贴纸、多余手指、鲜血特写、拥挤战场、乱码汉字。
```

### 104 周瑜 · 拒收首稿

- 原生身份参考（输入1）：`F:/project/baye-sanguo/assets/hd-portraits/refs/period-3/104-周瑜.png`；24×24；SHA-256 `039510e7765a00f0d2fc53618ac9d0e8fea32fb3233bab5138390b9d4b34040d`。
- 已接受 P1 曹操仅画风参考（输入2）：`F:/project/baye-sanguo/assets/hd-portraits/hd/hd_p1_0001_曹操.png`；1280×720；SHA-256 `e75fdd2ebeec7464e85291c99cd48cd2602d96f52963205899fc16e40fd11895`。
- 原始首稿 source：`C:/Users/75112/.codex/generated_images/01a116e3-623c-7513-a5e0-580eb72033be/exec-7781ad40-e4b4-4ed6-b22a-f0f8c7694bd6.png`。
- 首稿 PNG / RGB / 1672×941 / 2179337 bytes；SHA-256 `50480333b13b4a6f7fd339089152c50bb211b8437aa16e9486ce00dcc1d829c0`。
- 原先使用目标：`F:/project/baye-sanguo/assets/hd-portraits/hd/period-3/104-周瑜.png`；当前已替换为上文最终成品。
- 拒收原因：冠的上半部越过画幅上边缘。脸/年龄/须发仍可用于身份方向观察，但冠饰完整性不合格；原来的视觉通过描述已撤回。

调用：`referenced_image_paths` 按原生、P1顺序；`transparent_background=false`；该人物首轮1次调用。

完整原始提交 prompt（原样保留）：

```text
Use case: historical-scene
Asset type: 原创HD三国人物立绘，第三时期「赤壁之战」，周瑜，period=3/personId=104。
Primary request: 只以图1原生24×24周瑜头像决定人物身份，生成同一人的电影写实半身胸像。必须保留其较年轻的成年面容、修长轮廓、清楚眉眼、整洁下颌、冠帽/额带形状和原生年龄感。
Input images: 图1 F:/project/baye-sanguo/assets/hd-portraits/refs/period-3/104-周瑜.png 是本人物时期3真实原生身份参考，脸、冠帽、胡须与年龄完全优先。图2 F:/project/baye-sanguo/assets/hd-portraits/hd/hd_p1_0001_曹操.png 是已接受P1「曹操」HD，人物不是周瑜！图2只能参考电影写实渲染、自然肤质、历史布料金属材质、柔侧光、简洁虚化背景与半身构图。严禁复制曹操的脸、成熟年龄、黑冠造型、唇须或尖颏须。
Subject: 周瑜，中国较年轻的成年军官，清秀而沉稳的眉眼，整洁修长下颌，无图2曹操式山羊须或浓胡须；严格依图1可辨轮廓。束发与头冠/额带采用图1的周瑜轮廓，衣袍/衣甲符合东汉末三国，古代织物与金属真实克制。
Scene/backdrop: 简洁宫廊或江岸远景，浅景深柔焦，低细节，不堆旗帜杂兵。
Style/medium: 仅与图2共享历史电影写实质感和柔和侧光，自然皮肤/发丝，不是卡通或另一名武将，不添加现代妆造。
Composition/framing: 直接生成16:9横向原始宽幅，单独一人半身，头部与肩胸清楚，完整冠帽顶端留空间；不加黑边、不拼贴、不裁伸或放大原生24像素作为HD。
Constraints: 图1是唯一身份依据，图2曹操只作画风，绝不能混入曹操脸/须/年龄/冠帽。不透明背景；无文字、水印、签名、边框、UI或现代物品。
Avoid: 曹操面容、曹操胡须、老化、换脸、另一武将、现代服装、眼镜、手表、枪械、卡通贴纸、多余手指、鲜血特写、拥挤战场、乱码文字。
```

## 字节与参考核验

11 张最终图全部为生成器原始 1672×941 RGB PNG，总计 24310183 bytes，11 个 SHA-256 各不相同，分别与其原 source 逐字节一致，且不等于各自24×24原生参考。所有原生输入、P1辅助的 SHA 与生成前记录一致；不修改 manifest、refs/index、800张原生参考、14张已有P1或原生引擎四件。

7 张拒收首稿和7张修正的完整 prompt 均在本文，4张保留首稿的完整 prompt 在最终记录；合计18次调用。本文为 UTF-8、LF，文件末尾仅一个换行。
