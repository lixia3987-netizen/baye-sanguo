# 城池已安排出征携粮（V111）

2026-10-28。共享PC／手机城池事务行新增「 · 携粮 N」，直接显示本城全体己方军队已入队Order27的Food。保留原成员顺序、稀疏槽及重复人物，显示0和65535，不求和兵力，不读取出征未初始化的Money／Arms，不推算剩余粮草、预计到达或倒计时。Order13输送三资源继续保持。

原生玩家创建在citycmdd.c:141写Food，142的65535是输入返回取消；成功入队后才扣城粮。AddFightOrder在1148复制整订单只补军队槽号；AI的tactic.c:639直接取城粮U16，可能为0或65535。队列执行在citycmdd.c:370将Food交给MProvender，不把65535当取消。因此队列读数与玩家输入哨兵不能混用。读取在本城、全员己方及既有军队有效性过滤之后，新增Food进入raw seal与多次重核；无效值或末次姓名／城名回调变更撤回整组，恢复后可重读。公共返回结构及textContent渲染不变，两个入口cache改为20261028supplies1，无原生改动或新策略命令。

最终仅按^arranged模式运行14个相关case，14／14通过，fail／cancel／skip／todo均0，17来源整场保持；新增3个默认case、无新模块，覆盖零／最大值与队员顺序、排除读取、无效Food及最终姓名／城名回调变化。较早worker14／14单列不叠加，未跑整HUD文件或全量。隔离父版reader只跑3新增case，按预期0通过／3失败、exit1，未替换产品文件，不计通过数。[完整JSON](./m5-dispatch-supplies-20261028-v111.json)嵌原TAP／stderr与SHA。

一次自有Playwright Chrome／pipe、3页／3导航，在PC1280×720、手机844×390和667×375采9原PNG，21生产pins保持。当前reader从明确mock identity、深只读world得到12行（8出征／4输送），由build插桩生产renderStatus／appendStat渲染；两条10名长组、重复／稀疏成员、携粮65535／0及输送混排，三尺寸DTO一致。文字完整换行无省略／横溢，末行完整可滚达，返回PC68×44／手机80×44。预览审核者逐张看9图，Root另看3张代表图；所有native键／写／动作／storage／click／禁止payload读取及console／pageerror均空。自有context／HTTP已关，旧战局与既有browser／CDP／8080未访问。

原截图、profile、完整metrics保留于忽略的build/dispatch-supplies-20261028-v111/，公开JSON保存有界DTO与原件SHA。此为真实reader＋插桩renderer受控布局，未启动mobile生命周期、绑定、main／LIB／WASM，不授真实城池／战斗／真机信用。667双栏下长组滚动较密，列为后续布局改进；其余自然流程、性能及全量仍待。128原生源／4运行时、头像334映射／160图／124姓名及主目录保持，旧战局未操作，持续HD目标进行中。
