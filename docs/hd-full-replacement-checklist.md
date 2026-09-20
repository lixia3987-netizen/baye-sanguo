# HD 全替换清单

玩家能见到的主要画面是否已有 HD 表现壳。引擎规则一律仍走 WASM。  
**分支：`feature/hd-graphics`（Draft PR #2），不合 `main`。**

图例：`HD done` 已有可玩壳 · `partial` 有壳但依赖 LCD 对照 · `LCD residual` 仍经典 · 每条残留附一行原因。

| 画面 | 状态 | 说明 |
|------|------|------|
| **标题 / 主菜单** | **HD done** | 新君登基 / 重返沙场 / 制作群组 / 解甲归田 |
| **选时期** | **HD done** | 董卓弄权四时期 |
| **选君主 / 势力形势图** | **HD done** | `GetAllKings` 写入 `g_hdKingIds`（董卓弄权 18 人：马腾/董卓/曹操…）；高亮 `g_hdKingIndex`。形势图底图仍可开 LCD 对照 |
| 开场动画 | **HD done** | `PlcMovie(MAIN_SPE)` 每帧 blit `#lcd` → `#hd-spe-canvas` 11×（1760×1056）。跳过发回车。经典模式仍只走 160×96 LCD |
| **大地图** | **HD done** | P0–P3 |
| **城池根 / 一层 / 状况** | **HD done** | M0–M2；一层名只在首项/项数对得上时才用 `menuItems()`，避免 FunctionMenu 盖住 内政 |
| **人物选择** | **HD done** | `PlcSplMenu` + `ShowPersonControl` 写入 `g_hdMenuBytes` |
| **出征 / 外交目标城** | **HD done** | 出征先点将再 EXIT，才 GetFood / 「选择目标」/ GetCitySet。目标城按引擎格 `setx/sety` 对齐后再回车，不把 LCC 像素当格 |
| **数量 / 征兵步进** | **HD done** | `NumOperate` 写 `g_hdQty*`；CDP 征兵：成宜后 `active=1 value=1070`，`VK_LEFT×2`+`VK_DIGIT5` → **1050**。HD 数字键 `0x40–0x49` |
| **报告 / 对话** | **HD done** | `ShowDMsg`→`ShowGReport` 写入后 `onEngineReport` 立刻填 HD 正文。出征「选择目标」在 GetCitySet（`g_hdMapPick=1`）时关壳，不挡点城 |
| **帮助 / 查找** | **partial** | 大地图 HELP 导出 `Ver …`；战场 HELP 导出将领/地形 `g_hdHelpGbk`（`|` 换行）。查找仍放大 LCD，不编造词条 |
| **战场格网 / 单位** | **HD done** | 天水→河内 出征后 `GamFight`：`active=1 wait=1`，32×32 格 + `g_GenPos` 3 将（马腾蓝 / 于毒红）。进战斗收起 LCD 与过期报告 |
| **战场系统菜单** | **HD done** | 只读 `menuItems()` 画壳。`wait=1` 或 `onMenuIdle` 已停则关壳（残留「战场系统」不再挡选将）。返回只在菜单活着时发 EXIT。不 stub `fightOpenMainMenu` |
| **计谋选择** | **HD done** | `FgtGetJNIdx` 写入 `g_hdSkill*`（名/id）；HD 画「计谋」列表并 `sendKey`。不 stub `fightChooseSkill` |
| **计谋 / 开场 SPE** | **HD done** | `g_hdSpe*` + LCD 整数倍 overlay。`践踏`→`QIBING_SPE`；`谍报` 无 SPE id 时引擎不播（不编造）。规格 [hd-spe-spec.md](hd-spe-spec.md) |
| **策略结束 / 存读档** | **HD done** | 战役中见到 `策略结束` 三项即出壳（不 stub `mainSystemMenu`）。出征后 EXIT 到 FunctionMenu 再回车一次；存档只列真实 `sango*.sav` |
| 云存档条 | 页面 HTML | 不是游戏内 LCD |
| **战斗结算** | **HD done** | 原生系统菜单选「全军撤退」后 `over=2`，`#hd-battle-result` 显示导出串 **我军全军覆没** |
| **道具详情** | **partial** | 桥已通。董卓弄权安定开局城中无货、武将 Equip 空——不是代码 bug，菜单上暂无道具名可点 |
| 手机竖屏键位页 | 不做 | overworld 非目标 |
| 地图编辑器 | 不做 | 不在玩法路径 |

## 本分支壳

- `js/hd-overworld.js` · `js/hd-city-menu.js` · `js/hd-battle.js` · `js/hd-system-ui.js` · `js/hd-dialog.js` · `js/hd-spe.js`

## 本轮 WASM 桥

`vendor/iBaye` + `scripts/build-wasm.sh` 重编 `js/baye.wasm`。导出见 [wasm-hd-bridge.md](wasm-hd-bridge.md)。  
仍 residual：查找图文。安定开局无道具不是代码 bug。开场 / 计谋 SPE 已走 LCD-blit HD 层（见 [hd-spe-spec.md](hd-spe-spec.md)）。
