# 武将立绘

| 目录 | 内容 |
|------|------|
| `refs/period-{1..4}/{id}-{姓名}.png` | 引擎实拍的原头像。`id` 是 0-based PersonID |
| `hd/` | img2img 成品。缺文件时界面不编造 |
| `manifest.json` | personId + 时期 → `ref` / `hd` 路径。试点武将由导出脚本填 id |
| `PROMPT.md` | 中英提示词 |
| `refs/index.json` | 全量导出索引（脚本生成） |

`personId` 与 `gam_drawpic(GEN_HEADPIC1 + g_PIdx, personId)` 相同。`GEN_HEADPIC1` 是 47，时期 `g_PIdx` 为 1–4。时期 1 的 resid 是 48（47 + 1）。

导出只认这一条：

```js
baye.drawImage(0, 0, GEN_HEADPIC1 + g_PIdx, 0, personIndex, 1)
```

然后等一帧 `requestAnimationFrame` 和一次 LCD flush，裁 `document.getElementById('lcd')` 左上角 `24 * dotSize`。`bridge.js` 里 `scr == 1` 会画到虚拟屏，脚本会再用真实 LCD 的 flag 1 把同一张图刷上 `#lcd`，否则裁到的是空屏。

`document.querySelector('canvas')` 在 `pc.html` 上是 HD 大地图（`#hd-overworld-canvas`），裁出来接近全黑。不要用它。

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

回退路径由 `refs/index.json` 的全量索引提供，不从人物编号猜文件名。manifest 与参考索引都记录实际 LIB 的 SHA-256，游戏中由共享身份模块核对真正加载的 `dynLib`，不以首选路径认证。正确原版内容从其他路径或 IndexedDB 载入仍匹配；其他 Mod 未建立对应身份索引前使用引擎 LCD。模块缓存图片请求，LIB 身份、时期、视图、停止及隐藏时取消过期结果。原图缺失时不显示替代人物。契约见 [实际 LIB 身份](../../docs/hd-lib-identity.md)。

导出脚本提交索引前从真实浏览器读取加载内容并计算摘要。来源缺失或无效时保留原有文件；更换库后不继承另一库的 HD 路径。`hd-portrait-smoke.html` 是明确标记的独立素材预览，缓存不会授权后续运行的游戏。

`npm run test:portraits` 验证四时期、800 条参考图路径、ID 0、缺图、不同 Lib 和异步竞态。`CHROME=/path/to/chromium npm run test:portrait-browser` 验证实际图片加载与回退；这项检查不替代真实战斗验收。
