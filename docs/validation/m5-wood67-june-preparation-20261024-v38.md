# WOOD6/7 六月续接准备：V38 源码验证

本次仅发布无 Plunder 的原版续接模型及源码检查，尚未进行新的游戏、浏览器或 720p 实战；actualPreparationAccepted、actualCastAccepted、hd720Accepted 均为 false。

最新输入为已发布的 V37 239-6 四件存档，原始针逐一保留。131 在城7、2736兵、Lv17/EXP4、步兵、双装备为空；原版 sqrt32/PlcExtract 得到52，默认每日比例3使耗粮17，30回合严格携粮511。城20当前380粮/828钱满足严格267粮门槛，不需新增 Plunder。

新正式模块保留完整原世界、200项原生队列前缀和其余1800项尾部（全2000项）、俘虏129、当前己方唯一驻城、守军及未知字段；只有 March170。SAVE 以预声明 expectedSaveTag 和完整前后世界绑定，不以版本标签当语义证明。AI阶段允许真实敌方订单，首次 PICK 的 Mode/Way/map/cargo/全20单位双读和真实 MP 仍由实际调用者验证。战后按实际兵力、经验与归属计粮，不能回填2736；后续合法 SAVE 与下一次 END 的粮食安全分别判断。

新增正式受控检查84项，build和formal各84/84是同一组用例，不重复加计。首轮82/83的测试数据错误、后续83绿及最终84绿的源码/原日志/收据全部保留。独立审查另有4项旧调用者集成检查，范围按原针记录，不计入登记总数。

完整登记套件131文件、7052/7052通过，fail/cancelled/skipped/todo均0；真实 Clang 环境。终态70472/384214/exit0，166055.2319ms。原始603886字节日志按原字节 gzip 保留。

本包是小型 source-preparation 记录。正式源码、package及六月四输入由匹配 Git checkout 承担，reader逐针核验并重验原始 packed pair；controlled小原件与独立审查完整gzip回读。未复制 V37 大归档、PNG、完整运行环境或工具链，portableClosedArchive=false。

运行 `node docs/validation/m5-wood67-june-preparation-20261024-v38-reader.mjs` 回读验证；不启动游戏或重跑测试。
