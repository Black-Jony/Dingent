import uuid

import ag_ui_langgraph.agent as upstream_agent
import pytest
from ag_ui.core import EventType, ReasoningMessage, RunAgentInput
from langchain_core.messages import AIMessage, AIMessageChunk, HumanMessage, ToolMessage
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver
from langgraph.graph import END, START, MessagesState, StateGraph

from dingent.server.copilot.agents import DingLangGraphAGUIAgent, ding_agui_messages_to_langchain, ding_langchain_messages_to_agui, ding_resolve_reasoning_content


def make_agent(checkpointer=None):
    graph = StateGraph(MessagesState)
    graph.add_node("answer", lambda state: {"messages": [AIMessage(content="next answer", id=str(uuid.uuid4()))]})
    graph.add_edge(START, "answer")
    graph.add_edge("answer", END)
    return DingLangGraphAGUIAgent(name="conversion_test", graph=graph.compile(checkpointer=checkpointer or InMemorySaver()))


@pytest.mark.parametrize(
    ("content", "expected"),
    [
        ("plain answer", "plain answer"),
        (["first ", "second"], "first second"),
        ([{"type": "text", "text": "first "}, {"type": "text", "text": "second"}], "first second"),
        ([{"type": "output_text", "text": "answer"}], "answer"),
        (["first ", {"type": "text", "text": "second"}], "first second"),
        ([{"type": "thinking", "thinking": "summary"}, {"type": "text", "text": "answer"}], "answer"),
        ([{"type": "image_url", "image_url": {"url": "https://example.invalid/image"}}, {"type": "text", "text": "answer"}], "answer"),
        ([], ""),
        ("", ""),
    ],
)
def test_snapshot_preserves_all_visible_text(content, expected):
    source = AIMessage(id="answer-1", content=content)
    original = source.model_dump()
    converted = ding_langchain_messages_to_agui([source])[0]
    assert converted.id == "answer-1"
    assert converted.content.endswith(expected)
    if expected:
        assert converted.content.split("</thinking>\n")[-1] == expected
    assert source.model_dump() == original


@pytest.mark.parametrize(
    "content",
    [
        ["plain text"],
        [{"type": "text", "text": "body"}, {"type": "thinking", "thinking": "summary"}],
        [{"type": "reasoning", "summary": [{"type": "summary_text", "text": "summary"}]}],
    ],
)
def test_reasoning_parser_accepts_mixed_blocks(content):
    message = AIMessage(content=content)
    result = ding_resolve_reasoning_content(message)
    if content == ["plain text"]:
        assert result is None
    else:
        assert result["text"] == "summary"


def test_replayed_reasoning_is_not_a_model_conversation_role():
    reasoning = ReasoningMessage(id="reasoning-1", content="display summary", encrypted_value="opaque-provider-value")
    messages = [reasoning]
    assert ding_agui_messages_to_langchain(messages) == []
    assert reasoning.encrypted_value == "opaque-provider-value"
    assert messages == [reasoning]
    assert upstream_agent.agui_messages_to_langchain is ding_agui_messages_to_langchain


def test_tool_call_ids_and_arguments_survive_conversion():
    messages = [
        AIMessage(id="a-1", content="", tool_calls=[{"id": "call-1", "name": "lookup", "args": {"query": "BRCA1"}}]),
        ToolMessage(id="t-1", content="found", tool_call_id="call-1"),
        AIMessage(id="a-2", content=[{"type": "output_text", "text": "final answer"}]),
    ]
    restored = ding_agui_messages_to_langchain(ding_langchain_messages_to_agui(messages))
    assert [message.id for message in restored] == ["a-1", "t-1", "a-2"]
    assert restored[0].tool_calls[0]["id"] == restored[1].tool_call_id == "call-1"
    assert restored[0].tool_calls[0]["args"] == {"query": "BRCA1"}
    assert restored[2].content == "final answer"


@pytest.mark.asyncio
@pytest.mark.parametrize("as_dict", [False, True])
@pytest.mark.parametrize("reasoning", [None, "summary"])
@pytest.mark.parametrize(
    "content",
    [
        "visible answer",
        ["visible ", "answer"],
        [{"type": "text", "text": "visible "}, {"type": "text", "text": "answer"}],
        [{"type": "output_text", "text": "visible answer"}],
        [{"type": "thinking", "thinking": "summary"}, {"type": "text", "text": "visible answer"}],
    ],
)
async def test_stream_keeps_answer_when_chunk_also_has_reasoning(content, reasoning, as_dict):
    agent = make_agent()
    agent.active_run = {"id": "run-1", "state_reliable": True}
    chunk = AIMessageChunk(id="answer-1", content=content, additional_kwargs={"reasoning_content": reasoning} if reasoning else {})
    original = chunk.model_dump()
    event = {"event": "on_chat_model_stream", "data": {"chunk": chunk.model_dump() if as_dict else chunk}, "metadata": {}}
    events = [item async for item in agent._handle_single_event(event, {"messages": []})]
    assert "".join(item.delta for item in events if item.type == EventType.TEXT_MESSAGE_CONTENT) == "visible answer"
    expected_thinking = reasoning is not None or any(isinstance(block, dict) and block.get("type") == "thinking" for block in content)
    assert sum(item.type == EventType.THINKING_TEXT_MESSAGE_CONTENT for item in events) == int(expected_thinking)
    assert sum(item.type == EventType.THINKING_END for item in events) == int(expected_thinking)
    assert not agent.active_run.get("thinking_process")
    assert chunk.model_dump() == original


@pytest.mark.asyncio
async def test_reasoning_chunk_does_not_drop_tool_calls():
    agent = make_agent()
    agent.active_run = {"id": "run-1", "state_reliable": True}
    chunk = AIMessageChunk(
        id="tool-message",
        content="",
        additional_kwargs={"reasoning_content": "summary"},
        tool_call_chunks=[{"name": "lookup", "args": "{}", "id": "call-1", "index": 0}],
    )
    events = [item async for item in agent._handle_single_event({"event": "on_chat_model_stream", "data": {"chunk": chunk}}, {"messages": []})]
    assert any(item.type == EventType.TOOL_CALL_START and item.tool_call_id == "call-1" for item in events)


@pytest.mark.asyncio
async def test_reasoning_only_finishes_at_model_end_without_empty_answer():
    agent = make_agent()
    agent.active_run = {"id": "run-1", "state_reliable": True}
    chunk = AIMessageChunk(id="answer-1", content="", additional_kwargs={"reasoning_content": "summary"})
    start = [item async for item in agent._handle_single_event({"event": "on_chat_model_stream", "data": {"chunk": chunk}}, {})]
    assert any(item.type == EventType.THINKING_START for item in start)
    assert not any(item.type == EventType.TEXT_MESSAGE_START for item in start)
    end = [item async for item in agent._handle_single_event({"event": "on_chat_model_end", "data": {}}, {})]
    assert [item.type for item in end] == [EventType.THINKING_TEXT_MESSAGE_END, EventType.THINKING_END]
    assert not agent.active_run.get("thinking_process")


@pytest.mark.asyncio
async def test_hidden_model_stream_does_not_emit_reasoning_or_text():
    agent = make_agent()
    agent.active_run = {"id": "run-1", "state_reliable": True}
    chunk = AIMessageChunk(id="answer-1", content="body", additional_kwargs={"reasoning_content": "summary"})
    event = {"event": "on_chat_model_stream", "data": {"chunk": chunk}, "metadata": {"emit-messages": False}}
    assert [item async for item in agent._handle_single_event(event, {})] == []


@pytest.mark.asyncio
async def test_sqlite_replay_and_followup_keep_native_reasoning(tmp_path):
    database = str(tmp_path / "conversion.sqlite")
    config = {"configurable": {"thread_id": str(uuid.uuid4())}}
    native = AIMessage(
        id="answer-1",
        content=[{"type": "text", "text": "first "}, {"type": "text", "text": "second"}],
        additional_kwargs={"reasoning_content": "provider summary", "signature": "opaque-provider-value"},
    )
    async with AsyncSqliteSaver.from_conn_string(database) as saver:
        saver.conn.is_alive = lambda: True
        agent = make_agent(saver)
        await agent.graph.aupdate_state(config, {"messages": [HumanMessage(id="user-1", content="question"), native]})

    async with AsyncSqliteSaver.from_conn_string(database) as saver:
        saver.conn.is_alive = lambda: True
        agent = make_agent(saver)
        replay = [event async for event in agent.get_thread_messages(config["configurable"]["thread_id"], "reload")]
        snapshot = next(event for event in replay if event.type == EventType.MESSAGES_SNAPSHOT)
        assert snapshot.messages[-1].content.endswith("first second")
        assert replay[-1].type == EventType.RUN_FINISHED
        request = RunAgentInput(
            threadId=config["configurable"]["thread_id"],
            runId="followup",
            state={},
            messages=[
                *snapshot.messages,
                ReasoningMessage(id="r-1", content="display summary", encrypted_value="opaque-provider-value"),
                {"id": "user-2", "role": "user", "content": "continue"},
            ],
            tools=[],
            context=[],
            forwardedProps={},
        )
        events = [event async for event in agent.run(request)]
        assert not any(event.type == EventType.RUN_ERROR for event in events)
        state = await agent.graph.aget_state(config)
        previous_answer = next(message for message in state.values["messages"] if message.id == "answer-1")
        assert previous_answer.content == native.content
        assert previous_answer.additional_kwargs == native.additional_kwargs
        assert state.values["messages"][-1].content == "next answer"
        assert request.messages[-2].role == "reasoning"
