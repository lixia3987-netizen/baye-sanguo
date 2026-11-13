# Maker返回控件窗口边界修复（V43）

真实旧版在同一Maker等待阶段按住返回、将窗口从1920×1080缩至1280×720后释放，会发送39并提前回到标题。修复后相同真实指针序列不发送原生键，完整Maker原生owner和token保持；随后一次新的真实点击仍单发39并正常返回标题。两场均为Windows无头Chrome、DPR1、禁用GPU。

生产改动仅清除待定指针按压，覆盖blur、pagehide、resize、orientationchange、visualViewport.resize；不更改原生owner、epoch、电影时序或发送边界按键。pc.html只更新hd-spe查询版本。

五个新增正式用例在旧源码上5/5按预期拒收、修复后5/5通过；原probe六项与候选重复五项不另计新增。完整Clang回归141文件7701/7701通过，较7696净增5；原始完整测试日志独立gzip保存。root终端74943/9fad82/exit0，206项来源前后精确一致。

原v1真实运行在Title第二次Down的等待门超时，尚未达到Maker边界；v2完善公开menu及pending ACK等待后另起独立场景。独审第一次因两个manifest异步请求到达次序不同而拒收，修正为唯一81路径集合及逐文件原字节比较，原工具和失败收据保留；没有改写原运行记录。

归档116个明确小原件，包括三场平层记录、普通Page截图、旧/新实际源码及执行工具副本、测试与独审原件。读取器逐原字节SHA、PNG CRC/解压/滤波/RGB、可信事件顺序、完整原生owner、正常导航ACK及精确清理回读，并依匹配checkout核206项来源。profile和旧V42大分卷不归档。

本轮仅验收Maker返回控件的resize按压边界；其他四种边界为源码受控用例，不授真实浏览器矩阵。没有WOOD/AID活动、原生电影像素、完整resize/DPR矩阵、真机或性能接受。最新V42十月四小输入仅按原pin引用，主活动存档未改变，全球HD仍未完成。

验证：`node docs/validation/m5-spe-return-boundary-20261024-v43-verify.mjs`。
