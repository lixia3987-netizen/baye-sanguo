# 系统界面 HD 表现壳（标题 / 时期 / 君主 / 存读档）

本文锁定 **开局与系统菜单** 的 HD 表现轨道。哲学与大地图 / 城菜单相同：**HTML/CSS 壳 + 原 baye WASM**。不改 `dat.lib`、不 stub 会替换系统菜单的 hook、不伪造存档槽。

**分支策略：只停在 `feature/hd-graphics`，用户明确要求之前不要合入 `main`。**

城菜单见 [hd-city-menu-spec.md](hd-city-menu-spec.md)。战场见 [hd-battle-spec.md](hd-battle-spec.md)。清单见 [hd-full-replacement-checklist.md](hd-full-replacement-checklist.md)。

---

## 1. 目标 / 非目标

### 目标

- 标题主菜单、选时期、选君主、存读档列表用 1080p HD 面板呈现。
- 点击只 `sendKey`；引擎仍是唯一规则源。
- 项名来自 **FEATURES.md 已核验** 的引擎字符串，或运行时从 `g_Cities.Belong` / `localStorage sango*.sav` 探测。没有的不编造。
- HD 战役偏好下（`overworldMode=hd-map` 或 `systemUiMode=hd`）这些画面自动出壳；经典路径不强迫。

### 非目标

- **不**把 `chooseGameEntry` / `loadPeriod` / `chooseActor` / `mainSystemMenu` 写成空 hook 或替换菜单（WASM 里 hook 存在就会接管系统 UI）。
- 不伪造空档位、时间戳、君主名单。
- 不开场动画重做（回车跳过，仍 LCD）。
- 不改 WASM。

---

## 2. 检测（只观察）

`baye.callHook` 包装后能看到的名字（存在才用）：

| Hook | 含义 | 可否 stub |
|------|------|-----------|
| `onMenuIdle` | 任意菜单光标 `ctx.index` | 可以空函数（已有） |
| `willCloseMenu` | 一层关掉 | 可以空函数 |
| `didOpenNewGame` / `didLoadGame` | 进入战役 | 可以空函数 |
| `chooseGameEntry` / `loadPeriod` / `chooseActor` / `mainSystemMenu` | 替换系统菜单 | **禁止 stub** |

启发式（hook 不一定会来）：

| 画面 | 判定 |
|------|------|
| 标题 | `g_PlayerKing` 无效（含 0）且城尚无归属 |
| 时期 | 刚在标题确认「新君登基」，城仍无归属 |
| 君主 | 城已有 `Belong`，但 `g_PlayerKing` 仍为 0 / 无效 |
| 读档 | 标题确认「重返沙场」 |
| 战役中系统菜单 | `menuItems()[0]==策略结束` 且 `g_hdMapPick=0` 且最近有 `onMenuIdle`（不 stub `mainSystemMenu`） |
| 关掉系统壳 | `didOpenNewGame` / `didLoadGame` / 已点策略结束 / `fight.active` / 大地图 pick=1 |

`localStorage['baye/systemUiMode']`：`auto`（默认，跟 HD 战役）/ `hd` / `classic`。

---

## 3. 已核验文案（只作标签）

| 层 | 项（index 0…） | 来源 |
|----|----------------|------|
| 标题 | 新君登基、重返沙场、制作群组、解甲归田 | FEATURES.md / 词典原版 LCD |
| 时期 | 董卓弄权、曹操崛起、赤壁之战、三国鼎立 | FEATURES.md |
| 君主 | 运行时：各城 `Belong` 去重 + `getPersonNameByID` | 不写死马腾名单 |
| 存档 | 只列出探测到的 `baye//data//sangoN.sav` | 没有就写「未探测到」，框 LCD |
| 战役系统 | 策略结束、存储进度、结束游戏 | FEATURES `MENU_FUNCSTR` |

君主点选：引擎形势图顺序未必等于 Belong 扫描序。HD 用 `onMenuIdle` `index` 对齐发键；名单只是探测展示。对不上就当对照。

### PC 原生君主选择与领城预览

原生 SYSTEM/context4、kind3 君主菜单有效时，PC 名单以当前原生高亮为准。点击另一项仅经原选择器移动光标，等原生 ACK 后更新预览；再次点击当前项、点击“开始游戏”或按 Enter 才确认。此行为与原版 `GamGetKingInner` 的触屏选择一致。其它系统菜单与移动端保留各自输入路径。

预览显示当前君主的领城数、完整城名和城市位置示意：扫描原库38城，以 `g_Cities[i].Belong === currentId + 1` 取得领城，位置直接读取同库 `g_CityPositions[i].x/y`，城名调用原版 `getCityName(i)`。不推断首都，也不使用确认前的 `g_PlayerKing`。原库身份、数据对象、菜单归属、名单和当前高亮须在读取前后保持一致；无法核实时清空预览并提示查看经典画面。

本页“经典 LCD”只切换实际原生画面的显示，不发送引擎按键；选择在同页轮询及高亮更新后保持。君主页专用布局为 LCD 留出位置，标题、返回、开关和开始按钮仍可使用。

---

## 4. 1080p 布局

`#hd-system-ui` z-index 70，盖住可能误出的大地图预览。

```
┌────────────── 980 × 640 面板 ──────────────┐
│  三国霸业 · 标题 / 时期 / 君主 / 存档      │
│  [ 大按钮或列表 ]                          │
│  [ 返回 ]  [ 经典 LCD ]                    │
└────────────────────────────────────────────┘
```

经典 LCD 默认可藏；存档空列表 / 制作群组等深层对照时露出。

制作群组的默认滚动及原有停留现在由只读MAKER原生归属单独观察。此归属有效时，旧标题表现、排队输入、choose/back及键盘确认均退休，避免子SPE退出后标题盖住仍在等待的署名页。停留的“返回标题”只向当前MAKER等待发送一次原生Enter；自然等待结束不发键。原生返回后重新读取新的标题菜单归属，从index0显示，无旧确认泄漏。模式切换立即同步SPE层并退休旧pointer token。协议与限制见[HD SPE规格](hd-spe-spec.md)，真实场景记录见[MAKER验收](validation/m4-maker-20261008.json)。

---

## 5. 成功标准

1. 规格 + `js/hd-system-ui.js` + `css/hd-system-ui.css` 入 `pc.html`。
2. HD 战役下新鲜开局能看到标题 HD；点「新君登基」到时期；再进到君主（有探测名或 LCD 对照）。
3. 「重返沙场」出存读档壳：有 `sango*.sav` 才列槽，不造假档。
4. `overworldMode=classic` 且 `systemUiMode≠hd` 不强迫。
5. 不改 WASM / `dat.lib`。


## 保存槽的年月与原版姓名（V91）

BayeSaveStorage.inspectSlot在现有完整双文件验证后返回king／period／year／month，month取sav0字节11，原范围1..12不变。UI按保存period和零基king调用BayeHdSavedRuler.read；后者只读已认证原版LIB的62／70／71／72姓名资源（每期200槽），不切时期、不读取当前人物或调用getPersonName。资源缓存仍逐次授权，未知／空项无姓名。

列表显示保存君主、时期及年月，缺月只显示年；自定义姓名hook或未知资源保留已知保存元数据。slot／provider／hook／元数据在读取中变化会撤摘要，标签不充当输入授权。PC／手机共用格式，既有三保存槽／四读取槽、原生ACK、最终可读性重查及双存档事务保持。具体检查与实际流程／真机后验边界见[V91记录](validation/m5-save-summary-20261026-v91.md)。
