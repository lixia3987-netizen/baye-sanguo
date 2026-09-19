# HD SPE 规格

引擎仍用 `PlcMovie` 播 SPE。HD 只做**同帧放大**：每 tick 把已合成的 LCD 位图整数倍画到 1080p 画布。不另造与引擎结果脱节的技能特效。

**分支：`feature/hd-graphics`（Draft PR #2），不合 `main`。**

## 资源在哪

SPE 不是独立 `.spe` 文件。帧数据在 `libs/*.lib`（`dat.lib` / `dat-mod.lib`）里，按**资源 ID** 用 `ResLoadToCon(speid, index+1, g_CBnkPtr)` 取出。

固定 ID（`consdef.h`）：

| ID | 宏 | 用途 |
|----|----|------|
| 3 | `MAIN_SPE` | 开场 `GamMovie(MAIN_SPE)` |
| 6 | `MAKER_SPE` | 制作群组 |
| 16 | `SPE_BACKPIC` | 战斗特效底图 |
| 19–25 | `QIBING_SPE`… | 兵种攻击 |
| 27 | `STACHG_SPE` | 升级/死亡 |
| 35–43 | `FIRE_SPE`…`XJING_SPE` | 计谋特效 |

计谋 → SPE：`dJNSpeId[skillId-1]`（`FightSub.c`，启动时从 `IFACE_CONID`/`kdJNSpeId` 覆盖）。默认 `践踏`(id=1) → `QIBING_SPE`(19)。`谍报`(id=30) 默认表无条目，`dJNSpeId[29]` 常为 0，**引擎不播 SPE**。

## 文件格式（lib 内一块）

```
SPERES (6 bytes)
  U8 type, idx, count, picmax, startfrm, endfrm
SPEUNIT[count] (各 5 bytes)
  U8 x, y          // 相对 PlcMovie(x,y)
  U8 cdelay        // 本帧显示延时
  U8 ndelay        // 下一帧叠上前再等多久
  U8 picIdx        // 后面图片槽
Picture[picmax]    // PictureHeadType + 1bit 点阵
  wid, hig, mask   // mask=1 走 GamMPicShowV，否则 GamPicShowV
  行字节 = ceil(wid/8)，高 hig，mask+1 层
```

`PlcMovie` 把 1-bit 图画进 `g_VisScr`，`GamShowFrame` → `gam_copyscr` → `flushLcd` → JS `lcdFlushBuffer`（RGBA，默认 160×96 × `dotSize` 4 = 640×384）。

时机：`GamDelay(1, keyflag)`（约 10ms）。`keyflag & 0x01` 时按键可中断（开场 `true`）。计谋/攻击 `keyflag=0`，不能跳过。

开场坐标 `WK_SX,WK_SY`（满屏）。战斗 SPE 窗口 `FGT_SPESX/Y` ≈ `(SCR_WID-130)/2`, `(SCR_HGT-64)/2` → 160×96 上约 15,16，窗口 130×64。

`g_LookMovie` 默认 1。为 0 时技能/攻击不播 SPE。`g_engineConfig.showStartMovie` 默认 1。

## HD 路径（本轮）

可靠做法：**不解码 raw 1-bit**，而在每次 `lcdFlushBuffer` 把 `#lcd` 降回 160×96 再最近邻整数倍画到 `#hd-spe-canvas`。

- 开场：满屏 160×96 × `min(⌊1920/160⌋, ⌊1080/96⌋)` = **11× → 1760×1056**（> 160×96）。
- 计谋/攻击：裁 SPE 窗 130×64 × 8 = **1040×512**（> 160×96）。
- `imageSmoothingEnabled = false` / `image-rendering: pixelated`。
- `assets/hd-spe/` 可放后续替换 PNG；缺文件就继续 blit。禁止与 `PlcMovie` 脱节的装饰动画。

WASM 标志：`g_hdSpeActive/Id/Kind/X/Y/StartFrm/EndFrm/Seq`。`PlcMovie` 入口置位、每 `GamShowFrame` `baye_hd_spe_tick`、退出清零。`FightSub` 计谋前 `baye_hd_begin_spe(SKILL)`。`GamMovie(MAIN_SPE)` 仍写 `g_hdMovie*`。

Kind：`1` 开场 · `2` 计谋 · `3` 攻击 · `4` 状态（不弹 HD 层）。

## 行为

| 模式 | 开场 | 计谋 SPE | 跳过 |
|------|------|----------|------|
| HD 开 | `#hd-spe` 放大层 | 同左（`践踏` 等有 `dJNSpeId` 的技能） | 开场「跳过」发 `VK_ENTER`；计谋引擎不允许跳过 |
| 经典 | 只走 `#lcd` 160×96 | 只走 LCD SPE 窗 | 回车仍可跳开场 |

引擎伤害/命中/AI 不改。HD 关时不挂 overlay。

## 限制

- 放大的是 1-bit LCD，不是手绘 1080p。更细要换 `assets/hd-spe/` 或改 SPE。
- `谍报` 无 SPE id 时引擎不播，HD 也不编造。
- `STACHG_SPE` 不盖 HD 层，避免每下状态都闪全屏。
- 开场在 `GamMainChose` 之前；计谋要 `g_LookMovie` 且 `willShowPKAnimation` 未替换（返回 -1）。
