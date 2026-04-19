from fastapi import APIRouter, Depends
from motor.core import AgnosticDatabase
from app.api import deps
from app.models.user import User

router = APIRouter()

def serialize_audit(doc: dict):
    return {
        "id": str(doc["_id"]),
        "action": doc.get("action"),
        "user_id": doc.get("user_id"),
        "user_email": doc.get("user_email"),
        "status": doc.get("status"),
        "timestamp": doc.get("timestamp"),
        "alert_id": doc.get("alert_id"),
        "member_id": doc.get("member_id"),
        "member_name": doc.get("member_name"),
    }

@router.get("/")
async def get_audit_logs(
    db: AgnosticDatabase = Depends(deps.get_db),
    current_user: User = Depends(deps.get_admin_user),
):
    logs = await db["audit_logs"].find({}).sort("timestamp", -1).to_list(length=200)
    return [serialize_audit(log) for log in logs]