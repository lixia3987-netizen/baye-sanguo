# HD 全替换清单

玩家能见到的主要画面是否已有 HD 表现壳。引擎规则一律仍走 WASM。  
**分支：`feature/hd-graphics`（Draft PR #2），不合 `main`。**

图例：`HD done` 已有可玩壳 · `partial` 有壳但依赖 LCD 对照 · `LCD residual` 仍经典 · 每条残留附一行原因。

| 画面 | 状态 | 说明 |
|------|------|------|
| **标题 / 主菜单** | **HD done** | 新君登基 / 重返沙场 / 制作群组 / 解甲归田 |
| **选时期** | **HD done** | 董卓弄权四时期 |
| **选君主 / 势力形势图** | **HD done** | `GetAllKings` 写入 `g_hdKingIds`（董卓弄权 18 人：马腾/董卓/曹操…）；高亮 `g_hdKingIndex`。形势图底图仍可开 LCD 对照 |
| 开场动画 | LCD residual | 引擎播片，回车跳过；无独立图文接口，重做要改 WASM |
| **大地图** | **HD done** | P0–P3 |
| **城池根 / 一层 / 状况** | **HD done** | M0–M2 |
| **人物选择** | **HD done** | `PlcSplMenu` + `ShowPersonControl` 写入 `g_hdMenuBytes`；一层菜单不再复用父菜单项名 |
| **出征 / 外交目标城** | **HD done** | 同上，名单序跟引擎菜单缓冲 |
| **数量 / 征兵步进** | **HD done** | 方向键步进 + PC 数字键 `0x40–0x49`（不占用词典 0x30–0x33） |
| **报告 / 对话** | **HD done** | `ShowDMsg`→`ShowGReport` 写入后 `onEngineReport` 立刻填 HD 正文。CDP：`农业开发度变为 730 (+34)。` 无 LCD OCR |
| **帮助 / 查找** | **partial** | VK_HELP / VK_SEARCH + 放大 LCD；帮助正文仍多在 LCD |
| **战场格网 / 单位** | **partial** | `enterBattle`/`exitBattle` + `g_hdFightActive`；格/将仍要开打后的 `g_FightMap`/`g_GenPos` |
| 战场系统菜单 / 计谋 | LCD residual | 不 stub `fightOpenMainMenu` / `fightChooseSkill`，否则会替换系统菜单 |
| **策略结束 / 存读档** | **partial** | HD 三项 + 只列真实 `sango*.sav` |
| 云存档条 | 页面 HTML | 不是游戏内 LCD |
| 战斗结算 | **partial** | `exitBattle` 写 `g_hdFightOver`，HD HUD 显示结束码；无独立结算文案页 |
| 道具详情 | LCD residual | 无道具名数组在 `onMenuIdle` ctx 上 |
| 手机竖屏键位页 | 不做 | overworld 非目标 |
| 地图编辑器 | 不做 | 不在玩法路径 |

## 本分支壳

- `js/hd-overworld.js` · `js/hd-city-menu.js` · `js/hd-battle.js` · `js/hd-system-ui.js` · `js/hd-dialog.js`

## 本轮 WASM 桥

`vendor/iBaye` + `scripts/build-wasm.sh` 重编 `js/baye.wasm`。导出见 [wasm-hd-bridge.md](wasm-hd-bridge.md)。  
仍 residual：开场动画、计谋 SPE、帮助图文、道具详情独立页、战场系统菜单（不 stub）。
