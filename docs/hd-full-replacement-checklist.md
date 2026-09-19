# HD 全替换清单

玩家能见到的主要画面是否已有 HD 表现壳。引擎规则一律仍走 WASM。  
**分支：`feature/hd-graphics`（Draft PR #2），不合 `main`。**

图例：`HD done` 已有可玩壳 · `partial` 有壳但依赖 LCD 对照 · `LCD residual` 仍经典 · 每条残留附一行原因。

| 画面 | 状态 | 说明 |
|------|------|------|
| **标题 / 主菜单** | **HD done** | 新君登基 / 重返沙场 / 制作群组 / 解甲归田 |
| **选时期** | **HD done** | 董卓弄权四时期 |
| **选君主 / 势力形势图** | **HD done** | `GetAllKings` 写入 `g_hdKingIds`（董卓弄权 18 人：马腾/董卓/曹操…）；高亮 `g_hdKingIndex`。形势图底图仍可开 LCD 对照 |
| 开场动画 | LCD residual | `GamMovie(MAIN_SPE)` 帧动画，无独立图文接口；薄导出不够，重做要改 SPE 播放 |
| **大地图** | **HD done** | P0–P3 |
| **城池根 / 一层 / 状况** | **HD done** | M0–M2；一层名只在首项/项数对得上时才用 `menuItems()`，避免 FunctionMenu 盖住 内政 |
| **人物选择** | **HD done** | `PlcSplMenu` + `ShowPersonControl` 写入 `g_hdMenuBytes` |
| **出征 / 外交目标城** | **HD done** | GetCitySet 是地图光标：HD 点城按 `g_CityPos` 发方向键再回车 |
| **数量 / 征兵步进** | **HD done** | `NumOperate` 写 `g_hdQty*`；CDP 征兵：成宜后 `active=1 value=1070`，`VK_LEFT×2`+`VK_DIGIT5` → **1050**。HD 数字键 `0x40–0x49` |
| **报告 / 对话** | **HD done** | `ShowDMsg`→`ShowGReport` 写入后 `onEngineReport` 立刻填 HD 正文 |
| **帮助 / 查找** | **partial** | VK_HELP / VK_SEARCH + 放大 LCD；帮助正文仍多在 LCD，无单独 help 字符串导出 |
| **战场格网 / 单位** | **partial** | `g_hdFightActive` / `g_FightMapData` / `g_GenPos` 已接线；进战斗收起 LCD。本轮 VM 未打完一次真实 出征→`GamFight`（出征排队要过月，CDP 易在 GetCitySet/FunctionMenu 脱节） |
| 战场系统菜单 / 计谋 | LCD residual | 不 stub `fightOpenMainMenu` / `fightChooseSkill` |
| **策略结束 / 存读档** | **partial** | HD 三项 + 只列真实 `sango*.sav` |
| 云存档条 | 页面 HTML | 不是游戏内 LCD |
| **战斗结算** | **partial** | `exitBattle` 写 `g_hdFightOver` + `g_hdFightResultGbk`（胜/负串）到 `#hd-battle-result`；缺一次实战截图 |
| **道具详情** | **partial** | `ShowGoodsControl` → `menuItems()` / `baye.hd.toolName(id)` 已接线。董卓弄权安定开局城中无道具、武将 Equip 空，赏赐走「城中无道具」，菜单上暂无道具名可点 |
| 手机竖屏键位页 | 不做 | overworld 非目标 |
| 地图编辑器 | 不做 | 不在玩法路径 |

## 本分支壳

- `js/hd-overworld.js` · `js/hd-city-menu.js` · `js/hd-battle.js` · `js/hd-system-ui.js` · `js/hd-dialog.js`

## 本轮 WASM 桥

`vendor/iBaye` + `scripts/build-wasm.sh` 重编 `js/baye.wasm`。导出见 [wasm-hd-bridge.md](wasm-hd-bridge.md)。  
仍 residual：开场动画、计谋 SPE、帮助图文、战场系统菜单（不 stub）。道具名/战场结算 **桥已通**，缺开局道具与一次实战过月。
