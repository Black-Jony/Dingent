from __future__ import annotations

import asyncio
import json
import os
import re
from collections.abc import AsyncIterator, Mapping
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from pathlib import Path
from threading import Lock
from typing import Any, NoReturn

import sqlglot
from dotenv import dotenv_values
from fastmcp import FastMCP
from fastmcp.exceptions import ToolError
from langchain_community.utilities import SQLDatabase
from loguru import logger
from sqlalchemy import URL, Engine, create_engine, event, text
from sqlalchemy.exc import SQLAlchemyError
from sqlglot import exp
from sqlglot.errors import ParseError
from sqlglot.expressions.dml import DML
from sqlglot.optimizer.scope import traverse_scope


@dataclass(frozen=True)
class DatabaseConfig:
    alias: str
    description: str
    host: str
    port: int
    username: str
    password: str = field(repr=False)
    database: str = ""
    tables: tuple[str, ...] = ()

    def url(self) -> URL:
        prefix = self.alias.upper()
        required = {"HOST": self.host, "USER": self.username, "PASSWORD": self.password, "NAME": self.database}
        missing = [f"{prefix}_DB_{key}" for key, value in required.items() if not value.strip()]
        if missing:
            raise ToolError(f"数据源 {self.alias} 尚未配置：{', '.join(missing)}。请填写插件的 .env 并重启后端。")
        return URL.create("mysql+pymysql", username=self.username, password=self.password, host=self.host, port=self.port, database=self.database, query={"charset": "utf8mb4"})


@dataclass(frozen=True)
class Settings:
    databases: tuple[DatabaseConfig, ...]
    max_rows: int = 100
    timeout_seconds: int = 10

    @classmethod
    def from_env(cls, path: Path, environ: Mapping[str, str] | None = None) -> Settings:
        # Explicit path: MCP's working directory need not be the plugin directory.
        values = {**dotenv_values(path, interpolate=False), **(os.environ if environ is None else environ)}
        aliases = [alias.strip() for alias in (values.get("DATABASES") or "books,orders").split(",")]
        if not aliases or len(set(aliases)) != len(aliases) or any(not re.fullmatch(r"[a-z][a-z0-9_]{0,31}", alias) for alias in aliases):
            raise ValueError("DATABASES 必须为逗号分隔、不重复的小写数据源标识，例如 books,orders")
        databases = []
        for alias in aliases:
            prefix = f"{alias.upper()}_DB_"
            databases.append(
                DatabaseConfig(
                    alias=alias,
                    description=values.get(prefix + "DESCRIPTION") or alias,
                    host=values.get(prefix + "HOST") or "",
                    port=_integer(values.get(prefix + "PORT") or "3306", prefix + "PORT", 1, 65535),
                    username=values.get(prefix + "USER") or "",
                    password=values.get(prefix + "PASSWORD") or "",
                    database=values.get(prefix + "NAME") or "",
                    tables=tuple(name.strip() for name in (values.get(prefix + "TABLES") or "").split(",") if name.strip()),
                )
            )
        return cls(
            tuple(databases),
            max_rows=_integer(values.get("MAX_RESULT_ROWS") or "100", "MAX_RESULT_ROWS", 1, 1000),
            timeout_seconds=_integer(values.get("QUERY_TIMEOUT_SECONDS") or "10", "QUERY_TIMEOUT_SECONDS", 1, 120),
        )


def _integer(value: str, name: str, minimum: int, maximum: int) -> int:
    try:
        number = int(value)
    except ValueError:
        raise ValueError(f"{name} 必须为 {minimum}～{maximum} 的整数") from None
    if not minimum <= number <= maximum:
        raise ValueError(f"{name} 必须为 {minimum}～{maximum} 的整数")
    return number


def validate_query(sql: str, config: DatabaseConfig, allowed_tables: set[str], max_rows: int) -> str:
    try:
        statements = sqlglot.parse(sql, read="mysql")
    except ParseError:
        raise ToolError("SQL 解析失败，请根据表结构重新生成 MySQL SELECT 查询。") from None
    if len(statements) != 1 or not isinstance(statements[0], exp.Select | exp.Union | exp.Intersect | exp.Except):
        raise ToolError("只允许单条 SELECT 查询，可以使用只读 CTE 或 UNION。")
    query = statements[0]
    if any(isinstance(node, DML | exp.DDL | exp.Command | exp.Into | exp.Lock) for node in query.walk()):
        raise ToolError("不允许修改数据、写文件或锁定查询。")
    blocked_functions = {"SLEEP", "BENCHMARK", "LOAD_FILE", "GET_LOCK", "RELEASE_LOCK", "MASTER_POS_WAIT", "WAIT_FOR_EXECUTED_GTID_SET"}
    for node in query.find_all(exp.Func):
        function_name = node.name if isinstance(node, exp.Anonymous) else node.sql_name()
        if function_name.upper() in blocked_functions:
            raise ToolError("不允许文件访问、锁操作或等待函数。")
    for scope in traverse_scope(query):
        for source in scope.sources.values():
            if not isinstance(source, exp.Table):
                continue  # CTEs and derived tables resolve to Scope rather than physical tables.
            if source.catalog or (source.db and source.db != config.database):
                raise ToolError(f"工具 {config.alias}_query 只允许访问绑定的数据源，不能跨库查询。")
            if source.name not in allowed_tables:
                raise ToolError(f"表 {source.name!r} 不在可用表中，请先调用 {config.alias}_list_tables。")
    limit = query.args.get("limit")
    if limit:
        expression = limit.expression
        if not isinstance(expression, exp.Literal) or not expression.is_int or int(expression.this) < 0:
            raise ToolError("LIMIT 必须为非负整数。")
        rows = min(int(expression.this), max_rows + 1)
    else:
        rows = max_rows + 1
    return query.limit(rows, copy=False).sql(dialect="mysql")


class DatabaseService:
    def __init__(self, config: DatabaseConfig, settings: Settings) -> None:
        self.config = config
        self.settings = settings
        self._db: SQLDatabase | None = None
        self._engine: Engine | None = None
        self._lock = Lock()

    def _database(self) -> SQLDatabase:
        with self._lock:
            if self._db is None:
                engine = create_engine(
                    self.config.url(),
                    pool_pre_ping=True,
                    pool_size=2,
                    max_overflow=0,
                    pool_timeout=self.settings.timeout_seconds,
                    connect_args={"connect_timeout": self.settings.timeout_seconds, "read_timeout": self.settings.timeout_seconds, "write_timeout": self.settings.timeout_seconds},
                )

                @event.listens_for(engine, "connect")
                def configure_session(connection: Any, _record: Any) -> None:
                    with connection.cursor() as cursor:
                        cursor.execute(f"SET SESSION MAX_EXECUTION_TIME = {self.settings.timeout_seconds * 1000}")

                try:
                    db = SQLDatabase(engine, include_tables=list(self.config.tables) or None, sample_rows_in_table_info=0, lazy_table_reflection=True, view_support=True)
                except Exception:
                    engine.dispose()
                    raise
                self._engine, self._db = engine, db
            return self._db

    def list_tables(self) -> dict[str, Any]:
        try:
            tables = list(self._database().get_usable_table_names())
        except (SQLAlchemyError, ValueError) as error:
            self._database_error(error)
        return {"model_text": json.dumps({"source": self.config.alias, "tables": tables}, ensure_ascii=False)}

    def get_schema(self, tables: list[str]) -> dict[str, Any]:
        if not tables:
            raise ToolError("请指定至少一个表名。")
        try:
            db = self._database()
            if not set(tables) <= set(db.get_usable_table_names()):
                raise ToolError(f"包含不可用的表，请先调用 {self.config.alias}_list_tables。")
            schema = db.get_table_info(tables)
        except (SQLAlchemyError, ValueError) as error:
            self._database_error(error)
        return {"model_text": f"数据源：{self.config.alias}\n{schema}"}

    def query(self, sql: str, show_table: bool = True) -> dict[str, Any]:
        try:
            db = self._database()
            checked_sql = validate_query(sql, self.config, set(db.get_usable_table_names()), self.settings.max_rows)
            assert self._engine is not None
            with self._engine.connect() as connection:
                result = connection.execution_options(stream_results=True).execute(text(checked_sql))
                try:
                    columns = list(result.keys())
                    records = result.fetchmany(self.settings.max_rows + 1)
                finally:
                    result.close()
            truncated = len(records) > self.settings.max_rows
            rows = [[_cell(value) for value in row] for row in records[: self.settings.max_rows]]
        except (SQLAlchemyError, ValueError) as error:
            self._database_error(error)
        data = {"source": self.config.alias, "columns": columns, "rows": rows, "truncated": truncated}
        response: dict[str, Any] = {"model_text": json.dumps(data, ensure_ascii=False, default=str)}
        if show_table:
            # A bounded SELECT result has no server-side page API. Avoid the generic
            # A2UI table template, which unconditionally adds Previous/Next actions.
            content = _markdown_table(columns, rows)
            if truncated:
                content += f"\n\n仅展示前 {self.settings.max_rows} 行，结果已截断。"
            response["display"] = [{"type": "markdown", "title": f"{self.config.alias} 查询结果", "content": content}]
        return response

    def _database_error(self, error: Exception) -> NoReturn:
        # Driver exceptions can contain credentials, SQL literals and server addresses.
        logger.warning("Database operation failed: source={}, error_type={}", self.config.alias, type(error).__name__)
        raise ToolError(f"数据源 {self.config.alias} 操作失败，请检查独立连接配置、只读权限、表结构或查询超时。") from None

    def close(self) -> None:
        if self._engine is not None:
            self._engine.dispose()


def _cell(value: Any) -> Any:
    if isinstance(value, bytes):
        return "<binary>"
    if value is None or isinstance(value, bool | int | float):
        return value
    rendered = str(value)
    return rendered if len(rendered) <= 2000 else rendered[:2000] + "…[截断]"


def _markdown_table(columns: list[str], rows: list[list[Any]]) -> str:
    def render_row(values: list[Any]) -> str:
        cells = [re.sub(r"([\\`*_\[\]<>|])", r"\\\1", str(value) if value is not None else "").replace("\r", " ").replace("\n", " ") for value in values]
        return "| " + " | ".join(cells) + " |"

    return "\n".join([render_row(list(columns)), "| " + " | ".join("---" for _ in columns) + " |", *[render_row(row) for row in rows]])


def create_server(settings: Settings) -> FastMCP:
    services = [DatabaseService(config, settings) for config in settings.databases]

    @asynccontextmanager
    async def lifespan(_server: FastMCP) -> AsyncIterator[None]:
        try:
            yield
        finally:
            for service in services:
                await asyncio.to_thread(service.close)

    server = FastMCP("Dingent Multi Database", lifespan=lifespan)
    for service in services:
        register_tools(server, service)
    return server


def register_tools(server: FastMCP, service: DatabaseService) -> None:
    alias = service.config.alias
    description = f"仅用于数据源 {alias}：{service.config.description}。"
    annotations = {"readOnlyHint": True, "destructiveHint": False, "openWorldHint": False}

    @server.tool(name=f"{alias}_list_tables", description=description + "列出允许查询的表和视图。", annotations=annotations)
    async def list_tables() -> dict[str, Any]:
        return await asyncio.to_thread(service.list_tables)

    @server.tool(name=f"{alias}_get_schema", description=description + "查看指定表的字段结构；请先列出表，不返回样例记录。", annotations=annotations)
    async def get_schema(tables: list[str]) -> dict[str, Any]:
        return await asyncio.to_thread(service.get_schema, tables)

    @server.tool(
        name=f"{alias}_query",
        description=description + "执行单条只读 MySQL SELECT 查询；先查看表结构。结果自动限行，truncated=true 表示未返回完整结果。show_table=false 可只供模型阅读。",
        annotations=annotations,
    )
    async def query(sql: str, show_table: bool = True) -> dict[str, Any]:
        return await asyncio.to_thread(service.query, sql, show_table)
