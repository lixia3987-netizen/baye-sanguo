# HD Overworld 素材包

本目录用于 HD 大地图表现层。当前清单为 [manifest v7](manifest.json)，规则、城池 ID、原生格坐标和存档仍由原引擎负责；素材只参与绘制。当前规范见 [大地图规格](../../docs/hd-overworld-spec.md)。

## 当前绘制素材

| 素材 | 原图尺寸 | 当前用途与范围 | 来源 |
|---|---|---|---|
| `terrain/base_plains.jpg` | 3840×4000 | 完整 LCC 源栅格 3840×3309，南侧海面延展到 4000；1920×1080 是可拖动视口 | Wikimedia China LCC，CC BY-SA 4.0 |
| `terrain/overlay_rivers.png` | 1920×1655 RGBA | 对齐世界矩形 `[0,0,3840,3309]`；绘制 opacity 0.12，止于源栅格南缘 | 从同一 Commons 源图提取的水体衍生，CC BY-SA 4.0 |
| `terrain/mountain-cluster-v1.png` | 1254×1254 RGBA | 10 个手工放置的装饰实例，opacity 0.66 | 内置 imagegen 独立生成 |
| `terrain/forest-cluster-v1.png` | 1254×1254 RGBA | 14 个手工放置的装饰实例，opacity 0.62 | 内置 imagegen 独立生成 |
| `cities/fortified-city-v1.png` | 1254×1254 RGBA | 无主、己方和他方共用堡城原图；势力环与选中反馈由程序绘制，常态屏幕盒 56px | 内置 imagegen 独立生成 |

三张新 PNG 都是未经裁切、缩放或 alpha 清理的原始生成输出。完整提示词、内置工具来源、SHA-256、真实透明通道及预览检查见 [GENERATED-ART.md](GENERATED-ART.md)。原图有透明留白，屏幕绘制盒尺寸不等于实心轮廓尺寸；最终小尺寸可读性由真实绘制验收确认。

## 坐标与装饰边界

环境使用 `china-lcc-raster-padded-v1` 坐标系；完整世界为 3840×4000，源栅格为 3840×3309。河流的 1920×1655 像素按明确 `worldRect` 映射到 3840×3309，不能拉伸到 4000。山林实例保存独立世界矩形，裁切后仍按原实例矩形取样，再与底图使用同一摄像机变换。

山林位置是人工选择的视觉装饰，不是原生地形分类、古代生态测量或精确山脉边界。海南与南侧海面 `landmarks` 也是人工检查源图的区域框，不是测绘数据。城标锚点继续使用 [china-lcc-cities.json](china-lcc-cities.json) 的原有 38 城 ID、名称、经纬度投影与 `hdX/hdY`；没有因新素材移动城池。

道路和 `roads/pass.png` 仍用于低调虚线与过河装饰标记。它们既不是原生出征可达表，也不提供关隘玩法；选中城池不会把装饰道路变成可达高亮。

## 保留的历史文件

旧 `terrain/overlay_mountains.png`、`terrain/overlay_forest.png` 是 8×8 全透明占位，保留在仓库中但未进入当前绘制清单。旧 `cities/marker_*.png` 与 `ui/cursor*.png` 也保留；v7 城标使用新堡城，悬停、选中与光标反馈使用程序描边和系统指针，不绘制这些旧图。

当前素材按显式路径、尺寸和世界矩形接入；新增版本文件与清单变更一起审查。缺失或尺寸不符的可选装饰层独立跳过，不能让已验证的城池地图失去原生输入归属或 LCD 回退。

## 来源与许可

LCC 底图及提取的河流层来源、作者与 CC BY-SA 4.0 许可见 [reference/LICENSE.txt](reference/LICENSE.txt)，地理投影与南侧延展说明见 [GEOGRAPHY.md](GEOGRAPHY.md)。新山林和堡城是内置工具生成的独立装饰图，不是步步高原作美术，也不属于上述 Commons 作品；生成记录不替现有 Commons 素材重新授权。

本说明记录清单与来源。R08 图层、两分辨率交互和完整游戏回归的通过状态以对应测试日志及真实浏览器证据为准，不由素材生成或文档同步自动宣告完成。
