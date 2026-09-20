# HD 报告 / 数量 / 帮助壳

哲学与其它 HD 壳相同：**只发 sendKey，不改 WASM / `dat.lib`，不 stub 会替换系统 UI 的 hook**。

**分支：`feature/hd-graphics`，不合 `main`。**

---

## 目标

- 引擎弹出报告 / 对话 / 帮助时，用 1080p 面板展示**读到的**文本；读不到就框经典 LCD，不编造台词。
- 征兵 / 输送等数量输入：HD 步进器发 UP/DOWN/LEFT/RIGHT/ENTER。电子词典没有 0–9 键码，不假装能打数字。
- `g_asyncActionID` 1/2 = 脚本 alert/say 文本；9 = `getNumber` 的 min/max；13 = sysMessage。原生引擎对话框常常 **ID=0**，此时只做铬框。

## 非目标

- 不 stub `showMainHelp`。
- 不 OCR LCD。
- 不写死假粮饷。

## 文件

`js/hd-dialog.js` · `css/hd-dialog.css` · 城菜单 M3 数量区复用同一套键。

出征 `ShowGReport`「选择目标」后引擎进入 `GetCitySet`（`g_hdMapPick=1`），桥里的 `g_hdReportGbk` **不会清空**。HD 报告壳若继续全屏 `pointer-events`，会挡住大地图和邻城列表。GetCitySet 期间关闭/不拦截该提示；点城仍走 `setx/sety`。

`ShowConstStrMsg`「部队已出发」第一次（引擎卡住、`pick=0`）发一次回车关掉；之后只是残留文本。全屏壳在 `pick=0`、城菜单开着、策略结束交接、`全军撤退` / `fight` 未激活时都必须关掉，且 `data-baye-dialog-pass=1` 不拦截招商/开垦。残留期间不再回车，避免打进 FunctionMenu 或战场。
