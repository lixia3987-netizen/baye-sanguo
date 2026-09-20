# 城池四项菜单 HD 表现壳（M0–M2）

本文锁定 **城池主菜单**（内政 / 外交 / 军备 / 状况）的 HD 表现轨道。  
哲学与大地图相同：**HTML/CSS 表现壳 + 原 baye WASM**。不改 `dat.lib`、不改引擎菜单坐标、不伪造数值。

**分支策略：只停在 `feature/hd-graphics`，用户明确要求之前不要合入 `main`。**

大地图规格见 [hd-overworld-spec.md](hd-overworld-spec.md)。本轨道从该文档「v1 入城仍开经典菜单」往下接。

---

## 1. 目标 / 非目标

### 目标（M0–M2）

- 从 HD 大地图点城（或引擎已打开城池根菜单）时，用 **1080p HD 面板** 呈现与引擎相同的四项根选择。
- 点击 HD 按钮只向引擎 `sendKey`（方向 + `VK_ENTER` / `VK_EXIT`），**引擎仍是唯一规则源**。
- 关闭 HD 菜单（返回 / ESC / 空格 / 点地图空白）干净回到 HD 大地图；若当时是经典大地图模式，则回到经典 LCD。
- 经典 LCD 城池菜单必须可切回，且 **经典-only 路径不强迫 HD 菜单**。
- 文档化已探测到的菜单 hook / 城字段；没有的字段不编造。

### 非目标（本切片不做）

- **战斗地图 HD**（见 [hd-battle-spec.md](hd-battle-spec.md)）。
- **标题 / 选时期 / 选君主 / 存读档 UI HD**（见 [hd-system-ui-spec.md](hd-system-ui-spec.md)）。
- 不重写数量输入、道具详情、出征走格子规则（M3 有名单则 HD，否则框 LCD）。
- 不改 WASM / `bridge.js` 菜单几何、不写死假粮饷。
- 不把引擎逻辑分辨率改成 1920×1080。

---

## 2. 分期

| 期 | 内容 | 本 PR |
|----|------|--------|
| **M0** | 根菜单四钮 + 按键回传 + LCD 可藏/对照 + 与 overworld `classic-menu` 接线 | 已做 |
| **M1** | 可读现代面板：城名标题、四块大操作、返回=`VK_EXIT`；一层子列表（至少内政 / 军备） | 已做 |
| **M2** | 外交列表、军备全表、状况只列探测字段、`onMenuIdle` `ctx.index` 高亮 | 已做 |
| **M3** | 人物/目标城 HD 列表（本城 PersonQueue / 其它城名）；数量仍框 LCD | 已做 |
| **出征** | BattleMake：点将 → EXIT 完成选将 → 粮草 → 「选择目标」→ GetCitySet 走格 → 部队已出发 → 策略结束 | 已做 |

系统界面见 [hd-system-ui-spec.md](hd-system-ui-spec.md)。战场见 [hd-battle-spec.md](hd-battle-spec.md)。

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

只记录 `ctx` 上实际出现的键。词典原版核验：`onMenuIdle` 的 `ctx` **只有 `index`**（高亮项），没有 `itemNames` / 项数字段。没有的键不猜。

### 6.3 回传

与大地图相同：`sendKey` / `baye.sendKey`。

| 键 | 码 |
|----|----|
| UP / DOWN / LEFT / RIGHT | `0x22` / `0x23` / `0x24` / `0x25` |
| ENTER | `0x27` |
| EXIT | `0x28`（`baye.VK_EXIT`） |

对齐策略：若已有 `onMenuIdle` 的 `index`，按差值发 UP/DOWN；否则先连发若干 UP 回顶再 DOWN 到目标，然后 ENTER。按键排队，间隔约 50ms。

### 6.4 城字段（状况，只展示读到的）

候选（存在才画）：`Belong`、`Food`、`Money`、`Commerce`、`Farming` / `Agriculture`、`PeopleDevotion`、`Population` / `People`、`State`、`AvoidCalamity`，以及太守类键（`Satrap` / `SatrapId` / `Mayor` / …）。  
归属 / 太守名用 `baye.getPersonNameByID`；城名用 `baye.getCityName(i)`。词典原版安定已探测到 `SatrapId`（不是 `Satrap`）。其余数字键（Limit / Queue 等）原样列出，不编造。

---

## 7. 与大地图 / 经典 LCD 的关系

| 场景 | 行为 |
|------|------|
| HD 地图 + `cityMenuMode=auto/hd` | 入城后 HD 面板；LCD 默认隐藏，可「经典 LCD」对照 |
| HD 地图 + `cityMenuMode=classic` | 与本轨道之前相同：中央弹出经典 LCD |
| 经典地图 + `auto/classic` | 零 HD 菜单，LCD 全屏路径不改 |
| 根层关闭 | `BayeHdOverworld.leaveMenu()`：发 `VK_EXIT`，phase 回 `map` |

点 HD 地图空白仍可关菜单（现有 overworld 行为）。出征进行中（选将 / 选粮 / GetCitySet）点地图空白**不** `leaveMenu`，避免把方向键/EXIT 打进将领表或取消 GetCitySet。残留 `g_hdMenuBytes`「策略结束」不当 FunctionMenu、不关出征向导。「选择目标」壳的返回不发 EXIT；点河内时若 `pick=0` 先回车再走格，避免退回将领表。

BattleMake 期间 `holdExit()`：HD「返回 / 关闭」、dialog 返回、overworld `leaveMenu` / `ensureOnMap` 六次 EXIT、系统壳返回、ESC/空格 **一律不发 EXIT**（唯一合法 EXIT 是一次「完成选将」）。未到 `pick=1` 的点城只亮红提示、不走格。二次「完成选将」被忽略。漏点「完成选将」会大声提示，而不是静默弹回将领表。「部队已出发」用 `data-baye-march-ok` 大横幅。

### 7.1 出征（BattleMake）与入城的区别

入城：`ShowCityMap` ENTER，`g_hdMapPick` 1→0 后开 OrderMenu。

出征不是点城就开目标列表。引擎顺序（`citycmdd.c` `BattleMake`）：

1. `ShowPersonControl` 循环：ENTER 加点将，**EXIT**（`0xffff`）结束选将；零将则取消。
2. `GetFood` / `NumOperate`（`g_hdQtyActive`）。
3. `ShowGReport`「选择目标」→ 回车关掉。
4. `baye_hd_set_city_links` + `GetCitySet`（`g_hdMapPick=1`）在**地图上**走格到敌邻城。
5. `AttackCityRoad` 可达则「部队已出发」+ `AddFightOrder`（`g_hdMarchOk=1`）。己方城 / 不可达会提示并继续选。

HD 曾在点第一名将领后就把 `person-city` 当成目标城列表（`usesMapCursor` 在 `deepStep===1` 画全部他城），走格键打进将领表，**从未 EXIT、从未 GetFood、从未 GetCitySet**。现在：

- `usesMapCursor` **只**认 `g_hdMapPick`。
- 点将后留在将领表；「完成选将 · 选粮出发」发 EXIT。
- 见到「选择目标」自动回车；`mapPick=1` 才画邻城并 `walkCursorToCity`（`setx/sety`，不是 china-lcc）。
- 「部队已出发」后引擎回到 `PlayerTactic` 的 `GetCitySet`。当前 `PolicyExec`（`citycmd.c`）对队列里每条命令立刻 `OrderExec`+`DelOrder`（旧的 `TimeCount` 递减已被注释），所以 **一次** FunctionMenu「策略结束」就会 `BattleDrv`→`GamFight`。邻城河内的 `odis` 常为 1，但本引擎不按月等待。
- HD「策略结束」：关报告壳（不回车残留「部队已出发」）→ 清上场 `g_hdFightOver` / `active` / `wait` / `resultDismissed` → `EXIT` 直到 `menuItems()[0]==策略结束` 且 `pick=0` → **只回车一次**。残留「全军撤退」不当活菜单、不再 EXIT。再回车会打进河内（「敌方城池」）或战场系统菜单（「全军撤退」）。新 `GamFight` 入口把桥接 `over/active/wait` 清零。
- **覆没后再出征**：上场 `g_hdMarchOk=1` 与对话框残留「部队已出发」不当新行军。HD 只在本次 `AddFightOrder`（`g_hdMarchSeq` 增加，或本趟 GetCitySet 见过 `ok=0` 再变 `ok=1`）后亮横幅。策略结束时若仍在 BattleMake `GetCitySet` 且没有新 token，**不发 EXIT**（否则取消出征、PolicyExec 空队列，只出内政/天灾报告、不进 `GamFight`）。`BattleDrv` 打完后清 `g_hdMarchOk`。
- **引擎正确跳过战场**（`g_hdFightSkip`，不是 HD 挡战）：`1` 空城直接占领；`2` 目标已是己方；`3` 出征槽无将（`fighters[0]==0`，全军覆没后军队已删）；`4` `FgtInit` 当场结束（将领全死/0 兵，仍 pulse HD 结算）。有将、目标仍是敌城时应进 `GamFight`。
- `全军撤退` 是战场 `dFgtSysMnu` 项，不是出征失败。天水有将、粮>0、点邻城河内且 `march.ok=1` 时，策略结束应进 `GamFight`，不是撤退。
- `g_hdMapPick` 在过图 `PlayerTactic` 与出征 `GetCitySet` **共用**。过图对他方城回车是「敌方城池」，不是出征成功。HD 只在 `isMarching()`（出征向导 / `campaignPick`，**不含**已出发）时把点城当目标；他方城不再 `openClassicCity` 回车。出征确认后不对敌城 retry ENTER（HUD「未对他方城再回车」是预期，不是路不通）。

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

## 9. 成功标准（M0–M3）

1. HD 地图进入安定 → 见 HD 四项面板（城名=安定）。西凉 / 安定 / 天水连点，标题必须是本次入城，不残留上场城名。
2. 点「内政 / 外交 / 军备」→ 对应一层 HD 列表；点「状况」只显示读到的 `g_Cities` 字段。
3. `onMenuIdle` 的 `index` 在根钮 / 子项上高亮。
4. 返回 / `VK_EXIT` → 回到 HD 大地图。
5. `overworldMode=classic` 不出现 HD 菜单强迫。
6. 不改 WASM / `dat.lib`。
7. M3：一层之后尽量出本城人物 / 目标城 HD 列表；数量与对不上的顺序仍框 LCD。
8. 出征：天水 → 军备 → 出征 → 点将 → 完成选将 → 粮草 → 地图点河内等敌邻 → 「部队已出发」→ 策略结束 → `GamFight`。本引擎不按月等待。结束后「部队已出发」壳须消失，招商/开垦可点。
