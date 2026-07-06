# Crime Analytics Platform — FastAPI Backend
# Catalyst Advanced I/O Function Entry Point

import os
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Import routers
from app.routers import auth, cases, chat, network, analytics, risk, forecast, admin

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Import seed generator
from data.seed_data import generate_all_data

app = FastAPI(
    title="Crime Analytics Platform API",
    description="Conversational crime intelligence, network analysis, and analytics",
    version="1.0.0",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
)

@app.on_event("startup")
async def startup_event():
    logger.info("Initializing database with seed data...")
    try:
        generate_all_data()
    except Exception as e:
        logger.error(f"Failed to auto-seed database: {e}")

# CORS — allow Catalyst Slate frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://datathon-60076836035.development.catalystserverless.com",
        os.environ.get("FRONTEND_URL", ""),
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth.router, prefix="/api/v1/auth", tags=["Auth"])
app.include_router(cases.router, prefix="/api/v1/cases", tags=["Cases"])
app.include_router(chat.router, prefix="/api/v1/chat", tags=["Chat"])
app.include_router(network.router, prefix="/api/v1/network", tags=["Network"])
app.include_router(analytics.router, prefix="/api/v1/analytics", tags=["Analytics"])
app.include_router(risk.router, prefix="/api/v1/risk", tags=["Risk"])
app.include_router(forecast.router, prefix="/api/v1/forecast", tags=["Forecast"])
app.include_router(admin.router, prefix="/api/v1/admin", tags=["Admin"])


@app.get("/")
async def root():
    return {"status": "ok", "service": "Crime Analytics Platform API", "version": "1.0.0"}


@app.get("/health")
async def health():
    return {"status": "healthy"}
