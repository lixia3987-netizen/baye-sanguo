# 撞击后续路径只读审计：V32 的 239-3 保存

后续更新：本页保存三月静态审计原结论；新V33选择在兵符所在城6继续原版招揽，已实际重新取得水军潘浚129，不再需要先打通城7走廊。当前唯一输入已前进至239-4，具体双档、原生取得过程和补粮要求见[城市6真实续接记录](m5-impact13-city6-20261023-v33.md)。下文旧三月状态与走廊方案保留历史范围，不是当前必经步骤。

2026-10-23。本文件所述续接审计仅读取已有 V32 实跑文件、原版 LIB 和当前 C 源码，并对保存字段及原 LIB 城路表作离线计算；**零新游戏动作、零新月份、零重新付款、零新招揽或赏赐**。该路径审计没有运行 V32 独立终审，也没有取得新的施法、经典 LCD 或 HD 验收；本批另外完成的[16阶段独立复核](m5-impact13-bounded-canvass-20261023-v32-prefix-acquisition.md)与[PC隔离新局专项](m5-display-settings-20261023.md)分别记录。本文件的哈希为本轮读取的文件字节，源码规则推导与已保存实跑观测分开陈述。

## 当前保存与已经取得的人选

后续唯一输入应继续 V32 的 `impact13-129-v32-month1-policy-settled`、239-3、slot0；原始世界的 `worlds[0].world` 为该月 MAP，活动订单为0。下表路径均相对仓库根目录。

| 实际文件 | 字节 | SHA-256 |
| --- | ---: | --- |
| `build/impact-skill-20261014/impact13-battle-actual-v32/raw-v32-month1-settled-before-SAVE.json` | 90381 | `2428db154ccc84dfa5809aa10c727d77a68edcfda8624956c6cccfdee7341586` |
| `build/impact-skill-20261014/impact13-battle-actual-v32/native-impact13-129-v32-month1-policy-settled-sango0.sav` | 8221 | `4b90d599951b9e585d2e8405cc2be207bb85826871ee66a78d757a4b8ee5b320` |
| `build/impact-skill-20261014/impact13-battle-actual-v32/native-impact13-129-v32-month1-policy-settled-sango1.sav` | 4840 | `6592838867bec41b6ded9a8d0626e2fbd1ad5f9008694f11030ec6ed0622344f` |
| `build/impact-skill-20261014/impact13-battle-actual-v32/raw-v32-optional-give-skipped.json` | 113503 | `3ef21d825a4838aec3fbdb32e2812184c5ed055bc49ff5cc4da8f66604eda7df` |

保存实跑记录中的第10单为城7、人68招揽人131；其相邻回调模型记录 `nativeOutcome=success`、`targetAcquiredAtNativeReturn=true`。这项记录见同目录 `report-field-129.jsonl`（`result.json.fieldStorage.v32Month`），SHA-256 为 `1c7217d09770d19e304b4678d138161f698ddc677a38631fa7b7cfba1c043275`；上述 optional-give 原始包同时保留招揽结果及跳过理由。本轮是读取该既有证明，没有重新执行回调。

当前人131为原版第四时期 ROM 姓名“张休”（LIB resource72、零基 item131），Belong1、Lv17、Force42、IQ80、Thew100、ArmsType1、Arms2920、忠诚63、Tool1/2均0；唯一原始位置为城7、queue24。其等级及转换后源 MP 算术84，使其成为可替代人129的后续准备人选；**当前仍为非水军，84不是实际战场 MP**。源算术入口为 `build/impact-skill-20261014/hd-impact-v32-acquisition-policy-v1.mjs:104-107`。

`result.json:223` 保存 `v32AcquisitionRunAccepted=true`；`:202,263-264` 仍保存 `actualCastAccepted=false`、`actualAcquisitionAccepted=false`、`actualGiveExecutionAccepted=false`。Give 因候选不在城6跳过，不能将流程接受或已经取得张休解释为水军施术者准备完成。

## 合法移动与兵符阻碍

读取的 `libs/dat-mod.lib` 为207195字节，SHA-256 `3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e`。resource2/item5为38城坐标，resource59/item0为38×16城路记录。结合当前保存的城市归属，原生 `SearchRoad`（`vendor/iBaye/src/cityedit.c:296,410-456`）经 `GetRoundSelfCity`（同文件`:552-578`）仅扩展同归属相邻城：

- 城7己方连通闭包为 `[7,13]`，城6一侧为 `[6,5,4]`；7→6虽曼哈顿距离为2，当前 `MoveMake` 的道路检查仍拒绝（`vendor/iBaye/src/citycmdc.c:441-506`）。
- 城7邻城为13、1；城13邻城含12；城6邻城含1、12、5。当前城1、12都属于势力2，取得其中任一城可连接两侧。这是原路表及当前归属的静态推导，尚未执行攻城或证明能够取胜。
- 当前全部城池有效 goods 切片中，原始物品32仅城6的已发现标记32800一枚；城7、13均 Tools0。`SearchDrv` 只在本城 `GetCityDispGoods` 列表中发现既存隐藏物品（`vendor/iBaye/src/citycmd.c:224-255`），所以当前在7或13搜索不会生成第二枚水战兵符。`TransportationMake` 仅处理粮、钱、预备兵（`vendor/iBaye/src/citycmdc.c:271-425`），不能据此运输兵符。
- 当前己方7城，势力2为11城。`InduceDrv` 在随机门之前要求己方城数至少为目标势力的2倍（`vendor/iBaye/src/citycmd.c:881-904`）；7小于22，当前对该势力的劝降19必在此门失败。未来城数变化后须重新判断。

当前原始世界的 `config` 没有采集 `fixThewOverFlow`。`MoveMake` 根据该项选择 MOVE 或 TRANSPORTATION 的体力消耗（`vendor/iBaye/src/citycmdc.c:535-539`）；原 LIB 对应值为0和8。未来移动合同需要新鲜只读采集该项，不能从旧采样缺失推断其值。

## 控制器早停及可复用部分

`build/impact-skill-20261014/hd-impact-v32-acquisition-policy-v1.mjs:52` 在 `v32AdvancedOwned(w).length>0` 时停止规划；`:107` 的高级己方候选允许仍需兵符转换的人选。城7张休触发此停止，但既未成为水军，也未与兵符连通。这是**控制器准备目标过早停止**，不是原生招揽规则 bug。该冻结文件18391字节，SHA-256 `42cfa940c289764547dccb93c51e0c82ef557688beeba085fd50cb7b2ad9af3c`；应在未来新版本区分已合格水军、兵符可达候选和孤立非水军候选，不回写 V32 证据。

原生 `CanvassDrv` 的 IQ 差使用U8（`vendor/iBaye/src/citycmd.c:673-689`），目标无当前城时也失败（`:715-717`）。保存 V32 的人26两次回调记录 `targetFirstRawCityBeforeDriver=255`。因此这些失败不能单独归为随机门故障，更不能据此修改原生规则。

只读文件名检索未发现完整 V33 或“当前张休迁移后赏赐”的续接脚本。可复用的移动 MAKE 模型及 UI 范式为 `scripts/hd-mobile-transfer-runtime-oracle.mjs` 与 `build/mobile-transfer-prebuild-20261011/hd-mobile-transfer-runtime-checks.mjs:90-123`；前者对全局 PID 唯一的旧限制不适合当前合法跨城原始重复，不能原样当作当前全世界合同。赏赐 UI 已有 `build/impact-skill-20261014/impact13-v32-water-token-give-runtime-fragment-v1.js.txt:18-34`，但其模型 `hd-impact-v32-water-token-give-oracle-v2.mjs:6,57-59` 限定239-3、城6以及该月招揽因果链终点；未来跨月 Move 到达需要新的明确因果合同，不能只替换日期。

## 下一步走廊准备与城1风险

下一轮先绑定上述最新双 SAVE 及当前源文件，再选择原版合法取得城1或12的路线；通过真实原生胜利、归属与保存证明走廊后，才规划张休 Move、实际到达城6、唯一兵符赏赐及新的水军资格。每个新阶段分别保存原始观测和公开双 SAVE，不回退 V31 或重放已消费操作。

城7→1为原 LIB 邻接攻城合法边（`vendor/iBaye/src/cityedit.c:506-536`），距离2。当前城7钱30000、粮18617、预备兵0；原 LIB command27费用为0。当前实际己方总兵3520，其中张休2920、其他7名合计600。城1实际同归属守军为公孙恭148／1980、孟获3／1930、王平71／1800、公孙渊149／1990，共7700；其余原始队列项属于在野或其他归属，不计为当前守军。`BattleDrv` 取得同归属人物后按兵力安排守军（`vendor/iBaye/src/citycmdd.c:247,369-416`），AI MAKE 后还须重新核对真实阵容。

当前直接出征兵力劣势明显，张休Force42且是唯一已取得的高级人选；没有执行胜负模拟或实战，不能保证胜利或安全返城。`ConscriptionMake` 可作为准备（`vendor/iBaye/src/citycmdc.c:1077-1167`）：当前城7民忠31、armsPerDevotion20，每次最多620兵，且征兵者派出后要自然返城；不能将待返人物或未来征兵当作当前可部署军力。`PlcArmsMaxP`（`vendor/iBaye/src/PublicFun.c:838-855`）的原版算术给当前城7八人理论统率总上限12130，但这不是已拥有的兵力。后续需要独立证明征兵、分配、原守军保护、每次实际粮钱和战斗结果，不能只按理论上限宣布走廊已可取得。
