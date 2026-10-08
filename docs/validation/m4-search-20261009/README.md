# 搜寻人物列表 HD 验收

[专项记录](../m4-search-20261009.json)与[runtime-index.json](runtime-index.json)记录每个原始文件的路径、字节数和 SHA256。raw 为原字节 gzip，screenshots 为原 PNG；本批实际运行目录的全部 PNG 都已收录。

只读预检、旧判据诊断和 Node/VM 回归分别保存，不算实际游戏运行。compiledRevision 和 engineSourceModified 保持安装引擎原始来源。后续独立归档/实机审计写在本目录，其审计文件不会被追溯加入先前索引。

[人物编号纠正说明](gameplay-id-clarification.json)保留原始审计并澄清其遗留标签：实际人物编号、菜单、报告与订单均为零基110；原记录nativeId=111仅是一基展示号。该说明在索引生成后保存。

[独立归档校验](archive-audit.json)核对158项原始文件与全部21张实际PNG；该校验在索引生成后保存，旧索引和原始结果保持原字节。
