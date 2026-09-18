# 三国霸业 H5

步步高电子词典经典游戏《三国霸业》的完整浏览器移植。本仓库导入了上游 [baye-alpha](https://gitee.com/bgwp/baye-alpha) 的全部前端页面、资源、Mod 数据与预编译 WebAssembly 引擎，不是精简 Demo。

在浏览器里按原作流程游玩：选时代 → 选君主 → 大地图 → 城池菜单（内政 / 外交 / 军备 / 状况）→ 战斗。

## 如何本地运行

不要直接双击 HTML。WASM 与跨域限制要求用本地 HTTP 服务。

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
- PC 键盘版：先到首页「选择版本」，再点「进入游戏」，或打开 <http://localhost:8080/pc.html>
- 手机触摸版：<http://localhost:8080/m.html>（需先选版本；本地可用 `m.html?debug=1` 跳过回首页检查）

## 入口页面

| 页面 | 用途 |
|------|------|
| `index.html` | 首页：选操作模式 / 分辨率 / 终端，进入游戏或存档管理 |
| `choose.html` | 选择游戏版本（词典原版、原版精修、平衡版、群魔乱舞等） |
| `pc.html` | PC 端，键盘操作 |
| `m.html` | 横屏触控 |
| `m-ges.html` | 横屏手势 |
| `m-old.html` | 竖屏虚拟键盘 |
| `m-ktouch.html` | 竖屏键盘 + 触控 |
| `online-save.html` | 云存档管理（依赖 bbkgames 账号，本地可用游戏内「存储进度」） |
| `load.html` / `get-sav.html` | 导入 / 导出本地存档 |
| `loadlib.html` / `designer.html` | 载入自定义 Lib、调试设计器 |
| `mapeditor/index.html` | 地图编辑器 |
| `debug.html` | 引擎调试开关 |
| `mt.html` | 附带「魔塔」 |
| `fm/`、`fmj.html` | 附带「伏魔记」相关页 |
| `v0/` | 上游早期前端快照 |

## 操作说明（PC）

| 电脑键盘 | 电子词典 |
|----------|----------|
| 方向键 | 上下左右 |
| 回车 | 输入 / 确认 |
| 空格或 Esc | 返回 / 取消 |
| H | 帮助 |
| S 或 F | 查找 |

移动端支持触摸滑动与点击。首页可切换「横屏触控 / 横屏手势 / 竖屏键盘 / 竖屏键盘+触控」。

推荐流程：首页 → 选择版本（例如「三国霸业-词典原版」或「三国霸业-原版精修」）→ 进入游戏 → 新君登基 → 董卓弄权 / 曹操崛起 / 赤壁之战 / 三国鼎立 → 选君主 → 大地图 → 入城。

## 本仓库包含什么

完整 baye-alpha 目录树，便于以后把引擎重编译产物直接覆盖进 `js/`：

```
css/           样式
docs/          画质等说明
fonts/         字体
js/            引擎与桥接
  baye.js      Emscripten 加载器（来自上游预编译）
  baye.wasm    WebAssembly 引擎（来自上游预编译）
  bridge.js    JS ↔ WASM
  lcd.js       LCD 渲染、按键、Lib 选择
libs/          游戏数据 / Mod（.lib）
libs.json      版本列表
mapeditor/     地图编辑器
resetLibs/     重置用库
v0/            早期版本前端
LICENSE        上游 GPL-2.0
```

`js/baye.wasm`（约 4MB）与 `js/baye.js` 直接取自 Gitee 上游仓库 [bgwp/baye-alpha](https://gitee.com/bgwp/baye-alpha) 提交 `5d19e8f`（2026-09-02），**未在本仓库重新用 Emscripten 编译**。该预编译产物可正常加载，无需本机安装 emsdk。

## 画质优化

本仓库在 `feature/hd-graphics` 上准备了**可逆的画质脚手架**，不换 `dat.lib` 图块、不改 WASM 引擎。完整管线、后续步骤与「不要做什么」见 [docs/hd-graphics.md](docs/hd-graphics.md)。

默认仍是经典观感（PC 显示框 480×288，邻近取样）。PC 键盘版可以整数倍放大 LCD，方便阅读：

1. 用上面的静态服务打开首页 <http://localhost:8080/>
2. （可选）把「PC 画质缩放」设为「清晰 2×」，滤镜保持「锐利」
3. 选择版本后进入游戏，或直接打开 `pc.html`
4. 也可在 PC 页下方画质条即时切换：
   - **经典 1× / 清晰 2×**：只改 CSS 外壳大小（480→960），键盘操作不变
   - **锐利 / 平滑**：邻近取样 vs 双线性
   - **经典外壳 / HD 外壳**：只改页面底色与边框，不改游戏像素

手机页（`m.html` 等）已经拉满视口；v1 **不**做 2×，以免挤掉触控和虚拟键命中区。回到 1× + 锐利 + 经典外壳即还原。

## 从 iBaye 重新编译引擎（可选）

需要时再装 [Emscripten SDK](https://emscripten.org/docs/getting_started/downloads.html) ≥ 3.1.51 和 CMake ≥ 3.5：

```bash
git clone https://github.com/emscripten-core/emsdk.git
cd emsdk
./emsdk install 3.1.51
./emsdk activate 3.1.51
source ./emsdk_env.sh

git clone https://gitee.com/bgwp/iBaye.git
cd iBaye
mkdir -p js/baye-engine && cd js/baye-engine
emcmake cmake ../..
make -j$(nproc)

cp src/baye.js src/baye.wasm src/baye.wasm.map  <本仓库>/js/
```

部署后如遇浏览器缓存，可改各 HTML 里 `baye.js?ver=` 的版本号，或运行 `python3 updatejsversion.py`。

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
