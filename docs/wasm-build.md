# 从 iBaye 重编译 `baye.wasm`

本仓库在 `vendor/iBaye` 里带了一份引擎源码（MIT，上游 `62241e2`），并加了 HD 桥接导出。  
预编译产物仍放在 `js/baye.js` + `js/baye.wasm`。

## 环境

- Emscripten SDK **3.1.51**（与上游 README 一致）
- CMake ≥ 3.5
- Python 3（`src/genver.py`）
- Node ≥ 22（建议 `.nvmrc` 的 24.19.0，用于产物校验与浏览器测试）
- 当前验证的 CMake 版本为 3.31.6；旧 CMake 文件在该版本有兼容弃用提示，CMake 4 尚未验收。

```bash
git clone https://github.com/emscripten-core/emsdk.git "$HOME/emsdk"
cd "$HOME/emsdk"
./emsdk install 3.1.51
./emsdk activate 3.1.51
source ./emsdk_env.sh
```

## 一键编译并安装到本仓库 `js/`

```bash
source "$HOME/emsdk/emsdk_env.sh"
./scripts/build-wasm.sh
```

产物：

- `build/wasm/src/baye.js`
- `build/wasm/src/baye.wasm`
- 复制到 `js/baye.js` / `js/baye.wasm`（以及 `.map` 若有）
- `js/baye.build.json`：SDK、CMake、源码版本/内容 hash、菜单及 HD 输入协议与各产物 hash；当前输入协议 version 3 记录 27 个生命周期字段，包含数量会话、按键回执与原生光标；存档协议为 `0x95`

构建脚本检查 Emscripten 恰为 3.1.51，使用确定的 `build/wasm/src/` 产物路径并验证 WASM 格式。`SOURCE_DATE_EPOCH` 默认取当前 Git 提交时间，以 UTC 生成引擎版本；可显式指定。manifest 记录实际引擎源码内容 hash，包含尚未提交的修改。这里提供来源可追踪的构建，不承诺不同机器上的字节完全相同。

## 先验证暂存产物

```bash
npm run build:wasm -- --stage-only
# 浏览器回归脚本使用 build/wasm/src/ 中的 JS/WASM，不覆盖当前 js/
CHROME=/path/to/chromium npm run test:runtime -- --staged
CHROME=/path/to/chromium npm run test:battle-runtime -- --staged
# M3 分场景验证；各场景独立开局，保留 JSON、截图与输入记录
CHROME=/path/to/chromium npm run test:campaign-runtime -- --staged --scenario victory --artifact-dir build/m3-victory-staged
CHROME=/path/to/chromium npm run test:campaign-runtime -- --staged --scenario retreat --artifact-dir build/m3-retreat-staged
# 通过后从相同源码成套安装 JS、WASM、map 和 manifest
npm run build:wasm
```

`BAYE_EMSDK_ROOT` 可指向自定义 SDK 目录，`JOBS` 控制并行编译数。切换经典模式、HD 模式与新增菜单回退协议需要匹配的 JS/WASM，不能只替换一个文件。

专项回归运行 `npm test`，覆盖 16 个测试文件，包括真实 C 编译的战役与协议回归、存档事务、存读档 UI、存档页面、跨刷新输入记录、后台绘制与性能统计。用例数会随回归增加，以实际测试输出为准；专项通过不能代替真实浏览器完整胜负验收。可单独运行 `npm run test:campaign-engine`、`npm run test:engine-protocol`、`npm run test:save-transaction`、`npm run test:saveload-ui` 与 `npm run test:save-pages` 定位对应问题。

`test:runtime` 检查开局、模式、头像和数量输入，包括连续加减、边界、无数值变化的按键、取消及调整尚未完成时确认征兵；征兵使用真实按钮，核对预备兵、钱、人物队列和实际订单。`test:battle-runtime` 使用真实出征与战斗，读取引擎路径、射程及技能规则，通过玩家输入执行操作。`test:campaign-runtime` 支持 `--scenario victory|retreat|empty|campaign|domestic|save|restart`，分别覆盖胜利占城、撤退、空城占领、连续出征、内政后出征、保存刷新读取和同页重开。三个浏览器脚本均支持 `--staged` 与 `--artifact-dir`，保存截图、操作顺序和引擎快照；脚本通过玩家入口执行，不直接写胜负、城池归属或将领状态。运行场景时将 `--scenario` 后的值替换为一个场景名。完整验收结果及未完成范围以 [hd-development-plan.md](hd-development-plan.md) 为准。

胜利场景以董卓从洛阳向许昌出征，先真实征兵和配兵，再读取每将实际攻击范围规划合法站位。快速移动、关闭动画与敌军移动显示均经原生设置菜单确认。连续出征场景为一次胜利和两次显式撤退；同月 AI 来袭另记真实守城选将与守战，不能跳过来袭或强制回图。敌方回合等待以真实引擎进展计时，60 秒无进展失败，240 秒为单次总限，报告只确认匹配的当前等待。`--scenario probe` 是只读城池与军队诊断。

M3 存档 `0x95` 保留双文件槽位，保存完整 4000 字节道具队列、600 字节出征队列和 U32 自定义数据长度。读取先校验完整快照再提交；浏览器保存与导入使用 journal 保留旧完整槽，LIB 使用加载内容指纹校验。旧 `0x90`–`0x94` 仍可读取，但旧活动出征槽 `slot≥8` 缺少已保存将领数据，必须拒绝加载。协议细节见 [wasm-hd-bridge.md](wasm-hd-bridge.md)。

当前入口缓存号为 `20261007f`。修改产物时同步 HTML 的 `js/baye.js?ver=`、`Module.locateFile` 的 WASM 版本及相关脚本缓存号，成套安装 manifest 和产物；仅运行旧缓存号更新脚本并不能代替检查。`save-storage.js` 必须先于 `lcd.js` 加载，纯存档导出页不加载 LCD。

## PC 性能基线

```bash
CHROME=/path/to/chromium npm run test:performance -- --artifact-dir build/hd-performance
```

在真实 LIB/WASM 开局与数量操作检查中固定 1920×1080 内容视口、DPR 1，记录 3 秒地图 RAF 节拍与 Canvas 重绘、JS 堆和 WASM 堆容量、12 次真实鼠标点击至原生数量确认的延迟。原始样本、浏览器/主机信息、LIB 指纹、引擎 manifest、实际提供的输入与渲染源码哈希保存在 `result.json`，不是屏幕呈现 FPS 或整机总内存。输入延迟起点为可信点击事件进入按钮处理器，终点为下一帧观察到原生值及输入队列完成；不包括 OS 输入与网络传输。

工具另用只读的 4ms 观察器记录发送时间、原生回执、队列结束和最终观测帧。新协议逐键核对 session、下一个 inputSeq、lastKey 和 ready；旧协议没有原生按键回执数据，该项明确为 null，不以值变化补造。观察器本身有开销，前后版本均使用同一工具。

脚本切换到真实后台标签页，调整视口并验证没有绘制或自发输入，返回时验证恢复绘制且日期和城池归属不变。地图和战场隐藏时暂停绘制 RAF，原生状态与 ACK 轮询保留。需要对照旧版时，将同一提交的 `hd-overworld.js` 与 `hd-battle.js` 存入目录，追加 `--renderer-dir <目录>`；旧版采样仍记录后台行为，停绘断言仅对当前版本执行。对照时使用相同主机和引擎并串行运行，单次采样不构成性能提升的稳定结论。

输入对照使用 `--input-dir <目录>`，仅覆盖 `lcd.js`、`hd-city-menu.js`、`hd-dialog.js`、`bridge.js`。引擎对照使用 `--engine-dir <目录>`，目录必须含成套 `baye.js`、`baye.wasm`、`baye.wasm.map`、`baye.build.json`，与 `--staged` 互斥。脚本启动时冻结这些文件及两个渲染脚本的实际字节，检查引擎 SHA-256 和长度与 manifest 一致，避免测试期间的源码编辑改变对照版本。修改引擎时分别记录前后引擎身份，不称为相同引擎对照。

## 手工编译（诊断用途）

```bash
source "$HOME/emsdk/emsdk_env.sh"
mkdir -p build/wasm && cd build/wasm
emcmake cmake ../../vendor/iBaye
cmake --build . -j"$(nproc)"
```

输出保留在 `build/wasm/src/`。安装使用 `scripts/build-wasm.sh`，由脚本生成 manifest、校验产物，并成套复制 JS、WASM 与 map。

## 上游对照

| 项 | 值 |
|----|----|
| 源码 | `vendor/iBaye`（见 `vendor/iBaye/ATTRIBUTION.md`） |
| 上游 | https://gitee.com/bgwp/iBaye @ `62241e294f3ba3d4589d6e1205e6deb486a6c2d9` |
| 许可证 | MIT，`vendor/iBaye/LICENSE` / `LICENSE.ENGINE` |

HD 导出清单见 [wasm-hd-bridge.md](wasm-hd-bridge.md)。
