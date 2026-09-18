# 上游来源

本仓库前端树完整导入自 Gitee：

- 仓库：https://gitee.com/bgwp/baye-alpha
- 提交：`5d19e8fd5828547cfd6dc310e3c6d27429d37de9`（2026-09-02，`update libs/balance2.01.lib.about.`）

Gitee 克隆成功，因此没有改用 GitHub 镜像。对照过的镜像：

- https://github.com/kvinwang/baye-alpha （默认分支 `s2`，较早，文件更少）
- https://github.com/lyxverycool/sanguobaye_h5 （Koa 静态托管的较早快照，无 `baye.wasm`）

引擎源码（未整树导入，仅保留许可证与重编译说明）：

- https://gitee.com/bgwp/iBaye
- 提交：`62241e294f3ba3d4589d6e1205e6deb486a6c2d9`（2026-03-17）

预编译 `js/baye.js`、`js/baye.wasm`、`js/baye.wasm.map` 来自上述 baye-alpha 提交，不是本仓库现场用 Emscripten 编出来的。
