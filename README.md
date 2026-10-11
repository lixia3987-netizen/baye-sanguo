# 三国霸业 H5

步步高电子词典经典游戏《三国霸业》的完整浏览器移植。本仓库导入了上游 [baye-alpha](https://gitee.com/bgwp/baye-alpha) 的全部前端页面、资源、Mod 数据与预编译 WebAssembly 引擎，不是精简 Demo。

首页直接进入三国霸业原版（`libs/dat-mod.lib`），无需选择版本。在浏览器里按原作流程游玩：选时代 → 选君主 → 大地图 → 城池菜单（内政 / 外交 / 军备 / 状况）→ 战斗。

## 如何本地运行

不要直接双击 HTML。WASM 与跨域限制要求用本地 HTTP 服务。

Node 开发环境使用 `.nvmrc` 指定的版本；首次运行 `npm ci`，然后 `npm start`。`npm test` 执行输入、战场指令、出征、结算、存档事务、C 协议、对话路由、立绘、后台绘制与性能统计专项回归；真实引擎检查使用 `npm run test:runtime`、`npm run test:battle-runtime` 和 `npm run test:campaign-runtime -- --scenario save`。`npm run test:performance` 记录固定 PC 视口的真实浏览器性能基线。HD 后续计划与验收见 [docs/hd-development-plan.md](docs/hd-development-plan.md)，源码与 WASM 构建见 [docs/wasm-build.md](docs/wasm-build.md)。

```bash
# 方式 1：Python 3（无需安装 Node）
python3 -m http.server 8080

# 方式 2：Node（可选）
npx --yes serve -l 8080 .

# 方式 3：若已安装依赖
npm start
# 或
pnpm start
```

浏览器打开：

- 首页：<http://localhost:8080/>
- PC 键盘版：首页点「进入原版游戏」，或打开 <http://localhost:8080/pc.html>
- 手机触摸版：<http://localhost:8080/m.html>（直接加载原版）

## 入口页面

| 页面 | 用途 |
|------|------|
| `index.html` | 首页：选操作模式 / 分辨率 / 终端，进入游戏或存档管理 |
| `choose.html` | 兼容旧链接，自动返回原版首页 |
| `pc.html` | PC 端，键盘操作 |
| `m.html` | 横屏触控 |
| `m-ges.html` | 横屏手势 |
| `m-old.html` | 竖屏虚拟键盘 |
| `m-ktouch.html` | 竖屏键盘 + 触控 |
| `online-save.html` | 原版云存档管理（依赖 bbkgames 账号，本地可用游戏内「存储进度」） |
| `load.html` / `get-sav.html` | 导入 / 导出本地存档 |
| `loadlib.html` | 兼容旧链接，自动返回原版首页 |
| `designer.html` | 历史地图调试工具，不在普通入口展示 |
| `mapeditor/index.html` | 地图编辑器 |
| `debug.html` | 引擎调试开关 |
| `mt.html` | 附带「魔塔」 |
| `fm/`、`fmj.html` | 附带「伏魔记」相关页 |
| `v0/` | 上游早期前端快照 |

历史 Mod、附带游戏与调试资源保留供兼容和开发使用，普通游玩请从首页进入原版。旧 Mod 存档不会自动转换或重新标记为原版；切换前请先导出保留。

原版入口验证可运行 `npm run test:original-entry`；独立浏览器检查运行 `npm run test:original-entry-runtime`（需要本机 Chrome，或通过 `CHROME` 指定路径）。测试使用独立浏览器配置与临时端口。[本批验证记录](docs/validation/m4-original-entry-20261010.json)包含入口、缓存迁移和HD地图回归结果。

## 操作说明（PC）

| 电脑键盘 | 电子词典 |
|----------|----------|
| 方向键 | 上下左右 |
| 回车 | 输入 / 确认 |
| 空格或 Esc | 返回 / 取消 |
| H | 帮助 |
| S 或 F | 查找 |

移动端支持触摸滑动与点击。首页可切换「横屏触控 / 横屏手势 / 竖屏键盘 / 竖屏键盘+触控」。

推荐流程：首页 → 进入游戏 → 新君登基 → 董卓弄权 / 曹操崛起 / 赤壁之战 / 三国鼎立 → 选君主 → 大地图 → 入城。

## 本仓库包含什么

完整 baye-alpha 目录树，便于以后把引擎重编译产物直接覆盖进 `js/`：

```
css/           样式
docs/          画质脚手架、HD 大地图规格
fonts/         字体
js/            引擎与桥接
  baye.js      从 vendor/iBaye 重编的 Emscripten 加载器
  baye.wasm    与加载器配套的 WebAssembly 引擎
  baye.build.json  源码、SDK 与产物校验记录
  bridge.js    JS ↔ WASM
  lcd.js       LCD 渲染、按键、原版数据加载
  save-storage.js  本地双文件存档事务、校验与导入导出
libs/          原版数据及保留的历史 Mod（.lib）
libs.json      历史版本目录（普通入口不使用）
mapeditor/     地图编辑器
resetLibs/     重置用库
v0/            早期版本前端
LICENSE        上游 GPL-2.0
```

`js/baye.wasm` 与 `js/baye.js` 可按 [docs/wasm-build.md](docs/wasm-build.md) 从 `vendor/iBaye` 用 Emscripten 3.1.51 重编。HD 桥接字段见 [docs/wasm-hd-bridge.md](docs/wasm-hd-bridge.md)。

## 画质优化

本仓库在 `feature/hd-graphics` 上开发 PC HD 界面，保留经典模式和原版 `dat.lib` 图块。引擎桥提供真实菜单、出征、战斗和存档状态，HD 界面按引擎回执提交玩家操作。完整管线与素材约定见 [docs/hd-graphics.md](docs/hd-graphics.md)。

默认仍是经典观感（PC 显示框 480×288，邻近取样）。PC 键盘版可以整数倍放大 LCD，方便阅读：

1. 用上面的静态服务打开首页 <http://localhost:8080/>
2. （可选）把「PC 画质缩放」设为「清晰 2×」，滤镜保持「锐利」
3. 点「进入游戏」，或直接打开 `pc.html`
4. 也可在 PC 页下方画质条即时切换：
   - **经典 1× / 清晰 2×**：只改 CSS 外壳大小（480→960），键盘操作不变
   - **锐利 / 平滑**：邻近取样 vs 双线性
   - **经典外壳 / HD 外壳**：只改页面底色与边框，不改游戏像素

手机页（`m.html` 等）已经拉满视口；v1 **不**做 2×，以免挤掉触控和虚拟键命中区。回到 1× + 锐利 + 经典外壳即还原。

真·HD 大地图（1080p 现代 2D 策略图、城/地形/路/字/反馈分层、经典 LCD 可切回）的锁定规格见 [docs/hd-overworld-spec.md](docs/hd-overworld-spec.md)。`feature/hd-graphics` 上 **P0 表现壳已接线**（默认仍是经典 LCD，不强迫）。

怎么试 HD 地图：

1. 用上面的静态服务打开 <http://localhost:8080/pc.html>（直接加载原版）
2. 页下方画质条点 **HD 地图**（写入 `localStorage['baye/overworldMode']='hd-map'`）
3. 应看到 1920×1080 **摄像机窗口**（不是全国缩进一屏）+ 城标 + 路网；拖动平移可到海南 / 南海。未进大地图时是预览，经典 LCD 缩在右下角，键盘仍可开局
4. 进大地图后 LCD 隐藏。点城打开 **HD 城池四项菜单**（内政/外交/军备/状况，一层子菜单已 HD）。进入战斗后使用 **HD 战场**，移动、攻击、计谋和结算按真实引擎状态与输入回执执行。清单：[docs/hd-full-replacement-checklist.md](docs/hd-full-replacement-checklist.md)
5. 点 **经典地图** 即还原，1×/2× / 锐利 / 外壳与之前相同

素材是分支内 AI 占位包，不是步步高原作美术。不替换 `dat.lib`。用户未明确要求前不要把本分支合入 `main`。

## 从 iBaye 重新编译引擎（可选）

安装 [Emscripten SDK](https://emscripten.org/docs/getting_started/downloads.html) 3.1.51 和 CMake ≥ 3.5 后，从本仓库源码构建：

```bash
# BAYE_EMSDK_ROOT 指向已经安装 SDK 的目录
BAYE_EMSDK_ROOT=/path/to/emsdk npm run build:wasm -- --stage-only
CHROME=/usr/bin/chromium npm run test:runtime -- --staged
CHROME=/usr/bin/chromium npm run test:campaign-runtime -- --staged --scenario save
# 暂存验证通过后成套安装 JS、WASM、map 和 manifest
BAYE_EMSDK_ROOT=/path/to/emsdk npm run build:wasm
```

部署时同步更新 HTML 与加载器中的脚本和 WASM 缓存版本号。构建详情、完整场景参数与产物记录见 [docs/wasm-build.md](docs/wasm-build.md)。

## 上游与致谢

| 项目 | 地址 | 说明 |
|------|------|------|
| 前端（本仓库来源） | https://gitee.com/bgwp/baye-alpha | 完整导入；Gitee 克隆成功 |
| GitHub 镜像 | https://github.com/kvinwang/baye-alpha | 较旧（`s2`），未采用 |
| GitHub 镜像 | https://github.com/lyxverycool/sanguobaye_h5 | 带 Koa 托管的较早快照，未采用 |
| 引擎 | https://gitee.com/bgwp/iBaye | C → WASM（Emscripten），MIT |
| 在线参考 | https://www.bbkgames.com/ | 官方在线站 |
| Mod / 脚本文档 | https://bgwp.gitee.io/baye-doc/script/index.html | 脚本接口 |

原作版权归步步高 / 原厂商。移植作者包括 loongw、kvinwang、bgwp 等。交流 QQ 群：526266208。

本仓库不新增科技树、抽卡或联机玩法。云存档按钮依赖 bbkgames SDK，离线时请用游戏内「存储进度」与浏览器 localStorage / IndexedDB。

## 许可证

- 前端仓库上游声明为 **GPL-2.0**，见 [LICENSE](LICENSE)。
- 引擎 iBaye 为 **MIT**（Copyright 2015 loongw），见 [LICENSE.ENGINE](LICENSE.ENGINE)。
- 游戏数据、美术与原作内容版权归原厂商，仅供学习交流，请勿商用。

功能对照见 [FEATURES.md](FEATURES.md)。
