import sys
import os

# Override SDK default URLs to use the real Zoho Catalyst IN API production server
os.environ["X_ZOHO_CATALYST_ACCOUNTS_URL"] = "https://accounts.zoho.in"
os.environ["X_ZOHO_CATALYST_CONSOLE_URL"] = "https://api.catalyst.zoho.in"

import zcatalyst_sdk
from zcatalyst_sdk import credentials

def test():
    # Use the active token retrieved from "catalyst token:generate --current"
    token = "w_1000.1083ffb5ab64da61b0e6b34ed96e4c86.18c3c298f47c53022d1f30172ff2245a"
    
    cred = credentials.AccessTokenCredential({
        "access_token": token
    })
    
    options = {
        "project_id": "55341000000016001",
        "project_key": "Development",
        "project_domain": "api.catalyst.zoho.in",
        "environment": "Development"
    }
    
    try:
        print("Initializing app...")
        app = zcatalyst_sdk.initialize_app(credential=cred, options=options)
        print("Accessing datastore...")
        datastore = app.datastore()
        print("Fetching all tables...")
        tables = datastore.get_all_tables()
        print(f"Tables found: {len(tables)}")
        for t in tables:
            print(f" - {t.get('table_name')} (ID: {t.get('table_id')})")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test()
