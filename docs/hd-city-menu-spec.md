# 城池四项菜单 HD 表现壳（M0 / M1）

本文锁定 **城池主菜单**（内政 / 外交 / 军备 / 状况）的 HD 表现轨道。  
哲学与大地图相同：**HTML/CSS 表现壳 + 原 baye WASM**。不改 `dat.lib`、不改引擎菜单坐标、不伪造数值。

**分支策略：只停在 `feature/hd-graphics`，用户明确要求之前不要合入 `main`。**

大地图规格见 [hd-overworld-spec.md](hd-overworld-spec.md)。本轨道从该文档「v1 入城仍开经典菜单」往下接。

---

## 1. 目标 / 非目标

### 目标（本切片 M0 / M1）

- 从 HD 大地图点城（或引擎已打开城池根菜单）时，用 **1080p HD 面板** 呈现与引擎相同的四项根选择。
- 点击 HD 按钮只向引擎 `sendKey`（方向 + `VK_ENTER` / `VK_EXIT`），**引擎仍是唯一规则源**。
- 关闭 HD 菜单（返回 / ESC / 空格 / 点地图空白）干净回到 HD 大地图；若当时是经典大地图模式，则回到经典 LCD。
- 经典 LCD 城池菜单必须可切回，且 **经典-only 路径不强迫 HD 菜单**。
- 文档化已探测到的菜单 hook / 城字段；没有的字段不编造。

### 非目标（本切片不做）

- **战斗地图 HD**（另开轨道）。
- **标题 / 选时期 / 选君主 / 存读档 UI HD**（另开轨道）。
- 不重做人物选择、输送数量、出征走格子等深层对话框（仍走引擎 LCD，可作对照）。
- 不改 WASM / `bridge.js` 菜单几何、不写死假粮饷。
- 不把引擎逻辑分辨率改成 1920×1080。

---

## 2. 分期

| 期 | 内容 | 本 PR |
|----|------|--------|
| **M0** | 根菜单四钮 + 按键回传 + LCD 可藏/对照 + 与 overworld `classic-menu` 接线 | 做 |
| **M1** | 可读现代面板：城名标题、四块大操作、返回=`VK_EXIT`；一层子列表（至少内政 / 军备） | 做 |
| M2 | 外交列表、状况数值条（只显示已探测字段）、子菜单与 `onMenuIdle` 光标同步 | 后续 |
| M3 | 人物/道具/数量等深层 UI HD | 后续 |

**未来轨道（仅点名）：** 战斗地图 HD；标题 / 存档 / 选君主 HD。

---

## 3. 已锁定的产品规格

| 项 | 锁定值 |
|----|--------|
| 风格 | 现代策略 UI 面板（暗底、大点击区），不是点阵放大 |
| 设计分辨率 | 面板落在 1920×1080 舞台内，约 980×640 居中 |
| 根四项 | 与引擎字符串一致：`内政` `外交` `军备` `状况`（FEATURES.md 已核验） |
| 一层子菜单 | 内政 / 军备（及外交）用**已核验**的引擎项名；点选仍按 index 发键 |
| 关闭 | HD「返回」/ ESC / 空格 → `VK_EXIT`；根层关闭后回 overworld |
| 默认 | `overworldMode=hd-map` 时自动出 HD 菜单；`cityMenuMode=classic` 可强制 LCD |
| 经典 | `overworldMode=classic` 且 `cityMenuMode` 非强制 `hd` 时，行为与本轨道之前完全一致 |

`localStorage`：

| 键 | 值 | 默认 |
|----|----|------|
| `baye/overworldMode` | `classic` / `hd-map` | `classic`（已有） |
| `baye/cityMenuMode` | `auto` / `hd` / `classic` | `auto` |

`auto`：仅当大地图是 `hd-map` 且城池根菜单已打开时显示 HD 面板。

---

## 4. 架构

```
玩家点 HD 城标
    → overworld tile-walk + VK_ENTER
    → 引擎打开城池根菜单
    → hooks: onMenuIdle / cityMakeCommand
    → BayeHdOverworld 进入 phase=classic-menu
    → BayeHdCityMenu.open() 画四钮
玩家点「内政」
    → HD 发 UP/DOWN 对齐 index + VK_ENTER
    → 引擎进入内政子菜单
    → HD 换成内政列表（占位/已核验项名）
玩家点「返回」
    → 子层：VK_EXIT 回根；根层：VK_EXIT + overworld.leaveMenu()
```

引擎菜单坐标、`g_CityPos` 走格、归属判定一律不改。

---

## 5. 1080p 布局（M0 / M1）

舞台：`#hd-city-menu` 覆盖在 `#hd-overworld` 之上（z-index 60），背后地图可辨但不可点（面板吃事件）。

```
┌──────────────────── 1920 × 1080 ────────────────────┐
│  HUD（年月 · 君主）                         画质条   │
│                                                     │
│           ┌──────── 980 × 640 面板 ────────┐        │
│           │  安定                          │        │
│           │  城池指令 · 引擎同步            │        │
│           │  ┌────────┐  ┌────────┐        │        │
│           │  │  内政  │  │  外交  │        │        │
│           │  └────────┘  └────────┘        │        │
│           │  ┌────────┐  ┌────────┐        │        │
│           │  │  军备  │  │  状况  │        │        │
│           │  └────────┘  └────────┘        │        │
│           │  [ 返回 ]     [ 经典 LCD ]     │        │
│           └────────────────────────────────┘        │
└─────────────────────────────────────────────────────┘
```

子层（内政 / 军备）：同一面板改为纵向列表（两列也可），项名来自下表；底栏仍是返回。

状况：优先列出 `g_Cities[i]` 上**读到的**字段；读不到就写「未探测」，不填假数。

---

## 6. 引擎同步（只读 + 按键）

### 6.1 已核验的菜单文案（FEATURES.md / 词典原版）

| 层 | 项（index 0…） |
|----|----------------|
| 根 | 内政、外交、军备、状况 |
| 内政 | 开垦、招商、搜寻、治理、出巡、招降、处斩、流放、赏赐、没收、交易、宴请、输送、移动 |
| 外交 | 离间、招揽、策反、反间、劝降 |
| 军备 | 侦察、征兵、分配、掠夺、出征 |
| 状况 | 不是指令表；LCD 显示归属/太守/农商/民忠/人口/金钱/粮食等 |

这些名字只用于 HD **标签**。能否执行、灰不灰、空城/他方城有哪些项，仍以引擎回键后的表现为准。

### 6.2 Hook（`baye.callHook`）

| Hook | 用途 |
|------|------|
| `onMenuIdle` | 约 0.5s；`ctx.index` 为当前高亮项（examples.js）。HD 用来对齐光标，不改引擎 |
| `cityMakeCommand` | 城池指令流程进行中；确认菜单仍开着 |
| `willCloseMenu` | 一层菜单关闭。HD 子层把它当成「回到根」；根层再关才 `leaveMenu` |

只记录 `ctx` 上实际出现的键（`index` 已见）。没有 `itemNames` 就不要猜。

### 6.3 回传

与大地图相同：`sendKey` / `baye.sendKey`。

| 键 | 码 |
|----|----|
| UP / DOWN / LEFT / RIGHT | `0x22` / `0x23` / `0x24` / `0x25` |
| ENTER | `0x27` |
| EXIT | `0x28`（`baye.VK_EXIT`） |

对齐策略：若已有 `onMenuIdle` 的 `index`，按差值发 UP/DOWN；否则先连发若干 UP 回顶再 DOWN 到目标，然后 ENTER。按键排队，间隔约 50ms。

### 6.4 城字段（状况，只展示读到的）

候选（存在才画）：`Belong`、`Food`、`Money`、`Commerce`、`Farming` / `Agriculture`、`PeopleDevotion`、`Population` / `People`、`State`、`AvoidCalamity`，以及太守类键（`Satrap` / `Mayor` / …）。  
归属名用 `baye.getPersonNameByID`；城名用 `baye.getCityName(i)`。

---

## 7. 与大地图 / 经典 LCD 的关系

| 场景 | 行为 |
|------|------|
| HD 地图 + `cityMenuMode=auto/hd` | 入城后 HD 面板；LCD 默认隐藏，可「经典 LCD」对照 |
| HD 地图 + `cityMenuMode=classic` | 与本轨道之前相同：中央弹出经典 LCD |
| 经典地图 + `auto/classic` | 零 HD 菜单，LCD 全屏路径不改 |
| 根层关闭 | `BayeHdOverworld.leaveMenu()`：发 `VK_EXIT`，phase 回 `map` |

点 HD 地图空白仍可关菜单（现有 overworld 行为）。

---

## 8. 文件

| 路径 | 角色 |
|------|------|
| `docs/hd-city-menu-spec.md` | 本规格 |
| `js/hd-city-menu.js` | 表现壳 |
| `css/hd-city-menu.css` | 面板样式 |
| `pc.html` | 挂载节点、画质条切换、脚本 |

不新增 npm 依赖。

---

## 9. 成功标准（M0 / M1）

1. HD 地图进入安定 → 见 HD 四项面板（城名=安定）。
2. 点「内政」→ 引擎进入内政（HD 切到内政列表或按键成功），不卡死。
3. 返回 / `VK_EXIT` → 回到 HD 大地图，可继续拖图。
4. `overworldMode=classic` 不出现 HD 菜单强迫。
5. 不改 WASM / `dat.lib`。
