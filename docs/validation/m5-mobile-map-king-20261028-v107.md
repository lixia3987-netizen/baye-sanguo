# 手机地图当前君主立绘（V107）

2026-10-28。手机地图新增独立当前君主栏，复用现有HD／原生参考头像和原生姓名。君主来自零基g_PlayerKing，不取当前选中城归属；复用既有MAP票，另封存时期、人物、data／API／DOM引用，姓名与异步图片回调后重核。空地地图同样支持，city／report原优先级保持。无新增原生字段、输入或世界写入。

左栏宽clamp(88px,14vw,118px)，右侧Canvas在独立wrapper，图片加载不改栏宽；原地图按真实Canvas rect调整。经典、非MAP、失效、隐藏／旋转／失焦及换源正常退休。HD失败沿精确manifest回退原生PNG；双缺图只隐藏可选图，保留认证姓名和当前地图，sourceMode=none、fallbackActive=false，不宣称LCD地图回退。m.html更新栏与地图wrapper结构，并将本次CSS与手机头像控制器cache更新至20261028king1，原生源与运行时未重建。

三个相关模块新跑260／260，fail／cancel／skip／todo均0，16份所选源整场字节保持。净增3个默认case，无新模块；使用生产hd-mobile-map.js的真实getInputTicket，覆盖零ID、同key换君主／时期、13类拒绝边界、迟到source／image、等值data／API替换及报告接管。首次单模块94／95仅新夹具MAP空地→报告未设有效城而失败，修正夹具后新增3项通过；原记录保留，未叠加到本次260。父版JS隔离负控仅执行3新增case，按预期0通过／3失败、exit1，未替换产品文件，不计入通过数。原TAP／stderr与来源SHA见[完整JSON](./m5-mobile-map-king-20261028-v107.json)。

提交前精确字节门曾拒绝测试文件被auto-CRLF规范化的差异，未创建提交。仅将该测试文件CRLF转为LF并增加专属LF属性，逻辑不变；旧记录与原测试字节保留。最终在LF字节上重跑上述三模块260／260与父版负控0／3，公开JSON采用这轮最终来源，不将前后两轮累计。

受控预览使用生产m.html、CSS、HUD／MAP host／头像控制器与真实曹操／刘备1280×720 PNG；identity明确mock、world深只读，共享地图绘图为标注的受控示意，未加载真实LIB／WASM／main。最终两图及同轮viewport精确844×390与667×375，预览审核者及Root均实际目检，姓名14px可见、原PNG完整contain。左栏118／93.375px，Canvas726×338／573.625×323，头像与地图／提示／页头／控件无覆盖，5按钮均44px高，无横溢出、页面异常或native输入／写／动作／storage写。667既有页头日期及大钱粮仍有省略号，不授完整数值可读信用；该缺口列入下一项。

共4次自有浏览器启动：2次CLI首轮截图因采集时viewport变化、正常异步重载未完成而拒收，原件保留；改用Playwright自有Chrome与pipe固定viewport、等真实PNG后，2组通过。另一次预览路径准备错误发生在浏览器／HTTP启动前，单独保留。自有上下文关闭、HTTP关闭，未访问现有浏览器／CDP／8080或旧战局。原截图、profile、完整metrics与失败日志在忽略的build/mobile-map-king-20261028-v107/，公开JSON保存有界metrics、全部来源与原件SHA。

V95冻结128原生源／4运行时与头像manifest281映射／141图／106姓名保持；主目录未改。真实游戏、设备、性能与全量仍待，整体HD为partial，持续目标保持进行中。
