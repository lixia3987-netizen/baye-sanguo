# HD SPE 原生帧与素材协议

更新：2026-10-08。引擎继续用 `PlcMovie` 决定播放、叠图、清除和结束；前端依据实际 LCD 显示提交选择高清图片槽。没有独立的 JavaScript 播放时钟，不计算伤害或命中。分支为 `feature/hd-graphics`。

## 原生资源与播放

SPE 在 LIB 内，`ResLoadToCon(speid,index+1,g_CBnkPtr)` 的 index 是原生 0-based item。资源布局为 6-byte SPERES、count 个 5-byte SPEUNIT、picmax 个 7-byte PictureHeadType 及点阵。SPEUNIT 是 x/y/cdelay/ndelay/picIdx；图片行宽为 ceil(wid/8)，层数 mask+1。单元偏移使用原生逻辑坐标；图片宽高除以实际 `g_scale`。结构按字节对齐。

| 原生资源 | 实际用途 |
|---|---|
| MAIN_SPE=3、MAKER_SPE=6 | 开场和制作群组 |
| SPE_BACKPIC=16 | 战斗组合背景 |
| 19–25 | 兵种攻击 |
| STACHG_SPE=27 | 升级/死亡等状态变化，暂不打开全屏 HD 层 |
| 35–43 等 | `dJNSpeId[skillId-1]` 实际映射的计谋资源 |

默认技能 5/11/18 可指向 FIRE_SPE=35，但 Mod/实际 LIB 可以覆盖技能表。`谍报` 等技能在资源映射为 0 时没有 SPE；不能按技能名称补造播放事件。原生 `g_LookMovie` 与 hook 仍决定是否播放。

## baye.hd.spe() version 2

旧 active/id/kind/x/y/startFrm/endFrm/seq 保留。`seq` 是兼容更新序号，禁止当作实际帧号。新增字段如下。

| 字段 | 含义 |
|---|---|
| protocolVersion、generation、eventId | 协议 2；世界重置代次与一次真实 PlcMovie 调用的 U32 身份 |
| parentEventId、depth | 嵌套 Mod 调用所属父事件；深度超过 16 使用原生回退 |
| resourceIndex、count、picmax | 实际资源 item、单元数和图片槽数 |
| resourceFingerprint、resourceLength | 整个实际 item（含 header/单元/图片/尾部）的 FNV-1a32，格式 `fnv1a32:8位小写hex:十进制字节数` |
| x、y | 原生 I16 起点，经 OriginX/Y 的 U16 位模式有符号解码；负坐标不绕回 U8 |
| frameIndex、frameValid、commitSeq | 最近原生合成的绝对 SPEUNIT 索引、是否有效及 U32 合成提交；未合成时 frameIndex=null |
| visibleFrames | 32 字节 bitset，bit i 表示本次合成仍可见的绝对 SPEUNIT i；同帧清除也可能产生新 commit |
| keyflag、skipEligible | 原生标志与真实可中断规则 `keyflag===1`；GamDelay 对 3/5 不返回可中断键 |
| protocolValid | 当前资源、背景、绘制模式与作用域是否适合高清槽合成 |
| skillId、actorIndex、targetIndex | 已知时从真实攻击/计谋调用点导出；未知为 null，不推测伤害 |
| lastEnd | 上次结束 eventId/reason/key；完整播放、按键、缺资源、无效资源或重置 |
| display | 真正进入 LCD 回调的 generation/eventId/commitSeq/frameIndex/frameValid/visibleFrames |

`baye_hd_spe_frame` 在 GamShowFrame 前捕获已引入单元与仍显示的 spec[]。`SysCopyScreen` 复制屏幕时保存这次提交的值快照；timer 合并刷新可以跳过中间提交。`timed_flush_lcd` 在 LCD 回调前发布 display，所以前端不假定每次原生提交都显示过。屏幕清除、直接绘制、restore/resize/realloc 失效旧关联。

事件结束、重置或报告接管后旧图与输入令牌失效；嵌套事件退出恢复父身份，但父帧须重新合成后才有效。缺资源也消费 pending kind/context，避免污染下一个播放。

新增 payload 验证核对已返回 item 的完整文件可读范围、SPE 范围与图片字节跨度，防止整项 FNV 扫描声明长度外。原有资源目录/header loader 不属于本批完整加固范围，不能声称任意恶意 LIB 都可安全解析。

## 高清素材 manifest

`assets/hd-spe/manifest.json` schemaVersion=1，libSha256 必须等于 **实际 global.dynLib 加载字节** 的 SHA-256；首选路径不能代替内容校验。axScale 等于实际 g_scale。entries 逐项匹配 speId/resourceIndex/kind/startFrm/endFrm/count/picmax/resourceFingerprint/resourceLength。

每个 entry 的 units 必须覆盖完整 count，记录绝对 frame/x/y/picIndex。pictures 必须覆盖完整 picmax，各槽包含 src、图片真实 width/height、logicalWidth/Height、nativeWidth/Height、mask。只接受项目目录内 PNG/WebP/SVG，无路径上跳；所有图载入成功且真实尺寸一致后才使用。

高清画布先画统一中性底色，再按实际 **display.visibleFrames** 升序合成对应图片。mask=0 使用不透明图片；mask=1 可使用透明图片。不能把透明新素材盖在尚有旧点阵的 LCD 上。异步图片、manifest 或 hash 的迟到结果需同时符合当前事件、资源和 LIB 代次。

资源未覆盖、校验等待、未知 LIB、无 digest、旧桥、缺图或尺寸不符、keyflag 保留背景位、复杂 mask、翻转/特殊画色均保持原生 LCD。非 160×96 配置暂用实际屏幕尺寸的完整 LCD 回退。基线战斗窗口固定居中 130×64、起点15,16，特效依照真实有符号 origin 保留窗口内偏移；例如 FIRE 原点48,16在窗口内为33,0。改变尺寸或 scale 必须使绘制缓存失效。

首个交付族是标准 `dat-mod.lib` 的 FIRE35：index0/kind2/0..7/count8/picmax2/fingerprint `fnv1a32:0bf53f74:1212`。两张高清图轮替，原生时序与单位、MP、回合仍由引擎管理。其余开场、兵种攻击、计谋及状态美术未完成，范围见 [hd-remaining-work.md](hd-remaining-work.md)。

## 输入与模式

HD 开场允许原生 skip 时，按钮、Enter/Space/Escape 或画布点击只发一次 VK_ENTER；按键 repeat 不重发，编辑器、输入框、IME 与隐藏页不领取输入。确认已归属本事件后即锁定，不能让下一层收到重复确认。攻击/计谋不能跳过。经典 LCD 按钮实际切换相应模式，并立即交还输入。

## 验证

`npm run test:spe` 覆盖显示提交、叠帧/清除、LIB 与异步图片代次、输入锁、报告/隐藏/经典、负 origin、屏幕尺寸和资源回退。`npm run test:spe-engine` 编译并执行实际 C 播放与桥函数，覆盖嵌套/重置、上下文消费、真实位图组合及 timer 显示关联。`npm run test:spe-runtime -- --staged` 用真实 LIB 和暂存 WASM 从玩家入口验证连续开场、跳过、战斗事件；未自然触发的资源继续记为未验收。

完整专项测试不能代替每类素材的真实连续播放与最终移动设备验收。证据按 [剩余清单](hd-remaining-work.md) 保存。
