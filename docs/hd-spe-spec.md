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

每个 entry 的 units 必须覆盖完整 count，记录绝对 frame/x/y/picIndex。pictures 必须覆盖完整 picmax 的原生槽元数据。普通旧 entry 的全部槽均需图片；新增 compositionVersion=1 的攻击 entry 只在其严格 startFrm..endFrm 范围内接入美术，该范围实际单元引用的全部槽均需完整高清图片。未在该范围引用的槽可以明确保留 src/width/height=null，不能被邻近范围借用，也不计作已交付美术。所有槽仍记录完整 logicalWidth/Height、nativeWidth/Height、mask。只接受项目目录内 PNG/WebP/SVG，无路径上跳；本范围所需图全部载入且真实尺寸一致后才使用。

高清画布先画统一中性底色，再按实际 **display.visibleFrames** 升序合成对应图片。mask=0 使用不透明图片；mask=1 使用真实透明图片。不能把透明新素材盖在尚有旧点阵的 LCD 上。entry缓存绑定完整元数据；相同源文件和完整图像尺寸/掩码元数据可以在不同攻击范围间共享一次图像解码。两层缓存均绑定manifest代次与实际LIB代次/hash，事件结束只退休显示；缓存完成回调重新读取当前原生事件与display，不携带旧帧绘制。换库或换manifest使旧缓存失效。

资源未覆盖、校验等待、未知 LIB、无 digest、旧桥、缺图或尺寸不符、keyflag 保留背景位、复杂 mask、翻转/特殊画色均保持原生 LCD。非 160×96 配置暂用实际屏幕尺寸的完整 LCD 回退。基线战斗窗口固定居中 130×64、起点15,16，特效依照真实有符号 origin 保留窗口内偏移；例如 FIRE 原点48,16在窗口内为33,0。改变尺寸或 scale 必须使绘制缓存失效。

已交付标准库FIRE35：index0/kind2/0..7/count8/picmax2/fingerprint `fnv1a32:0bf53f74:1212`；完整MAIN3：index0/kind1/0..8/count9/picmax7/fingerprint `fnv1a32:a5a91c68:11380`；以及MAKER6：index0/kind1/0..95/count96/picmax1/fingerprint `fnv1a32:b961053e:2413`。MAIN五张不透明背景与两张透明标题覆盖七槽；九个时间单元的图片序列是0,1,2,3,4,0,5,6,6，最后同一标题清除并不是第八张新美术。MAKER一张不透明署名页按原生159×96映射，96个单元从y=95滚到0。实际timer可合并短帧，不能要求每单元都产生独立LCD提交。兵种攻击、其余计谋及状态美术仍在 [剩余清单](hd-remaining-work.md)。

## 开场前准备

`lcd.bayeMain()` 在 `loadLibDefault` 的真实LIB载入回调后调用 `BayeHdSpe.prepareStart(_main)`。HD且160×96时，先以实际LIB身份读取manifest并加载全部MAIN图片，成功后再进入原生主循环；5秒超时、404、未知库或不匹配均继续原生游戏。经典模式直接进入；手机入口未加载此模块，仍直接执行原入口。

准备期间不访问 `baye.data` 或原生getter、不提前绑定C全局、不发键；JS定时检查只管理载入上限。使用callback及fetch/crypto自身then链，兼容引擎覆盖全局Promise。继续回调恰好一次，原生主循环异常仍向外传播；原生开场时钟在进入主循环后开始，HD不推进、暂停或改变动画结果。准备成功也只授予资源缓存，实际显示仍需当前事件、完整匹配和display.visibleFrames。

## 输入与模式

HD 开场允许原生 skip 时，按钮、Enter/Space/Escape 或画布点击只发一次 VK_ENTER；按键 repeat 不重发，编辑器、输入框、IME 与隐藏页不领取输入。确认已归属本事件后即锁定，不能让下一层收到重复确认。攻击/计谋不能跳过。经典 LCD 按钮实际切换相应模式，并立即交还输入。

## 制作群组的原生停留归属

`GamMakerInf` 的默认分支由 `GamMovie(MAKER_SPE)` 和原有 `GamDelay(5000,2)` 组成。滚动结束后，子SPE已经退出，LCD保留实际最后复制的画面；该等待为5000个原生timer1 tick，在本机约50秒，不是5秒。提前跳过滚动仍进入原有停留，并保留实际部分滚动位置。HD不补滚到末帧、不缩短等待，也不在自然结束时发送确认。

新增只读 `baye.hd.maker()` 协议1，归属与子SPE分开。`active/phase/generation/session/inputSeq/custom/returnEligible` 表示原生滚动或停留的所有者；`resourceIndex/count/picmax/x/y/startFrm/endFrm/resourceFingerprint/resourceLength` 和 `display` 保存真正复制到LCD的SPE来源。`scrollEnd.reason/key` 仅记录子SPE的结束，不代表后续停留的返回键。停留时公开 `baye.hd.spe().active` 仍为false，前端内部只读呈现层不修改这个事实。

默认、非自定义、资源有效且真正复制过的MAKER画面才授予 `sourceValid`。保存的generation/eventId/commitSeq/frameIndex/32字节visibleFrames必须与当前公开SPE.display完全相等；实际LIB、manifest、范围和图片仍走相同严格匹配。原生hold期间的屏幕dirty/copy/restore/resize会永久退休该图像授权；原生等待还在时仍可以保留输入归属并回退LCD。世界重置、返回及后续输入所有者使旧token失效。`showAbout`只调用原有一次hook；hook自行处理时不创建默认归属，存在自定义hook但返回-1时允许原生默认流程，禁用标准HD署名图。

桥接先检查所有字段宽度与真实32字节bitset，再重读所有字段防止跨归属混合。ValueTypeU32在实际WASM i32返回边界用 `>>>0` 还原无符号位模式；严格领域getter仍拒绝负数、字符串、布尔值和不完整快照。

标题表现与排队输入在MAKER原生归属期间退休。滚动skip和hold返回各用不同token；48px“返回标题”按钮只对当前hold发送一次原生Enter。pointerdown记录当前token，pointercancel、隐藏、模式切换或归属变化清除，迟到click不能确认新标题。Enter/Space/Escape同样只确认当前hold，repeat/IME/表单输入不领取。经典模式继续使用原生输入。等待自然结束或真正确认后，标题使用新的原生菜单归属重新显示。MAKER资源在开场期间预热，但不增加MAIN开场等待，不暂停原生署名滚动。

## 普通攻击的背景、退场与数字观察

SPE v2 保持原义，独立 composition v1 在 `composition` 与 `display.composition` 中提供实际背景资源/index/slot/header/FNV/长度/有符号原点，以及32字节累计 `clearFrames`。背景来源是实际 `PlcRPicShowEx` 默认绘制，不由资源号或标准库路径推测。每次真实 `gam_clrvscr` 记录对应绝对单元；`SysCopyScreen` 保存值快照，实际timer刷新才发布显示快照。只按仍可见的单元重画不足以重建原生角饰被擦除的场景。

攻击 entry 的 `background` 必须逐字段匹配实际显示背景，其高清画布按背景、累计清除矩形、当前可见单元升序合成。清除矩形使用该单元真实图片宽高和原点；不复原已被原生擦去的边框。背景高清纹理与中性清除色的艺术差异另外用真实截图检查，不声称高清像素与原生单色点阵相等。

只读 `baye.hd.attack()` v1 观察真正 `FgtAtkAction` 的 movie/numbers/hold 三阶段。`generation/session/actorIndex/targetIndex/hurt/custom/sourceValid` 来自实际调用点，hurt是原来CountPlusSub的实际结果。`scene` 保存最后真正复制的SPE及其背景/可见/清除位图；`display` 另保存实际LCD刷新的数字绘制。数字来自实际NUM15字符槽与 `DigitX/Y/FirstY/DrawCount`，按字符顺序累计重放每次不透明12×16绘制框与上移位置，保留相邻字符重叠和旧底部足迹。原生timer合并多个绘制时，不用前端时钟补帧或提前显示后续数字。高清数字使用画布字体表现，实际原生位图另由独立像素oracle核对。

数字与原有最终等待期间公开SPE仍inactive；前端 `attack-postlude` 只是该真正攻击所有者的表现。没有新增skip/return按键，不计算或推进伤害/经验，也不更改g_LookMovie、原有延时和消息处理。原有willShowPKAnimation只调用一次，自定义hook即便返回-1也永久撤销标准HD来源。未控制的虚拟/LCD绘制、嵌套事件、重置、非默认palette/flip/paint、无效背景或数字资源同样退休HD；真正等待仍在时显示真实LCD。

所有新增桥字段严格检查原生宽度、完整固定数组，并最终逐项重读身份、资源和显示快照，防止getter重入后拼接新旧代次。普通图资源16/15增加目录与物理长度检查，不将此局部加固扩称为任意Mod文件安全解析。

`npm run test:attack` 编译执行实际原生绘制/播放/数字及桥接范围矩阵。真实浏览器脚本 `npm run test:attack-runtime -- --staged --range 21:9:17` 只验收其明确合法流程；完整37范围的原生像素专项、素材静态覆盖和真实玩家触发分别记录，不能互相替代。

## 计谋结果与嵌套归属

只读 `baye.hd.skillResult()` 协议1观察真正 `_CommonJNAction` 的 movie/numbers/hold，以及没有电影的原生粮草提示。旧 `baye.hd.skill()` 仍表示计谋选择菜单。结果的 skillId、actorIndex、targetIndex、resultKind、value 来自当前实际调用；value 是原生显示的 U16 值，不能用它推算粮草总量或实际增减。例如粮草显示请求80而实际扣除50时，保留显示80。

每个实际目标持有独立 session；标签由真正 `GamStrShowS` 消费的 GBK 字节及坐标观察，数字仍来自 NUM15。current、copy 与 timed-flush display 分开保存；只有实际进入 LCD 回调的完整匹配快照才用于高清重放。电影阶段尚未显示的标签/数字不提前绘制，电影结束后的 public SPE 保持 inactive。没有新增键、跳过、定时器、伤害/经验计算、等待或第二次 hook 查询。

当前 FIRE35 的实际8单元都使用不透明65×64图片和同一起点48,16，因此只有已经实际复制过的 `scene.mode===2` 矩形授予窗口内高清。累计清除、可见图片、真实标签和数字按实际写入顺序重放；130×64显示画布内、特效窗口外的4160个逻辑像素保留真实 LCD。完整160×96原生画面的窗口外11200像素由独立原生oracle另行核对。电影本身仍沿既有 SPE 窗口表现，不声称整片战场已高清。其它资源、没有电影、粮草、custom、未证实背景或来源退休，继续完整160×96 LCD；不能固定裁到攻击 arena 而隐藏原生目标坐标的文字。

高清数字字形最大宽度为原生6px步距，绘制高度、12×16不透明清除、clip 与所有实际历史位置保持原值。这个字形调整避免后一个数字的清除框擦掉前一个数字右半；旧底部轨迹仍保留。高清字体属于美术替换，原生 ROM 数字和实际字体像素另行独立核对。

`baye.hd.resultOwner()` 用 kind（1攻击、2计谋）、generation、session、valid 观察当前实际调用栈顶。两类结果的高清来源必须同时匹配此归属；嵌套返回不会复活父层已退休的高清来源。同类嵌套覆盖了公开前缀时，真实父等待仍作为 `result-lcd` 保留完整原生画面，不能误显示新子层、旧攻击或标题。重置清空当前栈归属，迟到 unwind 不能恢复旧世界。

新增普通攻击范围19/index0/11..21（骑兵对步兵）和20/index0/10..19（步兵对步兵）仍保留完整66/60单元和19/18图片槽元数据，只授权该明确区间所需的9/6槽。21/9..17首组继续保留。三个区间的真实流程、原生像素、高清绘图和失败尝试分别记录在[本批验收](validation/m4-attacks-skills-20261008.json)，不扩称37区间全部完成。

`npm run test:skill` 包含实际 C、桥和 SPE 前端专项；`npm run test:skill-runtime -- --staged` 使用真实玩家出征、移动、计谋菜单、范围与目标选择。原生随机失败须原样保留，不直接开启电影或改成功率。LCD 捕获必须取实际回调 ImageData 或真正 LCD canvas readback，不能把 HD canvas PNG 命名为原生图来充当像素证据。

## 验证范围

`npm run test:spe` 覆盖显示提交、叠帧/清除、LIB 与异步图片代次、输入锁、报告/隐藏/经典、负 origin、屏幕尺寸和资源回退。`npm run test:spe-engine` 编译并执行实际 C 播放与桥函数，覆盖嵌套/重置、上下文消费、真实位图组合及 timer 显示关联。`npm run test:spe-runtime -- --staged` 用真实 LIB 和暂存 WASM 从玩家入口验证连续开场、跳过、战斗事件；未自然触发的资源继续记为未验收。

`npm run test:opening-runtime` 默认严格验收实际MAIN完整冷开场：1080p/720p首提交及全部可见提交均HD、七槽自然出现、原生完整结束和双标题清除；独立单次跳过、经典/resize、真实tab后台与恢复、受控404/迟到、真实sc-mod.lib及恢复标准库。逐次捕获原LCD与HD原图并核对前后display戳、实际IMG绘制来源/顺序/坐标；标准库另按实际palette/scale/flip重建原生位图逐byte对照。`--allow-lcd` 仅为原生开发基线，不能算HD完成。完整原始记录及图片见 [MAIN验收](validation/m4-opening-20261008.json)。

完整专项测试不能代替每类素材的真实连续播放与最终移动设备验收。证据按 [剩余清单](hd-remaining-work.md) 保存。

`npm run test:maker` 包含17个实际C生命周期用例和13个桥接用例；其中U32用例使用真正WebAssembly i32.load和实际ValueTypeU32绑定，不用模拟负数替代ABI。`npm run test:maker-runtime -- --staged` 从真实标题选择“制作群组”，连续采集原LCD/HD画布、实际IMG绘制和前后display戳，并按真实LIB点阵重建LCD逐byte比较。七个独立页面场景覆盖完整自然结束、提前skip后的部分停留、显式返回按钮、模式/隐藏/resize、实际HTTP缺图/迟到及真实未知LIB回退。实际tab隐藏与只用于停绘防护的visibility夹具分开记录；未知Mod只验署名/标题，不冒充完整新局或战役。`--allow-lcd`保留原生开发基线。最终结果以[MAKER验收](validation/m4-maker-20261008.json)为准。
