# 原生道具长名单完整发布（V89，轻量开发验证）

2026-10-26，修复 ShowGoodsControlInner 发布名单时固定截取80件的问题。发布上限改为原菜单字节容量、每名槽宽和已有2000身份槽的共同限制；80、81与2000项可完整发布原ID、顺序、重复实例及当前高亮，不扩ABI或缓冲区。超过容量的列表仍不授完整身份，保留原生LCD、索引、翻页和确认。JS桥与HD列表本已有2000项容量，本批不重写输入路径。

新增C两组与桥一组，共净增3个默认测试。旧产品对新C断言 **0通过／2失败**，Node退出1；包装命令退出0仅表示预期负控成立。修复后最终三个相关模块 **300/300**（实际C函数24＋桥36＋HUD240），失败／取消／跳过／todo均0，22件所选来源保持，实际Clang18。覆盖80／81／2000、末项DOWN及唯一ENTER、完整重复ID顺序；2001／2047／2048安全截断、拒绝不完整身份且原生选择结果保持；桥验证1999高亮、未知末ID和短数组拒绝，读取零键。早期专项24／36不重复计入300。

使用Emscripten3.1.51、CMake3.31.6重建并成套安装加载器／WASM／map／manifest。128件跟踪原生来源构建期间保持；将旧showface原件代回当前源可重得原安装聚合617c3aea…，确认本批原生代码差异仅为该容量修复。当前聚合2a59a39c…，清单保留真实构建父提交85d9fbd及modified=true，不伪标成后来的交付提交。CMake既有旧兼容弃用提示留在原stderr中，构建正常退出。

实际新加载器与链接WASM在隔离Node VM以noInitialRun初始化成功，83项导出函数可见、三项必需入口存在，游戏main未运行；各产物SHA及安装字节与暂存件一致。接口／存档协议元数据不变。此项不等于完整ABI、存读档或历史RNG接受，也没有启动浏览器或真实战役。

复核命令：

    CC=build/toolchain/emsdk/upstream/bin/clang node --test --test-reporter=tap --test-concurrency=1 scripts/test-hd-details-engine.mjs scripts/test-hd-details-bridge.mjs scripts/test-hd-city-hud.mjs

Windows本轮实际CC路径为 F:/project/baye-sanguo/build/toolchain/emsdk/upstream/bin/clang.exe；完整构建命令、来源、原C负控与TAP、旧运行时和新产物记录位于 build/goods-capacity-20261026-v89/，SHA见[结构化记录](./m5-goods-capacity-20261026-v89.json)。修复覆盖原生合法长名单合同，尚未验证原版自然战役积累超过80件、真实长滚动／取用、真机或性能；全量验证与调优后排。

本次核查还确认侦察后的 ShowCityProInner 城市详情仍缺原生HD发布，以及存档月份／跨时期君主摘要待补，均保留为后续开发项。旧战局未接入、关闭或重开；整体HD仍partial。

重建后的baye.js与父提交逐字节相同，成套校验与安装仍包含它；Git只提交其余发生变化的产物，不人为改动加载器制造差异。
