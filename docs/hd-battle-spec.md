# 战场 HD 表现壳（B0 / B1）

本文锁定 **战斗地图** 的 HD 表现轨道。哲学与大地图 / 城菜单相同：**HTML/CSS/Canvas 壳 + 原 baye WASM**。不改 `dat.lib`、不重写战斗规则。

**分支策略：只停在 `feature/hd-graphics`，用户明确要求之前不要合入 `main`。**

城池菜单见 [hd-city-menu-spec.md](hd-city-menu-spec.md)。全屏清单见 [hd-full-replacement-checklist.md](hd-full-replacement-checklist.md)。

---

## 1. 目标 / 非目标

### 目标（B0 / B1）

- 战役在 HD 大地图模式下进入战斗时，铺一层 1080p 战场壳。
- 能读到的引擎战场状态（`g_FightMap` / `g_GenPos` / `g_FgtParam.GenArray` / `g_FoucsX·Y`）画成可读格子与单位标记。
- 读不到时：**HD 铬框套住放大后的经典 LCD 战场**（B0 过渡）。
- 点击 / 方向 / 确认 / 返回仍 `sendKey` 或现有触控回传，引擎裁决。
- 经典战斗路径必须可逆、不强迫。

### 非目标（本切片不做）

- 不重做计谋动画、SPE、伤害数字、完整战术 AI。
- 不改六兵种规则、天气、地形系数。
- 不把标题 / 存档做成 HD（下一切片）。
- 不改 WASM。

---

## 2. 分期

| 期 | 内容 | 本 PR |
|----|------|--------|
| **B0** | 规格 + 检测（fight hooks / `g_FgtParam`）+ 1080p 壳；有图则画格，无图则框 LCD | 做 |
| **B1** | 用已暴露的 `g_GenPos` / `GenArray` 画简易单位；光标跟 `g_FoucsX/Y` | 做（数据在才画） |
| B2 | 地形色按 `g_FightMap` 图元分类、移动范围、攻击预览 | 后续 |
| B3 | 战场系统菜单 HD（只读 `menuItems()`，不 stub `fightOpenMainMenu`） | 做 |
| B3b | 计谋列表 HD（`g_hdSkill*` / `FgtGetJNIdx`，不 stub `fightChooseSkill`） | 做 |

---

## 3. 检测

引擎可能调用的 hook（`baye.callHook`，**不**用空函数去 stub，以免替换系统菜单）：

| Hook | 含义 |
|------|------|
| `fightOpenMainMenu` | 战场系统菜单 |
| `meetFight` | 本城被进攻 |
| `drawMapUnit` | 画一格地形（`ctx.tile/x/y`，`g_FightMap[tile]`） |
| `drawOneGeneral` | 画一将（`ctx.index/x/y/pic`） |
| `fightChooseAction` | 攻击/计谋/查看/待机 |
| `fightStatusBarTouched` | 状态栏点击 |

只读数组（存在才用）：

| 字段 | 用途 |
|------|------|
| `baye.data.g_FightMap` | 地形图元 |
| `baye.data.g_FgtParam.GenArray` | 战场人物 id（常见 0–9 己方，10–19 敌方） |
| `baye.data.g_GenPos[i]` | `.x .y .active .hp .mp` |
| `baye.data.g_FoucsX` / `g_FoucsY` | 战场光标 |
| `baye.data.g_MapSX` / `g_MapSY` | 战场卷轴（也用于大地图，战斗期才当卷轴） |

`localStorage['baye/battleMode']`：`auto`（默认，HD 战役下自动）/ `hd` / `classic`。

---

## 4. 1080p 布局

`#hd-battle` 盖在大地图之上（z-index 65）。

```
┌──────────────── 1920 × 1080 ────────────────┐
│  HD 战场 · hook/探测                      │
│  ┌────────────── 格网 / 单位 ────────────┐ │
│  │                                      │ │
│  │     无数据时：中央框经典 LCD         │ │
│  └──────────────────────────────────────┘ │
│  按键仍交引擎 · [ 经典 LCD ] [ 关闭预览 ] │
└────────────────────────────────────────────┘
```

---

## 5. 输入

- 键盘：现有 `document.onkeydown` → `sendKey`（不拦截，除非 HD 壳自己的关闭钮）。
- 格网点击（B1）：向该格连发方向键逼近，或 `_bayeSendTouchEvent` 映射到 LCD；失败则忽略。
- 关闭预览：只关壳，不向引擎乱发 EXIT（真战斗中「关闭」只露出 LCD）。

---

## 6. 成功标准（B0 / B1）

1. 规格 + `js/hd-battle.js` + `css/hd-battle.css` 入 `pc.html`。
2. 检测到战斗 hook 或 `GenArray` 有人时，HD 壳出现（HD 战役 + `battleMode≠classic`）。
3. 经典大地图 / `battleMode=classic` 不强迫 HD 战场。
4. 无战斗数据时可用 `BayeHdBattle.debugPreview()` 展示 B0 铬框 + LCD 对照（自动化核验）。
5. 真进战斗的手动路径：HD 地图 → 己方城 → 军备 → 出征 → 选将 / 目标（深层仍 LCD）→ 开打后应升 HD 壳。

---

## 7. 文件

| 路径 | 角色 |
|------|------|
| `docs/hd-battle-spec.md` | 本规格 |
| `js/hd-battle.js` | 检测 / 画格 / 单位 / LCD 框 |
| `css/hd-battle.css` | 1080p 壳 |

不新增 npm 依赖，不改 WASM。

---

## 8. 本切片核验（B0）

自动化（CDP / 词典原版 / 马腾 190）：

1. `overworldMode=classic` 时 `BayeHdCityMenu.shouldShowHd()` 与 `BayeHdBattle.shouldShowHd()` 均为 false。
2. HD 地图点安定 → 外交（离间…劝降）、军备（侦察…出征）、状况（只读 `g_Cities[3]`）均出 HD 面板；返回后 `phase=map`。
3. `BayeHdBattle.debugPreview()` 打开 B0 铬框：16×16 格网 + 角上经典 LCD 对照。当时 `GenArray` 为空（未真开打），故无单位点。

真进战斗未在 agent VM 走完（出征选将 / 选目标仍是 M3 LCD 多层对话框）。手动：

HD 地图 → 己方城 → 军备 → 出征 →（LCD）选将 / 目标 → 开打后 `fightOpenMainMenu` / `drawMapUnit` / `drawOneGeneral` 应升 HD 壳；`battleMode=classic` 则不升。
