from pydantic import ConfigDict
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    openrouter_api_key: str
    environment: str = "development"
    log_level: str = "INFO"
    max_cost_per_request_usd: float = 0.05
    max_cost_per_project_day_usd: float = 2.00

    langsmith_api_key: str = ""
    langsmith_project: str = "starteria-ai-service"
    langsmith_tracing: bool = False

    # Outbound push channel to the Express backend so PDF extractions land in the
    # DB the moment they finish, regardless of whether a frontend is polling.
    # Empty `backend_webhook_url` disables the push (the backend's reactive
    # polling path then becomes the only sync mechanism — used in unit tests and
    # in dev when the backend isn't reachable).
    # Example: http://backend:3001/api/v1/internal/ai/webhooks/pdf-extract/runs
    backend_webhook_url: str = ""
    backend_webhook_token: str = ""
    backend_webhook_timeout_sec: float = 10.0

    model_config = ConfigDict(env_file=".env")


settings = Settings()
