# 画质优化计划（HD 分支）

本文记录**当前 LCD 渲染管线**、**v1 已落地的可逆脚手架**，以及后续如何在不改 WASM / 不换 `dat.lib` 图块的前提下做清晰放大。本分支不发明新美术包，也不替换原作瓦片。

下一产品轨道是 **1080p 现代 2D 策略大地图**（不是把 LCD 再放大一档）。已锁定规格、架构与素材清单见 **[hd-overworld-spec.md](hd-overworld-spec.md)**。经典 LCD 仍可切换保留。

相关实现：

- `js/hd-graphics.js` — 画质设置（缩放 / 滤镜 / 外壳主题）
- `css/hd-graphics.css` — 锐利放大与 PC 外壳
- `pc.html` — 可即时切换的 PC 画质条
- `index.html` — 持久化选项（写入 `localStorage`）

经典观感应始终可还原：默认 `1×` + 锐利 + 经典外壳。

---

## 1. 当前渲染管线

引擎与数据层保持原样。浏览器只负责把引擎画好的单色 LCD 缓冲贴到 `<canvas id="lcd">`，再用 CSS 铺到页面上。

```
┌─────────────────────────────────────────────────────────────┐
│  js/baye.wasm（iBaye，预编译）                               │
│  逻辑分辨率 g_screenWidth × g_screenHeight                    │
│  4988：160×96（10×6 个 16px 格）                              │
│  加大：208×128（13×8 个 16px 格）                             │
│  由 lcdInit() 读 localStorage["baye/resolution"] 后          │
│  调用 bayeResizeScreen() → _bayeSetLcdSize()                 │
└───────────────────────────┬─────────────────────────────────┘
                            │ bayeFlushLcdBuffer(ptr)
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  js/lcd.js :: lcdFlushBuffer                                 │
│  canvas.width  = lcdWidth  × dotSize                         │
│  canvas.height = lcdHeight × dotSize                         │
│  默认 dotSize = 4 → 位图 640×384（4988）或 832×512（加大）    │
│  从 WASM 堆读 Uint8ClampedArray，putImageData 到 2D context  │
└───────────────────────────┬─────────────────────────────────┘
                            │ CSS width/height: 100%
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  页面外壳（不参与战斗 / 大地图逻辑）                          │
│  PC pc.html：.container 固定 480px 宽，.dummy {margin-top:   │
│    60%} → 显示框 480×288（正好 3× 逻辑 160×96）               │
│  手机 m.html：JS 把 canvas 拉满视口，竖屏再 rotate(-90deg)    │
│  竖屏键盘 m-old.html / m-ktouch.html：LCD 按 5:3 占位，      │
│    剩余高度给虚拟键（layoutKeyboard）                         │
└─────────────────────────────────────────────────────────────┘
```

### 1.1 关键文件

| 文件 | 职责 |
|------|------|
| `js/lcd.js` | LCD 尺寸、`dotSize`、刷帧、按键、触摸换算、Lib 选择 |
| `js/bridge.js` | JS ↔ WASM；`baye.resizeScreen` / `baye.blurScreen` |
| `js/baye.js` + `js/baye.wasm` | 预编译引擎；调用 `bayeFlushLcdBuffer`、`lcdSetDotSize` |
| `css/baye.css` | `.fill, #lcd { width/height:100% }`；已有 `.no_blur` 邻近取样 |
| `pc.html` | 480×288 外壳 + 键盘说明（无触控命中区） |
| `m.html` | 全屏拉伸 + `touchScreenInit("lcd")` |
| `index.html` | `baye/resolution`、`baye/mpage`、`baye/uiKind` |

### 1.2 两层「放大」，不要混为一谈

1. **引擎点阵放大 `dotSize`**  
   WASM 按逻辑像素写出 `dotSize×dotSize` 的色块。默认 4。改这个会改变 canvas 位图尺寸和每帧 `putImageData` 的字节数，并可能与脚本里的 `baye.data.g_scale` 交互（`g_scale > 2` 时 `preScriptInit` 会 `blurScreen(true)`）。
2. **CSS 显示放大**  
   位图再被 CSS 缩放到外壳矩形。PC 上 640×384 位图被收到 480×288（0.75×），所以「内部 4× + CSS 0.75×」合起来是逻辑像素的 3×。

v1 **只动第 2 层**（外加滤镜开关）。不改 `dotSize`、不改 `_bayeSetLcdSize`、不改 `.lib`。

### 1.3 滤镜现状

`lcdInit()` 调用 `lcdBlur(false)`：

- `canvas.getContext('2d').imageSmoothingEnabled = false`
- `#lcd` 加上 `.no_blur`（`image-rendering: pixelated` 等前缀）

因此经典路径已经是邻近取样，只是 PC 显示框偏小（480px），远看像糊。

### 1.4 触摸坐标

`touchScreenInit` 用 `getBoundingClientRect()` 把 CSS 像素映射回逻辑 `lcdWidth × lcdHeight`，再 `_bayeSendTouchEvent`。  
**纯 CSS 放大在数学上不破坏触控换算。** 手机端的真正风险是布局：全屏页再 2× 会溢出；竖屏页放大 LCD 会挤掉虚拟键命中区。

### 1.5 分辨率选项（与画质缩放无关）

首页「分辨率 / 4988 / 加大」改变的是**引擎逻辑屏幕**（能多显示几格地图/菜单），不是 CSS 清晰度。画质缩放是另一套键，见第 3 节。

---

## 2. 增量 HD 路径（保持引擎与数据不动）

原则：WASM、`libs/*.lib`、战斗/大地图/菜单逻辑全部原样。只改「怎么把已有 LCD 放到更大的、更清晰的外壳里」。

### 阶段 A — 本分支（v1，无新美术）

- [x] 文档化管线与禁区
- [x] `localStorage` 画质三项：CSS 整数倍、滤镜、外壳主题
- [x] PC `pc.html`：经典 1×（480×288） / 清晰 2×（960×576，逻辑像素 6×）
- [x] 默认锐利邻近取样；可选平滑双线性
- [x] HD 外壳只改页面底色、LCD 边框、说明文字，不改游戏像素
- [x] 经典路径为默认；开关可逆
- [x] 手机布局**不**做 2×（见第 4 节 blocker）

### 阶段 B — 有现成外壳素材时（仍不换图块）

- 用作者提供的边框 / 按钮 / 字体替换 `pc.html` 外壳（chrome），canvas 仍吃同一块 WASM 缓冲
- 主题继续 `classic` / `hd` 切换，缺素材时 HD 退回 CSS 边框
- 不要手绘「假截图」充数

### 阶段 C — 大地图真 HD（下一轨道，规格已锁定）

CSS 2× 无法变成现代 1080p 策略地图。已选定 **HD 表现壳 + 原 WASM**：大地图用 1920×1080 Canvas 重画，规则/存档/城池菜单仍走引擎。见 [hd-overworld-spec.md](hd-overworld-spec.md)。  
**P0 壳已在本分支：** `pc.html` 画质条「HD 地图」读取 `assets/hd-overworld/` 占位包。默认仍是经典 LCD。缺文件的层回退几何占位，禁止假截图、禁止盲换 `dat.lib`。

### 阶段 D — 若未来提供对齐的高清图块（单独评审，非大地图主路径）

- 按 tile id **叠加**显示，而不是改 `dat.lib` 字节
- 必须与 16×16 逻辑格对齐；对不上就停
- 大地图主路径走阶段 C 的表现壳，不靠换瓦片冒充策略地图

### 可选技术债（非 v1）

- 让 CSS 宽高等于 `lcdWidth * integer`，避免 640→960 这种 1.5× 位图缩放（对 4988，每个逻辑像素仍是整齐的 6 CSS 像素，观感可接受）
- 若要 1:1 位图像素：`dotSize = 显示倍数`，需回归 `g_scale` / 脚本模糊
- 手机：只在「横屏且虚拟键独立、LCD 未拉满」的布局上考虑整数 contain 缩放

---

## 3. v1 设置（可逆）

| localStorage 键 | 取值 | 默认 | 作用范围 |
|-----------------|------|------|----------|
| `baye/lcdCssScale` | `1` / `2` | `1` | **仅 PC** `pc.html` 外壳宽度 `480 × scale` |
| `baye/lcdFilter` | `crisp` / `smooth` | `crisp` | PC；`crisp` = 邻近取样 |
| `baye/lcdTheme` | `classic` / `hd` | `classic` | PC + 首页外壳，**不**改 LCD 像素内容 |

写入入口：

1. 首页 `index.html` 三组下拉
2. `pc.html` 画质条（即时生效，无需刷新）

API（`window.BayeHd`）：

- `getSettings()` / `setScale()` / `setFilter()` / `setTheme()`
- `applyPcPage()` — PC 入页时调用
- `applyAfterLcdInit()` — 只套滤镜与主题，不改布局

---

## 4. 手机端：为什么 v1 不做 2×

| 页面 | 现状 | 若强行 CSS 2× |
|------|------|----------------|
| `m.html` | `reloadLCD()` 已把 canvas 拉成 `innerWidth × innerHeight` | 超出视口；与 `orientationchange` 打架 |
| `m-ges.html` | 全屏 LCD + 右侧/叠加手势层 | 手势热区与 LCD 一起错位 |
| `m-old.html` / `m-ktouch.html` | LCD 按 5:3 占位，`layoutKeyboard()` 用剩余高度算键帽 | LCD 变高 → 键帽过小，命中区失效 |

触控换算本身能跟着 `getBoundingClientRect` 走，**blocker 是布局与命中区，不是坐标公式**。  
因此 v1 不改这些页面的几何。手机想更清晰：用设备本身的全屏拉伸 + 已有 `.no_blur`，或等单独的 contain 方案。

---

## 5. v1 明确不要做

- 不要盲换 / 重打包 `libs/dat-mod.lib` 或其它 `.lib` 里的图块与字模
- 不要改 `js/baye.wasm` 或要求用户重编引擎
- 不要把逻辑分辨率偷偷改成「高清 320×192」之类——菜单与地图坐标仍按 16px 格
- 不要伪造截图，也不要提交没有引擎参考图的假高清立绘。武将立绘是允许的用户生成轨道：`refs/` 只收实拍，`hd/` 只收由这些参考图 img2img 得到的成品（见第 8 节）
- 不要把 HD 设成唯一外观；经典 1× 必须是默认且可一键回去
- 不要借画质分支加科技树、联机、抽卡等无关功能
- 不要在竖屏虚拟键页半吊子放大（见第 4 节）

---

## 6. 本地怎么试

```bash
python3 -m http.server 8080
```

1. 打开 <http://localhost:8080/>
2. （可选）在首页把「PC 画质缩放」设为「清晰 2×」，滤镜保持「锐利」
3. 「选择版本」→ 任意本地 Lib（例如词典原版）→ 「进入游戏」（桌面会进 `pc.html`）
4. 也可在 `pc.html` 画质条来回点「经典 1× / 清晰 2×」「锐利 / 平滑」「经典外壳 / HD 外壳」
5. 回到 1× + 锐利 + 经典外壳，应与改之前的 PC 页一致

无版本时 `pc.html` 只会 alert「没有选择版本」，画质条仍可改外壳尺寸（canvas 底为银色空屏）。

小屏笔记本上 2×（960×576）可能高于视口：v1 允许纵向滚动，避免裁掉按键说明。键盘操作不受影响（PC 无 canvas 点击热区）。

---

## 7. 回归检查清单

- [ ] 默认（未写过新键，或显式 1×/crisp/classic）PC 外观与 main 一致：480 宽 LCD + 浅灰底
- [ ] 2× 后键盘（方向 / 回车 / 空格 / H / S）仍送到引擎
- [ ] 锐利：放大后格线干净；平滑：边缘发糊（对比用）
- [ ] HD 外壳只改框，游戏画面内容与经典相同
- [ ] `m.html?debug=1` 仍全屏、可旋转，虚拟键页布局未变
- [ ] 首页「分辨率 4988 / 加大」仍只改逻辑屏，不与 CSS 2× 冲突

---

## 8. 武将立绘（用户生成）

原头像仍是 `gam_drawpic(GEN_HEADPIC1 + g_PIdx, personId)`（`GEN_HEADPIC1` = 47，时期 1–4，JS 为 `baye.drawImage(0, 0, 47 + period, 0, personId)`）。HD 壳不改 WASM。

| 路径 | 作用 |
|------|------|
| `assets/hd-portraits/refs/` | 引擎画到 `#lcd` 后裁下的头像，实拍 |
| `assets/hd-portraits/hd/` | img2img 成品。没有文件就不显示 HD |
| `assets/hd-portraits/manifest.json` | personId + 时期 → 路径。试点名单的 id 由导出脚本从武将名解析 |
| `assets/hd-portraits/PROMPT.md` | 保持相貌的中英提示词 |

显示位置（`js/hd-portraits.js`）：

- **人物信息**：HD 城池菜单里高亮的武将，或武将报告（`g_hdReportKind == 2`）
- **战场说明头像**：战场帮助打开时，光标下那一格的将（`GenArray` 是 1-based，显示用减 1 后的 PersonID）
- **地图君主头像**：HD 大地图阶段的 `g_PlayerKing`

有 `hd/...` 就显示 HD 图。没有则用对应 `refs/` 原头像。两样都没有时槽位隐藏，引擎继续画 `GEN_HEADPIC`。经典 LCD 路径不被迫换成 HD。

导出（词典原版 lib）：

```bash
node scripts/dump-hd-portraits.mjs
```

或 `python3 -m http.server 8080` 后打开 `hd-portrait-dump.html`。已经在 `pc.html` 里选好时期时，控制台执行 `BayePortraitDump.dumpCurrent()`。步骤写在 `assets/hd-portraits/README.md`。

不要把没跑过导出的图、拼出来的截图或手绘头像放进 `refs/`。

## 9. 许可证

不改 `LICENSE` / `LICENSE.ENGINE`。新增的 `js/hd-graphics.js`、`css/hd-graphics.css` 与本文只是外壳层，沿用仓库 GPL-2.0 前端许可。原作美术与数据版权仍归原厂商。
