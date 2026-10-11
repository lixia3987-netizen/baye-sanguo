# 原版WATER12高清窗口实战验证（2026-10-11）

水淹36／技能12保留完整160×96原版底图，只替换实际认证的64×64@48,16范围，电影／原生数字／等待沿真实提交。PC1080／720高清、精确缺图与经典LCD四个独立合法新局通过；高清窗口外每次11264个逻辑像素与原版LCD的RGBA读回一致，两种回退完整15360像素读回一致，不扩为HOLD页面CSS合成对比度验收。manifest54项，原53项及共享海啸19保持，无新素材或native构建。最终89模块串行 **4404／4404通过**，失败／取消／跳过／todo均0，222执行来源无漂移。首1080运行器缺少原生资源报告、过早预检及无效旧清理proof均保留并明确不计接受；旧源码检查点原样保留。移动仅受控VM、真机／其它技能／性能与完整流程仍待，完整HD保持 **partial**。

## 产品与原生范围

本批实际验证原版时期3韩玄、长沙33→桂阳36的合法公开流程，水军王朗Person14／原生token15使用水淹12／SPE36。依据当前实际ROM技能名、34字节技能记录、水军默认技能、8邻格范围与公开AIM判定，不改人物、世界、概率或RNG。施法MP真实扣20，伤兵与原生resultKind1/value、实际目标兵数逐次绑定，不能从动画推算伤害。

独立waterVersion1／opaqueCoverageVersion1绑定标准LIB与资源36／0、FNV6d62e7a8／1084字节、0..7八单位、两槽64×64和真实20／20延迟。完整160×96 LCD先保留，只替换64×64@48,16不透明窗口。NUM15真实GBK“兵力减少”、55,18标签与6px步距数字、56→49绘制历史及原生等待保留；current／display／clear-frontier／flush／data与绘制后复核失效时回LCD，不新增输入或等待流程。manifest54项，旧53项及顺序和顶层身份原样保持，两张原PNG复用，共享36海啸19仍沿旧路径。

## 四场终态实际通过

| 私局 | 浏览器尺寸 | 接受范围 | 合法施放尝试 | 源复制／实际LCD回调 | 数字／完整等待读回 | 捕获期额外键 | 冻结来源 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| pc-1080-v2 | 1920×1080 | 高清窗口 | 1 | 8／23 | 15／1 | 0 | 1214 |
| pc-720-v1 | 1280×720 | 高清窗口 | 1 | 8／24 | 16／1 | 0 | 1214 |
| pc-missing-v1 | 1920×1080 | 精确缺图LCD | 2 | 8／22 | 14／1 | 0 | 1214 |
| pc-classic-v1 | 1920×1080 | 经典LCD | 1 | 8／23 | 15／1 | 0 | 1214 |

四场共32次源复制、92次实际LCD回调和96次已验读回。8次不同源复制不等于8个物理帧均逐一截取；回调合并范围明确保留。高清每次读回的窗口外11264个逻辑像素与当前原版LCD逐像素一致；精确图片404与经典两场完整15360个逻辑像素一致。上述LCD一致限原始RGBA读回口径，包含alpha，仅alpha=0时不可见RGB按原验算口径归一。原生LCD另经实际ROM图片、GBK／数字历史独立重建比对；此处没有宣称窗口内彩色高清画面具备独立逐像素美术基准。实际DOM可见、视口及遮挡、NUM／HOLD、真实退休和捕获期0额外键分别记录。

单张canvas导出的PNG有大量透明背景、黑色文字和半透明灰色河流；PNG本身不包含页面CSS背景，在黑底查看器中黑字可能不可见。实际页面依赖浅色canvas背景，缺图画布CSS为`#e6edd4`，经典LCD采用silver（全局HD主题可为`#c8c8c8`）。本轮没有采集HOLD时的computedStyle或当时全页CSS合成截图，因此原始RGBA／alpha相等及DOM可见不能扩大为最终CSS合成对比度验收，也没有据此认定产品显示失败。四场独立审查和透明PNG显示边界原件`fallback-transparent-display-review-v1.json`均见结构化sourceRefs；待验边界单独保留。

各次真实actor／target／天气／MP／兵力／会话与伤害结果见结构化记录，四场不混用旧FIRE或历史WATER结果。实际只读观察器前后原生快照与LCD回调快照一致；没有模拟伤害或为动画补键。

## 失败、预检与旧检查点

- pc-1080-v1：runner-missing-native-resource-report-before-cast；0次已记录合法施放、0次WATER读回，actual／HD／fallback均false。TypeError: Cannot read properties of undefined (reading 'actualSkillName')

preflight-v1虽accepted但仅准备检查，遗漏waterNativeResource报告发布门；首1080在读取actualSkillName时停止，尚未施放WATER，不能计实战。修复只恢复1886字节原生技能／名称／范围报告块，旧runner／失败／修复逆差保留，正式四场使用同一修复后runner。新preflight-v2仍只是预检，不计实际施放；其余未来或失败尝试同样不因预检／单测通过而接受。

旧清理输出cleanup-verification-after-v1.json受PowerShell5读取UTF8无BOM及ConvertFromJson非终止错误影响，记录attempt1／recorded0而表面ok=true，明确为 **invalid-not-acceptance**。最终清理采用显式UTF8和终止错误策略，仅本轮最终proof计入接受。旧脚本和错误输出均保留，不伪装为一次有效OS核验。

[WATER源码检查点](m5-water-window-20261011.md)的MD／JSON／归档三件SHA及runtime-pending状态保持原字节；新实战记录只补充本轮事实。源码批新增65项受控用例，移动10项仅VM；编译C夹具不是手机浏览器实跑。源码批首轮共用C夹具锚点／mode碰撞导致的15项失败及恢复记录保留，不混同本轮实际失败。

## 回归、冻结与隔离

最终默认89模块串行4404／4404通过，失败／取消／跳过／todo均0，222执行来源无漂移；该数来自本轮终态，旧检查点的228执行来源只属历史。原128份native来源聚合仍为`713f2425551f3fbf3b9f0f892eeada969161c070c465e159f4126f1dd1944d9d`，安装来源一致，本轮无新native构建或素材生成。

最终外部只读证明覆盖7次含历史身份记录的尝试、72个精确PID／出生时间身份；无存活和私有端口listener。原8080 PID57860／出生时间／exe及HTTP200保持。各运行器自身也报告owned tree退出和私服关闭；profile保留未删，外部OS结论只归属于根代理的保存proof。

归档保存全部终态JSON／JSONL／NDJSON／日志／执行工具、冻结来源、独立审查和测试／清理证明，并选取首末已捕获电影、NUM／HOLD及失败／退休PNG。其它原始截图与私有profile仍留本机，不说成全量截图入库；gzip存储及原字节SHA均可往返核对。

完整HD仍为partial，globalHdComplete=false。共享海啸19、其它技能／时期、移动实际浏览器／真机、每物理帧、完整可见性／resize矩阵、性能、完整战役／存读档／RNG连续性继续待验；经典FIRE另批仍pending，本轮经典WATER不替代它。

[结构化结果](m5-water-window-runtime-20261011.json) · [归档索引](m5-water-window-runtime-20261011-archive.json)
