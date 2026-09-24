# 从 iBaye 重编译 `baye.wasm`

本仓库在 `vendor/iBaye` 里带了一份引擎源码（MIT，上游 `62241e2`），并加了 HD 桥接导出。  
预编译产物仍放在 `js/baye.js` + `js/baye.wasm`。

## 环境

- Emscripten SDK **3.1.51**（与上游 README 一致）
- CMake ≥ 3.5
- Python 3（`src/genver.py`）

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

改完 HTML 里的 `js/baye.js?ver=`（或跑 `python3 updatejsversion.py`）以免浏览器吃缓存。

## 手工步骤（等同脚本）

```bash
source "$HOME/emsdk/emsdk_env.sh"
mkdir -p build/wasm && cd build/wasm
emcmake cmake ../../vendor/iBaye
cmake --build . -j"$(nproc)"
cp src/baye.js src/baye.wasm ../../js/
```

## 上游对照

| 项 | 值 |
|----|----|
| 源码 | `vendor/iBaye`（见 `vendor/iBaye/ATTRIBUTION.md`） |
| 上游 | https://gitee.com/bgwp/iBaye @ `62241e294f3ba3d4589d6e1205e6deb486a6c2d9` |
| 许可证 | MIT，`vendor/iBaye/LICENSE` / `LICENSE.ENGINE` |

HD 导出清单见 [wasm-hd-bridge.md](wasm-hd-bridge.md)。
