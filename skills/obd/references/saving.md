# 保存工具与边界

`obd_save` 封装本 skill 自带的 `scripts/wiki_save.py` 和 `scripts/vault_io.js`，复用原 wiki-save 的实现。Python 仅使用标准库，Obsidian CLI 通过固定的 eval 模板调用原生 Vault API。正文以 UTF-8 base64 数据传递；本地文件只用于候选和恢复快照。

## 输入

| action | 必需参数 | 作用 |
| --- | --- | --- |
| snapshot | path、snapshotFile | 读取原始正文并创建新的本地恢复快照 |
| create | path、contentFile | 新建笔记，路径已存在时停止 |
| update | snapshotFile、contentFile | 以快照为基线比较并修订 |

本地文件使用绝对路径，候选使用写入工具生成，避免 shell 插值。候选保留 frontmatter、BOM、换行、字面反斜杠及正文 Unicode 形式。父笔记目录须已存在。

工具在 resolve、snapshot、create 中明确传入用户指定或 JSON 配置的 vault；update 使用快照内的 vault。脚本独立使用时同样需要 `--vault`，仅 update 可从快照读取目标。

快照包含 `version`、`vault`、`vault_path`、`path`、`content`，以独占创建和 `0600` 权限保存。原始正文可能含私有内容，快照应保留在本地恢复位置并避免提交或公开。

## 写入保证

- 名称从 `vaults verbose` 精确匹配，并以 `vault info=path` 核对实际路径；重名或不匹配时停止。
- 路径拒绝隐藏段、空段、绝对路径、反斜杠、控制字符、非 NFC 形式，以及 Obsidian 会转换为空格的 U+00A0 和 U+202F。先确认精确目标再更改路径。
- 修订在 `app.vault.process` 同步回调内比较全文，检测快照之后的修改；原始读取使用 adapter，保持 BOM 与回调表示一致。
- 写入后读取精确路径并比较完整正文。冲突、新建重名、目标身份不符、API 缺失时停止。
- 中断或缺失结果时写入状态可能未知；回读失败也可能已有内容落盘。保留快照和候选，检查后再决定处理方式。

这些保证针对单页，整批操作仍遵循库内锁、保护、链接验收和发布协议。跨页事务不在工具保证内。

## 验证范围

随包测试在内存 Obsidian API 模型中运行实际 JavaScript 模板，覆盖并发冲突、重名、路径归一化、BOM、正文转义和回读失败。模型继承自原 wiki-save，依据其对 Obsidian 1.13.7 的路径归一化及原始读取行为的核查。模型验证与真实应用集成验证分别报告。
