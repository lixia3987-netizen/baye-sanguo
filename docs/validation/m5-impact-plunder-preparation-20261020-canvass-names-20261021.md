# 原版招揽：packed 姓名合同修正与失败实战保留

发布：2026-10-21（Asia/Shanghai）。原版唯一入口、暂停版本切换、产品源码、正式package及native构建保持；本批为build验证器和证据记录。

- v9因七城预算工具调用范围问题被静态阻断，未执行CLI／游戏。新v10真实首单城7／人物28→129已扣50钱／20体力：29950→29900、100→80，NativeDONE普通MAP，slot2为Order16／Object129／Time10。ACTOR／TARGET／DONE完整票据、真实单键输入、全raw费用／订单／DelPerson公式复核；原Gov0与Trade1全部raw字段不变。
- 活动TARGET.names为完整“带来洞主／金环三结”；packedNames是原版最多复制7字节后的“带来洞�／金环三�”。旧v1把二者都期待成完整姓名，在付款后断言失败。新v2严格分别建模ROM全姓名、8字节槽／7字节复制／GBK替换的packed姓名，并加确认前precommit；三票直接重开原result后纯合同重算通过，没有重新发送游戏输入。
- v10 workflow仍exit1／okfalse。report.canvassOrders未写入不等于没有动作：真实已付首单为1，付款后SAVE为0、策略月为0、取得合格武将为0。只有派遣前impact-canvass-paid-input（237年1月／slot0）的真实双SAVE，不能补造已付存档、续接未保存订单或主张同局／RNG连续。
- recovery6／rootproof6只接受最新真实派遣前SAVE的新隔离重试：保存态28体力100、城7钱29950；保留capital已付72粮及5319钱／231粮／40体力88、完整Gov0／Trade1。40仍pending。新旧sango1只seed字节4836不同，已测world相同不构成RNG验收。后续v11／新隔离actual排除。
- 188／188和208／208是分别已真实执行的build测试，208覆盖真实三票来源／键切片重开及precommit／dispatch合同；两计数不相加，也不并入既有91模块5130项。旧正式suite本批未重跑，只复核当前241来源字节一致；实际1316逻辑／1312规范化物理来源一致，15个完整历史身份均退出、私端口无监听、8080保持、profile保留。
- 准备、招揽最终取得、撞击施放、HD／完整HD／全局HD保持未验收。原始失败、初稿、两版合同和所有必要非profile运行原件留档。

归档87个明确文件／85个gzip，分片均<50MiB并完整校验raw／gzip摘要及往返。namedFileArchiveClosed=true；旧完整产品、food／January大档和5130冻结大档依赖28df227，portableClosedArchive=false。

- [机器记录](m5-impact-plunder-preparation-20261020-canvass-names-20261021.json)
- [归档索引](m5-impact-plunder-preparation-20261020-canvass-names-20261021-archive.json)
