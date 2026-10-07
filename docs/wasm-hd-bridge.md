# HD WASM 桥接

导出原引擎状态，不改战斗 AI / `dat.lib` 图块。HD 输入与经典输入分别接入菜单，切经典时恢复原有 hook 和原生菜单。JavaScript 与 WASM 必须成套更新；协议新增菜单回退值 `-2`（U8 `0xfe`，`BAYE_HD_MENU_NATIVE`），由 C 打开原生系统菜单，与 EXIT `-1` 不同。

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
| `g_hdMenuBytes` | u8[16384] | 同上原始字节，按 `itemLen` 切片；容纳 2000 人的 8 字节姓名槽 |
| `g_hdMenuItemLen` | u16 | 每项字节宽 |
| `g_hdMenuCount` | u16 | 项数 |
| `g_hdMenuIndex` | u16 | 当前高亮 |
| `g_hdFightActive` | u8 | `GamFight` 进入后为 1；新一场开始前先清 0 |
| `g_hdFightOver` | u8 | 镜像 `g_FgtOver`（离开战斗时写入）。新 `GamFight` 入口先清 0，避免上场全军覆没残留 |
| `g_hdFightSkip` | u8 | `BattleDrv` / 瞬时 `FgtInit` 为何没打：0 无 · 1 空城占领 · 2 已是己方 · 3 出征槽无将 · 4 `FgtInit` 当场结束 |
| `g_hdFightWait` | u8 | `FgtGetFoucs` 正在 `GamGetMsg` 时为 1（按键不会被 `GamDelay(false)` 吃掉）。新一场 / 显式 reset 时清 0 |
| `g_hdFightActCommit` | u8 | 旧 HD 桥兼容邮箱；仅行动菜单可消费，关闭等待即丢弃。M2 控制器通过真实菜单逐键确认，不写此字段 |
| `g_hdFightAllowRetreat` | u8 | HD 用户点「全军撤退」时为 1；仅本次 HD hook 的撤退受授权限制，原生与既有 Mod 菜单保留原确认流程 |
| `g_hdFightMenuControl` | u8 | 仅当前 HD `fightOpenMainMenu` 调用写 1；C 在每次菜单调用前清 0，避免继承上一场或其他 hook 的授权 |
| `g_hdFightResultGbk` | GBK | `over==1` 胜 / `over==2` 负（`STR_GAMEWON` / `STR_GAMELOST`） |
| `g_hdQtyActive` | u8 | `NumOperate` 打开时为 1，ENTER/EXIT 清 0 |
| `g_hdQtyValue` / `Min` / `Max` | u32 | 当前数与区间 |
| `g_hdQtySession` / `InputSeq` / `LastKey` | u32 / u32 / u16 | 数量会话、实际字符按键回执序号、最后处理的原生键码；序号回绕跳过 0 |
| `g_hdQtyCursor` / `Step` / `Ready` | u8 / u32 / u8 | 原生数字光标、方向键步长、处理完成且正在等待输入 |
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
| `g_hdMarchOk` / `City` / `Obj` / `Time` | u8 | 本次 `AddFightOrder` 成功才 `ok=1`；仅消费匹配 OrderId、City、Object、Person 槽位的实际订单才清 0，其他 AI 或较早订单不能清除本次确认 |
| `g_hdMarchSeq` | u16 | 每次 `AddFightOrder` 成功 +1，回绕跳过 0；结合 session、出发城和目标城确认新订单，不用大小比较 |
| `g_hdFightInputKind` / `InputSeq` / `Actor` | u8 / u32 / u8 | 真实输入等待类型、进出等待的序号、当前行动将领下标（空闲 255） |
| `g_hdMenuActive` / `Context` / `Kind` / `Seq` | u8 / u8 / u8 / u32 | 菜单真实生命周期与上下文；关闭后旧 bytes 不代表可操作菜单 |
| `g_hdMarchPhase` / `Session` / `Origin` / `Selected` / `InputSeq` | u8 / u16 / u8 / u8 / u32 | 出征步骤、当前出征会话、0-based 出发城（空闲 255）、已选人数及阻塞输入序号 |
| `g_hdMapInputSeq` | u32 | 每次真正进入 `GetCitySet` 的输入序号；同一次等待中的光标移动不改变它 |
| `g_hdReportActive` / `InputSeq` | u8 / u32 | 报告真实等待的归属与输入序号；正文 seq 变化不等于可确认 |
| `g_hdRecordActive` / `Mode` / `Index` / `Count` / `Seq` | u8 / u8 / u8 / u8 / u32 | 原生存读档等待：mode 1 保存、2 读取；下标更新不重开等待 |

原有 `g_FightMap` / `g_FightMapData` / `g_MapWid` / `g_MapHgt` / `g_GenPos` / `g_FgtParam.GenArray` / `g_FgtOver` 仍可用。

当前 manifest 的 `hdInputProtocol.version=3` 共记录 27 个生命周期字段：fight 3、menu 4、march 6、report 2、record 5、qty 7。M3 的 version 2 记录前五组共 20 个字段。它们用于判断当前输入归属；不能用缓存正文、旧菜单名或旧异步调用编号代替。

## M4 数量输入确认

`qty().protocol` 表示六个新增数量字段均存在；旧引擎继续使用原有定时队列。支持新协议时，HD 根据真实 `cursor` 和 `step` 选择所需方向键，每个按键等待同一 `session`、下一个非零 `inputSeq`、匹配 `lastKey` 和 `ready=1` 后才继续。按键处理、必要重绘及下一次输入等待全部到达后，C 才发布回执；光标移动、达到边界或未改变数值的数字键也有回执。触摸与定时消息不会伪造字符按键确认。

`cursor` 沿用原生 `bit` 的视觉位置，方向键步长为 `step`；原生数字键仍按既有 `10^bit` 规则替换数字。前端不修改数量或游戏资源。按钮与实体键盘通过同一数量队列输入，确认等待之前的按键全部收到回执；取消、会话切换、新世界和模式切换使旧操作失效，超时不重发未确认的按键。ENTER、EXIT 和原生触摸确认/取消关闭数量等待，世界提交更新数量会话令牌，旧 C 调用不能重新发布已失效的数量镜像。

`bayeSendKey` 只将消息加入原生队列，入队时 `ready` 可以仍为 1。共享的已发送按键记录跨弹窗和模式的异步令牌保留；重新打开同一数量会话时，先等待旧按键的真实回执，再根据最新光标规划。确认也经过此等待，不能领取旧的同码按键回执。取消或确认后，已关闭的同一会话在 C 尚未退出期间继续拦截游戏键，避免落入下一层经典界面；编辑器、输入法和 SPE 原有键盘归属保持。

## M2 输入生命周期

`fight.inputKind`：0 忙碌、1 选将、2 移动、3 行动菜单、4 计谋菜单、5 瞄准、6 系统菜单、7 撤退确认、8 设置菜单、9 帮助、10 形势图。`fight.inputSeq` 在进入和退出真实等待时变化，同一等待里的光标移动不改变序号；形势图翻页完成后会产生新的序号作为响应确认。`fight.actorIndex` 为战场将领数组的 0-based 下标，不是 PersonID。

`menuItems().active` 只在真正菜单等待中为 1，`context` 为 0 无、1 城池、2 大地图系统、3 战场。城池 `kind=1/2/3/4` 表示根菜单/子菜单/人物/道具；战场 kind 与 inputKind 一致。人物和道具按 8 字节 GBK 槽打包，槽内允许 NUL，必须按 `itemLen × count` 复制，不能按首个 NUL 截断。文本缓冲在关闭后可以保留，输入必须同时校验 active、context、kind、seq。M3 增加的系统与战役归属见下节。

`march.phase`：0 空闲、1 选将、2 粮草、3 目标提示、4 选城、5 拒绝提示、6 出发提示、7 已写入订单。每次进入 `BattleMake` 产生新 session，退出时结束等待；`march.inputSeq` 区分同一步骤的多次等待。行军成功必须是当前 session、新订单 seq、匹配 origin/目标的 `ok=1`，报告文字不能代替订单确认。

手动控制器每次点击只启动一项操作。方向键后等待真实光标或菜单下标确认，再继续该次操作；ENTER 发送一次并结束事务，不因超时重发。切经典模式、输入序号变化或进入另一场战斗会使旧事务失效。刷新、绘制和结果通知只读取引擎，不自动攻击、待机、过回合或确认俘虏。

## M3 战役、报告与存读档生命周期

`menu.context=4` 为 SYSTEM：`kind=1` 标题菜单，`kind=2` 时期菜单，`kind=3` 开局君主菜单。图片菜单通过 `baye_hd_set_menu(NULL, 0, count, index)` 发布真实项数与光标，不伪造菜单名称；同一次等待中更新 index 不改变 seq。君主菜单在真实 `GamGetKing` 等待期间发布 8 字节姓名槽，确认或取消后结束；不能用历史 `kings().count` 或上一局 `g_PlayerKing` 判断当前是否正在选君主。

`context=5` 为 CAMPAIGN：`kind=1` 是玩家继任选将，`kind=2` 是敌军来袭时的守将选择。`ShowPersonControl` 的默认城市归属保留上游显式 scope，名单使用原生顺序与下标，支持全部 2000 个候选；每步方向键等待该请求的实际 index ACK 后再推进，最终只发一次 ENTER。继任取消按经典规则重新等待玩家选择，不自动拥立第一人。守将菜单逐名确认后产生新 seq 和缩减后的名单，“完成选将”只向当前 owner 发一次 EXIT；名单选尽由 C 自然开战，HD 不向 BUSY 状态补发确认。守城地点和已选将领读取真实 `g_FgtParam.CityIndex` 与 `GenArray[0..9]`，上一战的 `fight.over` 或旧出征阶段不能替代当前等待。

系统与战役人物菜单的 5 秒期限是每步未收到预期 ACK 的等待上限。只有实际预期下标确认才刷新期限；系统菜单另有 60 秒总限，战役人物菜单按真实候选数设置有界总限。超时取消请求，不重发未确认按键，也不自动选择下一人。

`baye_hd_world_commit()` 只在新游戏初始化完成或两个存档文件全部验证并提交后调用。它清除旧战斗结果、出征阶段及输入令牌，保留刚提交的城市、人物、订单等世界数据；读取失败不触发此清理。

`report.active` 由 `GamMsgBox` / `ShowGReport` 在真正进入等待时 begin、返回时 end；`inputSeq` 每次进入、退出或恢复外层等待都更新。报告正文的 `seq` 与输入的 `inputSeq` 分工不同。最多保存 16 层等待正文、person 和 kind，内层结束后恢复外层正文并生成新的输入序号，内层按钮不能继续确认外层。`GamMsgBox(delay=0)` 和禁用的武将报告没有输入等待。战斗提示的 `GamDelay(300, responseNoteOfBettle)` 保持经典规则，默认纯定时提示不能被伪造的确认按钮跳过。

`baye.hd.record()` 发布原生 `GamRecordMan` 的 active、mode、index、count、seq：`mode=1` 保存，3 个槽位；`mode=2` 读取，4 个槽位。槽位 `i` 对应 `sango(2i).sav` 与 `sango(2i+1).sav`，稀疏槽位保留真实下标。只有匹配原生等待的请求才能逐键移动光标并确认；index 更新是 ACK，不增加 seq。保存或读取失败后重新打开等待会生成新 seq，旧请求不得重发 ENTER。新 LIB / 新游戏清除报告嵌套、存读档等待和旧出征确认，更新输入序号使旧操作失效。

出征槽位按 10 个 `PersonID`（20 字节）保存，共 30 槽、600 字节。`BattleMake` 入队成功才扣粮与钱；队列满或 Mod 拒绝时退回武将，保留资源。最新出征确认关联实际 OrderId、出发城、目标城与 Person 槽位，其他订单执行不会提前消费它。胜负、占城、俘虏和继任仍由 C 结算，HD 只观察结果并提供真实输入。

## 存档格式与浏览器事务

新存档版本为 `0x95`，每槽仍有两个文件。第一文件包含完整 4000 字节道具队列，以及自定义数据前的 U32 长度；第二文件包含完整 600 字节出征将领队列。读取时先暂存并校验两份文件、长度、队列引用及自定义数据，再一次性提交世界状态；缺失、截断或非法文件不会部分改写当前世界。

支持 `0x90`–`0x94` 旧格式。旧版只保存 300 字节出征数据，又使用 `40 × slot` 的旧偏移；完整的活动槽 0–7 会重排至新布局。活动槽 `slot≥8` 的将领字节未被旧文件保存，加载必须拒绝，不能补造将领。未保存的道具队列后半段清零。

`js/save-storage.js` 统一游戏与导入、导出页的存储操作。保存先写旧槽快照 journal，再写两文件及 LIB 元数据，最后删除 journal 才公开新槽；写失败时保留旧完整槽，刷新后仍从 journal 读取旧快照。LIB 校验使用路径及完整加载内容的长度、两路 32 位指纹，同路径的不同上传 LIB 也会拒绝加载；旧存档没有内容指纹时保留旧路径兼容检查。导入同样校验双文件并通过槽事务提交。

页面必须先加载 `save-storage.js`，再加载 `lcd.js`。纯存档导出页只安装存储模块，不安装 LCD 或启动引擎。

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
- 标题 / 时期菜单 → SYSTEM scope 与纯索引菜单；开局君主 → SYSTEM/KING scope；`KingOverDeal` 玩家选将 → CAMPAIGN/SUCCESSOR scope；`BattleDrv` 守将选择 → CAMPAIGN/DEFENDERS scope
- `ShowGoodsControl` 刷新 → 道具名写入同一 menu 缓冲（8 字节槽）
- `NumOperateInner` 重绘 → `g_hdQty*`；ENTER/EXIT 清 `active`
- `GamFight` 进入/离开 → fight flags + 结算 GBK；`EM_ASM` 调 `BayeHdBattle.onEngineFight()`
- `FgtGetFoucs` → `g_hdFightWait`
- `FgtShowHlp` / 大地图 `VK_HELP` 版本串 → `g_hdHelp*`；`EM_ASM` `BayeHdDialog.onEngineHelp()`
- `GamMovie(MAIN_SPE)` → `g_hdMovie*`；`EM_ASM` `BayeHdSpe.onEngineSpe()` + `BayeHdDialog.onEngineMovie()`
- `PlcMovie` → `g_hdSpe*`；计谋前 `baye_hd_begin_spe(SKILL)`；每帧 `baye_hd_spe_tick()`
- `FgtGetJNIdx` → `g_hdSkill*` + 立刻 `baye_hd_set_menu`（不 stub `fightChooseSkill`）
- `GamMsgBox` / `ShowGReport` 真实等待前后 → `baye_hd_report_begin/end`
- `GamRecordMan` 打开、光标更新、返回 → `baye_hd_record_begin/index/end`

## JS 助手（`js/bridge.js`）

```js
baye.ensureData()    // 仅在 bayeHdReady() 后绑 baye.data
baye.hd.report()     // { text, seq, active, inputSeq, kind, person }；无 data 时正文走 keepalive 指针
baye.hd.reportText() // 最近一次报告/对话的中文（GBK 解码）
baye.hd.record()     // { active, mode, index, count, seq }；mode 1 保存、2 读取
baye.hd.kings()      // { count, index, currentId, kings:[{id,name}] }
baye.hd.menuItems()  // { active, context, kind, seq, itemLen, count, index, names:[] }
baye.hd.qty()        // { active, value, min, max }
baye.hd.march()      // { phase, session, origin, selected, inputSeq, mapInputSeq, pick, battlePick, mapCity, ok, city, obj, time, seq }
baye.hd.fight()      // { inputKind, inputSeq, actorIndex, active, over, wait, phase, aimType, tip, skip, result, mapW, mapH, bout, boutMax, focusX, focusY }
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
- `pc.html` `<head>` 最先装 onerror + `Module.locateFile`，`baye.wasm?ver=` 与 `baye.js?ver=` 同号 `20261007f`，避免旧胶水配新 wasm
- `pc.html` / `choose.html` 带 `Cache-Control: no-store` + `Pragma: no-cache`；页角 `#baye-build-badge` 显示运行时版本；入口脚本缓存号同步为 `20261007f`

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

## 历史 CDP 实测（M2 改造前，`dat-mod.lib` / 董卓弄权）

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
