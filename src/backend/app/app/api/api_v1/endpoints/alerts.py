from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from motor.core import AgnosticDatabase

from app.api import deps
from app.models.user import User

router = APIRouter()


def to_utc_iso(dt):
    if not dt:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    else:
        dt = dt.astimezone(timezone.utc)
    return dt.isoformat()


def serialize_alert(doc: dict):
    return {
        "id": str(doc["_id"]),
        "member_id": doc.get("member_id"),
        "member_name": doc.get("member_name"),
        "timestamp": to_utc_iso(doc.get("timestamp")),
        "prediction": doc.get("prediction", "fall"),
        "confidence": doc.get("confidence", 0),
        "acknowledged": doc.get("acknowledged", False),
        "acknowledged_at": to_utc_iso(doc.get("acknowledged_at")),
        "acknowledged_by": doc.get("acknowledged_by"),
    }


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


@router.get("/")
async def get_alerts(
    db: AgnosticDatabase = Depends(deps.get_db),
    current_user: User = Depends(deps.get_carer_or_admin_user),
):
    alerts = await db["fall_events"].find({}).sort("timestamp", -1).to_list(length=200)
    return [serialize_alert(a) for a in alerts]


@router.post("/{alert_id}/acknowledge")
async def acknowledge_alert(
    alert_id: str,
    db: AgnosticDatabase = Depends(deps.get_db),
    current_user: User = Depends(deps.get_carer_or_admin_user),
):
    if not ObjectId.is_valid(alert_id):
        raise HTTPException(status_code=400, detail="Invalid alert id")

    existing = await db["fall_events"].find_one({"_id": ObjectId(alert_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Alert not found")

    await db["fall_events"].update_one(
        {"_id": ObjectId(alert_id)},
        {
            "$set": {
                "acknowledged": True,
                "acknowledged_at": datetime.now(timezone.utc),
                "acknowledged_by": getattr(current_user, "email", "unknown"),
            }
        },
    )

    updated = await db["fall_events"].find_one({"_id": ObjectId(alert_id)})

    await create_audit_log(
        db=db,
        action="alert_acknowledged",
        user=current_user,
        metadata={
            "alert_id": alert_id,
            "member_id": updated.get("member_id"),
            "member_name": updated.get("member_name"),
            "acknowledged_by": getattr(current_user, "email", "unknown"),
        },
    )

    return {"status": "ok", "alert": serialize_alert(updated)}