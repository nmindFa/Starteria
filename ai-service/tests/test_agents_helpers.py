"""Unit tests for the pure-Python helpers inside each agent module.

These cover the deterministic JSON-extraction and message-handling functions
without invoking deepagents or any LLM. The agent classes themselves are
exercised in `test_agents_run.py` by stubbing `self._agent.invoke`.
"""

from __future__ import annotations

import pytest


# ---------------------------------------------------------------------------
# JSON extraction — every agent module ships an `_extract_*_json` helper with
# the same fallback semantics. Test them all in one parametrised suite.
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def all_extract_helpers() -> list:
    from agents.experiment_coach import _extract_json as ec
    from agents.feedback_ia import _extract_feedback_json as fia
    from agents.mentor_virtual import _extract_mentor_json as mv
    from agents.narrative_builder import _extract_json as nb
    from agents.research_assistant import _extract_json as ra
    from agents.solution_design import _extract_json as sd

    return [ec, fia, mv, nb, ra, sd]


@pytest.mark.unit
class TestExtractJsonHelpers:
    def test_pure_json_string_round_trips(self, all_extract_helpers: list) -> None:
        for fn in all_extract_helpers:
            assert fn('{"a": 1, "b": [2,3]}') == {"a": 1, "b": [2, 3]}

    def test_extracts_json_substring_from_chatty_text(
        self, all_extract_helpers: list
    ) -> None:
        # Each helper falls back to a regex that matches the first `{...}` block.
        chatty = 'Aqui esta tu respuesta: {"x": "ok"} con saludos!'
        for fn in all_extract_helpers:
            assert fn(chatty) == {"x": "ok"}

    def test_returns_empty_dict_for_invalid_content(
        self, all_extract_helpers: list
    ) -> None:
        for fn in all_extract_helpers:
            assert fn("no json here at all") == {}

    def test_returns_empty_dict_when_substring_is_invalid_json(
        self, all_extract_helpers: list
    ) -> None:
        # The greedy regex matches everything between the first `{` and last `}`,
        # but the contents are not valid JSON. The helper must swallow the error.
        for fn in all_extract_helpers:
            assert fn("prefix {totally not json} suffix") == {}

    def test_handles_multiline_json(self, all_extract_helpers: list) -> None:
        multiline = 'preamble\n{\n  "y": 2\n}\nepilogue'
        for fn in all_extract_helpers:
            assert fn(multiline) == {"y": 2}


# ---------------------------------------------------------------------------
# `_get_last_content` and `_wrap_result` — present on three agent modules
# (solution_design, experiment_coach, narrative_builder).
# ---------------------------------------------------------------------------


class _FakeMsg:
    def __init__(self, content: str) -> None:
        self.content = content


@pytest.mark.unit
class TestGetLastContent:
    @pytest.fixture(
        params=[
            "agents.solution_design",
            "agents.experiment_coach",
            "agents.narrative_builder",
        ]
    )
    def get_last_content(self, request):
        from importlib import import_module

        mod = import_module(request.param)
        return mod._get_last_content

    def test_returns_empty_string_when_no_messages(self, get_last_content) -> None:
        assert get_last_content({"messages": []}) == ""
        assert get_last_content({}) == ""

    def test_returns_content_attribute_of_last_message(self, get_last_content) -> None:
        result = {"messages": [_FakeMsg("first"), _FakeMsg("last-one")]}
        assert get_last_content(result) == "last-one"

    def test_falls_back_to_str_when_no_content_attribute(self, get_last_content) -> None:
        # A plain string with no `.content` should be cast via str().
        result = {"messages": ["plain-string"]}
        assert get_last_content(result) == "plain-string"


@pytest.mark.unit
class TestWrapResult:
    @pytest.fixture(
        params=[
            ("agents.solution_design", "solution-design"),
            ("agents.experiment_coach", "experiment-coach"),
            ("agents.narrative_builder", "narrative-builder"),
        ]
    )
    def wrap_result(self, request):
        from importlib import import_module

        mod_name, expected_id = request.param
        mod = import_module(mod_name)
        return mod._wrap_result, expected_id

    def test_wraps_with_metadata(self, wrap_result) -> None:
        wrap, expected_id = wrap_result
        wrapped = wrap({"k": "v"}, 42)
        assert wrapped == {
            "data": {"k": "v"},
            "agent": expected_id,
            "model": "openrouter:qwen/qwen3.6-flash",
            "input_tokens": 0,
            "output_tokens": 0,
            "latency_ms": 42,
        }
