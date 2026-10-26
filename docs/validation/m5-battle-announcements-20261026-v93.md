# 战前进攻与交锋公告 HD（V93，轻量开发验证）

2026-10-26，将原版ShowAttackNote、ShowFightNote已拼好并实际绘制的整句接入PC／手机的被动公告面板。前者包含真实进攻方／「我军」与城市原名，后者包含双方原名；UI不追加人物／城市getter，不从地图或名单猜测信息，也不把公告当作胜负结果。两端原「战果」ARIA名称改为「战事公告」。

沿现有battleNote version1追加类型3进攻、4交锋，保留1胜／2败。原字段outcome继续作为类型编码，3／4的winner强制65535表示未发布胜者；不新增虚构actor／city字段。新类型无需额外人数读取，旧胜败及完整U16赢家规则保持。面板只显示原文，无按钮，不接管输入或发键，保留原LCD触摸命中区域；ShowAttackNote仍GamDelay(100,false)纯定时，ShowFightNote仍GamDelay(300,responseNoteOfBettle)，原配置决定是否提前结束，不补确认。

新原生入口在绘制前捕获generation，实际绘制后只有generation仍current才发布，原等待后用局部generation／seq退休。独立审阅发现同步通知回调若发布替换公告，begin原先返回通知后的全局新seq，会让旧end误退新公告；现保存并返回自身发布的局部seq，ABI不变。真实EM_ASM同步重入检查覆盖同世代与换世界，旧公告不会退休替换者。UI同时补读重入、原文／raw、LIB原串、identity原值、API／函数／data引用与末次实际模式／可见性／ready封口；最后引用getter改正文或切classic的独立PoC均已拒绝旧绘制，保持零键／零写。

最终5个相关模块 **124／124**，失败／取消／跳过／todo均0，37份来源字节保持，实际Clang18。新增2个正式模块及23个Node检查：真实原生11、真实bridge6、既有只读UI新增6；原生模块直接编译四种真实公告入口、真实GamDelay和helpers，资源／LCD／消息边界为夹具。覆盖原文本／绘制顺序、getter次数、100／300tick、配置flag0／1／2原输入差异、绘制回调换代、局部旧end、同步通知重入、GBK／wrap、胜败旧合同，及新类型／sentinel、torn数据与只读模式／高owner／生命周期守门。

将父提交citycmde.c入口替回当前helpers作隔离负控，旧源 **4通过／7失败**、Node退出1；确认编译成功且失败来自真实C断言。4项通过属于仍成立的旧胜败／helper或旧代码根本没有publisher的边界，不能算旧进攻／交锋已有HD。负控包装退出0只表示预期负控成立；未启动旧WASM或真实战役。

使用Emscripten3.1.51／CMake3.31.6重建并原子安装四件运行时。128件原生源保持，除citycmde／hd-bridge外与V92记录一致；citycmde同时按LF归一。第一次候选构建早于同步重入修复且未安装，最终以build-v2重建、来源聚合d2eb9e64772ff874eb34a4408f77dbf884f704c32563f95791a61462bb9f90d1为准。清单保留真实构建父提交c53a31c与modified=true，新增hdBattleNoteProtocol元数据说明四种类型，未改变存档格式。真实加载器与链接WASM以noInitialRun初始化，83导出、三项必需入口存在，main未运行；四件安装字节与暂存件逐一相同。加载器baye.js原字节未变，参与成套核对但不人为制造Git差异。

两个独立Chrome profile加载真实PC／手机入口DOM、外部与内嵌CSS、真实bridge及公告controller，使用明确受控快照。桌面进攻实际CSS视口1264×625、手机横屏交锋828×295，原文与类型正确、ARIA为战事公告、面板完整可见、无横溢出／页面错误、零按钮／键／额外人物读取且raw保持；pointer-events:none与原LCD命中保持。人工查看两张截图。这是两次受控布局，不是真实攻击、自动战斗、物理触摸或真机验收。

5模块命令、37源SHA、负控、独立PoC失败与修复、最终128原生源／四产物及截图索引见[结构化记录](./m5-battle-announcements-20261026-v93.json)。主归档为build/battle-announcements-20261026-v93/，审阅PoC原件保留于build/prebattle-note-20261026-v93/。旧战局未接入、关闭或重开；自然实战、真机、全量和调优后排。下一开发继续原生电脑策略预告，整体HD仍partial。
