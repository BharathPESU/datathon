import os
import uvicorn
from main import app

if __name__ == "__main__":
    port = int(os.getenv('X_ZOHO_CATALYST_LISTEN_PORT', 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, ws="none")
