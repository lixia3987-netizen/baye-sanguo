# 电脑策略预告 HD 状态条（V94，轻量开发验证）

2026-10-26，原生ShowTacticNote逐条实际画出的姓名＋TACTIC_STR接入PC／手机HD被动状态条。它位于GameDevDrv调用ComputerTactic／PolicyExec之前，仅代表原版预告，不能解释为正在逐个计算该君主或任何百分比进度。名单、顺序、重复实例、原名字／资源读取、三次原绘制、每条GamDelay(5,false)与首尾ShowMapClear保持；产品tactic.c只加5行观察，不代理AI执行、不推进月份、不补END或确认，也不延长短暂等待。

沿battleNote version1增加类型5，winner必须65535表示没有发布胜者，旧1..4语义保持。有效3..5的观察不追加人数／名称／城市读取；body类型5选择透明根背景与底部小条，ARIA为「电脑策略预告」，原全屏公告及其LCD隐藏只用于1..4。类型5不强制隐藏、改visibility或改变LCD命中；状态条无按钮、不接管输入、不发键。begin／end同步通知立即显退，不等80ms轮询，也不保留最后一条文字冒充后续计算状态。

函数起始generation阻止换世界后剩余旧队列条目发布；每条局部seq保护旧end，沿用V93同步通知前保存自身seq的修复。UI保留现有原版LIB、完整raw、data／API引用、实际模式／可见性／ready封口与高owner退让。没有增加新的计算完成标记、订单结果或战局恢复语义。

最终7个相关模块 **144／144**，失败／取消／跳过／todo均0，39份所选来源字节保持，实际Clang18。新增2个正式模块及20个Node检查：真实原生10、真实bridge6、既有UI新增4；旧公告检查将现在合法的未知类型断言5改为6，其余旧合同保持。C检查直接编译ShowTacticNote、GamDelay及观察helpers，覆盖0／1／多君主、U16／0号与重复、精确getter／原文／几何／顺序、5timer1tick不被键或触摸缩短、timer0处理、七种原回调换世界、剩余旧条目不复活、等待／同步通知替换与旧end、GBK／wrap及计算前静态调用边界；平台资源／LCD／消息入口为受控边界。没有把真实AI执行或完整END流程当作已验。

将父提交旧tactic.c入口替回当前helpers隔离负控，旧源 **4通过／6失败**，Node退出1；编译成功且失败为真实C断言。通过项是空队列、helper／静态或旧代码无publisher而自然不发布的边界，不代表旧入口已有HD。负控包装退出0只表示预期失败成立，未运行旧WASM／游戏。

使用Emscripten3.1.51／CMake3.31.6重建并原子安装四件运行时，128件原生来源构建期间保持，除tactic／hd-bridge外与V93来源相同；tactic按LF归一。新聚合56a9c2705b61380b8f36505ea8a6bbdadff80c9527d12b49ab5ee78202c36d56，清单保留真实父提交c4b27f6及modified=true，hdBattleNoteProtocol元数据补类型5与计算前边界。实际新加载器与链接WASM以noInitialRun在隔离Node VM初始化，83导出与三项必需入口存在，main未运行；四件安装字节精确匹配。baye.js原字节相同，仍参与成套核对，不强制制造Git差异；存档格式不变。

两个独立Chrome profile使用真实PC／手机DOM、外部与内嵌CSS、真实bridge／controller及明确受控type5快照。最终CSS视口1264×625／828×295，透明根、底部条分别约54／46px高、正文与ARIA正确、无横溢出／页面错误，LCD opacity保持1，零按钮／键／额外人数读取且raw不变；人工查看截图。静态生产DOM里的LCD是占位，不是实际地图或AI运行截图；这只授布局信用，不授自然短帧、真机或物理输入信用。

命令、7模块、39源SHA、负控、独立只读审阅、128原生源／四产物与截图索引见[结构化记录](./m5-tactic-prelude-20261026-v94.json)，私有明细位于build/tactic-prelude-20261026-v94/。旧战局保持，未接入、关闭、重开或再次执行END。真实流程／真机／全量与调优后排；后续实际功能缺口优先考虑原生天气／战斗日转场及缺失的原版人物HD立绘覆盖，整体HD仍partial。
