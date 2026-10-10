# HD SPE 原生帧与素材协议

更新：2026-10-09。引擎继续用 `PlcMovie` 决定播放、叠图、清除和结束；前端依据实际 LCD 显示提交选择高清图片槽。没有独立的 JavaScript 播放时钟，不计算伤害或命中。分支为 `feature/hd-graphics`。

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

后续素材批次将39个已接受的严格原始字节组接入全部素材齐备的24个调用区间：19、20、21、23各六个守方段。每个entry仍保存完整原生item/FNV/长度、全部单元和图片槽，只有该段实际使用的图片才有src，其余明确为null；旧MAIN/MAKER/FIRE和三个攻击entry保持原值。22水军六段、24玄兵六段以及25水面特殊段因12组素材未完成继续LCD。素材接线、实际C37区间矩阵和真实玩家攻击是三个不同证据范围，详见[区间批次验收](validation/m4-attack-ranges-20261008.json)。

真实攻击脚本支持`--target-arm 0..5`与严格`--range SPE:start:end`，按当前敌方GenArray、实际人物ID、存活状态、装备派生兵种、目标地形及原生AIM选择。方悦仅是当前真实ID的排序偏好，不固定battle slot；最终必须由玩家确认的攻击发出该准确区间，自然敌军动画不能替代。征兵仍使用真实城市队列、数量上限、资金与确认菜单，弓兵可沿相同合法入口征兵。

`npm run test:skill` 包含实际 C、桥和 SPE 前端专项；`npm run test:skill-runtime -- --staged` 使用真实玩家出征、移动、计谋菜单、范围与目标选择。原生随机失败须原样保留，不直接开启电影或改成功率。LCD 捕获必须取实际回调 ImageData 或真正 LCD canvas readback，不能把 HD canvas PNG 命名为原生图来充当像素证据。

## 验证范围

`npm run test:spe` 覆盖显示提交、叠帧/清除、LIB 与异步图片代次、输入锁、报告/隐藏/经典、负 origin、屏幕尺寸和资源回退。`npm run test:spe-engine` 编译并执行实际 C 播放与桥函数，覆盖嵌套/重置、上下文消费、真实位图组合及 timer 显示关联。`npm run test:spe-runtime -- --staged` 用真实 LIB 和暂存 WASM 从玩家入口验证连续开场、跳过、战斗事件；未自然触发的资源继续记为未验收。

`npm run test:opening-runtime` 默认严格验收实际MAIN完整冷开场：1080p/720p首提交及全部可见提交均HD、七槽自然出现、原生完整结束和双标题清除；独立单次跳过、经典/resize、真实tab后台与恢复、受控404/迟到、真实sc-mod.lib及恢复标准库。逐次捕获原LCD与HD原图并核对前后display戳、实际IMG绘制来源/顺序/坐标；标准库另按实际palette/scale/flip重建原生位图逐byte对照。`--allow-lcd` 仅为原生开发基线，不能算HD完成。完整原始记录及图片见 [MAIN验收](validation/m4-opening-20261008.json)。

完整专项测试不能代替每类素材的真实连续播放与最终移动设备验收。证据按 [剩余清单](hd-remaining-work.md) 保存。

`npm run test:maker` 包含17个实际C生命周期用例和13个桥接用例；其中U32用例使用真正WebAssembly i32.load和实际ValueTypeU32绑定，不用模拟负数替代ABI。`npm run test:maker-runtime -- --staged` 从真实标题选择“制作群组”，连续采集原LCD/HD画布、实际IMG绘制和前后display戳，并按真实LIB点阵重建LCD逐byte比较。七个独立页面场景覆盖完整自然结束、提前skip后的部分停留、显式返回按钮、模式/隐藏/resize、实际HTTP缺图/迟到及真实未知LIB回退。实际tab隐藏与只用于停绘防护的visibility夹具分开记录；未知Mod只验署名/标题，不冒充完整新局或战役。`--allow-lcd`保留原生开发基线。最终结果以[MAKER验收](validation/m4-maker-20261008.json)为准。

## 2026-10-09：完整普通攻击素材与真实汉中目标

标准LIB的113个原生图片槽按原payload SHA对应51组内置原始PNG，19–24的六个守方段及25水面段共37个调用区间全部严格接线。原有完整units、picmax、FNV/length、每槽native尺寸/掩码、背景16和数字15保持；只用当前区间required slots，未用槽null。旧27个entry对象原样保留，无native/前端JS/CSS/引擎产物变化。

真实驱动支持`--destination 14`，保留默认9；当前Realm归属、真实CITY_LINKR字节、AddFightOrder原生订单和实际战场CityIndex分别确认。每次目标以当前真实GenArray、存活、装备派生兵种、地形0..6和fresh native AIM授权，不能用初始slot或既往AIM排名授权攻击。

三次新增对弓的玩家攻击实际通过19:22..32、20:20..29、21:18..26；其它28接线组合仍待实战，原有对步/对骑六段保留历史来源而未冒充本批复验。原生死亡失败与同一源码后续真实新局通过分别保留，不能改伤害/兵力/随机状态或绕过死亡门控。详见[普通攻击完整接入与汉中实战证据](validation/m4-attack-completion-20261009.json)。

## 2026-10-09：STONE42无数字状态计谋

标准技能23「石阵」的实际资源42/index0、kind2、start0/end7、count8/picmax2、1084bytes、`fnv1a32:0e6f8d97:1084`。8单位x/y0、cdelay/ndelay20，槽0/1交替，两槽均64×64/mask0。两张1254×1254原始PNG按原生起点48,16映射到既有130×64电影画布，相对偏移33,0；没有独立动画时钟。旧40entry对象和普通51原图/ledger均原样保留。

`skillResultVersion1`及真实NUM15 metadata用于现有manifest校验与预热；加载只准备entry图片，不启动数字阶段。实际power/destroy均0，原生局部arms/prov为0，因此不进入NUM15、标签或hold，skill_end后才出现真实状态报告。状态6石阵与状态3定身分开：石阵不设置移动1，也不产生虚构兵力伤害。实际LCD与最终严格HD两个成功游戏分别验证800兵、move4保持和状态0→6；最终8实际timer显示均高清，完整160×96原生RGBA由独立真实位图重建逐字节核对。

`npm run test:stone-runtime -- --recruit --recruit-arms 800`使用独立浏览器及私有端口，先观察真实钱/后备兵/名单与数量上限，再通过真正征兵、分配、出征、技能菜单和当前AIM完成23。800是请求量，巴郡实测资金仅允许590征兵、690分配；不伪造兵力、MP、随机种子或成功事件。自然失败、其它技能捕获与选中成功Stone8回调分开，原生像素专项不扩称所有raw captures已oracle验证。公开silent close只用于已退回原生地图的准备壳退休；它不证明普通空征兵pane返回已修复。证据见[石阵专项](validation/m4-stone-20261009.json)。

随后独立`npm run test:city-back-runtime`已验证真实资金耗尽后的普通返回按钮零键退壳，以及分配取消、军备子菜单/根菜单各一次EXIT和地图回执退壳。两次私局中的初次回执/UI等待失败与最终16点通过分开记录，未扩展SPE/战斗验收；见[城池返回专项](validation/m4-city-back-20261009.json)。


## WATER36 水淹原图与结果阶段

标准skill12使用资源36/index0/kind2/0..7/count8/picmax2，payload1084与 `fnv1a32:6d62e7a8:1084` 经实际LIB核对。两个原始内置生成不透明1254×1254 PNG映射到原生64×64窗口(48,16)，完整8单位交替两槽，20/20延迟由原生执行。旧41项manifest不变；NUM15仅使用实际12×16/10槽/327bytes来源，前端不计算伤害、补数字或改变等待。

真实P3韩玄/长沙→桂阳玩家王朗技能12对河川陈应成功：MP66→46、敌兵800→400；8电影和21结果读回全HD，28callback+1held独立核对全160×96原生像素。标签取实际GBK消费字节，数字400保留真实多次上移与opaque足迹，原有50tick等待后owner正常退休，结果期零输入。电影窗口外中性舞台与结果窗口外LCD各自限定，不推定全战场背景、其它计谋、Mod或移动验收。首个汉中路线0cast/自然阵亡另存，[完整证据](validation/m4-water-20261009.json)。


## FENG39 奇门状态计谋

标准skill20奇门使用39/index0/kind2/0..7/count8/picmax2/1084bytes，指纹fnv1a32:6b0ebc5a:1084。八单位x/y0、cdelay/ndelay25，槽0/1交替；两张1254×1254原始不透明PNG映射原生64×64窗口(48,16)，现有130×64画布相对偏移33,0，不增加动画时钟。旧42entry和native/JS/CSS保持。

原生aim1/state4/power0/destroy0/useMP20。现有NUM15 metadata用于manifest校验和预热；本次实际state-only调用没有数字、标签或50tick数字等待，电影结束后真实状态报告接管。最终真实玩家徐庶对刘琦MP82→62、兵力100保持/state0→4，8次原生timer读回全HD并独立核对160×96。共享39的技能14/15未做实际施法验收；STATE_QM4不是Stone6或DS3移动限制。

可重复入口npm run test:qimen-runtime -- --recruit --search-orders 8 --search-months 24。24/8是独立私局搜寻预算，真实身份/归属/菜单/AIM/MP仍由引擎确认；随机拒绝和脚本错误不能计作高清通过。最终执行与发布source字节相同，所有尝试与精确PNG保存范围见[奇门验收](validation/m4-qimen-20261009.json)。

## STACHG27：AI 已选目标提示

`baye.hd.spe().aiTarget` 与 `display.aiTarget` 使用独立 version 2，只观察 AI 已选定的攻击或计谋命令在执行前调用的 27/index0/kind4/12..17/keyflag0。实际将领槽、零基 U16 人物编号、双方位置、地图窗口、目标在 LCD 中的坐标及调色板都来自该次原生调用。它不使用攻击或计谋结果的 NUM/hold 归属，也不增加跳过、返回、按键或播放时钟。

第一次真正绘制前保存目标 16×16 区域的 256 个原生像素索引，以及按实际调色板映射的 1024 字节 RGBA；每次实际清除、复制和定时显示保留固定底片、累计清除位与当前 SPE 的 generation/event/commit 票据。合法的已显示 commit 可以早于当前合成 commit。身份、位置、地图、原载荷、画法、已使用的调色板颜色、场景或归属改变永久退休该底片，后续读取不能重新采样旧动画。版本2支持默认 scale1、160×96、palette0=0x00ffffff 与 palette255=0xff000000；真实灰色地形也保留其颜色和透明度。桥接完整原子读取两份索引/RGBA数组，检查同索引同色、黑白端点和显示底片一致，前端按原 RGBA 恢复底片，不能将灰色当作黑色。

标准载荷是 735 字节、18 单位/9 图片槽，指纹 `fnv1a32:ba494eea:735`；12..17 按7/8交替，16的 ndelay 为1，真实最后显示允许16和17重叠。新增 manifest entry 保存全部单位和槽位元数据，仅7/8有原始透明高清PNG，其余明确为空。每槽32字节 `nativeWhitePixels` 保存真实 AND0/OR0 的7个显式清除点；这些点不能当作保留底片的透明像素。

高清画布以本次完整原生 LCD 为底，仅重建已认证目标格的固定底片、实际累计清除及每个可见槽的显式白位，再绘制高清小剑。格外所有画面沿用本次 LCD，不推断高清战场格网的对应位置。图未就绪、未知 LIB、失效来源、覆盖报告或经典模式继续原生提示；结束后按实际界面归属退出。升级/死亡0..11及整个战场的高清提示定位不属于这一批。

`test:ai-target` 联合实际C、桥接及显示专项；`test:ai-target-runtime` 沿真实时期1马腾、天水出兵河内和玩家显式结束回合触发敌方命令。脚本独立浏览器与私有端口不复用游戏8080；原生逐字节重建、高清格外像素、实际图片绘制、经典/缺图回退和结束接回画面各自保存，不把高清重绘的剑身宣称为原生逐像素相等。实际结果与覆盖边界见[本批记录](validation/m4-ai-target-20261009.json)。

## STACHG27：升级与战场退场提示

`baye.hd.spe().statusEffect` 与 `display.statusEffect` 使用独立协议1。它们观察真正 `FgtChkAtkEnd` 的升级和退场分支，分别绑定27/index0/kind4/0..5和6..11/keyflag0；AI目标协议2保持。主体使用实际将领槽0..19、零基U16人物编号、坐标和修改前后的等级、经验、状态、U16生命及兵力。升级先扣100经验再执行原生 `LevelUp`；等级封顶时仍可播放，不能要求等级必增。退场先置状态8，实际原因可以是撤退、受伤或死亡，提示不宣称人物永久死亡。同一武将可以先升级再退场，两个真实调用各持独立SPE事件。

原生检查栈只包围 `FgtExeCmd` 与 `FgtInit` 原有检查入口；phase1匹配活动战斗，phase2匹配实际初始化。初始化尚未设置战斗active，也不臆造命令或攻击者身份。离屏或资源失败消费待播上下文，不补播；检查结束、报告、HELP、数量、嵌套、世界重置或未认证绘制退休来源。原来的经验、随机、Mod hook、输入、延时和报告处理顺序保持，不新增NUM、hold或跳过键。

每次实际首draw前固定捕获认证16×16内256原生索引和1024字节真实RGBA，记录已使用调色板并保留实际累计清除32字节。current、copy和timed-flush display使用既有generation/event/commit票据，允许同事件真实显示落后当前合成，失效底片不能重新采样复活。桥完整原子读取及最终身份复核；前端分别校验升级/退场事实、来源、显示与素材代次，再以当前完整160×96 LCD为底重建认证格内固定底片、累计清除、真实白位和可见高清图片。格外全部保留实际LCD。

同一735字节、18单位/9槽、`fnv1a32:ba494eea:735`载荷新增两个完整manifest对象，旧44项保持。升级槽序为2/3/4/1/0/1，退场为2/3/4/6/5/6；七张1254×1254原始透明PNG共用，生成来源、完整提示、原始SHA及alpha见[素材记录](../assets/hd-spe/GENERATED-STATUS.json)。各entry只加载该区间需要的槽，其它src/width/height为空；每槽保存实际AND0/OR0白位，不能把显式清除当作保留底片的透明部分。图片未就绪、未知LIB、失效来源和经典模式沿原生画面回退。

`test:status-effect` 联合真实C、桥与SPE显示专项；`test:status-effect-runtime`使用独立真实新局和正常出征、命令及报告确认，升级/退场必须分别有真实事件与LCD回调。人工设置经验、生命、兵力、随机种子或直接调用电影不能算实战验收。全量素材接线和专项通过不替代手机、任意Mod及完整战役验收。

## WOOD37：滚木与落石的实际覆盖范围

标准技能6「滚木」和7「落石」共享37/index0的1148字节载荷，指纹为 `fnv1a32:d38c3c8b:1148`。完整8单位按槽0/1交替，延时与清除各20；槽0是不透明64×64，槽1是不透明66×64。滚木使用0..7，落石实际只用0..0，不能把资源头的end7套到技能7。两种原生调用都使用起点48,16、keyflag0且没有BACKPIC16。新增entry以 `opaqueCoverageVersion:1` 和实际 `skillId` 明确绑定事件，保留完整单位及槽位信息；落石不用的槽1明确为空，旧46项不变。[原始素材与提示](../assets/hd-spe/GENERATED-WOOD.json)。

相同原点的不透明矩形只有形成包含链才支持新增composition mode3。资源尺寸只声明可能的范围；真实绘制或清除完成后，经frame和受控copy才建立该次覆盖，首64列不能提前授权66列。current与display各自保留 `SceneMode/SceneX/SceneY/SceneWidth/SceneHeight` 和原有generation/event/commit/frame票据；显示仍是64列时，不能借用较新的66列范围。来源退休同时撤销后续建立覆盖的资格，旧帧、重绘或迟到素材不能复活。

新增电影表现以完整当前160×96 LCD为底，只在该次display认证的64或66列区域内重放实际累计清除和可见原始HD图片；所有区域外像素保持LCD。真正复制过的末帧由原生skillResult保存，后续实际GBK标签、NUM15及原有等待继续使用该来源；不能把尚未显示的末帧当作结果底图。原有mode1/2、攻击、AI目标及状态协议保留，经典模式、缺图或失效来源回退完整LCD。两张高清PNG均保留内置生成器的原始字节，不裁剪新增两列，也不把绘画像素称为原生位图相等。

`test:wood`覆盖原生、桥接和显示专项。两种技能的实战验证仍待完成，后续通过公开玩家操作触发。普通步兵从6级开放滚木、11级开放落石，准备路线必须由真实练级或招揽获得合格武将；不能人工改等级、经验、技能、兵力、MP或随机种子。素材和接线本身不证明实际施放、伤害数字、等待、回退或整个战场HD已完成；各项以独立运行记录为准。本次先提交接入源码及专项，已安装的引擎仍为此前版本，成套引擎更新和实战验收另外提交。


## AID41：援兵与援军的接入边界

标准技能17「援兵」与29「援军」共享41/index0/kind2/0..7、1084字节及 `fnv1a32:1d4637e9:1084`。8个真实单位以20/20延迟交替两张同原点、不透明64×64图片。一个共享entry以 `aidVersion:1`、`opaqueCoverageVersion:1`、`skillResultVersion:1` 和 `skillIds:[17,29]` 授权，旧48个对象保持。实际LIB与原始素材SHA匹配后才加载两张1254×1254原始PNG。

电影的桥接独立认证真实context17/29和mode2当前/显示票据；不能借WOOD的mode3或仅凭manifest标记授权。高清以本次完整160×96 LCD为底，仅在显示票据认证的(48,16)64×64内重放实际累计清除和可见素材，区域外保留LCD。当前合成可领先已显示copy；未知LIB、缺图、经典模式、失效/报告/退休来源回退完整LCD，不裁130×64或加暗色整场背景。

两技能为原生单个友方目标，消耗MP分别15/30，请求兵力增加800/1800。实际增量由原生CountOverAdd及当前PlcArmsMax返回，满容量的0仍进入原有“兵力增加”、NUM15和等待；前端不能计算/补造增量。真实状态结果、MP扣除、自然失败、50原生timer单位等待和最终退属都需独立实战验收。

本节只声明素材/源接入与离线专项范围。真实获取人物、17/29施放、高清电影/数字/等待、经典/缺图回退均未由本次静态或VM证据证明；不代表完整HD战场、完整Mod或移动端完成。机器entry定义需随生成源持久保留，不能只手改生成后的manifest。

`npm run generate:aid-manifest` 从 `scripts/specs/hd-spe-aid.json`、实际LIB与两张原始PNG重建共享entry，校验原生载荷、图片SHA/CRC和不透明格式。默认输出 `build/hd-spe-aid-manifest.json` 供检查，拒绝覆盖已有输出或直接写生产文件；保留base中的全部无关对象，拒绝不一致或重复的41项。生成后的本批49项清单与生产manifest逐字节一致。新增54项离线桥/消费/联合检查纳入完整1075项运行，真实玩家施放另验。

`scripts/test-hd-aid-engine.mjs` 将真实CountSklHurt、FgtJNAction/_CommonJNAction、PlcMovie、NUM15、字体及GamDelay编译成受控原生专项，新增17/29各三种容量边界；全额例从100兵力起算，另外覆盖实际+10与+0。正请求被容量裁至0仍显示原生0并等待50tick；真正request0不进入数字分支。独立原始ROM点阵/字形oracle核对每次完整160×96像素。属性、容量、随机成功、目标选择和消息供给为明确夹具边界，未据此接受浏览器玩家施法。新6项纳入当前完整1081项实际运行，原54/1075历史证据保留；[原生与准备记录](validation/m4-aid-native-20261009.json)。

## LIUYAN40：流言的状态计谋接入

原版技能16“流言”以敌军为目标，消耗20 MP，成功时由原生代码设置混乱状态1；原始技能的兵力伤害与粮草伤害均为0。资源40/index0/kind2为1084字节（`fnv1a32:bd0140e0:1084`），8个单位交替引用两张64×64不透明图，在48,16播放0..7。沿用已安装引擎的mode2覆盖协议，本批只修改桥接、前端与素材，不重编引擎。

新增严格的`liuyanVersion:1`映射和只读技能上下文认证。只有原版LIB、技能16、完整资源指纹、真实帧与copy/display票据、已建立且没有未来帧的覆盖范围均有效时，才替换64×64窗口；窗口外保留当次完整160×96 LCD。预加载两张素材；经典模式、缺图、未知库、失效来源和退休继续回退完整LCD。无数字不等于没有瞬时SKILL作用域：原生movie期间仍存在该作用域，但0兵力结果不进入NUM15、数字停留或50tick分支，不能借用援兵的数字结果阶段。

两张高清PNG为内置生成器原始输出的精确副本，视觉文字核对为“在那?”／“河北”。这是对原生小图的视觉转写，不是原字体逐字形精确匹配证明；首版错误文字、完整提示、按顺序的参考图、工具返回和原图均保留于[素材生成记录](../assets/hd-spe/GENERATED-LIUYAN.json)。新增桥接与消费者检查覆盖8帧、显示滞后、清除、异常上下文、缺图、退休和预加载；通过结果与来源见[静态接入记录](validation/m4-liuyan-static-20261010.json)。实际玩家敌军AIM、MP扣减、混乱状态变化、原生报告，以及1080/720高清、经典／404／可见性／resize仍需独立实战验证。

后续[安装1080p实战记录](validation/m4-liuyan-runtime-20261010.json)已独立证明技能16真实敌军AIM、MP146→126、许褚混乱0→1且兵力／HP不变、8次原生LCD及高清帧、一次原生报告与确认和最终退休。movie期间的瞬时SKILL作用域有效，0兵力结果不产生NUM／HOLD；本次认证范围仍仅64×64、窗口外当前LCD。720p与缺图1080p共三次运行在施法前超时，不能计作施法或回退通过；经典、可见性／resize及其它计谋仍待独立验收。原静态阶段记录保持其历史范围。

## 2026-10-10：咒封14独立静态接线，实战待验

原版咒封14新增独立的 zhoufengVersion:1／opaqueCoverageVersion:1／skillId:14 映射，manifest为51项，旧50项保持原值。复用39的两张原始高清图片，但只接受真实技能14上下文、39/index0/kind2/0..7、完整原生指纹和当前／显示复制票据；与既有奇门20的首匹配及绘制路径隔离，未知上下文仍回退LCD。认证范围仅(48,16)64×64，窗口外保留当前完整160×96 LCD。

原版技能14消耗15 MP，成功时设置状态2；瞬时SKILL movie作用域不进入NUM、数字停留或50tick分支。以上是素材复用与静态接线，真实敌军AIM、MP扣减、状态／报告、全部8帧像素和退休尚待独立实战，不扩大奇门20的既有验收。

本轮[咒封静态接入记录](validation/m4-zhoufeng-static-20261010.json)与实际施放分别记录：52模块完整回归1228／1228通过，472份受检来源前后零漂移、零新增。

流言一次720p诊断完成两轮敌军行动，未复现超时，只能说明本次诊断没有出现同一超时，不能称问题已修复或720p已验收。诊断工具不授予技能／HD接受结论；此前三次失败及1080p限定通过保持原范围。诊断记录见[流言响应诊断](validation/m4-liuyan-diagnostic-20261010.json)。

## 2026-10-10：咒封14的四个实际场景

安装1080p与720p分别通过8次真实原生显示及8次HD读回；缺图1080p与经典1080p分别通过8次完整LCD回退，合计32次真实显示。每局沿原始公共存档、31→32出征及当前敌军AIM施放，MP146→131、目标状态0→2，HP与兵力不变；SPE39保持原版25/25 tick、0..7及64×64认证窗口，高清窗口外保留完整LCD，没有NUM或HOLD。

四局各出现一次真实禁咒报告，前三局各确认一次，经典局自然退休且零确认；动画、结果与报告均已退休。经典确认的两次方向键和一次Enter、公开模式切换及完整名单恢复另有实际回执。详见[咒封实战与原始证据](validation/m4-zhoufeng-runtime-20261010.json)。这只接受原版技能14和列出的四场景，不扩大为其它技能或完整HD。

## 2026-10-10：原版定身15独立接入

定身15新增独立dingshenVersion:1／opaqueCoverageVersion:1／skillId:15映射，manifest增至52项，旧51项对象及顺序保留。复用实际SPE39的两张原始图片，但按技能15上下文、指纹、当前与显示复制票据独立授权，不能借用咒封14或奇门20。只认证(48,16)64×64窗口，窗口外保留完整LCD，缺图或不满足合同则回退。

原版定身消耗20 MP，成功设置状态3及NO_MOV=1；每回合按原生智力／随机判定解除，没有新增固定持续时间。瞬时SKILL movie/value0不进入NUM、数字停留或50tick分支。本批53模块1293/1293通过、475份来源无漂移；真实施放、移动限制、8帧像素、报告与回退实战仍待验，见[定身静态接入记录](validation/m4-dingshen-static-20261010.json)。
