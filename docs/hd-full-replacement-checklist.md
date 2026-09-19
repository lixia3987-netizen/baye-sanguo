# HD 全替换清单

玩家能见到的主要画面是否已有 HD 表现壳。引擎规则一律仍走 WASM。  
**分支：`feature/hd-graphics`（Draft PR #2），不合 `main`。**

图例：`HD done` 已有可玩壳 · `partial` 有壳但依赖 LCD 对照 · `LCD residual` 仍经典 · 每条残留附一行原因。

| 画面 | 状态 | 说明 |
|------|------|------|
| **标题 / 主菜单** | **HD done** | 新君登基 / 重返沙场 / 制作群组 / 解甲归田 |
| **选时期** | **HD done** | 董卓弄权四时期 |
| **选君主 / 势力形势图** | **partial** | 城 Belong / 人物自归属在 `didOpenNewGame` 后才有数；形势图阶段名单常空，LCD 对照。频率已每 400ms 重扫 |
| 开场动画 | LCD residual | 引擎播片，回车跳过；无独立图文接口，重做要改 WASM |
| **大地图** | **HD done** | P0–P3 |
| **城池根 / 一层 / 状况** | **HD done** | M0–M2 |
| **人物选择** | **partial** | M3 PersonQueue；顺序对不上则 LCD |
| **出征 / 外交目标城** | **partial** | M3 城名列表；引擎顺序可能不同 |
| **数量 / 征兵步进** | **HD done** | UP/DOWN/LEFT/RIGHT 步进；词典无 0–9 键码 |
| **报告 / 对话** | **partial** | `g_asyncActionStringParam` 有则显示；原生框常无字符串，只铬框 LCD |
| **帮助 / 查找** | **partial** | 发 VK_HELP / VK_SEARCH + HD 框；不 stub `showMainHelp` |
| **战场格网 / 单位** | **partial** | B0/B1 壳；B2 按 `g_FightMap` 图元着色（不标地形名） |
| 战场系统菜单 / 计谋 | LCD residual | 不 stub `fightOpenMainMenu` / `fightChooseSkill`，否则会替换系统菜单 |
| **策略结束 / 存读档** | **partial** | HD 三项 + 只列真实 `sango*.sav` |
| 云存档条 | 页面 HTML | 不是游戏内 LCD |
| 战斗结算 | LCD residual | 无独立结算 hook；随战场 LCD 对照 |
| 道具详情 | LCD residual | 无道具名数组在 `onMenuIdle` ctx 上 |
| 手机竖屏键位页 | 不做 | overworld 非目标 |
| 地图编辑器 | 不做 | 不在玩法路径 |

## 本分支壳

- `js/hd-overworld.js` · `js/hd-city-menu.js` · `js/hd-battle.js` · `js/hd-system-ui.js` · `js/hd-dialog.js`

## 无法在不改 WASM 的前提下做完的

- 开场动画重绘、计谋动画/SPE、道具列表项名、数字键输入。
- 形势图点击坐标与 HD 名单一一对应（引擎不暴露当前高亮君主名）。
