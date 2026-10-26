# 天气与战斗日数 HD 过场（V95，轻量开发验证）

2026-10-26，原版 FgtChgWeather 与 FgtDealBout 的实际绘制接入 PC／手机独立 HD 过场。晴、阴、风、雨、冰雹使用本地 SVG，日牌显示真实 U16 日数。天气仍用原 RNG 或原禁变天气配置，三次图片绘制参数、日推进／上限与兵将激活／粮草和状态处理顺序、各自 GamDelay(50,false) 均保持；不补键、回合或时间。成功天变22本来调用同一 FgtChgWeather，源码分支已核对，但本轮没有实际施法验收。

battleNote version1 增类型6天气与7日数，winner65535；新增原生 U16 Value，仅 active6/7 的 DTO 增 value，旧1..5与 inactive 形状保持。天气在三次原绘制后发布，值1..5且文字为空；日数在实际数字绘制后发布，文字必须是该值的规范十进制。日数本来为 U16，局部 numb 从5字节补为6字节以安全容纳65535与NUL，不限缩到四位；原计数与居中公式保持，0回绕也测试。

函数起始 generation 与局部 note seq／实际来源一致性阻止绘制回调换世界或换owner后发布旧过场；helper拒绝当前 active note／report／help／menu／qty。report两入口、menu、help两入口、qty两入口只在当前类型6/7时同步退休，旧1..5行为保持。原 end 只退休自身 seq，不会关闭等待／同步通知期间替换的公告。同步通知分别调用旧note和新transition，异常隔离。

UI核对原版LIB身份、真实raw／DTO／API引用、代际／序号、两份战斗结束值、BUSY归属与所有高owner，再绘制只读过场。当前原生begin/end立即显退，不延长等待；经典／不支持／失焦／隐藏／竖屏等回退。过场无按钮、pointer-events:none，只改变LCD像素opacity，原生canvas的visibility与输入命中保持；手机根在真实stage内，顶部工具区保持。五天气和完整日数由VM覆盖。

最终 **12模块208／208**，fail／cancelled／skipped／todo均0；**47份所选来源**字节稳定，实际Clang18。净增3模块42项：原生15（13组真实C路径与2项源码／ABI）、桥接6、UI21。另有子代理17模块414／414，含共享报告／菜单／帮助／数量依赖，和最终208有重叠，不相加；414当时只保留原工具汇总JSON，未重建不存在的完整TAP。三个旧C测试仅增加实际notify／retire等必要依赖提取，两个旧桥接检查把现在合法的未知6改为8。

父提交旧Fight.c与旧FightSub.c各自替换的安全负控，分别 **12通过／3失败**、**7通过／8失败**，退出1、均编译成功并到达真实C发布断言。负控SAFE_DAYS_ONLY不让旧5字节缓冲接收五位日数，无溢出／编译失败替代功能断言；新源正向覆盖0、1、30、9999、10000、65535。负控保留原始简要结果及旧源快照，完整TAP当时未留存，范围明确。

Emscripten3.1.51／CMake3.31.6重建并原子安装四件运行时，128件引擎来源稳定；仅Fight.c／FightSub.c／hd-bridge.c／hd-bridge.h改变，其余124件与V94相同。聚合 d13e8eefbbc0d2847133cca7b22ff28f73b994eb87327268dd8fe0b7c18d5a76；清单保留实际父提交0a6e4aa与modified=true。实际新加载器和链接WASM在隔离Node VM以noInitialRun初始化，83函数导出／三必需入口存在，main未运行，输入0；四安装字节匹配。

两个新独立Chrome profile用生产PC／手机完整DOM、外部和内嵌CSS、真实bridge和controller及受控native快照。PC冰雹CSS视口1264×625、手机65535日视口828×295，显示／ARIA／图标／正文正确、无横溢出或页面错误、零按钮／键／额外人数读取，raw不变；LCD opacity0而visibility visible／pointer-events auto。截图已查看。这是受控布局信用，LIB身份为明确替身、LCD为静态占位，不代表自然战斗、实际LIB运行或真机输入。

记录见[结构化明细](./m5-battle-transition-20261026-v95.json)，原日志与截图索引在build/battle-transition-20261026-v95/。旧战局未接入、关闭、重开或重试END。后续优先缺失原版人物HD覆盖；自然战斗、天变22、真机、全量与调优仍待，整体HD保持partial。
