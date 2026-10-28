# 手机页头完整读数与经典画面适配（V108）

2026-10-28。900px以内横屏页头改为品牌／操作第一行、资料第二行，667×375及844×390下原版最长四字姓名、65535年12月、钱粮后备兵65535均完整显示。资料可见时页头89px，隐藏时不产生空轨道、恢复52px；竖屏既有隐藏规则保持。CSS cache更新至20261028header1。

资料显隐会改变stage高度，因此m.html新增幂等bindMobileStageResize()，postRun在既有reloadLCD后绑定。ResizeObserver观察stage，缺失时MutationObserver仅监听HUD hidden；比较实际正宽高，尺寸未变不调用reloadLCD，避免重复刷新反复取消手势。实际变更沿用原reloadLCD缩放和touch.cancel，不新增策略命令或自动确认，原window／visualViewport监听保持。

两个现有模块最终新跑103／103，fail／cancel／skip／todo均0，16份所选源整场字节保持，无新增测试项或模块。较早一轮同样通过，最终补齐原有lcd.js输入来源pin后复跑，结果不累计为206。原TAP、空stderr与SHA见[完整JSON](./m5-mobile-header-20261028-v108.json)。

一个自有Playwright Chrome／pipe、5页／6导航完成受控检查，23来源保持。两个MAP布局均六字段scrollWidth≤clientWidth、44px操作按钮无交叠或横溢出，667→844→667往返通过；667资料隐藏的战场页头DOM示意为52px，6顶部操作及底部控件保持可见。父版m.html／CSS通过独立只读route作负控，归属／日期／三个资源共5字段按预期截断，未替换产品文件。

经典页使用生产jQuery和未改写的当前inline LCD定义，Module.postRun未执行。固定667×375、无window resize时，RO与禁用RO后的真实MO fallback均验证52→89→52页头、LCD538.328×323→476.656×286→538.328×323，始终包含于stage且保持160∶96比例；每步四次同值刷新及重复绑定不增加cancel，实际几何变化计数1→2→3。只在只读夹具间切换，无真实原生世界变更。10原PNG由预览审核者逐张目检，Root另看5张代表图；RO／MO对应图SHA相同。原件、profile、完整metrics和日志保存在忽略的build/mobile-header-20261028-v108/，公开JSON嵌有界metrics与原件SHA。自有页／context及HTTP关闭，旧战局与现有浏览器未访问。

本批只接受所列尺寸、切换及几何检查：identity明确mock，地图绘图和HUD隐藏战场为标注DOM示意，经典Canvas为受控几何图；未加载真实LIB／WASM／main，未执行真实postRun、战役、真机、性能或全量。128原生源／4运行时及头像281映射／141图／106姓名保持，主目录未改；不扩展为任意更窄横屏或整个HD完成，持续目标保持进行中。
