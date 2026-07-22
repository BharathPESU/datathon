import asyncio
from app.services.nl2sql_service import nl2sql_pipeline
from dotenv import load_dotenv

load_dotenv()

def main():
    query = "Show theft hotspots"
    print("Running pipeline for:", query)
    res = nl2sql_pipeline.run_pipeline(query)
    print(res)

if __name__ == "__main__":
    main()
