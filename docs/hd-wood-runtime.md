# 滚木与落石运行时验证工具

`npm run test:wood-runtime` 提供独立测试局的准备与施法验证入口，配套 `scripts/hd-wood-runtime-oracle.mjs` 核对原生画面和高清覆盖范围。当前提交保留基础版本；后续路线调整及续跑候选仍在本地 `build/` 中，尚未合入此入口。两种技能的完整实战验收仍待完成，预检通过不代表已取得合格武将或实际施法通过。

静态路线依据随仓库保存于 `scripts/specs/hd-wood-runtime-route-plan.json`。该文件保留原始计划字节及历史生成信息（包括当时的 `build/` 输出路径）；运行时会校验完整 SHA-256，并继续依据实际游戏中的归属、队列、等级和费用决定操作。

## 只做预检

需要 Node.js 22 或更新版本。原生源码和待测引擎必须一致；先按项目构建说明生成对应引擎，再检查暂存产物。在 Windows 上可执行：

```powershell
npm run build:wasm:windows
npm run test:wood-runtime -- --staged --preflight-only --artifact-dir build/wood-runtime-preflight
```

预检只读取来源、LIB、动画资源及构建身份，写入独立报告，不启动浏览器。每次须指定一个尚无 `result.json` 的输出目录，以保留已有证据。省略 `--staged` 时检查已安装的 `js/` 引擎；源码与已安装引擎不匹配会拒绝继续。

## 实际测试范围

省略 `--preflight-only` 会在独立浏览器及独立存储中，通过公开操作推进月份、招揽武将并保存原生双文件。准备有月份和操作预算，可能因条件不足而失败；不得将准备过程或原生存档本身计为高清技能验收。

`--cast-only --from-preparation <目录>` 只接受准备已通过、来源未漂移、私局已清理且原生存档完整匹配的报告。当前仍缺少通过这组条件的完整实战输入；不得用失败报告或修改后的存档绕过校验。真实施法、MP/伤害、数字等待以及高清与回退表现分别保留验收状态。

当前实际测试的进程身份校验适用于 Windows。需要 Chrome、Chromium 或 Edge，可通过 `CHROME` 环境变量指定程序路径。工具使用独立端口，浏览器目录固定在本次输出目录的 `private-browser-profile/`，启动前须不存在。只结束经过 PID、创建时间、程序路径与命令行核实的测试进程；仅父进程退出不能作为清理通过依据。每次完整原生保存后及清理前的身份采样保存在 `owned-process-samples.jsonl`，无关进程不保存完整命令行。浏览器目录保留，不递归删除；`isolation.cleaned` 表示测试进程树与独立服务均已退出。

报告使用分块写入并在完成后发布，不覆盖已有结果。较大的 `campaignObservations` 保存为完整的 `result.json.campaignObservations.ndjson`，主报告保留条数、字节数与 SHA-256 引用。读取时可使用 `scripts/hd-runtime-json.mjs` 的 `readCampaignObservations()`；须完整读取迭代器后才完成条数与摘要校验。其它存档与施法接受条件保持独立。测试报告、原生战役存档和浏览器目录均保存在忽略的 `build/`，不作为游戏素材提交。

`npm run test:runtime-helpers` 单独检查进程身份计算与报告保存，不启动浏览器。完整 `npm test` 还会编译真实 C 专项，需要可用的 `cc` 或通过 `CC` 指定 C 编译器；已安装本项目 Windows emsdk 时，可将 `CC` 指向其 `upstream/bin/clang.exe`。
