# Core configuration — reads from Catalyst environment variables
import os
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # App
    APP_NAME: str = "Crime Analytics Platform"
    DEBUG: bool = os.environ.get("DEBUG", "false").lower() == "true"

    # JWT
    JWT_SECRET_KEY: str = os.environ.get("JWT_SECRET_KEY", "crime-analytics-secret-key-change-in-prod")
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # NVIDIA NIM
    NVIDIA_API_KEY: str = os.environ.get("NVIDIA_API_KEY", "")
    NIM_BASE_URL: str = os.environ.get("NIM_BASE_URL", "https://integrate.api.nvidia.com/v1")
    NIM_MODEL: str = os.environ.get("NIM_MODEL", "z-ai/glm-5.2")
    NIM_EMBEDDING_MODEL: str = os.environ.get("NIM_EMBEDDING_MODEL", "")

    # Catalyst
    CATALYST_PROJECT_ID: str = os.environ.get("CATALYST_PROJECT_ID", "55341000000016001")

    # Zoho Catalyst QuickML / AutoML
    QUICKML_LLM_ENDPOINT: str = os.environ.get(
        "QUICKML_LLM_ENDPOINT",
        "https://api.catalyst.zoho.in/quickml/v1/project/55341000000016001/glm/chat"
    )
    QUICKML_LLM_MODEL: str = os.environ.get("QUICKML_LLM_MODEL", "crm-dl-gLaM7b_30b_it")
    QUICKML_RAG_ENDPOINT: str = os.environ.get(
        "QUICKML_RAG_ENDPOINT",
        "https://api.catalyst.zoho.in/quickml/v1/project/55341000000016001/rag/answer"
    )
    QUICKML_RAG_DOCUMENTS: str = os.environ.get("QUICKML_RAG_DOCUMENTS", "5720000000003006")
    QUICKML_ORG_ID: str = os.environ.get("QUICKML_ORG_ID", "60076836035")
    QUICKML_MAX_TOKENS: int = int(os.environ.get("QUICKML_MAX_TOKENS_DNF", "1200"))

    class Config:
        env_file = ".env"
        extra = "allow"


settings = Settings()
