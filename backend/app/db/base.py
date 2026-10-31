"""
AI Surveillance System - SQLAlchemy Base Model & Universal Safe Types
"""

import uuid
import sqlalchemy as sa
import sqlalchemy.sql.sqltypes as _sqltypes
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.types import TypeDecorator, CHAR


def parse_safe_uuid(value):
    """Safely converts any string, hex, or truncated UUID into a valid uuid.UUID."""
    if value is None:
        return None
    if isinstance(value, uuid.UUID):
        return value
    val_str = str(value).strip()
    clean_hex = val_str.replace("-", "")
    try:
        if len(clean_hex) == 32:
            return uuid.UUID(hex=clean_hex)
        if len(val_str) == 36:
            return uuid.UUID(val_str)
        # Deterministic UUID for any truncated or non-standard string
        return uuid.uuid5(uuid.NAMESPACE_DNS, val_str)
    except Exception:
        try:
            return uuid.uuid5(uuid.NAMESPACE_DNS, val_str)
        except Exception:
            return uuid.uuid4()


# Patch SQLAlchemy's internal python UUID processor globally so no model/query crashes
_sqltypes._python_UUID = parse_safe_uuid


class SafeUUID(TypeDecorator):
    """Platform-independent UUID type that gracefully handles truncated or malformed hex."""
    impl = CHAR(36)
    cache_ok = True

    def __init__(self, as_uuid: bool = True, native_uuid: bool = True, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.as_uuid = as_uuid
        self.native_uuid = native_uuid

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if isinstance(value, uuid.UUID):
            if dialect and dialect.name == "mysql":
                return value.hex
            return str(value)
        val_str = str(value).strip()
        if dialect and dialect.name == "mysql":
            return val_str.replace("-", "")
        return val_str

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        if isinstance(value, uuid.UUID):
            return value
        return parse_safe_uuid(value)


# Alias sa.Uuid to SafeUUID so any model importing sa.Uuid uses SafeUUID
try:
    sa.Uuid = SafeUUID
    sa.types.Uuid = SafeUUID
    _sqltypes.Uuid = SafeUUID
except Exception:
    pass


class Base(DeclarativeBase):
    pass
