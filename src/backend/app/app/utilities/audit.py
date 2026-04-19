from datetime import datetime, timezone
from motor.core import AgnosticDatabase
from app.models.user import User

async def create_audit_log(
    db: AgnosticDatabase,
    action: str,
    user: User,
    metadata: dict,
    status: str = "success",
):
    try:
        audit_doc = {
            "action": action,
            "user_id": str(user.id) if getattr(user, "id", None) else "",
            "user_email": getattr(user, "email", ""),
            "status": status,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            **metadata,
        }
        await db["audit_logs"].insert_one(audit_doc)
    except Exception as e:
        print(f"Audit log failed: {e}")