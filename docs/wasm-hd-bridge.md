# HD WASM 桥接

薄导出，不改战斗 AI / `dat.lib` 图块。HD 壳读这些字段，经典 LCD 路径不变。

## `baye.data` 新字段

| 字段 | 类型 | 含义 |
|------|------|------|
| `g_hdEngineReady` | u8 | `GamVarInit`+`script_init` 完成后为 1 |
| `g_hdReportGbk` | GBK 字符串 | 最近一次 `GamMsgBox` / `ShowGReport` 正文 |
| `g_hdReportPerson` | u16 | 报告武将 PersonID；消息框为 `0xffff` |
| `g_hdReportKind` | u16 | `1` 消息框 · `2` 武将报告 |
| `g_hdReportSeq` | u16 | 每次写入 +1，供 JS 侦测新报告 |
| `g_hdKingCount` | u16 | `GetAllKings` 之后的可选君主数 |
| `g_hdKingIds` | u16[128] | 0-based PersonID |
| `g_hdKingNames` | GBK | 8 字节槽拼接（优先用 `getPersonName(id)`） |
| `g_hdKingIndex` | u16 | 形势图当前高亮下标 |
| `g_hdKingId` | u16 | 当前高亮 PersonID |
| `g_hdMenuGbk` | GBK | 当前菜单打包串 |
| `g_hdMenuBytes` | u8[] | 同上原始字节，按 `itemLen` 切片 |
| `g_hdMenuItemLen` | u16 | 每项字节宽 |
| `g_hdMenuCount` | u16 | 项数 |
| `g_hdMenuIndex` | u16 | 当前高亮 |
| `g_hdFightActive` | u8 | `GamFight` 进入后为 1；新一场开始前先清 0 |
| `g_hdFightOver` | u8 | 镜像 `g_FgtOver`（离开战斗时写入）。新 `GamFight` 入口先清 0，避免上场全军覆没残留 |
| `g_hdFightSkip` | u8 | `BattleDrv` / 瞬时 `FgtInit` 为何没打：0 无 · 1 空城占领 · 2 已是己方 · 3 出征槽无将 · 4 `FgtInit` 当场结束 |
| `g_hdFightWait` | u8 | `FgtGetFoucs` 正在 `GamGetMsg` 时为 1（按键不会被 `GamDelay(false)` 吃掉）。新一场 / 显式 reset 时清 0 |
| `g_hdFightActCommit` | u8 | HD 待机/攻击提交：`0xFF` 无 · `0` 攻击 · `3` 待机。`FgtGetPCmd` / `PlcSplMenu` 读到即返回，不走 DOWN×3 |
| `g_hdFightAllowRetreat` | u8 | 仅用户点「全军撤退」时为 1；否则 `FgtMainMenu` case 1 硬挡并打 `retreat-blocked` |
| `g_hdFightResultGbk` | GBK | `over==1` 胜 / `over==2` 负（`STR_GAMEWON` / `STR_GAMELOST`） |
| `g_hdQtyActive` | u8 | `NumOperate` 打开时为 1，ENTER/EXIT 清 0 |
| `g_hdQtyValue` / `Min` / `Max` | u32 | 当前数与区间 |
| `g_hdHelpGbk` | GBK | `FgtShowHlp` 将领/地形正文，或大地图 HELP 的 `Ver …` |
| `g_hdHelpActive` / `g_hdHelpSeq` | u8 / u16 | 帮助打开时为 1；每次写入 +1 |
| `g_hdMovieActive` / `g_hdMovieId` | u8 / u16 | `GamMovie(MAIN_SPE)` 播放中 |
| `g_hdSpeActive` / `Id` / `Kind` | u8 / u16 / u8 | 任意 `PlcMovie`：1 开场 · 2 计谋 · 3 攻击 · 4 状态 |
| `g_hdSpeX` / `Y` / `StartFrm` / `EndFrm` / `Seq` | u8 / u8 / u8 / u8 / u16 | 播放坐标、帧窗、每 `GamShowFrame` +1 |
| `g_hdSkillActive` / `Count` / `NameLen` | u8 | `FgtGetJNIdx` 打开计谋列表 |
| `g_hdSkillIds` | u16[10] | 当前将领技能 id（1-based 资源号） |
| `g_hdSkillNames` | GBK | 8 字节槽，来自 `FgtMakeSklNam` |
| `g_hdMapPick` | u8 | `GetCitySet` 打开时为 1，返回后为 0 |
| `g_hdMapCity` | u8 | `ShowCityMap` 光标处 1-based 城号；不在视口 / 空格为 0。ENTER 认这个值 |
| `g_hdMarchOk` / `City` / `Obj` / `Time` | u8 | 本次 `AddFightOrder` 成功才 `ok=1`；`BattleDrv` 结束后清 0，避免上场覆没残留假「部队已出发」 |
| `g_hdMarchSeq` | u16 | 每次 `AddFightOrder` 成功 +1；HD 只认 `seq` 比上场大的行军 |

原有 `g_FightMap` / `g_FightMapData` / `g_MapWid` / `g_MapHgt` / `g_GenPos` / `g_FgtParam.GenArray` / `g_FgtOver` 仍可用。

## C 导出

`EMSCRIPTEN_KEEPALIVE`：

- `bayeHdReady()` → `U8`（lib 未加载时 JS 不要调用 `_bayeGetGlobal`）
- `bayeHdGetReport()` → `U8*`
- `bayeHdGetReportSeq()` → `U16`
- `bayeHdGetKingCount()` → `U16`

写入点：

- `GamMsgBox` / `ShowGReport`（`ShowDMsg` 走后者）→ report；写入后 `EM_ASM` 调 `BayeHdDialog.onEngineReport()`
- `GetAllKings` 之后（`gamEng.c`）→ king roster（不替换 `chooseActor`）
- `GamGetKing` 高亮刷新 → king highlight
- `PlcSplMenu` idle → menu items（`onMenuIdle` 额外绑定 `itemLen` / `itemCount`）
- `ShowPersonControl` 刷新 → 人物名单写入同一 menu 缓冲
- `ShowGoodsControl` 刷新 → 道具名写入同一 menu 缓冲（8 字节槽）
- `NumOperateInner` 重绘 → `g_hdQty*`；ENTER/EXIT 清 `active`
- `GamFight` 进入/离开 → fight flags + 结算 GBK；`EM_ASM` 调 `BayeHdBattle.onEngineFight()`
- `FgtGetFoucs` → `g_hdFightWait`
- `FgtShowHlp` / 大地图 `VK_HELP` 版本串 → `g_hdHelp*`；`EM_ASM` `BayeHdDialog.onEngineHelp()`
- `GamMovie(MAIN_SPE)` → `g_hdMovie*`；`EM_ASM` `BayeHdSpe.onEngineSpe()` + `BayeHdDialog.onEngineMovie()`
- `PlcMovie` → `g_hdSpe*`；计谋前 `baye_hd_begin_spe(SKILL)`；每帧 `baye_hd_spe_tick()`
- `FgtGetJNIdx` → `g_hdSkill*` + 立刻 `baye_hd_set_menu`（不 stub `fightChooseSkill`）

## JS 助手（`js/bridge.js`）

```js
baye.ensureData()    // 仅在 bayeHdReady() 后绑 baye.data
baye.hd.report()     // { text, seq, kind, person }；无 data 时走 keepalive 指针
baye.hd.reportText() // 最近一次报告/对话的中文（GBK 解码）
baye.hd.kings()      // { count, index, currentId, kings:[{id,name}] }
baye.hd.menuItems()  // { itemLen, count, index, names:[] }；人物/道具/一层菜单共用
baye.hd.qty()        // { active, value, min, max }
baye.hd.march()      // { pick, mapCity, ok, city, obj, time, seq }
baye.hd.fight()      // { active, over, wait, skip, result, mapW, mapH, bout, boutMax, focusX, focusY }
baye.hd.help()       // { active, seq, text }
baye.hd.movie()      // { active, id }
baye.hd.spe()        // { active, id, kind, x, y, startFrm, endFrm, seq }
baye.hd.skills()     // { active, count, ids, names }
baye.hd.toolName(id) // GetGoodsName
baye.hdEngineReady() // heap + `_bayeHdReady()`；未选 lib / 堆未就绪则 false
baye.lastHdCall      // 最近一次 HD 桥调用（崩溃 onerror / unhandledrejection 会附带）
```

越界防护（JS + 已重编 `baye.wasm`）：

- `baye.hd.ready()`：heap + `_bayeHdReady()`。所有 HD `setInterval` / overworld rAF 在 false 时停轮询
- OOB / `Module.onAbort` / `window.onerror` 会 `console.error('[hd-bridge] lastHdCall', JSON)`；alert **一定**带 `lastHdCall`（没有则 `(none)`）和 stack
- `pc.html` `<head>` 最先装 onerror + `Module.locateFile`，`baye.wasm?ver=` 与 `baye.js?ver=` 同号 `20260920h`，避免旧胶水配新 wasm
- `pc.html` / `choose.html` 带 `Cache-Control: no-store` + `Pragma: no-cache`；页角 `#baye-build-badge` 显示 `BAYE_ASSET_VER`；从选版本跳转会带 `&ver=20260920h` 以防缓存旧 HTML

- `getPersonName` / `getCityName` / `getToolName` / `getSkillName` / `getPersonNameByID`：index `<0` / `≥max` / `≥0xfffe`（队列空槽 `0xffff`）直接空串，不进 `ResLoadToMem`
- `ensureData` / `hd.report` / `hd.cityLinks` / keepalive 指针：lib 或 heap 未就绪则 no-op
- `hd.cityLinks(city)`：`city` 越界不调 `_bayeHdLoadCityLinks`（`city*16` 会读出 CITY_LINKR）
- 字符串长度走 HEAPU8 扫描（上限 4096），不再调 `_bayeStrLen`（裸 `strlen`）
- 城池菜单 `cityPersons` 跳过 `g_PersonsQueue` 空槽 `0xffff`，避免出征向导每 200ms 轮询打进 WASM

## 按键

词典原键没有 0–9。本分支把 **PC 数字键** 映射成 `VK_DIGIT0=0x40` … `0x49`，`NumOperate` 改当前数位。  
`0x30–0x33` 仍是 INSERT/DEL/MODIFY/SEARCH，不能占用。

## 已有、未 stub 的 hook

HD **只观察**，不往 `baye.hooks` 里登记会替换系统菜单的名字：

- `willChooseActor` / `choosingActorUpdate`（有登记才会进 IF_HAS_HOOK）
- `enterBattle` / `exitBattle` / `battleStage1`…
- `onMenuIdle`（现在带 `itemLen`/`itemCount`）

名单即使没有 hook 也会写入 `g_hd*`。

## 本轮 CDP 实测（`dat-mod.lib` / 董卓弄权）

- `script_init` 日志：`baye.data bound fields=95`，`g_hdEngineReady=1`
- `baye.hd.kings()`：18 人（马腾、公孙瓒、董卓、曹操、刘备、孙坚…），`currentId` 随形势图高亮
- `baye.hd.menuItems()`：内政 14 项（开垦…移动），`itemLen=4`
- `baye.hd.reportText()`：开垦确认后读到 `农业开发度变为 730 (+34)。`，HD 对话壳直接显示
- `baye.hd.qty()`：安定 征兵选成宜后 `active=1 value=1070 max=1070`；`VK_LEFT×2` + `VK_DIGIT5` → **1050**（HD 数字垫与 dialog 垫同时显示）
- `ShowGoodsControl` 写入道具名；董卓弄权安定开局城中无道具、武将 Equip 空
- `GetCitySet` 必须方向键走到目标格再回车，不能当菜单下标；`g_hdMapCity` 是 ENTER 实际会进的城（C_MAP，不是 china-lcc 像素）
- 观察 `cityMakeCommand` 必须 `return -1`，否则 `CityCommon` 会跳过 `AssartMake`
- 经典回车开局：190 年、君主 马腾（id=5）仍可进大地图
- 开场 / 计谋 SPE：`g_hdSpe*` + `#hd-spe` LCD-blit（见 [hd-spe-spec.md](hd-spe-spec.md)）；帮助查找图文仍 partial
- 天水 出征 马腾 → 方向键走到河内 → `部队已出发` → FunctionMenu「策略结束」→ `GamFight`
- 全军覆没后再出征：只认新的 `g_hdMarchSeq`；残留 `ok=1` / 「部队已出发」壳不进 `GamFight`。空城/已占/无将由 `g_hdFightSkip` 标明是引擎跳过
- `g_hdFightWait=1` 后 EXIT 打开原生战场菜单 `["回合结束","全军撤退","战斗动画","移动速度","敌军移动"]`
- 选「全军撤退」确认：`g_hdFightOver=2`，`baye.hd.fight().result==="我军全军覆没"`，HD `#hd-battle-result` 同文
- HD 战场系统菜单：`menuKind=sys` 画出 `["回合结束","全军撤退","战斗动画","移动速度","敌军移动"]`，点「全军撤退」再确认，不 stub `fightOpenMainMenu`
- 大地图 HELP：`g_hdHelpGbk==="Ver 260919 14:37"`；战场 HELP：马腾 `等级:1 |兵种:骑兵|武力:89 …`
- `GamMovie(MAIN_SPE)`：`g_hdSpeActive=1 kind=1`，`#hd-spe-canvas` 11× 开场；跳过发回车
- 计谋：马腾 `g_hdSkillActive=1` `ids=[30,1]` 名 **谍报 / 践踏**；HD `menuKind=skill`，不 stub `fightChooseSkill`
