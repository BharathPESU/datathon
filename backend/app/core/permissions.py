# Role-based permissions mapping
ROLE_PERMISSIONS = {
    "investigator": {
        "allowed_endpoints": [
            "cases:read", "cases:write",
            "accused:read", "victims:read",
            "chat:use", "network:read",
            "analytics:basic", "risk:read",
            "files:upload", "files:ocr",
        ],
        "data_scope": "station",  # Own station's data by default
        "pii_access": True,
    },
    "analyst": {
        "allowed_endpoints": [
            "cases:read",
            "accused:read", "victims:read",
            "chat:use", "network:read",
            "analytics:full", "risk:read",
            "forecast:read",
        ],
        "data_scope": "cross_station",  # Cross-station analytical views
        "pii_access": False,  # No raw PII edit rights
    },
    "supervisor": {
        "allowed_endpoints": [
            "cases:read", "cases:write",
            "accused:read", "victims:read",
            "chat:use", "network:read",
            "analytics:full", "risk:read",
            "forecast:read", "admin:audit",
        ],
        "data_scope": "district",  # Station/district-level oversight
        "pii_access": True,
    },
    "policymaker": {
        "allowed_endpoints": [
            "analytics:aggregate",
            "forecast:read",
            "chat:use",
        ],
        "data_scope": "aggregate",  # Aggregate-only — NO individual-level access
        "pii_access": False,
    },
    "admin": {
        "allowed_endpoints": ["*"],
        "data_scope": "all",
        "pii_access": True,
    },
}

# Demographic analysis guardrails
SMALL_CELL_THRESHOLD = 20  # Don't return any demographic group smaller than this

def get_permissions(role: str) -> dict:
    """Get permissions for a given role."""
    return ROLE_PERMISSIONS.get(role, ROLE_PERMISSIONS["investigator"])

def can_access(role: str, permission: str) -> bool:
    """Check if a role has access to a specific permission."""
    perms = get_permissions(role)
    allowed = perms.get("allowed_endpoints", [])
    if "*" in allowed:
        return True
    return permission in allowed

def suppress_small_cells(value: int) -> int:
    """Returns 0 (suppressed) if the value is below the threshold, otherwise the value."""
    if 0 < value < SMALL_CELL_THRESHOLD:
        return 0
    return value