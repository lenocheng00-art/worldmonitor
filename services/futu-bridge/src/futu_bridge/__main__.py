import uvicorn

from .config import Settings


def main() -> None:
    settings = Settings()
    uvicorn.run(
        "futu_bridge.app:app",
        host=settings.futu_bridge_bind_host,
        port=settings.futu_bridge_bind_port,
        reload=False,
        access_log=False,
    )


if __name__ == "__main__":
    main()
