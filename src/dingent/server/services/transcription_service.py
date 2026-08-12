from __future__ import annotations

import asyncio
import importlib.util
import tempfile
import threading
from pathlib import Path
from typing import Any

from dingent.core.config import settings
from dingent.core.paths import paths


class TranscriptionUnavailableError(RuntimeError):
    pass


class TranscriptionFailedError(RuntimeError):
    pass


_model: Any | None = None
_model_key: tuple[str, str, str, bool] | None = None
_model_lock = threading.Lock()
_inference_lock = threading.Lock()

_CONTENT_TYPE_SUFFIXES = {
    "audio/aac": ".aac",
    "audio/flac": ".flac",
    "audio/m4a": ".m4a",
    "audio/mp4": ".mp4",
    "audio/mpeg": ".mp3",
    "audio/ogg": ".ogg",
    "audio/wav": ".wav",
    "audio/webm": ".webm",
    "audio/x-m4a": ".m4a",
}


def is_transcription_available() -> bool:
    if not settings.TRANSCRIPTION_ENABLED:
        return False
    try:
        return importlib.util.find_spec("faster_whisper") is not None
    except (ImportError, ValueError):
        return False


def _get_model() -> Any:
    global _model, _model_key

    if not is_transcription_available():
        raise TranscriptionUnavailableError(
            "Local transcription is disabled or the speech extra is not installed."
        )

    key = (
        settings.TRANSCRIPTION_MODEL,
        settings.TRANSCRIPTION_DEVICE,
        settings.TRANSCRIPTION_COMPUTE_TYPE,
        settings.TRANSCRIPTION_LOCAL_FILES_ONLY,
    )
    with _model_lock:
        if _model is not None and _model_key == key:
            return _model

        try:
            from faster_whisper import WhisperModel

            download_root = paths.cache_root / "faster-whisper"
            download_root.mkdir(parents=True, exist_ok=True)
            _model = WhisperModel(
                settings.TRANSCRIPTION_MODEL,
                device=settings.TRANSCRIPTION_DEVICE,
                compute_type=settings.TRANSCRIPTION_COMPUTE_TYPE,
                download_root=str(download_root),
                local_files_only=settings.TRANSCRIPTION_LOCAL_FILES_ONLY,
            )
            _model_key = key
        except Exception as exc:
            _model = None
            _model_key = None
            raise TranscriptionUnavailableError(
                "The local speech model could not be loaded."
            ) from exc

    return _model


def _transcribe_file(audio_path: Path) -> str:
    try:
        model = _get_model()
        with _inference_lock:
            segments, _ = model.transcribe(
                str(audio_path),
                beam_size=max(1, settings.TRANSCRIPTION_BEAM_SIZE),
                language=settings.TRANSCRIPTION_LANGUAGE or None,
                vad_filter=True,
            )
            text = " ".join(
                segment.text.strip()
                for segment in segments
                if getattr(segment, "text", "").strip()
            ).strip()
    except TranscriptionUnavailableError:
        raise
    except Exception as exc:
        raise TranscriptionFailedError("The audio could not be transcribed.") from exc

    if not text:
        raise TranscriptionFailedError("No speech was detected in the recording.")
    return text


def _audio_suffix(filename: str | None, content_type: str | None) -> str:
    suffix = Path(filename or "").suffix.lower()
    if suffix and len(suffix) <= 10:
        return suffix
    media_type = (content_type or "").split(";", 1)[0].strip().lower()
    return _CONTENT_TYPE_SUFFIXES.get(media_type, ".webm")


async def transcribe_audio(
    data: bytes,
    *,
    filename: str | None,
    content_type: str | None,
) -> str:
    suffix = _audio_suffix(filename, content_type)
    with tempfile.TemporaryDirectory(prefix="dingent-audio-") as temp_dir:
        audio_path = Path(temp_dir) / f"recording{suffix}"
        await asyncio.to_thread(audio_path.write_bytes, data)
        return await asyncio.to_thread(_transcribe_file, audio_path)
