# WOOD精确缺图：源码测试矩阵（V40）

本批仅补 scripts/test-hd-spe.mjs 的缺失覆盖，生产JS、manifest、LIB、C和原oracle保持原字节。正式定向298→307，净增9项：7个必需图／阶段组合、1个落石未使用宽图在NUM中不请求的正例、1个真实BACKPIC16同时污染两技能的拒例。旧滚木宽图movie／HOLD用例逐字保留；14项早期纯VM探针是设计依据，与正式9项不相加。完整133文件回归7186／7186通过（上批7177+9），定向原TAP、全套spec原日志及前后源码均有界gzip保存。

新增用例让确实请求的必需Image触发onerror，清空旧绘制记录后核完整160×96 LCD与零HD图片；延迟onload不能复活失败缓存。NUM使用最后一位8步中第4步的真实部分历史。落石只请求picture0，unused picture1保持null；即使提供当前manifest认证的BACKPIC16，也必须拒绝给WOOD添加背景且不产生新Image请求。它们是Node VM受控输入与绘图事件检查，没有启动浏览器或HTTP，不能视为实际404或原版电影像素验收。

下一精确缺图实战仍需从最新八月档合法恢复兵力，私服仅对共享必需URL assets/hd-spe/wood-37/picture-0.png 返回真实404，模式保持hd；必须采两技能成功的完整原生LCD电影、NUM、HOLD及退休，明确断言fallbackAccepted，不能以allowLcd选项或缺背景／unused图代替。此项尚未执行。

实际主活动仍为V39的239年8月：131在城7、0兵／EXP8，44体力16，城20粮493／钱1086；本批无新增收入、消费、END、SAVE或游戏接受。classic、exactmissing、HD和global接受均不新增。小包只绑定V39四个当前输入文件，不递归71MB实际归档；完整运行环境仍需匹配checkout。运行同名前缀 -verify.mjs 可只读回验全部原件、7186完整日志、当前源pin和原版双SAVE；不会执行测试或游戏。
