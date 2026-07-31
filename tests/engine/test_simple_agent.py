import json
from typing import Any, cast

import pytest
from langchain_core.messages import AIMessage, HumanMessage, ToolMessage
from langchain_litellm.chat_models import litellm as langchain_litellm_chat_models
from langgraph.types import Command

from dingent.engine.agents.simple_agent import DingMiddleware, mcp_artifact_to_agui_display


def test_mcp_artifact_to_agui_display_builds_official_a2ui_operations():
    artifact = [{"type": "table", "title": "Users", "columns": ["id", "name", "active", "score"], "rows": [[1, "Alice", True, 95.5], [2, "Bob", False, 88.0]]}]

    result = mcp_artifact_to_agui_display("test_tool", {"page": 1}, "surface", artifact)

    assert len(result) == 1
    content = result[0]
    assert content["surfaceId"] == "surface-0"

    operations = content["a2ui_operations"]
    assert operations[0]["createSurface"]["surfaceId"] == "surface-0"
    assert operations[1]["updateComponents"]["surfaceId"] == "surface-0"
    assert operations[2]["updateDataModel"]["surfaceId"] == "surface-0"

    components = operations[1]["updateComponents"]["components"]
    assert {component["id"] for component in components} >= {"root", "tableTitle", "tableHeader", "row_0", "row_1", "paginationRow"}

    data = operations[2]["updateDataModel"]["value"]
    assert data["title"] == "Users"
    assert data["columns"] == ["id", "name", "active", "score"]
    assert data["rows"] == [{"id": 1, "name": "Alice", "active": True, "score": 95.5}, {"id": 2, "name": "Bob", "active": False, "score": 88.0}]
    assert data["pageInfo"] == "Page 1"


def test_mcp_artifact_to_agui_display_keeps_markdown_payload_for_client_renderer():
    artifact = [{"type": "markdown", "title": "QC Analysis Result", "content": "### Result\n- Passed"}]

    result = mcp_artifact_to_agui_display("test_tool", {}, "surface", artifact)

    assert result == [{"type": "markdown", "title": "QC Analysis Result", "content": "### Result\n- Passed"}]


@pytest.mark.asyncio
async def test_ding_middleware_awrap_model_call_normalizes_string_content_blocks():
    middleware = DingMiddleware()
    user_message = HumanMessage(content=["", "hello", {"type": "text", "text": "world"}])

    class MockRequest:
        messages = [user_message]
        model_settings = {}

        def override(self, **kwargs):
            self.messages = kwargs.get("messages", self.messages)
            self.model_settings = kwargs.get("model_settings", self.model_settings)
            return self

    async def mock_handler(req: Any) -> str:
        assert req.messages[0].content == [{"type": "text", "text": "hello"}, {"type": "text", "text": "world"}]
        assert req.model_settings["parallel_tool_calls"] is False
        return "ok"

    result = await middleware.awrap_model_call(cast(Any, MockRequest()), cast(Any, mock_handler))

    assert result == "ok"


def test_litellm_message_conversion_preserves_reasoning_content():
    message = AIMessage(
        content=[{"type": "thinking", "thinking": "private reasoning"}, {"type": "text", "text": "hello"}], additional_kwargs={"reasoning_content": "private reasoning"}
    )

    message_dict = langchain_litellm_chat_models._convert_message_to_dict(message)

    assert message_dict["reasoning_content"] == "private reasoning"


@pytest.mark.asyncio
async def test_ding_middleware_awrap_model_call_moves_thinking_blocks_to_reasoning_content():
    middleware = DingMiddleware()
    assistant_message = AIMessage(content=[{"type": "thinking", "thinking": "private reasoning"}, {"type": "text", "text": "hello"}])

    class MockRequest:
        messages = [assistant_message]
        model_settings = {}

        def override(self, **kwargs):
            self.messages = kwargs.get("messages", self.messages)
            self.model_settings = kwargs.get("model_settings", self.model_settings)
            return self

    async def mock_handler(req: Any) -> str:
        assert req.messages[0].content == [{"type": "text", "text": "hello"}]
        assert req.messages[0].additional_kwargs["reasoning_content"] == "private reasoning"
        assert req.model_settings["parallel_tool_calls"] is False
        return "ok"

    result = await middleware.awrap_model_call(cast(Any, MockRequest()), cast(Any, mock_handler))

    assert result == "ok"


@pytest.mark.asyncio
async def test_ding_middleware_awrap_tool_call_with_tool_message():
    middleware = DingMiddleware()

    # Mock request
    class MockTool:
        name = "test_tool"

    class MockRequest:
        tool_call = {"id": "call_123", "args": {}}
        tool = MockTool()
        state = {"messages": []}

    request = MockRequest()

    # Mock handler that returns a ToolMessage with an artifact
    async def mock_handler(req):  # noqa: ARG001
        return ToolMessage(
            content="Tool executed", tool_call_id="call_123", artifact={"structured_content": {"display": [{"type": "table", "rows": []}], "model_text": "Here is the table"}}
        )

    result = await middleware.awrap_tool_call(request, mock_handler)

    assert isinstance(result, Command)
    assert "messages" in result.update
    messages = result.update["messages"]

    assert len(messages) >= 1
    # First message should be ToolMessage with modified content
    assert isinstance(messages[0], ToolMessage)
    assert messages[0].content == "Here is the table"
    assert messages[0].tool_call_id == "call_123"
    assert messages[1].id == "call_123:activity"
    assert messages[1].type == "activity"


@pytest.mark.asyncio
async def test_ding_middleware_turns_plain_structured_content_into_a_table():
    middleware = DingMiddleware()

    class MockTool:
        name = "legacy_tool"

    class MockRequest:
        tool_call = {"id": "call_legacy", "args": {}}
        tool = MockTool()
        state = {"messages": []}

    async def mock_handler(req):  # noqa: ARG001
        return ToolMessage(
            content="Tool executed",
            tool_call_id="call_legacy",
            artifact={"structured_content": {"accession": "P04637", "organism": "Homo sapiens"}},
        )

    result = await middleware.awrap_tool_call(MockRequest(), mock_handler)

    assert isinstance(result, Command)
    messages = result.update["messages"]
    assert len(messages) == 2
    assert messages[1].type == "activity"
    activity_content = messages[1].content[0]
    assert activity_content["a2ui_operations"]
    rendered_operations = json.dumps(activity_content["a2ui_operations"], ensure_ascii=False)
    assert "Property" in rendered_operations
    assert "Value" in rendered_operations
    assert "P04637" in rendered_operations
    assert "Homo sapiens" in rendered_operations


@pytest.mark.asyncio
async def test_ding_middleware_preserves_legacy_plugin_display_protocol():
    middleware = DingMiddleware()

    class MockTool:
        name = "legacy_tool"

    class MockRequest:
        tool_call = {"id": "call_legacy_display", "args": {}}
        tool = MockTool()
        state = {"messages": []}

    legacy_display = {
        "association_table": {
            "columns": ["Property", "Value"],
            "rows": [["accession", "P04637"]],
        }
    }

    async def mock_handler(req):  # noqa: ARG001
        return ToolMessage(
            content="Tool executed",
            tool_call_id="call_legacy_display",
            artifact={
                "structured_content": {
                    "model_text": "AlphaFold result",
                    "display": legacy_display,
                }
            },
        )

    result = await middleware.awrap_tool_call(MockRequest(), mock_handler)

    assert isinstance(result, Command)
    messages = result.update["messages"]
    assert messages[0].content == "AlphaFold result"
    assert messages[1].content == [legacy_display]


@pytest.mark.asyncio
async def test_ding_middleware_parses_legacy_display_from_json_content():
    middleware = DingMiddleware()

    class MockTool:
        name = "generate_gwas_sankey"

    class MockRequest:
        tool_call = {"id": "call_gwas", "args": {"trait_name": "plant height"}}
        tool = MockTool()
        state = {"messages": []}

    legacy_display = {
        "sankey_image_base64": "aW1hZ2U=",
        "association_table": {
            "columns": ["Variant ID", "Trait"],
            "rows": [["ghi12837308", "plant height"]],
        },
    }

    async def mock_handler(req):  # noqa: ARG001
        return ToolMessage(
            content=json.dumps(
                {
                    "model_text": "Found 8 GWAS associations.",
                    "display": legacy_display,
                }
            ),
            tool_call_id="call_gwas",
        )

    result = await middleware.awrap_tool_call(MockRequest(), mock_handler)

    assert isinstance(result, Command)
    messages = result.update["messages"]
    assert len(messages) == 2
    assert messages[0].content == "Found 8 GWAS associations."
    assert messages[0].artifact == legacy_display
    assert messages[1].id == "call_gwas:activity"
    assert messages[1].content == [legacy_display]


@pytest.mark.asyncio
async def test_ding_middleware_parses_legacy_display_from_text_content_block():
    middleware = DingMiddleware()

    class MockTool:
        name = "legacy_tool"

    class MockRequest:
        tool_call = {"id": "call_text_block", "args": {}}
        tool = MockTool()
        state = {"messages": []}

    display = {"text": "Rendered result"}

    async def mock_handler(req):  # noqa: ARG001
        return ToolMessage(
            content=[
                {
                    "type": "text",
                    "text": json.dumps({"model_text": "Model result", "display": display}),
                }
            ],
            tool_call_id="call_text_block",
        )

    result = await middleware.awrap_tool_call(MockRequest(), mock_handler)

    messages = result.update["messages"]
    assert messages[0].content == "Model result"
    assert messages[1].content == [display]


@pytest.mark.asyncio
async def test_ding_middleware_keeps_non_json_tool_content_unchanged():
    middleware = DingMiddleware()

    class MockTool:
        name = "plain_text_tool"

    class MockRequest:
        tool_call = {"id": "call_plain", "args": {}}
        tool = MockTool()
        state = {"messages": []}

    async def mock_handler(req):  # noqa: ARG001
        return ToolMessage(content="Plain tool result", tool_call_id="call_plain")

    result = await middleware.awrap_tool_call(MockRequest(), mock_handler)

    messages = result.update["messages"]
    assert len(messages) == 1
    assert messages[0].content == "Plain tool result"
    assert messages[0].artifact is None


@pytest.mark.asyncio
async def test_ding_middleware_awrap_tool_call_with_command():
    middleware = DingMiddleware()

    class MockTool:
        name = "test_tool"

    class MockRequest:
        tool_call = {"id": "call_123"}
        tool = MockTool()
        state = {"messages": ["history_1", "history_2"]}

    request = MockRequest()

    async def mock_handler(req):  # noqa: ARG001
        return Command(graph="some_graph", update={"messages": ["new_message"]})

    result = await middleware.awrap_tool_call(request, mock_handler)

    assert isinstance(result, Command)
    assert "messages" in result.update
    messages = result.update["messages"]

    # It should NOT append the new message to the history messages, returning only the update
    assert len(messages) == 1
    assert messages == ["new_message"]

    # And it should not mutate the original state list
    assert request.state["messages"] == ["history_1", "history_2"]
