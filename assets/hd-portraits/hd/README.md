# HD 立绘输出

这里放 img2img 成品，不放手绘占位，也不要把原 LCD 头像复制进来冒充高清。

文件名跟 `manifest.json` 的 `hd` 字段一致。时期 1 已放入的四张：

```text
hd/hd_p1_0005_马腾.png
hd/hd_p1_0001_曹操.png
hd/hd_p1_0089_关羽.png
hd/hd_p1_0157_诸葛亮.png
```

其它武将仍是 `hd/period-{时期}/{personId}-{姓名}.png`，文件不存在时壳用对应 `refs/`。

壳在下面三处查找：人物信息（城池人物列表高亮，或武将报告）、战场说明头像（战场帮助框里光标下的将）、地图君主头像（HD 大地图阶段的 `g_PlayerKing`）。

找到 HD 文件就显示它。找不到就显示 `refs/` 里的引擎原头像。连 ref 都没有时，槽位隐藏，画面仍用引擎 `GEN_HEADPIC`。

提示词见 `../PROMPT.md`。参考图见 `../refs/`。
