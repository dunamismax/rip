from __future__ import annotations

import argparse
import asyncio

import uvicorn

from .app import create_app
from .config import load_settings
from .ytdlp import check_ffmpeg, check_ytdlp


def main() -> None:
    parser = argparse.ArgumentParser(prog="rip")
    subparsers = parser.add_subparsers(dest="command", required=True)

    serve = subparsers.add_parser("serve", help="Run the FastAPI web app.")
    serve.add_argument("--reload", action="store_true", help="Enable auto-reload for development.")

    subparsers.add_parser("doctor", help="Check yt-dlp, ffmpeg, and the download directory.")

    args = parser.parse_args()

    if args.command == "serve":
        settings = load_settings()
        uvicorn.run(
            create_app(settings),
            host=settings.host,
            port=settings.port,
            reload=args.reload,
        )
        return

    if args.command == "doctor":
        asyncio.run(run_doctor())


async def run_doctor() -> None:
    settings = load_settings()
    ytdlp_version, ffmpeg_version = await asyncio.gather(check_ytdlp(settings), check_ffmpeg(settings))

    settings.download_dir.mkdir(parents=True, exist_ok=True)
    writable = settings.download_dir.is_dir()

    print("rip doctor\n")
    print(f"download dir        {settings.download_dir}")
    print(f"download dir ready  {'yes' if writable else 'no'}")
    print(f"yt-dlp              {ytdlp_version or 'missing'}")
    print(f"ffmpeg              {ffmpeg_version or 'missing'}")

    if not (writable and ytdlp_version and ffmpeg_version):
        raise SystemExit(1)


if __name__ == "__main__":
    main()
