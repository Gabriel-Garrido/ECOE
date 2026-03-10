from django.contrib import admin

from .models import AuditLog


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ["created_at", "actor", "action", "entity_type", "entity_id"]
    list_filter = ["action", "entity_type"]
    search_fields = ["actor__email", "action", "entity_type"]
    readonly_fields = ["actor", "action", "entity_type", "entity_id", "payload_json", "created_at"]
