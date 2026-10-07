# 战场 HD 输入规格与 B0 / B1 历史记录

本文保留 B0/B1 的战斗地图规格；当前分支已增加引擎桥接并从 `vendor/iBaye` 重编 WASM。经典模式走原菜单，HD 模式拥有独立输入 hook；`fightOpenMainMenu` 回退协议见 [wasm-hd-bridge.md](wasm-hd-bridge.md)。下文历史阶段的“不改 WASM”“不 stub”不是当前实现状态。继续开发与真实战斗验收见 [hd-development-plan.md](hd-development-plan.md)。

**分支策略：只停在 `feature/hd-graphics`，用户明确要求之前不要合入 `main`。**

城池菜单见 [hd-city-menu-spec.md](hd-city-menu-spec.md)。全屏清单见 [hd-full-replacement-checklist.md](hd-full-replacement-checklist.md)。

## 当前手动战斗协议（M2）

引擎使用 `g_hdFightInputKind/inputSeq/actor` 表示正在等待的玩家操作；菜单使用 `g_hdMenuActive/context/kind/seq` 确认归属。完整字段及有效期见 [wasm-hd-bridge.md](wasm-hd-bridge.md)。HD 只在这些字段匹配时允许操作；旧菜单内容仍留在内存中，不表示菜单可点击。

点击将领、移动格或瞄准目标时，每次只提交一个方向键，等待真实光标回执后继续，最后提交一次确认。菜单选择同样等待真实索引回执。等待超时只终止本次请求并提示玩家，没有确认重试。移动范围、攻击射程和技能合法性由引擎裁决。

刷新、轮询、绘制和切换经典/HD 模式不发送战斗指令。待机由玩家选择，只结束该将行动；结束回合必须通过真实系统菜单确认。系统、撤退确认和设置使用原生菜单；HD 的 `fightOpenMainMenu` 返回 `-2`，让 C 打开原菜单。切换经典模式恢复原 hook，不能自动结束回合。

HELP 9 和 VIEW 10 保留原生 LCD，置于 HD 战场上方。返回只发送一次取消；形势图翻页依据引擎输入序号回执。战斗结束时关闭战场层，结果和继任提示交由引擎及玩家处理，不自动确认。

专项回归：`npm run test:battle-commands`、`npm run test:battle-mode`、`npm run test:engine-protocol`。真实流程：`npm run test:battle-runtime`。实际通过范围记录在开发计划中。

## M4 战场识别与目标预览

将领以阵营旗标显示原生有效兵种、姓名和实际兵力，并区分待行动、已行动及当前将领。焦点详情显示原生 HP、MP 和状态，不以固定 100 为属性上限。兵种来自包含装备修正的 `getArmType`；当前导出只接受 U8 人物索引，超过 256 的人物编号或缺少字段时显示通用旗标，避免截断后读到另一人物。

瞄准时按当前输入归属、行动者和原生射程掩码绘制目标连线。普通攻击只标敌将；计谋仅提示“射程内目标”，阵营、地形、MP 和实际效果继续由原生引擎裁决。预览不提交按键，也不预测伤害；棋盘坐标和点击换算保持一致。

表现与后台回归：`npm run test:render-visibility`。真实流程继续使用 `npm run test:battle-runtime`，具体本轮范围见开发计划。

## M4 战场地形与焦点说明

地形绘制独立为 `js/hd-battle-terrain.js`，在战场模块之前加载。使用 `g_MapWid × g_MapHgt` 的完整 `g_FightMapData`，行跨度为原生宽度；固定 65536 字节分配不表示有效地图大小。`g_FightMap` 是带滚动原点的 LCD 屏显缓存，不能当成整张地图或推算尺寸。视觉棋盘为容纳部队和焦点而扩展时，扩展格仍显示未知地形。

分类遵循原生 `FgtGetTerrain`：1 平原、2 草地、3 城池、4 村庄、5 森林、6–15 山地、41 营寨，其余 16–255 河流；0、缺失和越界均未知。使用草纹、田垄、山峰、树木、房屋、城墙、营帐和水纹区分八类地形，单位和原生范围掩码绘制在地形之上。焦点位于空格或部队时都显示地形和原生坐标；未知时保留可读的原始图块编号。

标准表现须校验实际加载的 `dynLib` 内容，不能只相信 `localStorage` 的首选路径。自定义地图绘制、地图加载或地形说明 hook 接管时使用中性地块，保留原生帮助路径。读取已占格的原生地形 getter 进行交叉核对；发生分类不一致时整张地图退回未知。绘制不调用 Mod 规则或绘制 hook，不提供移动消耗、防御加成或计谋合法性推断。

静态地形使用独立画布缓存，内容、原生尺寸/跨度、视区、DPR、LIB 校验结果和战斗生命周期改变时失效；经典模式清除缓存，隐藏页不绘制。棋盘布局、点击换算和原生输入归属保持一致。专项：`npm run test:battle-terrain`、`npm run test:render-visibility`；真实战斗及两种视口继续由 `npm run test:battle-runtime` 验证。

## 历史 B0 / B1 规格

以下保留早期表现壳的设计与当时验证结果；其中键盘不拦截、猜测 `wait`、不改 WASM 等实现描述已由上面的 M2 协议替代。

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
| B3 | 战场系统菜单 HD（只读 `menuItems()`，不 stub `fightOpenMainMenu`）。未见过选将 / `wait=1` / 无新鲜 `onMenuIdle` 时关壳，避免残留「战场系统」挡选将 | 做 |
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
- 战场系统 / 将领行动：本场见过 `wait=1`、当前 `wait=0`，且 `onMenuIdle` 已把 `liveMenuKind` 置上才画壳。开战瞬间残留「回合结束」不当活菜单。`willCloseMenu` / `wait` 变化清位，过期 idle 不再把活壳藏掉。「系统菜单」在 `wait=1` 时发 EXIT；若还没进 `FgtGetFoucs` 则记下再发。「返回」只在菜单活着时发 EXIT。点己方将：方向键对齐，仅 `wait=1` 时回车。结算后关壳，不把战场盖回大地图。

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
