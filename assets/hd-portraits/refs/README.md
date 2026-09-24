# 原头像

此目录只放引擎画出来的头像 PNG。来源是 `#lcd` 左上角 `24 * dotSize`，画完 `baye.drawImage(0, 0, GEN_HEADPIC1 + g_PIdx, 0, personIndex, 1)` 并等一帧加一次 flush。时期 1 的 resid 是 48。运行 `node scripts/dump-hd-portraits.mjs` 之后会出现 `period-1` … `period-4`。

不要把生成图、截图拼图或手绘头像放在这里。
