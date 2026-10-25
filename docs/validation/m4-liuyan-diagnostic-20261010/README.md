# LIUYAN 两回合诊断证据

本目录保存 2026-10-10 一次 installed720 诊断的原字节。原执行冻结在提交 `04f0895334daeb3f2bcbf54c206e5a08f226b774`，runner 为 `42eb3c8e7d500c32711d301dec8db84193784e9e53b0043d9ea97ff136285b2d`。

两轮敌军回合完成，1926 个 CDP 请求均返回，本局没有 timeout。脚本按预定哨兵 exit1；没有施放流言，没有电影、原因、修复或 HD 验收结论。CPU profile 只提供受诊断仪器影响的热点线索。

原结果的 cleanup=false 保留。第一次补清理仍为 false；第二次在原 PID/创建时刻及进程 handle 身份复核后记录 owned 8→0、treeExited=true。补证明与原结果并存，浏览器 profile 保留且不归档，不删除旧 profile。

`runtime-index.json` 列出 37 个逻辑原文件及 36 个按原 SHA256 寻址的 gzip。每件已验证解压后的大小、SHA256 与原字节一致。6 张 PNG 是普通路线/回合截图，不能作为流言电影验收。

本归档不是完整可移植运行包（`portableClosedArchive=false`）：不含私有 profile、完整生产源码/引擎以及全部前序草稿。原文件继续保留在本地 build；此前实战历史见 [原 runtime 记录](../m4-liuyan-runtime-20261010.json)，本次范围见 [诊断记录](../m4-liuyan-diagnostic-20261010.json)。
