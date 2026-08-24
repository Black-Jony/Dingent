from __future__ import annotations

import warnings
from typing import Any


def create_text_embedding(model_name: str) -> Any:
    from fastembed import TextEmbedding

    with warnings.catch_warnings():
        warnings.filterwarnings(
            "ignore",
            message=r"The model .* now uses mean pooling instead of CLS embedding.*",
            category=UserWarning,
        )
        return TextEmbedding(model_name=model_name)
