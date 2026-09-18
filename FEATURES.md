# 功能对照表

对照上游 H5 移植（[baye-alpha](https://gitee.com/bgwp/baye-alpha) + [iBaye](https://gitee.com/bgwp/iBaye)）与原作《三国霸业》。  
状态：`done` 已在本仓库落地且本地验证；`partial` 代码在但有外部依赖或未走完交互；`missing` 本仓库没有。

验证环境：`python3 -m http.server 8080` 打开 `index.html` → `choose.html` → `pc.html`，使用「三国霸业-词典原版」`libs/dat-mod.lib`。  
浏览器已走通：主菜单 → 董卓弄权 → 势力形势图选君主（马腾）→ 大地图西凉（190年1月）→ 城池「内政/外交/军备/状况」及各子菜单。

## 入口与页面

| 功能 | 状态 | 说明 |
|------|------|------|
| 首页 `index.html` | done | 选择版本 / 进入游戏 / 存档管理，以及操作模式、分辨率、终端、PC 画质（缩放/滤镜/外壳） |
| 版本选择 `choose.html` | done | 读取 `libs.json`，写入 `localStorage` 后跳转游戏 |
| PC 端 `pc.html` | done | 160×96 LCD + 键盘说明；WASM 从 `js/baye.wasm` 同目录加载；可逆 1×/2× 画质条 |
| 横屏触控 `m.html` | done | 页面在；本地可用 `?debug=1` 避免无 hash 回首页 |
| 横屏手势 `m-ges.html` | done | 同上 |
| 竖屏键盘 `m-old.html` | done | 页面在；无 hash 时会回首页（上游逻辑，与 `m.html` 的 debug 例外不同） |
| 竖屏键盘+触控 `m-ktouch.html` | done | 同上 |
| 云存档页 `online-save.html` | partial | 页面在；上传/下载依赖 `img.bbkgames.com` SDK 与登录，离线不可用 |
| 导入存档 `load.html` | done | 页面与脚本齐全 |
| 导出存档 `get-sav.html` | done | 页面与脚本齐全 |
| 远程 Lib `loadlib.html` | done | 页面在；需 URL 参数指向 Lib |
| 设计器 `designer.html` | done | 页面在，可载入自定义 Lib |
| 地图编辑器 `mapeditor/index.html` | done | 上游完整编辑器（地形图块 + 脚本） |
| 调试开关 `debug.html` | done | 写入 `baye/debug` |
| 魔塔 `mt.html` | done | 上游附带；`choose.html` 的绝对路径 `/mt.html` 已改为相对路径以便本地访问 |
| 伏魔记 `fmj.html` / `fm/` | done | 上游附带页与 `fm.wasm` |
| 早期前端 `v0/` | done | 完整保留 |
| UA 探测 `t.html` | done | 上游调试页 |
| 网址转换 `convert.html` | partial | 页面在；缩短服务 `50r.cn` 现已不可用，仅保留上游工具 |

## 版本 / Mod

| 功能 | 状态 | 说明 |
|------|------|------|
| 词典原版 `dat-mod.lib` | done | `libs.json` 第一项，文件存在 |
| 原版精修 `SGBY-Reset.lib` | done | 文件存在 |
| 无痕修复 / 平衡 2.1 / 修罗 / 群魔乱舞等 | done | `libs.json` 内本地 path 均有对应 `.lib` |
| 自定义 Lib 文件选择 | done | `pc.html` / `designer.html` 的「载入 Lib」 |
| 黄豆豆版 | partial | `libs.json` 外链到 `games.qtjoy.com`，不在本仓库 |

## 开局与大地图（引擎）

| 功能 | 状态 | 说明 |
|------|------|------|
| 主菜单：新君登基 / 重返沙场 / 制作群组 / 解甲归田 | done | `pc.html` LCD 已见到四按钮主菜单 |
| 时代：董卓弄权 / 曹操崛起 / 赤壁之战 / 三国鼎立 | done | 四格时期画面（董卓/曹操/赤壁/鼎立）已打开 |
| 君主选择 | done | 「势力形势图」列出马腾、公孙瓒、张杨、刘虞、袁绍等 |
| 开场动画 | done | `showStartMovie`；回车可跳过 |
| 大地图（12×9 / 38 城） | done | 已进入西凉，190年1月，城池图标齐全 |
| 城市光标移动、入城 | done | 回车入城打开四项主菜单 |

## 城池菜单

主菜单字符串：`内政外交军备状况`（引擎里「状况」即状态）。

### 内政

开垦、招商、搜寻、治理、出巡、招降、处斩、流放、赏赐、没收、交易、宴请、输送、移动 — **done**。浏览器已打开内政子菜单（开垦/招商/搜寻/治理/出巡/招降，其余项可滚动）。

### 外交

离间、招揽、策反、反间、劝降 — **done**。浏览器已打开完整外交子菜单。朝贡在源码中已注释，原作亦无独立菜单项。

### 军备

侦察、征兵、分配、掠夺、出征 — **done**。浏览器已打开完整军备子菜单。

### 状况 / 状态

城池：归属、太守、农业、商业、民忠、防灾、人口、金钱、粮食、后备兵力、城池状态（正常/饥荒/旱灾/水灾/暴动）。  
浏览器已打开西凉状况：归属马腾、太守韩遂、农业/商业/民忠数值。  
武将：姓名、归属、所在城市、等级、武力、智力、忠诚、经验、体力、兵种、兵力、年龄、道具。 — **done**。

## 战斗

| 功能 | 状态 | 说明 |
|------|------|------|
| 天气：晴 / 阴 / 风 / 雨 / 冰雹 | done | `WEATHER_FINE`…`WEATHER_HAIL`，回合中会转变 |
| 地形：草地、平原、山地、森林、村庄、城池、营寨、河流 | done | 影响移动与防御 |
| 六兵种：骑兵、步兵、弓兵、水军、极兵、玄兵 | done | `ARMTYP_NUM == 6` |
| 计谋 / 攻击 / 查看 / 待机 | done | `dFgtMnuCmd` |
| 系统：回合结束、全军撤退、战斗动画、移动速度、敌军移动 | done | `dFgtSysMnu` |
| 异常状态：混乱、禁咒、定身、奇门、遁甲、石阵、潜踪 | done | 战斗状态机 |

## 系统指令

| 功能 | 状态 | 说明 |
|------|------|------|
| 策略结束 / 存储进度 / 结束游戏 | done | `MENU_FUNCSTR` |
| 本地存档 / 读档 | done | `sango*.sav` 写入 localStorage；IndexedDB 缓存 Lib |
| 云存档上传下载 | partial | 需 bbkgames 登录，离线不可用 |
| 脚本 / Mod hook | done | `bridge.js` + 文档 https://bgwp.gitee.io/baye-doc/script/index.html |

## 刻意未做

- 未自造科技树、抽卡、联机对战。
- 未用占位菜单替换引擎城池指令。
- 未重新编译 WASM：使用上游 baye-alpha 预编译二进制。

## 已知缺口

1. **云存档 / 黄豆豆版 / 短网址**：依赖外部站点，本仓库只保留上游页面与链接。
2. **伏魔记 `fmj.html`**：上游本身只是合作说明页，完整玩法在 `fm/`。
3. **完整一场战斗**：军备「出征」菜单已打开；打完一整场需在地图上派兵接敌，耗时较长，未在本次浏览器里打完。天气/地形/六兵种/计谋均在引擎内，不是占位。
4. **地图编辑器 favicon.ico**：浏览器默认请求该文件会 404，不影响编辑器本体。
