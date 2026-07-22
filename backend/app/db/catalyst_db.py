# Catalyst Data Store wrapper — provides ZCQL query interface
# Dynamically routes queries to the live Zoho Catalyst Data Store in the cloud
# and falls back to in-memory mock for local development.

import os
import json
import logging
import re
from typing import Any, Optional
from datetime import datetime

logger = logging.getLogger(__name__)

# Try importing Catalyst SDK
try:
    import zcatalyst_sdk
    HAS_SDK = True
except ImportError:
    HAS_SDK = False

# Detect if running in AppSail environment
IS_CLOUD = os.getenv("CATALYST_ENVIRONMENT") is not None or os.getenv("CATALYST_PROJECT_ID") is not None

_app = None

STATIC_COLUMN_MAPS = {
    "state_id": "State_id",
    "district_id": "District_id",
    "police_station_id": "Unit_id",
    "crime_category_id": "CrimeCategory_id",
    "crime_sub_head_id": "CrimeSubHead_id",
    "police_person_id": "PolicePerson_id",
    "case_master_id": "CaseMaster_id",
    "timestamp": "time_stamp",
}

def get_db_app():
    global _app
    if not HAS_SDK:
        return None
    if _app is not None:
        return _app
    
    # 1. Try initializing as serverless app (for AppSail cloud environment)
    try:
        _app = zcatalyst_sdk.initialize()
        return _app
    except Exception as e:
        # If serverless initialization fails (e.g., "Catalyst headers are empty" when running locally)
        # 2. Try initializing locally using the OAuth credentials
        auth_env = os.getenv("CATALYST_AUTH")
        token = os.getenv("CATALYST_AUTH_TOKEN")
        if auth_env or token:
            try:
                from zcatalyst_sdk import credentials
                if auth_env:
                    cred = None  # Will auto-load ApplicationDefaultCredential from CATALYST_AUTH env var
                else:
                    cred = credentials.AccessTokenCredential({
                        "access_token": token
                    })
                options = {
                    "project_id": "55341000000016001",
                    "project_key": "60076836035",
                    "project_domain": "api.catalyst.zoho.in",
                    "environment": os.getenv("CATALYST_ENVIRONMENT", "Development")
                }
                _app = zcatalyst_sdk.initialize_app(credential=cred, options=options)
                logger.info("✅ Catalyst SDK initialized locally with credentials!")
                return _app
            except Exception as ex:
                logger.error(f"Failed to initialize Catalyst SDK locally: {ex}")
        else:
            logger.debug(f"Skipping live Catalyst initialization (no credentials). Using local in-memory DB fallback. Detail: {e}")
            
    return None


# --- In-memory fallback storage ---
_tables: dict[str, list[dict]] = {}
_row_counters: dict[str, int] = {}

def _get_table(table_name: str) -> list[dict]:
    """Get or create an in-memory table."""
    if table_name not in _tables:
        _tables[table_name] = []
        _row_counters[table_name] = 0
    return _tables[table_name]

# --- Database API wrappers ---

def insert_row(table_name: str, data: dict) -> dict:
    """Insert a row into a table. Returns the inserted row with ROWID."""
    app = get_db_app()
    if app:
        try:
            # Safely get all columns to filter out nonexistent ones
            try:
                cols = app.datastore().table(table_name).get_all_columns()
                live_cols = [c.get("column_name") for c in cols]
                
                # Map timestamp to time_stamp if present in live columns
                mapped_data = {}
                for k, v in data.items():
                    if k == "timestamp" and "time_stamp" in live_cols and "timestamp" not in live_cols:
                        mapped_data["time_stamp"] = v
                    else:
                        mapped_data[k] = v
                        
                filtered = {k: v for k, v in mapped_data.items() if k in live_cols}
                res = app.datastore().table(table_name).insert_row(filtered)
                return res
            except Exception as e_col:
                logger.warning(f"Could not retrieve column metadata for {table_name}: {e_col}. Proceeding with static mapping fallback.")
                mapped_data = {}
                for k, v in data.items():
                    if k in STATIC_COLUMN_MAPS:
                        mapped_data[STATIC_COLUMN_MAPS[k]] = v
                    else:
                        mapped_data[k] = v
                res = app.datastore().table(table_name).insert_row(mapped_data)
                return res
        except Exception as e:
            logger.error(f"Live Datastore insert failed for {table_name}: {e}")
            raise e

    # Local in-memory fallback
    table = _get_table(table_name)
    _row_counters[table_name] = _row_counters.get(table_name, 0) + 1
    row = {"ROWID": _row_counters[table_name], **data}
    table.append(row)
    return row

def insert_rows(table_name: str, rows: list[dict]) -> list[dict]:
    """Insert multiple rows into a table."""
    return [insert_row(table_name, row) for row in rows]

def get_row(table_name: str, rowid: int) -> Optional[dict]:
    """Get a single row by ROWID."""
    app = get_db_app()
    if app:
        try:
            query_str = f"SELECT * FROM {table_name} WHERE ROWID = {rowid}"
            results = app.zcql().execute_query(query_str)
            for row in results:
                if table_name in row and row[table_name].get("ROWID") == rowid:
                    return row[table_name]
        except Exception as e:
            logger.error(f"Live ZCQL get_row failed for {table_name} id {rowid}: {e}")
        return None

    # Local in-memory fallback
    table = _get_table(table_name)
    for row in table:
        if row["ROWID"] == rowid:
            return row
    return None

def get_all_rows(table_name: str) -> list[dict]:
    """Get all rows from a table."""
    app = get_db_app()
    if app:
        try:
            # Default query limit in Catalyst is 200, but we can query up to 5000 records
            query_str = f"SELECT * FROM {table_name} LIMIT 5000"
            results = app.zcql().execute_query(query_str)
            return [row[table_name] for row in results if table_name in row]
        except Exception as e:
            logger.error(f"Live ZCQL select all failed for {table_name}: {e}")
            return []

    # Local in-memory fallback
    return _get_table(table_name)

def query_rows(table_name: str, conditions: Optional[dict] = None,
               order_by: Optional[str] = None, limit: int = 100,
               offset: int = 0) -> list[dict]:
    """Query rows with simple conditions (equality matching)."""
    app = get_db_app()
    if app:
        try:
            query_str = f"SELECT * FROM {table_name}"
            where_clauses = []
            if conditions:
                for k, v in conditions.items():
                    if isinstance(v, (int, float)):
                        where_clauses.append(f"{k} = {v}")
                    else:
                        where_clauses.append(f"{k} = '{v}'")
            if where_clauses:
                query_str += " WHERE " + " AND ".join(where_clauses)
            if order_by:
                query_str += f" ORDER BY {order_by}"
            # ZCQL limits are specified as: LIMIT offset, limit
            query_str += f" LIMIT {offset}, {limit}"
            
            results = app.zcql().execute_query(query_str)
            return [row[table_name] for row in results if table_name in row]
        except Exception as e:
            logger.error(f"Live ZCQL query failed for {table_name}: {e}")
            return []

    # Local in-memory fallback
    table = _get_table(table_name)
    results = table

    if conditions:
        results = [
            row for row in results
            if all(row.get(k) == v for k, v in conditions.items())
        ]

    if order_by:
        desc = False
        field = order_by
        if " desc" in order_by.lower():
            field = re.sub(r'(?i)\s+desc', '', order_by).strip()
            desc = True
        elif " asc" in order_by.lower():
            field = re.sub(r'(?i)\s+asc', '', order_by).strip()
            
        try:
            results = sorted(results, key=lambda x: x.get(field) or 0, reverse=desc)
        except Exception:
            pass

    return results[offset:offset + limit]

def execute_query(zcql_query: str) -> list[dict]:
    """Executes a ZCQL query on the database."""
    app = get_db_app()
    if app:
        try:
            return app.zcql().execute_query(zcql_query)
        except Exception as e:
            logger.error(f"Live ZCQL execute_query failed: {e}")
            raise e

    # Local in-memory fallback ZCQL simulation
    logger.info(f"Executing simulated ZCQL: {zcql_query}")
    match = re.search(r'(?i)from\s+([a-zA-Z0-9_]+)', zcql_query)
    if not match:
        raise ValueError("Invalid ZCQL: FROM clause not found.")
        
    table_name = match.group(1)
    table = _get_table(table_name)
    results = list(table)
    
    where_match = re.search(r'(?i)where\s+(.+?)(?=\s+order\s+by|\s+limit|$)', zcql_query)
    if where_match:
        conditions = re.findall(r'([a-zA-Z0-9_]+)\s*=\s*[\'\"]?([^\'\"]+?)[\'\"]?(?=\s+and\s*|\s*$)', where_match.group(1))
        for col, val in conditions:
            if val.isdigit():
                val = int(val)
            else:
                try:
                    val = float(val)
                except ValueError:
                    pass
            results = [row for row in results if str(row.get(col)) == str(val)]
            
    order_match = re.search(r'(?i)order\s+by\s+([a-zA-Z0-9_\s,]+)(?=\s+limit|$)', zcql_query)
    if order_match:
        order_clause = order_match.group(1).strip()
        desc = "desc" in order_clause.lower()
        col = re.sub(r'(?i)\s+(desc|asc)', '', order_clause).strip()
        try:
            results = sorted(results, key=lambda x: x.get(col) or 0, reverse=desc)
        except Exception:
            pass
            
    limit_match = re.search(r'(?i)limit\s+(\d+)(?:\s*,\s*(\d+))?', zcql_query)
    if limit_match:
        limit_val = int(limit_match.group(1))
        offset_val = int(limit_match.group(2)) if limit_match.group(2) else 0
        results = results[offset_val:offset_val + limit_val]
        
    return [{table_name: row} for row in results]

def get_table_stats() -> dict[str, int]:
    """Returns row counts for all tables."""
    app = get_db_app()
    if app:
        stats = {}
        for tbl in ["CaseMaster", "Accused", "Victim", "AppUser"]:
            try:
                res = app.zcql().execute_query(f"SELECT COUNT(ROWID) FROM {tbl}")
                if res:
                    val = list(res[0].values())[0].get("ROWID") or 0
                    stats[tbl] = int(val)
            except Exception:
                stats[tbl] = 0
        return stats

    # Local in-memory fallback
    return {table_name: len(rows) for table_name, rows in _tables.items()}

def update_row(table_name: str, rowid: int, data: dict) -> dict:
    """Update a row in the datastore by ROWID."""
    app = get_db_app()
    if app:
        try:
            # Fetch table columns to filter fields
            try:
                cols = app.datastore().table(table_name).get_all_columns()
                live_cols = [c.get("column_name") for c in cols]
                
                # Construct update dict, including ROWID
                update_payload = {"ROWID": rowid}
                for k, v in data.items():
                    if k in live_cols:
                        update_payload[k] = v
                        
                res = app.datastore().table(table_name).update_row(update_payload)
                return res
            except Exception as e_col:
                logger.warning(f"Could not retrieve column metadata for {table_name}: {e_col}. Proceeding with static mapping fallback.")
                update_payload = {"ROWID": rowid}
                for k, v in data.items():
                    if k in STATIC_COLUMN_MAPS:
                        update_payload[STATIC_COLUMN_MAPS[k]] = v
                    else:
                        update_payload[k] = v
                res = app.datastore().table(table_name).update_row(update_payload)
                return res
        except Exception as e:
            logger.error(f"Live Datastore update failed for {table_name} id {rowid}: {e}")
            raise e
            
    # Local in-memory fallback
    table = _get_table(table_name)
    for i, row in enumerate(table):
        if row["ROWID"] == rowid:
            updated = {**row, **data, "ROWID": rowid}
            table[i] = updated
            return updated
    raise ValueError(f"Row {rowid} not found in {table_name}")

def delete_row(table_name: str, rowid: int) -> bool:
    """Delete a row from a table by ROWID."""
    app = get_db_app()
    if app:
        try:
            app.datastore().table(table_name).delete_row(rowid)
            return True
        except Exception as e:
            logger.error(f"Live Datastore delete failed for {table_name} id {rowid}: {e}")
            raise e
            
    # Local in-memory fallback
    table = _get_table(table_name)
    for i, row in enumerate(table):
        if row["ROWID"] == rowid:
            table.pop(i)
            return True
    return False