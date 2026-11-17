from __future__ import annotations

from pathlib import Path

from server import Settings, create_server

if __name__ == "__main__":
    create_server(Settings.from_env(Path(__file__).with_name(".env"))).run(transport="stdio")
