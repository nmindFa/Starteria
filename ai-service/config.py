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

    model_config = ConfigDict(env_file=".env")


settings = Settings()
