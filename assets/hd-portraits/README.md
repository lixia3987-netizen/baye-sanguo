# 武将立绘

| 目录 | 内容 |
|------|------|
| `refs/period-{1..4}/{id}-{姓名}.png` | 引擎实拍的原头像。`id` 是 0-based PersonID |
| `hd/` | img2img 成品。缺文件时界面不编造 |
| `manifest.json` | personId + 时期 → `ref` / `hd` 路径。试点武将由导出脚本填 id |
| `PROMPT.md` | 中英提示词 |
| `refs/index.json` | 全量导出索引（脚本生成） |

`personId` 与 `gam_drawpic(GEN_HEADPIC1 + g_PIdx, personId)` 相同。`GEN_HEADPIC1` 是 47，时期 `g_PIdx` 为 1–4，所以 resid = 47 + 时期。JS：`baye.drawImage(0, 0, 47 + period, 0, personId)`。

## 怎么跑

Lib 用词典原版 `libs/dat-mod.lib`。需要本机 Chrome。

```bash
node scripts/dump-hd-portraits.mjs
```

只看时期 1 的前 8 人：

```bash
node scripts/dump-hd-portraits.mjs --periods 1 --limit 8
```

脚本会起一个本地静态服务，用无头 Chrome 打开 `hd-portrait-dump.html`：加载 lib、`LoadPeriod`、把每张头像画进离屏 `#lcd` 并裁切。PNG 写到 `refs/`，并重写 `manifest.json` 里的试点 id。

浏览器里预览（不写仓库，除非 URL 带脚本给的 `post=`）：

```bash
python3 -m http.server 8080
```

打开 <http://localhost:8080/hd-portrait-dump.html> 。

已经用 `pc.html` 选好版本和时期（`baye.data.g_PIdx` 为 1–4）时，控制台可以：

```js
await BayePortraitDump.dumpCurrent()
```

这只导出当前时期，会闪一下 LCD，不会调用 `LoadPeriod`。`dumpAll()` 会重载时期并清掉战役，只在导出页使用。

游戏里的替换逻辑在 `pc.html` 引入的 `js/hd-portraits.js`。说明见 `docs/hd-graphics.md`。
