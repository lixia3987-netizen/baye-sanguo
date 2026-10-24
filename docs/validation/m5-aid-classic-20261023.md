# AID41：原版援兵／援军的 PC1080 经典 LCD 实战

本批只接受技能17、29在当前安装版 **1920×1080 经典显示**的两次独立实战。`actualCastAccepted=true`、`classicNegativeAccepted=true`；`hdAccepted=false`、`wholeHdAccepted=false`、`globalHdComplete=false`。此前安装1080p高清、暂存720p高清和精确缺图记录仍保留各自执行来源，本批没有重新验收完整当前矩阵。

两场分别通过公开存档导入和真正原生 LOAD，使用独立 AID 活动的原版时期3／玩家9刘璋、212年8月 `caster188-owned` 双文件。身份为 `v1:414390:1d36da77:1e9c0477`，仍是[原有已接受准备记录](m4-aid-runtime-20261010.json)指定的冻结矩阵输入，和该活动最后 `phase2-month-003` 字节相同。sango0为8221字节，SHA256 `5e8eb45f4e7712d3e63982db03c5616ec7866a75b109ab186725b4eef938b20d`；sango1为4840字节，SHA256 `8f73a71dfba722cd2e3c33824853bc8a82886180030ed5d63a45a52c18939f97`。没有载入、回退或修改主撞击活动的时期4／玩家0／239年3月存档。

实际加载后重新核对全部200名武将、38城、居民队列、活动订单、600字节出征数据和日期；当前原版 LIB 独立双读、哈希并核对来源。南方小鬼188／Lv20／玄兵与吴兰144均在己方巴郡31居民队列，沿公开出征流程真实进攻武陵32；原生27订单、两名将领、携粮、钱粮变化、地图和当前友军 AIM 均另有回执。旧准备过程只作精确依赖，没有重复计为本次新取得。

| 技能 | 实际 MP | 吴兰实际兵力 | 真实增量 | 电影 LCD 回调 | NUM／HOLD 读回 | 全 LCD 读回 | HD 读回 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 17 援兵 | 146→131 | 100→900 | +800 | 8 | 22 | 30 | 0 |
| 29 援军 | 146→116 | 100→1470 | +1370，受当前容量1470限制 | 8 | 25 | 33 | 0 |

两次在当前原生友军 AIM 门切换为 classic；只以真实按键逐格移动光标并确认，原生电影、GBK「兵力增加」、NUM15八次上升绘制及50 tick等待期间没有跳过或额外输入。实际MP分别扣15／30，即使请求增兵1800也不把名义值当作实际+1800。结束后 SPE／结果／顶层归属均真正退休。每场只接受其显式 `--skill`；原始继承检查点名 `05-two-AID-owners-retired` 不代表单场已验两技能。

验证器独立解码当前原版 LIB／字体／NUM，重算8个原生电影提交、累计清除、标签与数字轨迹。63份读回共 **967680个逻辑像素**，逐项核对完整160×96原生画面及实际前台 LCD Canvas／原始PNG；还核对 classic 模式、画布可见且在视口内、三个实际前台命中点、无 HD 画布替代及无素材／字体替换绘制。61次实际LCD回调与两次完整HOLD读回分开计数，不把逻辑提交或回调数称为浏览器物理刷新帧覆盖。

当前[运行器](../../scripts/test-hd-aid-runtime.mjs)和[独立像素验证器](../../scripts/hd-aid-runtime-oracle.mjs)沿用已验证的公开原生流程，接入现代精确 Chrome 归属清理；没有改产品 JS／CSS／素材／原生源码或重编引擎。两场各冻结1229项来源，前后漂移／新增均0；native128为 `713f2425551f3fbf3b9f0f892eeada969161c070c465e159f4126f1dd1944d9d`。各自8个已记录出生时间／执行文件／私有profile的Chrome进程全部退出，私服与调试端口关闭，并由另一次当前OS读取复核；私有profile保留，没有递归清理用户目录。用户8080服务没有作为私服或调试端口使用。

当前20项[定向纯验证](../../scripts/test-hd-aid-runtime-oracle.mjs)全部通过，包含单技能缺失／非法技能集、隐藏LCD、遮挡、旧HD画布、错误模式、替换素材、可见像素错误、缺帧、MP／增兵错误、额外输入、未退休、缺HOLD及两项generation来源漂移的拒收。原运行记录对应的18项检查保留原日志；新增两项是以下只读复核的严格化，不是新浏览器实战。

命令分别为 `node scripts/test-hd-aid-runtime.mjs --classic --skill 17 --from-phase2 build/r22-aid-phase2-actual-v5 --artifact-dir build/aid-classic-20261023/classic-17-v1` 和 `node scripts/test-hd-aid-runtime.mjs --classic --skill 29 --from-phase2 build/r22-aid-phase2-actual-v5 --artifact-dir build/aid-classic-20261023/classic-29-v1`；每场先以同参数加 `--preflight-only` 通过无浏览器／无HTTP预检查。完整参数和精确执行代码保存在归档中。

[汇总JSON](m5-aid-classic-20261023.json)与[原始索引](m5-aid-classic-20261023/runtime-index.json)保留完整当前执行JSON、captures、引擎输入、SPE观察、来源、精确进程采样、终审、执行代码和原始双SAVE；每份实际电影／NUM／HOLD原生与可见LCD PNG均按原字节归档。186个逻辑记录去重为85个对象，约4.9MB。10张补充准备／动作后整页截图只保留完整字节与SHA清单，本地原件仍在；没有递归归档旧准备历史或浏览器profile，所以 `portableClosedArchive=false`，不声称所有补充截图闭合。

后续只读审查补上验证器中「实际 AIM generation→每份选中电影／结果 generation」的直接绑定。原两场实际 AIM 均为generation3，30／33份选中读回及display generation也全部为3；修订后严格验证器重新接受这63份未修改原始证据，并拒绝只把实际 AIM 改成1003的内存污染。此过程零新浏览器、零新原生输入、零新增HD信用。[补充复核JSON](m5-aid-classic-20261023-generation-revalidation-v2.json)及[独立append索引](m5-aid-classic-20261023/generation-revalidation-index-v2.json)追加5个对象，分别保存修订后的oracle／测试、20项新日志及只读复核源码／结果。原执行代码、两份原始result、原汇总JSON的`sourceBoundary`和原186项索引均逐字节保持，当前修订源码单独记录新SHA，没有把新代码回写成旧实跑来源。

AID其它当前高清矩阵、隐藏／可见性／resize、手机与真机、性能、完整战役和RNG连续性均未获本批信用。WOOD6／7、其它兵种技能和主撞击活动仍按各自实际最新状态继续，整体HD保持partial。
