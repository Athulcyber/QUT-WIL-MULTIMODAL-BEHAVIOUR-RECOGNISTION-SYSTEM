from fastapi import APIRouter, Depends
from motor.core import AgnosticDatabase
from uuid import UUID
from datetime import datetime, timezone

from app.api import deps
from app import crud
from app.api.api_v1.endpoints.activity import broadcast_prediction
from app.api.deps import get_current_active_user
from app.models.user import User
from app.utilities.audit import create_audit_log

router = APIRouter()

# UTD-MHAD activity mapping for demo
# Activity 25 = Lunge (closest to fall in dataset)
FALL_ACTIVITY_CLASS = 25

# Demo mode config
DEMO_MODE = True
DEMO_COUNTER = 0
DEMO_FALL_FREQUENCY = 5  # every 5th request becomes a fall
NON_FALL_ACTIVITY_CLASSES = [18, 24]  # Knock, Stand to Sit


async def insert_fall_event(
    db: AgnosticDatabase,
    member_id: str,
    member_name: str | None,
    confidence: float,
):
    """Save fall event to MongoDB and return inserted alert metadata."""
    event_timestamp = datetime.now(timezone.utc)

    event_doc = {
        "member_id": member_id,
        "member_name": member_name,
        "timestamp": event_timestamp,
        "prediction": "fall",
        "confidence": confidence,
        "acknowledged": False,
        "acknowledged_at": None,
        "acknowledged_by": None,
    }

    insert_result = await db["fall_events"].insert_one(event_doc)

    return {
        "alert_id": str(insert_result.inserted_id),
        "timestamp": event_timestamp.isoformat(),
    }


@router.post("/{member_id}")
async def predict_mock(
    member_id: UUID,
    *,
    db: AgnosticDatabase = Depends(deps.get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Mock /predict endpoint — returns controlled demo fall/no-fall data.
    Every Nth request becomes a fall so the full alert pipeline can be demonstrated.
    """
    import random

    global DEMO_COUNTER
    DEMO_COUNTER += 1

    if DEMO_MODE and DEMO_COUNTER % DEMO_FALL_FREQUENCY == 0:
        predicted_class = FALL_ACTIVITY_CLASS
        is_fall = True
    else:
        predicted_class = random.choice(NON_FALL_ACTIVITY_CLASSES)
        is_fall = False

    result = {
        "predicted_class": predicted_class,
        "predicted_action": "fall" if is_fall else "no_fall",
        "confidence": round(random.uniform(0.82, 0.97), 2)
        if is_fall
        else round(random.uniform(0.70, 0.89), 2),
        "alert_id": None,
        "timestamp": None,
    }

    should_trigger_alert = (
        result["predicted_action"] == "fall" and result["confidence"] >= 0.80
    )
    result["should_trigger_alert"] = should_trigger_alert

    member_name = None

    member = await crud.member.get_by_id(db, id=member_id)
    if member:
        member_name = f"{member.first_name} {member.last_name}"
        result["member"] = {
            "id": str(member.id),
            "name": member_name,
        }
    else:
        result["member"] = None

    if should_trigger_alert:
        alert_meta = await insert_fall_event(
            db=db,
            member_id=str(member_id),
            member_name=member_name,
            confidence=result["confidence"],
        )
        result["alert_id"] = alert_meta["alert_id"]
        result["timestamp"] = alert_meta["timestamp"]

        print(
            f"[DEMO] Fall event saved to MongoDB for member {member_id}, "
            f"alert_id={result['alert_id']}, request_count={DEMO_COUNTER}"
        )
    else:
        print(
            f"[DEMO] No alert created. predicted_class={predicted_class}, "
            f"predicted_action={result['predicted_action']}, "
            f"confidence={result['confidence']}, "
            f"should_trigger_alert={should_trigger_alert}, "
            f"request_count={DEMO_COUNTER}"
        )

    if result["timestamp"] is None:
        result["timestamp"] = datetime.now(timezone.utc).isoformat()

    await create_audit_log(
        db=db,
        action="predict_requested",
        user=current_user,
        metadata={
            "member_id": str(member_id),
            "member_name": member_name,
            "predicted_action": result["predicted_action"],
            "confidence": result["confidence"],
            "alert_id": result["alert_id"],
            "should_trigger_alert": result["should_trigger_alert"],
            "demo_counter": DEMO_COUNTER,
        },
    )

    await broadcast_prediction(result)

    return {"status": "ok", "result": result}