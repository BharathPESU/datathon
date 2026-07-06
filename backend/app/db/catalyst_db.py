# Catalyst Data Store wrapper — provides ZCQL query interface
# Since this is a datathon, we use an in-memory mock that mirrors the Catalyst Data Store API
# This allows local development without requiring Catalyst serve, and can be swapped to real
# Catalyst SDK calls when deploying.

import json
import logging
import re
from typing import Any, Optional
from datetime import datetime

logger = logging.getLogger(__name__)

# In-memory storage — simulates Catalyst Data Store tables
_tables: dict[str, list[dict]] = {}
_row_counters: dict[str, int] = {}

def _get_table(table_name: str) -> list[dict]:
    """Get or create an in-memory table."""
    if table_name not in _tables:
        _tables[table_name] = []
        _row_counters[table_name] = 0
    return _tables[table_name]

def insert_row(table_name: str, data: dict) -> dict:
    """Insert a row into a table. Returns the inserted row with ROWID."""
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
    table = _get_table(table_name)
    for row in table:
        if row["ROWID"] == rowid:
            return row
    return None

def get_all_rows(table_name: str) -> list[dict]:
    """Get all rows from a table."""
    return _get_table(table_name)

def query_rows(table_name: str, conditions: Optional[dict] = None,
               order_by: Optional[str] = None, limit: int = 100,
               offset: int = 0) -> list[dict]:
    """Query rows with simple conditions (equality matching)."""
    table = _get_table(table_name)
    results = table

    if conditions:
        results = [
            row for row in results
            if all(row.get(k) == v for k, v in conditions.items())
        ]

    if order_by:
        # Simple order by (supports ASC/DESC syntax or field names)
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

    # Pagination
    return results[offset:offset + limit]

def execute_query(zcql_query: str) -> list[dict]:
    """
    Simulates executing ZCQL SELECT queries.
    Parses basic queries like:
      SELECT * FROM TableName WHERE col = 'val'
      SELECT ROWID, col1 FROM TableName ORDER BY col2 DESC
    """
    logger.info(f"Executing simulated ZCQL: {zcql_query}")
    
    # Simple regex to extract table name and where clause
    # Regex matching: SELECT ... FROM TableName [WHERE ...] [ORDER BY ...] [LIMIT ...]
    match = re.search(r'(?i)from\s+([a-zA-Z0-9_]+)', zcql_query)
    if not match:
        raise ValueError("Invalid ZCQL: FROM clause not found.")
        
    table_name = match.group(1)
    table = _get_table(table_name)
    
    results = list(table)
    
    # Parse WHERE clause
    where_match = re.search(r'(?i)where\s+(.+?)(?=\s+order\s+by|\s+limit|$)', zcql_query)
    if where_match:
        where_clause = where_match.group(1)
        # Parse simple equality conditions, e.g., col = 'val' or col = 123
        conditions = re.findall(r'([a-zA-Z0-9_]+)\s*=\s*[\'\"]?([^\'\"]+?)[\'\"]?(?=\s+and\s*|\s*$)')
        # Also parse simple like conditions if any
        for col, val in conditions:
            # Cast values to float/int if possible
            if val.isdigit():
                val = int(val)
            else:
                try:
                    val = float(val)
                except ValueError:
                    pass
            results = [row for row in results if str(row.get(col)) == str(val)]
            
    # Parse ORDER BY
    order_match = re.search(r'(?i)order\s+by\s+([a-zA-Z0-9_\s,]+)(?=\s+limit|$)', zcql_query)
    if order_match:
        order_clause = order_match.group(1).strip()
        desc = "desc" in order_clause.lower()
        col = re.sub(r'(?i)\s+(desc|asc)', '', order_clause).strip()
        try:
            results = sorted(results, key=lambda x: x.get(col) or 0, reverse=desc)
        except Exception:
            pass
            
    # Parse LIMIT/OFFSET
    limit_match = re.search(r'(?i)limit\s+(\d+)(?:\s*,\s*(\d+))?', zcql_query)
    if limit_match:
        limit_val = int(limit_match.group(1))
        offset_val = int(limit_match.group(2)) if limit_match.group(2) else 0
        results = results[offset_val:offset_val + limit_val]
        
    # Return enriched dictionaries matching Catalyst row format
    return [{table_name: row} for row in results]

def get_table_stats() -> dict[str, int]:
    """Returns row counts for all tables."""
    return {table_name: len(rows) for table_name, rows in _tables.items()}