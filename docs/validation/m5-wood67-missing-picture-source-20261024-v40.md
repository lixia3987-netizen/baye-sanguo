# WOOD6/7精确缺图证据门：源码准备（V40）

本批将WOOD缺图配置与证据守门迁入正式脚本，生产JS、manifest、LIB、原生C及既有oracle不变。正式净增48项；137登记文件经真实Clang完整回归7430／7430通过（原7382＋48），退出码0。早期build49保留原件；迁移只调整相对import并删除版本专用assembler导出及其1个依赖ignored候选的测试，其余gate正文和48项逐字等价。49与48重叠，不相加为97。首移植9a1681因过短的逆import token命中两次而在写正式文件前拒收，原工具和记录保留。

正式门只允许HD模式对共享必需图 assets/hd-spe/wood-37/picture-0.png 产生预期404，不能以BACKPIC16、落石未使用宽图、经典模式或其它失败替代。原HTTP记录不得同时含该图200或任何无关404。它调用现有完整WOOD原生像素oracle，要求两技能8＋1原生拷贝、完整LCD电影、GBK／NUM、HOLD和退休；每个真正入选readback还按完整代际／事件／session／phase／commit身份回绑原capture，模式必须hd、source必须lcd、原因必须asset-load-failed。assets-loading、其它LCD原因和经典模式均由有效拒例直达这道新门，保留的未选中失败／过渡行不会被错授接受。

正例使用原ROM时间线、真实格式PNG／CRC／RGBA、原字体与NUM资源组成13条受控readback，直接穿现有oracle，没有替换oracle为stub或传入passed布尔。它们是合成受控证据，没有启动HTTP或游戏，也不是实际404、fallback电影或HD验收。原目标TAP、移植前后源码和拒收前缀逐字节gzip保存，完整7430原始spec日志独立gzip。

实际主活动仍为V39的239年8月：131在城7、0兵／EXP8，129仍被俘0兵，44体力16，城20粮493／钱1086。没有新输入、付款、征兵、END、SAVE或兵力恢复，下一施术资格尚未取得。实际缺图实战须另外闭合caller、冻结源、合法准备／出征及真实两技能完整采样，不能把本批控测或allowLcd配置当实际接受。

小包只绑定当前四个原版输入，不遍历V39九个大分卷。运行同名前缀 -verify.mjs 可只读核全部原件、49／48目标日志、7430完整日志、40个当前源pin和原版双SAVE；不会执行测试、driver、服务器或游戏。完整工程仍依赖匹配checkout，本包不是便携运行环境。
