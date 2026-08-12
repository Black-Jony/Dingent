from types import SimpleNamespace

import pytest

from dingent.server.services import transcription_service


def test_transcription_availability_requires_feature_flag_and_dependency(monkeypatch):
    monkeypatch.setattr(transcription_service.settings, "TRANSCRIPTION_ENABLED", False)
    monkeypatch.setattr(transcription_service.importlib.util, "find_spec", lambda _name: object())
    assert transcription_service.is_transcription_available() is False

    monkeypatch.setattr(transcription_service.settings, "TRANSCRIPTION_ENABLED", True)
    assert transcription_service.is_transcription_available() is True

    monkeypatch.setattr(transcription_service.importlib.util, "find_spec", lambda _name: None)
    assert transcription_service.is_transcription_available() is False


@pytest.mark.asyncio
async def test_transcribe_audio_uses_and_removes_temporary_file(monkeypatch):
    observed_path = None

    class FakeModel:
        def transcribe(self, audio_path, **kwargs):
            nonlocal observed_path
            observed_path = audio_path
            assert kwargs["vad_filter"] is True
            with open(audio_path, "rb") as audio_file:
                assert audio_file.read() == b"recording bytes"
            return iter([SimpleNamespace(text=" hello "), SimpleNamespace(text="world")]), object()

    monkeypatch.setattr(transcription_service, "_get_model", lambda: FakeModel())

    text = await transcription_service.transcribe_audio(
        b"recording bytes",
        filename="recording.webm",
        content_type="audio/webm;codecs=opus",
    )

    assert text == "hello world"
    assert observed_path is not None
    assert not transcription_service.Path(observed_path).exists()


@pytest.mark.asyncio
async def test_transcribe_audio_reports_when_no_speech_is_detected(monkeypatch):
    class SilentModel:
        def transcribe(self, _audio_path, **_kwargs):
            return iter([SimpleNamespace(text="  ")]), object()

    monkeypatch.setattr(transcription_service, "_get_model", lambda: SilentModel())

    with pytest.raises(transcription_service.TranscriptionFailedError, match="No speech"):
        await transcription_service.transcribe_audio(
            b"silence",
            filename=None,
            content_type="audio/webm",
        )
