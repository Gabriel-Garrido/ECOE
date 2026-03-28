"""Utility to log audit events."""

from typing import Any

from .models import AuditLog


def log_action(
    actor,
    action: str,
    entity_type: str,
    entity_id: int | None = None,
    payload: dict[str, Any] | None = None,
) -> AuditLog:
    return AuditLog.objects.create(
        actor=actor,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        payload_json=payload or {},
    )
