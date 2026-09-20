# 功能对照表

对照上游 H5 移植（[baye-alpha](https://gitee.com/bgwp/baye-alpha) + [iBaye](https://gitee.com/bgwp/iBaye)）与原作《三国霸业》。  
状态：`done` 已在本仓库落地且本地验证；`partial` 代码在但有外部依赖或未走完交互；`missing` 本仓库没有。

验证环境：`python3 -m http.server 8080` 打开 `index.html` → `choose.html` → `pc.html`，使用「三国霸业-词典原版」`libs/dat-mod.lib`。  
浏览器已走通：主菜单 → 董卓弄权 → 势力形势图选君主（马腾）→ 大地图西凉（190年1月）→ 城池「内政/外交/军备/状况」及各子菜单。

## 入口与页面

| 功能 | 状态 | 说明 |
|------|------|------|
| 首页 `index.html` | done | 选择版本 / 进入游戏 / 存档管理，以及操作模式、分辨率、终端、PC 画质（缩放/滤镜/外壳）与大地图模式 |
| 版本选择 `choose.html` | done | 读取 `libs.json`，写入 `localStorage` 后跳转游戏 |
| PC 端 `pc.html` | done | 160×96 LCD + 键盘说明；WASM 从 `js/baye.wasm` 同目录加载；可逆 1×/2× 画质条；可选 HD 大地图壳 |
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
| 开场动画 | done | `showStartMovie`；HD「跳过」钉在 SPE 画布之上可点；回车 / 空格 / Esc 同样关掉；结束后 overlay 不再挡地图 |
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

## HD 大地图表现壳（P0–P3）

规格：[docs/hd-overworld-spec.md](docs/hd-overworld-spec.md)。只停在 `feature/hd-graphics`，不合 `main`。

| 功能 | 状态 | 说明 |
|------|------|------|
| `classic` / `hd-map` 切换 | done | `localStorage['baye/overworldMode']`，默认 `classic`。首页下拉 + `pc.html` 画质条「经典地图 / HD 地图」 |
| 1080p 容器 `#hd-overworld` | done | Canvas 2D，设计 1920×1080，窗口内 `contain`；DPR≤2 提高清 backing store |
| 地形合成 | done | Wikimedia China LCC 全图（无国界，CC BY-SA 4.0）+ 南海垫高 3840×4000，含海南/南沙。1080p 摄像机可拖动，四边硬夹在可玩矩形内。开局对准中东部。城标 `china-lcc-cities.json` |
| 城标四态 / 势力色 | done | empty / owned / neutral / selected 用 `cities/marker_*.png`；空城 Belong 0；己方 `Belong === g_PlayerKing+1`；他方按 `palette/factions.json` 色环 |
| 城名标签 | done | `baye.getCityName(i)`，20px 暗底+描边，重叠时下移避让 |
| 点击入城 | partial | 走格只认 `setx/sety`。点己方城：拖动阈值 10px，松手当点城。`g_hdMapPick` 过图与出征共用：开局 PlayerTactic 常年 pick=1，不当作出征；关菜单只在城池 OrderMenu 发 EXIT，避免掉进「策略结束」。只在 HD 出征向导 /「选择目标」里点城当目标。他方城不回车 |
| 悬停 / 选中 | done | P3：悬停亮环 + 城名金色加粗；选中 `marker_selected` + rAF 脉动。不用 hover 光标图 |
| 年月 HUD | done | 词典原版读到 `g_YearDate=190` `g_MonthDate=1`，HUD「190年1月 · 张杨」。字段对不上仍显示「年月未探测到」 |
| 地图期藏 LCD / 菜单期弹出 | partial | 启发式：`g_PlayerKing` 已设且城有归属 → 地图；菜单期默认 HD 四项面板（`docs/hd-city-menu-spec.md`），可强制经典 LCD |
| HD 城池四项菜单 M0–M3 | done | 根+一层+状况+人物/城/数量。标题跟本次入城（点中/落地城），不沿用上场「西凉」。出征向导钉死：选将 → 选粮 → 选择目标 → 点目标城，不因残留「选择目标」/换城/过月策略结束回到将领表。过月残留人物台词（「我虽不愿如此…」）出征时关壳，不回车进 FunctionMenu；leftover pick 不挡住「完成选将」/GetFood。面板标明当前步骤。BattleMake 期间除一次「完成选将」外不发 EXIT；「部队已出发」大横幅。`cityPersons` 跳过队列空槽 `0xffff`，不再 `getPersonName(65535)`。GetCitySet 返回后的真「部队已出发」必须回车放行 AddFightOrder，选将残留横幅才不回车。第 4 步邻城表只在引擎 `GetCitySet`（`pick=1` 且本趟已选粮）才刷 CITY_LINKR；UI 步骤4 ≠ `pick=1` 时拒绝河内确认，向导拉回引擎 phase，粮草确认会 ENTER GetFood / 「选择目标」直到 `pick=1`。点邻城或「确认出征」会等到 `g_hdMapCity` 对上再 ENTER，残留「选择目标」在选粮前不回车（避免跳过 GetFood）。活 GetFood（min≥1）不当 leftover 清掉。引擎拒绝（我方城池/无法到达）写提示并重试。征兵 leftover `g_hdQtyActive` 在选将阶段清掉。`step4Trace` 记 walk/ENTER 空操作原因。横幅后「策略结束」单飞：面板不关，状态写「正在退出城池… / 等待策略结束菜单… / 正在确认… / 即将开战…」。最多 EXIT 6 / ENTER 2 / 10 秒。真 FunctionMenu 只 EXIT 一次出城，之后只等/回车，不再 EXIT 以免退回大地图。`march.seq` 只在 `fight.active=1` 才消耗；连点是空操作 |
| HD 桥接越界防护 | done | 52c049c 把 `ResLoadToMem` 写成按 4KB 截断，第一帧菜单串会把最长 4KB 灌进 32 字节栈缓冲，进游戏立刻 OOB，`lastHdCall` 还是空。现拒绝 `rlen>1024`、人名仍 32 字节封顶；`Module.locateFile` 给 `baye.wasm` 加 `?ver=` 防旧胶水配新 wasm。`<head>` 最先装 onerror，alert 必带 lastHdCall/stack。`getCityName` / 邻城链接按 `citiesCount` 封顶，拒绝 `>=count` / `0xffff` / 负数；C `GetResItem` `fseek` 失败即停，`rom_fread` 防 `cur>length` 下溢。资源号 `20260920v`；`pc.html`/`choose.html` `Cache-Control: no-store`；页角 `#baye-build-badge` 显示 `BAYE_ASSET_VER`，以角标为准勿认缓存旧胶水 |
| HD 系统界面 | done | 标题/时期/君主/存档。战役中 `menuItems()[0]==策略结束` 才出 FunctionMenu，不 stub `mainSystemMenu` |
| HD 报告 / 数量 / 帮助 | partial | `js/hd-dialog.js`：有文本则显示。数量壳「确认」/回车必提交并关层，Esc 取消；`g_hdQtyActive` 残留（含征兵后出征）不挡 GetCitySet。出征「选择目标」在选粮前 / `g_hdMapPick=1` 时只关壳不回车；「部队已出发」只回车一次，残留壳在 pick=0 / 策略结束 / 战斗后关掉，不挡招商。过月残留台词 / 农业开发度 / 天灾在出征向导里只关壳，完成选将后不再回车（回车等于策略结束） |
| HD 战场 B0/B1 | partial | `js/hd-battle.js`：fight hook / `g_FgtParam` 检测；有 `g_GenPos` 则画单位。新 `GamFight` / 策略结束清 `g_hdFightOver`/`active`/`wait`/`resultDismissed`，第二场不沿用上场覆没。覆没后残留 `g_hdMarchOk` / 「部队已出发」不当新出征；只认本次 `AddFightOrder`（`g_hdMarchSeq`）。引擎若空城/已占/无将则 `g_hdFightSkip` 跳过战场（不是 HD 挡战）。战场系统须本场见过选将 + 新鲜 `onMenuIdle` + `wait=0`；系统菜单等 `wait=1` 再 EXIT。结算后关壳，不挡招商 |
| 经典 1×/2× 无回归 | done | 默认经典路径不改 LCD 几何；2× 仍只作用于经典 LCD |
| 道路 / 关隘 | partial | 画面路网按 LCC 城标近邻（HD 像素距离）；入城 BFS 仍用引擎格邻接。关隘仍是河叠加启发式 |
| 可达邻接高亮 | done | 焦点城（选中 / 引擎光标 / 猜测）的 P2 邻边加亮金线；不另建图 |
| 入城闪白 | done | 点城后 150ms 白闪+缩放，再走 P1 对齐/ENTER |
| 自定义光标 | skipped | `ui/cursor.png` 会与系统指针叠影；`cursor_hover.png` 像禁止符。Canvas 用 `cursor:pointer` |
| 手机页 HD 地图 | missing | 非 P0 |

## 刻意未做

- 未自造科技树、抽卡、联机对战。
- 未用假数值替换引擎城池指令；HD 菜单只是按键壳。
- WASM 已按 [docs/wasm-build.md](docs/wasm-build.md) 从 `vendor/iBaye` 重编（OOB 守卫）；经典路径仍不改 AI。

## 已知缺口

1. **云存档 / 黄豆豆版 / 短网址**：依赖外部站点，本仓库只保留上游页面与链接。
2. **伏魔记 `fmj.html`**：上游本身只是合作说明页，完整玩法在 `fm/`。
3. **完整一场战斗**：天水（己方、有将、粮>0）→军备→出征→点将→完成选将→粮草→地图点邻城河内→「部队已出发」(`march.ok=1`)→策略结束。本引擎 `PolicyExec` 立刻执行队列（不按 `TimeCount` 等月），应进入 `GamFight`。`全军撤退` 是战场系统菜单，不是出征失败。
4. **地图编辑器 favicon.ico**：浏览器默认请求该文件会 404，不影响编辑器本体。
5. **HD 大地图 P1–P3**：四态/城名/年月/路网/悬停闪已接线。跨城只走引擎格（`setx/sety`），不走 china-lcc 像素。点天水曾因残留光标/视口字段/卡格 EXIT 对不齐而 `menu-timeout`；现已等格落地再 ENTER。其它 lib / 引擎不在大地图时仍可能失败。
