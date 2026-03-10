from django.db import models


class AuditLog(models.Model):
    actor = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_logs",
        verbose_name="Usuario",
    )
    action = models.CharField(max_length=100, verbose_name="Acción")
    entity_type = models.CharField(max_length=100, verbose_name="Tipo de entidad")
    entity_id = models.BigIntegerField(null=True, blank=True, verbose_name="ID de entidad")
    payload_json = models.JSONField(default=dict, blank=True, verbose_name="Datos")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Fecha")

    class Meta:
        verbose_name = "Log de auditoría"
        verbose_name_plural = "Logs de auditoría"
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.action} – {self.entity_type}#{self.entity_id} ({self.created_at})"
