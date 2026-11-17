# 多数据库 MCP 插件

独立的 MySQL 查询插件，内部使用 LangChain `SQLDatabase`。Dingent 现有助手负责生成 SQL、选择工具及回答；插件不创建第二个模型或 Agent。

默认提供 `books_list_tables`、`books_get_schema`、`books_query` 和对应的 `orders_*` 工具。两组工具分别绑定独立的主机、端口、账号、密码及数据库，没有跨数据源的连接配置回退。

## 安装与配置

源码在 `examples/plugins/multi_database`。将插件文件复制到实际数据目录（当前为 `D:\DingentData\plugins\multi-database`），不要复制 `.venv`。

```powershell
uv sync --project D:\DingentData\plugins\multi-database --locked --no-dev
```

将 `.env.example` 复制为 `.env`，填写两组连接信息。`.env` 不提交到仓库。使用 `URL.create()` 构造连接，密码中的 `@`、`:`、`$` 无需 URL 编码，也不会做 dotenv 插值。同名进程环境变量优先于插件 `.env`。

```dotenv
DATABASES=books,orders

BOOKS_DB_HOST=图书库服务器地址
BOOKS_DB_PORT=3306
BOOKS_DB_USER=图书库只读账号
BOOKS_DB_PASSWORD=图书库密码
BOOKS_DB_NAME=图书库名称
BOOKS_DB_DESCRIPTION=图书信息、价格、版本和库存
BOOKS_DB_TABLES=book,inventory

ORDERS_DB_HOST=订单库服务器地址
ORDERS_DB_PORT=3306
ORDERS_DB_USER=订单库只读账号
ORDERS_DB_PASSWORD=订单库密码
ORDERS_DB_NAME=订单库名称
ORDERS_DB_DESCRIPTION=订单、付款状态和订单金额
ORDERS_DB_TABLES=orders,payments
```

表名仅为示例，请按实际表名填写。`*_DB_TABLES` 留空表示允许该账号可见的所有表/视图；填写后同时限制表结构工具与 SQL 查询中的物理表。插件按需连接，启动及列出工具时不访问数据库。一个库未配置或连接失败，不影响另一个库使用。工具错误不会回传原始连接异常中的账号、地址或 SQL 字面量。

修改 `.env` 后重启 Dingent 后端，在工作流实际使用的助手中添加“多数据库查询”并启用相应工具。插件仅提供配置中列出的数据源；给助手启用此插件意味着允许该助手使用这些数据源。不同权限范围应部署为不同插件实例并分别授权。

修改 `DATABASES` 可以改变工具前缀或增加数据库，例如 `DATABASES=atlas,methbank`，相应配置改用 `ATLAS_DB_*` 和 `METHBANK_DB_*`。标识符只能包含小写字母、数字、下划线，且以字母开头。

## 助手提示词示例

```text
你是业务查询助手。必须使用工具中的实际数据回答，不得编造记录。
books_* 用于图书信息、价格、版本和库存。
orders_* 用于订单、付款状态和订单金额。
先调用对应的 list_tables，再用 get_schema 确认字段，最后执行 query。
涉及两个库时分别查询，按明确的业务关联字段汇总；不确定关联关系时先向用户澄清。
query 返回 truncated=true 表示结果不完整，不可将已返回行数当成总记录数；统计数量应使用 COUNT(*)。
仅查询当前问题需要的列，优先使用聚合，避免 SELECT *。
需要向用户展示明细时使用 show_table=true；辅助查询使用 show_table=false。
```

## 查询和展示约定

- 每个数据源提供独立的列表、结构和查询工具，不接受用户提供的任意连接 URI。
- 仅接受单条 SELECT，包括只读 CTE/UNION；拒绝 DML/DDL、跨库表引用、文件输出、锁及已知的等待/文件读取函数。
- 必须使用数据库端只读账号，并由数据库授权限制库、表、视图和函数。SQL 解析检查是额外约束，不代替数据库授权。
- 目标为支持 `MAX_EXECUTION_TIME` 的 MySQL 5.7+/8.x。MariaDB 不属于本插件当前验证范围。
- `QUERY_TIMEOUT_SECONDS` 默认 10 秒（1～120），同时设置连接、驱动读写、连接池等待和 MySQL SELECT 执行超时。
- `MAX_RESULT_ROWS` 默认 100（1～1000），查询最多读取上限加一行，用额外一行判断截断；单元格文本超过 2000 字符会标记截断，二进制不回传。
- 列表和表结构只返回 `model_text`，结构不附带样例记录。查询返回包含来源、列名、行和截断标记的 `model_text`；`show_table=true` 时通过显式 `display` 展示静态 Markdown 表格及截断提示，避免通用 A2UI 表格给一次性查询结果添加无效的分页按钮。
- `plugin.toml` 中 `auto_table=false` 关闭隐式 JSON 转表格，不影响上述显式查询表格。
- 同步数据库操作通过线程执行；连接池在 MCP 进程内复用，进程关闭时释放。首次使用需要检查数据库结构。

## 验证

插件依赖独立锁定在本目录的 `uv.lock`，不修改 Dingent 的主依赖。开发验证可以在仓库根目录运行：

```powershell
uv run --project examples/plugins/multi_database python -m pytest tests/plugins/test_multi_database.py --confcutdir=tests/plugins -q
```

测试使用隔离的 SQLite 测试库与 MCP 内存客户端，不需要生产账号。真实 MySQL 的网络、认证、授权与超时需要填写配置后验证。
