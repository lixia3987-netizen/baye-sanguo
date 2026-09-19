# HD WASM 桥接

薄导出，不改战斗 AI / `dat.lib` 图块。HD 壳读这些字段，经典 LCD 路径不变。

## `baye.data` 新字段

| 字段 | 类型 | 含义 |
|------|------|------|
| `g_hdReportGbk` | GBK 字符串 | 最近一次 `GamMsgBox` / `ShowGReport` 正文 |
| `g_hdReportPerson` | u16 | 报告武将 PersonID；消息框为 `0xffff` |
| `g_hdReportKind` | u16 | `1` 消息框 · `2` 武将报告 |
| `g_hdReportSeq` | u16 | 每次写入 +1，供 JS 侦测新报告 |
| `g_hdKingCount` | u16 | `GetAllKings` 之后的可选君主数 |
| `g_hdKingIds` | u16[128] | 0-based PersonID |
| `g_hdKingNames` | GBK | 8 字节槽拼接（优先用 `getPersonName(id)`） |
| `g_hdKingIndex` | u16 | 形势图当前高亮下标 |
| `g_hdKingId` | u16 | 当前高亮 PersonID |
| `g_hdMenuGbk` | GBK | 当前菜单打包串 |
| `g_hdMenuBytes` | u8[] | 同上原始字节，按 `itemLen` 切片 |
| `g_hdMenuItemLen` | u16 | 每项字节宽 |
| `g_hdMenuCount` | u16 | 项数 |
| `g_hdMenuIndex` | u16 | 当前高亮 |
| `g_hdFightActive` | u8 | `enterBattle` 后为 1 |
| `g_hdFightOver` | u8 | 镜像 `g_FgtOver`（`exitBattle` 时写入） |

原有 `g_FightMap` / `g_GenPos` / `g_FgtParam.GenArray` / `g_FgtOver` 仍可用。

## C 导出

`EMSCRIPTEN_KEEPALIVE`：

- `bayeHdGetReport()` → `U8*`
- `bayeHdGetReportSeq()` → `U16`
- `bayeHdGetKingCount()` → `U16`

写入点：

- `GamMsgBox` / `ShowGReport` → report
- `GetAllKings` 之后（`gamEng.c`）→ king roster（不替换 `chooseActor`）
- `GamGetKing` 高亮刷新 → king highlight
- `PlcSplMenu` idle → menu items（`onMenuIdle` 额外绑定 `itemLen` / `itemCount`）
- `GamFight` `enterBattle` / `exitBattle` → fight flags

## JS 助手（`js/bridge.js`）

```js
baye.hd.report()     // { text, seq, kind, person }
baye.hd.kings()      // { count, index, currentId, kings:[{id,name}] }
baye.hd.menuItems()  // { itemLen, count, index, names:[] }
```

## 按键

词典原键没有 0–9。本分支把 **PC 数字键** 映射成 `VK_DIGIT0=0x40` … `0x49`，`NumOperate` 改当前数位。  
`0x30–0x33` 仍是 INSERT/DEL/MODIFY/SEARCH，不能占用。

## 已有、未 stub 的 hook

HD **只观察**，不往 `baye.hooks` 里登记会替换系统菜单的名字：

- `willChooseActor` / `choosingActorUpdate`（有登记才会进 IF_HAS_HOOK）
- `enterBattle` / `exitBattle` / `battleStage1`…
- `onMenuIdle`（现在带 `itemLen`/`itemCount`）

名单即使没有 hook 也会写入 `g_hd*`。
