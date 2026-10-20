# 原版撞击准备：两城真实购粮、失败恢复与待完成订单

发布：2026-10-21（Asia/Shanghai）。依赖已推送正式验证器归档 2349c7cb496a98b582a0c1556fc1a8d6316ec988。

- v3整体失败，首笔城16／人物20仍已真实支付1150钱、12体力买230粮并保存；第二笔未付。v4整体失败，只LOAD这份最新真SAVE；100张完整票据已两两相等，但classic缓存other不能在HD呈现前硬等map，未发生新付款／SAVE／月份。失败源、SOURCE_PASS、诊断及独验均保留。
- v5仅从已存首笔继续城20／人物50，支付765钱、12体力买153粮，生成恢复输入与付款后两组原版双SAVE。城16钱4169／粮231／人物20体力88保持；城20钱856→91、粮114→267、人物50体力56→44。完整raw费用／新slot1／队列移除、旧slot0全部字段、49真实键与13个quantity键／唯一付款39、80mode全票和两组packedSAVE均独验。
- 最新真SAVE是impact13-129-food-20，日期237-2。两笔Trade11仍pending：16／20与20／50。0策略月、0订单自然返城、无治理／款待／新军／出征／MP／撞击施放。本批只接受已付款保存的维护子范围，完整准备、战前防御见证、cast／HD／完整HD／全局HD仍false。后续必须从最新真SAVE恢复，不能重付任一笔。
- city5平原State4未被修改。source-advice v1遗漏原版AI入口逐城清State，v2保留原件并纠正；源码事实不替代未来真实AI／防御／月份观察。46／53定向与既存5339分别记录，不累加、不冒称重跑。
- 1374／1388／1399来源严格原字节复核；15／11／11历史身份均无匹配存活，私端口0、8080保持、profile保留。v4有1个复用PID的新pwsh身份被保留未触碰。

194个明确原件／137个gzip对象，完整raw／gzip摘要与往返通过，目标30MiB分片、硬限制<50MiB。旧391MB取得实战及历史产品依赖上批commits/archive；namedFileArchiveClosed=true、portableClosedArchive=false。

- [机器记录](m5-impact-plunder-preparation-20261020-impact13-paid-20261021.json)
- [归档索引](m5-impact-plunder-preparation-20261020-impact13-paid-20261021-archive.json)
