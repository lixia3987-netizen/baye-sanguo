# 原版撞击准备：首都实际买粮检查点

发布：2026-10-21（Asia/Shanghai）；运行原件使用UTC时间。原版唯一入口、暂停版本切换及既有素材保持，本批没有产品源码或native构建变更。

- v7真实失败原件保留：数量到72后LCD被HD覆盖层遮挡，最终确认尚未执行；未付款、原始world未变、SAVE为0。v8只交接当前数量显示模式，核前后完整world／owner／身份／引用／键计数相等及零新增键，再由可见原版classic LCD经真实键盘路径单39确认。
- 首都16的40号武将实际支付360钱购买72粮，钱5679→5319、粮159→231、体力100→88。完整原始交易与DelPerson公式逐字段复核，旧Gov4 slot0（城16／人物20／Time0）的所有raw字段保留，仅新Trade11 slot1的五个非初始化字段明确按opaque处理。
- 君主0仍驻许昌，城20九名守将完整人物字段不变；40已真实进入Trade11待执行，尚未返城，不能声称全守将驻留、返城前防御或下月订单解决。没有策略月、招揽、新掠夺、新军、战斗与撞击cast。
- 唯一新真实双SAVE impact-capital-paid-food-040（237年1月／slot0）为8221／4840字节；完整已测200人物19B、38城37B、200订单14B及已存队列／goods／fighters／flags与实测world一致。此已付款SAVE成为唯一后续恢复点，禁止用旧未付款输入重放买粮。
- 仅foodCheckpointAccepted=true；准备、取得合格武将、撞击施放、HD／完整HD／全局HD继续false。117／136／城12仍归属2，不预记后续Canvass成功。RNG连续、未测header／cursor、未保存队列尾和完整ABI不扩大。
- 两个实际运行各自完整11个历史身份复核均无存活、私端口无监听、8080状态保持，profile保留。1302逻辑来源／1298规范化物理文件及128native来源字节一致。此前91模块串行5130／5130为既存真实记录，本批只重新核对当前241来源，未重跑测试。

明确归档69文件／65个去重gzip，分片均<50MiB并核raw／gzip摘要及完整往返。名单闭合；旧完整产品、January历史和大型归档依赖已提交b91cf74，portableClosedArchive=false。profiles／缓存／未来Canvass及新188tests排除。

- [机器记录](m5-impact-plunder-preparation-20261020-capital-food-20261021.json)
- [归档索引](m5-impact-plunder-preparation-20261020-capital-food-20261021-archive.json)
