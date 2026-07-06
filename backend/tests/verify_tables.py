import zcatalyst_sdk
import sys

def main():
    try:
        print("Initializing Catalyst SDK...")
        app = zcatalyst_sdk.initialize()
        datastore = app.datastore()
        
        print("Fetching all tables from Zoho Catalyst Data Store...")
        tables = datastore.get_all()
        
        if not tables:
            print("No tables found in your Catalyst Data Store. Please verify you created them in the console.")
            sys.exit(1)
            
        print(f"Successfully fetched {len(tables)} tables:")
        for idx, table in enumerate(tables, 1):
            # Print table metadata
            print(f" {idx}. Table Name: {table.get('table_name')} (ID: {table.get('table_id')})")
            
    except Exception as e:
        print(f"Error connecting to Zoho Catalyst Data Store: {e}")
        print("Please verify that your Catalyst CLI is logged in ('catalyst whoami') and linked to the active project.")
        sys.exit(1)

if __name__ == "__main__":
    main()
