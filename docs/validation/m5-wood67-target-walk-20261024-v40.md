# WOOD出征目标逐键合同修正（V40，源码准备）

真实helper控测发现旧准备合同把数量完成到目标确认的keys强制设为相等，旧正例却直接拷贝票据并改cityPos／phase，没有走真实目标光标。固定LIB实际城7为(10,1)、城1为(9,0)：一条合法最短路线是上34、左36，中间mapCity为0、最终为2。旧9,2／两Up口述错误已纠正；独立审计首a19655也因这个错误期待拒收，原工具与terminal-only记录保留，不把它算生产或游戏失败。

新合同显式接入targetWalk：数量完成必须是原版提示自然退休后的phase4新票；initial只允许公开overworldMode切classic，不能顺带改世界、qty、report、owner、key、引用或unknown。完整108字节地图与76字节坐标源自固定LIB；真实geometry双读限定12×9、160×96和C默认cursorRange0,0,100,100，合法8×6视窗必须包含实际起点。每个方向都保before／fresh／after、三份geometry及一个原生key，按C只改cursor、必要viewport、mapCity和keys＋1，其余完整票据逐项相等；最终独立fresh再绑定目标确认。合法绕路和原生视窗滚动也有正例，未以删除key约束或改写原票据绕门。

C静态screen初值为208×128；当前PC清本地设置后lcdInit实际设160×96，所以这里限定的是本case实际原生尺寸。g_cityCursorRange只在C初始化一次，后续原版方向／触摸读取，四字段通过U16绑定；city links不改变它。一个精确旧V39原raw独立重验确认数量done为keys66／phase3／report1，提示自然退休后keys仍66／phase4／report0；仅改公开map模式后与targetBefore全票相等，再经34、36达到targetReady keys68。只读重验旧证据不是新增游戏输入。

准备测试73→94净增21项，运行时测试85→87净增2项；原测试名称全保，运行时生产模块未改。94目标收据只有after源pin，明确没有before双锁；87目标有7源before／after，最终完整137文件Clang回归才用48源before／after确认7453／7453通过（原7430＋23），退出码0。旧73／85／7430记录按历史原件保留，不当修订后当前回归；额外helper VM、独立C／旧raw复验和重复目标都不再加计。

本批只修纯合同与受控fixture，没有启动driver、服务器或游戏，没有新付款、兵力、END、SAVE、404、fallback、经典或HD接受。完整新caller仍另审，不因本批绿而自动授实际执行。主活动仍为239年8月：131在城7、0兵／EXP8，129被俘0兵，44体力16，城20粮493／钱1086；未恢复下一次施术资格。

小包保留旧假正例源码、真实helper拒收、坐标期待纠正、精确旧raw和最终原TAP，完整7453原始spec日志独立gzip。当前主输入只绑定四个八月文件，不遍历旧九大分卷。运行同名前缀 -verify.mjs 可只读核原件、案例增量、48当前源pin、旧raw边界和原版双SAVE；完整工程仍需匹配checkout，本包不是便携运行环境。
