# 原版 PC MAP / FunctionMenu 边界记录 V44

真实公开 LOAD 沿用 V42 十月主档；普通 MAP 和原版功能菜单分别完成 4 组 CDP 模拟尺寸/DPR（1920×1080 DPR1 → 1280×720 DPR1 → DPR2 → 恢复）。MAP 可见时验 backing，菜单覆盖下的地图 backing 仅记录。

一次真实 trusted hidden/visible 往返约 30.9 ms。隐藏票据只有 owner/state；完整隐藏世界、种子和存档比较来自执行内断言，没有独立完整隐藏世界原件。长驻后台与节流恢复未接受。

51 件平层原件全部保留，含 11 张普通 RGB8 PNG、12 个执行源副本、1118 来源及 72 实际 served pins。独立 reader 校验原始字节、PNG CRC/解压/filter/RGB、11 世界快照及额外 final 副本、公开 LOAD ACK、7/8 按键层和精确 owned cleanup。profile 保留只引用闭局证明，不做新的 OS 存在性声明。

原始 actualAccepted/hdAccepted、CSS 布局总标志、电影/WOOD/AID、性能、物理 DPR/真实设备与 global 标志均保持 false；具体 metrics/backing 和短 visibility 结果单列。没有 END、Buy、战斗或新 SAVE；唯一主档不变。城20 Food1/Money886，下月严格粮267，仍缺266。

复用 V43 已保存的 7701/7701、141 文件回归记录，本批新增 default cases0、未重跑全套。205 非 attrs 测试来源不变，attrs 只精确追加 V44 字节规则；原 full gzip 仅引用。

验证：`node docs/validation/m5-pc-map-menu-boundaries-20261024-v44-verify.mjs`（匹配 Git checkout）。1115 个 committed 执行来源严格核当前字节；仅五个明确 ignored 工具允许精确归档源恢复，当前存在时仍须一致。归档不是完整 portable 源码包，不含 profile 或旧大档案。

首次发布工具 e11485/exit1 在大图片 Base64 重复分组正则校验时栈溢出，首次 writer 提前写入的接受标志不构成读回通过。原首次 reader/canonical/MD 与终端出处已保存；五分卷和 archive index 原字节保持。公开 reader 仅改用长度、解码后规范 Base64 往返比较，仍严格核 gzip/raw 字节摘要及原有解压上限；恢复由新的完整读回收据单列，没有重跑游戏或全套。
