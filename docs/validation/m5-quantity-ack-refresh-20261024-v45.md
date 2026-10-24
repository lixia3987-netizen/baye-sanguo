# 当前前层数量弹层ACK刷新（V45）

本轮只验证原版十月主输入中的数量编辑/取消与当前前层Dialog body/range刷新。两次准备运行失败原件完整保留，成功BEFORE与AFTER使用同一v4脚本，各24次真实点击，每次只有一条原生数量字符及匹配ACK；最终取消回MAP，未付款、MAKE、END或SAVE，主输入没有更新。

本地仪器化观测中，队列空闲→前层DOM的p95由148ms降至0.1ms，点击→RAF回调入口p95由224.4ms降至78.8ms（本批下降64.9%）。ACK回调p95由52.5ms到55.2ms。每批n=24、最近秩p95取第23项；保留负观测差值，RAF和DOM时间均不是物理显示时间。

AFTER原控制器exit1/okfalse/treeExitedfalse保持原样：11个Chrome身份已退出，另4个GoogleUpdater后代触发安全拒收；后续只读两次CIM核验记录其自然退出、私有端口清空、8080不变及profile保留。该补充证明与原运行结果分层，完整CIM数组未留存。

每批各自的world、双档和seed指纹前后一致；两批seed指纹本身不同。背景CITY摘要可在modal下变暗并部分可见，本轮不接受其即时刷新，也不接受完整CSS、WOOD/AID、稳定或真实设备性能、全局HD完成。

新默认用例7项，旧版正例2项按真实旧DOM行为拒收，新定向7项及routing/input171项只作源测试，不重复加计。141文件完整回归7708/7708，完整原stdout独立gzip保存，源前后逐字节相等。原型/复跑/观察器控制不追加不同用例。

归档包含四个实际目录全部平面原件与必要小来源，按SHA去重、逐blobgzip，profile及旧大档案不递归。旧执行源码以原copies/锁向量绑定，当前源需matching checkout；可运行 `node docs/validation/m5-quantity-ack-refresh-20261024-v45-verify.mjs` 只读校验。
