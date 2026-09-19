# HD 全替换清单

玩家能见到的主要画面是否已有 HD 表现壳。引擎规则一律仍走 WASM。  
**分支：`feature/hd-graphics`（Draft PR #2），不合 `main`。**

图例：`HD done` 已有可玩壳 · `partial` 根/一层已 HD，深层仍 LCD · `LCD residual` 仍经典 · `spec only` 仅文档。

| 画面 | 状态 | 说明 |
|------|------|------|
| 标题 / 主菜单（新开局、重返沙场） | LCD residual | 下一切片 |
| 选时期（董卓弄权…） | LCD residual | 下一切片 |
| 选君主 / 势力形势图 | LCD residual | 下一切片 |
| 开场动画 | LCD residual | 非优先 |
| **大地图** | **HD done** | P0–P3 + 全图摄像机；`docs/hd-overworld-spec.md` |
| **城池根菜单** 内政/外交/军备/状况 | **HD done** | M0/M1 |
| **城池一层子菜单**（内政/外交/军备） | **HD done** | **M2** |
| **城池状况** | **HD done** | M2，只列探测到的 `g_Cities` 字段 |
| 人物选择 / 道具 / 数量 / 输送 | LCD residual | **M3** |
| 出征选目标 / 选将（入战斗前） | LCD residual | M3 / 战场前置 |
| **战场** | **partial** | **B0/B1** 壳 + 检测 + 有数据则画格/单位；无数据则框 LCD。`docs/hd-battle-spec.md` |
| 战场系统菜单 / 计谋列表 | LCD residual | B2+ |
| 策略结束 / 存储进度 / 结束游戏 | LCD residual | 下一切片（存读档 HD） |
| 本地读档列表 | LCD residual | 下一切片 |
| 云存档条 | 页面 HTML | 非 LCD，但不是游戏内 HD 壳 |
| 帮助 / 查找 | LCD residual | 低优先 |
| 报告 / 对话 / 事件文本 | LCD residual | 低优先 |
| 战斗结算 | LCD residual | 随战场 |
| 手机竖屏键位页 | 不做 HD 地图 | 见 overworld 非目标 |

## 本分支已锁定的壳

- `js/hd-overworld.js` + `css/hd-overworld.css`
- `js/hd-city-menu.js` + `css/hd-city-menu.css`（M0–M2）
- `js/hd-battle.js` + `css/hd-battle.css`（B0/B1）

## 下一切片（不要在本文件之外另起分支）

1. 标题 / 选时期 / 选君主 / 存读档 HD。
2. 城菜单 **M3** 深层对话框。
3. 战场 B2（地形色、移动范围）。
