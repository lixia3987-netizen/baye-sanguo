# HD 全替换清单

玩家能见到的主要画面是否已有 HD 表现壳。引擎规则一律仍走 WASM。  
**分支：`feature/hd-graphics`（Draft PR #2），不合 `main`。**

图例：`HD done` 已有可玩壳 · `partial` 根/一层已 HD，深层仍 LCD · `LCD residual` 仍经典 · `spec only` 仅文档。

| 画面 | 状态 | 说明 |
|------|------|------|
| **标题 / 主菜单**（新君登基、重返沙场、制作群组、解甲归田） | **HD done** | `docs/hd-system-ui-spec.md`；文案来自 FEATURES 核验 |
| **选时期**（董卓弄权…） | **HD done** | 同上四时期按钮 |
| **选君主 / 势力形势图** | **partial** | Belong 去重名单 + sendKey；形势图顺序可能不同，LCD 可对照 |
| 开场动画 | LCD residual | 回车跳过，非优先 |
| **大地图** | **HD done** | P0–P3 + 全图摄像机；`docs/hd-overworld-spec.md` |
| **城池根菜单** 内政/外交/军备/状况 | **HD done** | M0–M2 |
| **城池一层子菜单**（内政/外交/军备） | **HD done** | M2 |
| **城池状况** | **HD done** | M2，只列探测字段 |
| **人物选择**（本城 PersonQueue） | **partial** | **M3**：开垦等出 HD 人名；对不上则 LCD |
| **出征 / 外交目标城** | **partial** | **M3**：其它城名列表；引擎顺序可能不同 |
| 道具 / 数量 / 输送数字 | LCD residual | M3 框 LCD，不编造数字 |
| **战场** | **partial** | B0/B1 壳 + `debugPreview`；真出征接敌未在 VM 走完 |
| 战场系统菜单 / 计谋列表 | LCD residual | B2+ |
| **策略结束 / 存储进度 / 结束游戏** | **partial** | HD 系统壳 `insystem` 三项；需从 HD 打开或后续 hook（不 stub `mainSystemMenu`） |
| **本地读档列表** | **partial** | 只列探测到的 `sango*.sav`；无档则框 LCD |
| 云存档条 | 页面 HTML | 非 LCD，但不是游戏内 HD 壳 |
| 帮助 / 查找 | LCD residual | 低优先 |
| 报告 / 对话 / 事件文本 | LCD residual | 低优先 |
| 战斗结算 | LCD residual | 随战场 |
| 手机竖屏键位页 | 不做 HD 地图 | 见 overworld 非目标 |

## 本分支已锁定的壳

- `js/hd-overworld.js` + `css/hd-overworld.css`
- `js/hd-city-menu.js` + `css/hd-city-menu.css`（M0–M3）
- `js/hd-battle.js` + `css/hd-battle.css`（B0/B1）
- `js/hd-system-ui.js` + `css/hd-system-ui.css`（标题/时期/君主/存档）

## 剩余（仍此分支，不要另开）

1. 报告 / 对话 / 帮助 / 战斗结算等残留 LCD。
2. 君主形势图顺序对齐、数量输入 HD。
3. 战场 B2（地形色、移动范围）与一场真出征截图。
4. 地图编辑器不在玩法路径内，除非另要求。
