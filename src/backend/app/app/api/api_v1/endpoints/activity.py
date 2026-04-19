import time
import asyncio
from uuid import UUID
from datetime import datetime, timezone
from fastapi import File, UploadFile, WebSocket, WebSocketDisconnect
from fastapi import APIRouter, Depends, HTTPException
from motor.core import AgnosticDatabase

from app import crud
from app.api import deps
from app.models.user import User
from app.utilities.audit import create_audit_log

from starlette.websockets import WebSocketDisconnect
from typing import Optional, List

from ....api.inference import MultiModalEvaluator
from ....api.sockets import send_response

router = APIRouter()

import os

print("Current working directory:", os.getcwd())

model_path = "./app/best_multimodal_model.pth"
if os.path.exists(model_path):
    evaluator = MultiModalEvaluator(
        model_path=model_path,
        device=None
    )
else:
    print(f"Model file not found at {model_path}. Model will not be loaded.")
    evaluator = None

connected_clients: List[WebSocket] = []
inferencetimes = []


async def insert_fall_event(
    db: AgnosticDatabase,
    member_id: str,
    member_name: str | None,
    confidence: float,
):
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


@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str,
    db=Depends(deps.get_db),
):
    await websocket.accept()
    try:
        await deps.get_active_websocket_user(db=db, token=token)
    except Exception as e:
        print(f"WebSocket auth failed: {e}")
        await websocket.close(code=1008)
        return

    connected_clients.append(websocket)


    # Replace the entire try/except block at the bottom of websocket_endpoint
    try:
        while True:
            try:
                # Wait up to 30s for any message.
                # If none arrive, keep the connection alive with a ping.
                await asyncio.wait_for(websocket.receive_text(), timeout=30.0)
            except asyncio.TimeoutError:
                try:
                    await websocket.send_text('{"type":"ping"}')
                except Exception:
                    break
    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"WebSocket error: {e}")
    finally:
        if websocket in connected_clients:
            connected_clients.remove(websocket)


async def broadcast_prediction(result: dict):
    disconnected = []

    for client in connected_clients:
        success = await send_response(websocket=client, response=result)
        if not success:
            disconnected.append(client)

    for client in disconnected:
        if client in connected_clients:
            connected_clients.remove(client)


@router.post("/{member_id}")
async def activity(
    member_id: UUID,
    *,
    db: AgnosticDatabase = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    skeleton_file: Optional[UploadFile] = File(None),
    inertial_file: Optional[UploadFile] = File(None),
    depth_file: Optional[UploadFile] = File(None),
):
    if evaluator is None:
        raise HTTPException(400, "Model not loaded. Please check server logs.")

    if not any([skeleton_file, inertial_file, depth_file]):
        raise HTTPException(400, "At least one modality file must be provided")

    skeleton_data = await skeleton_file.read() if skeleton_file else None
    inertial_data = await inertial_file.read() if inertial_file else None
    depth_data = await depth_file.read() if depth_file else None

    start_time = time.time()

    result = evaluator.predict(
        skeleton_data=skeleton_data,
        inertial_data=inertial_data,
        depth_data=depth_data,
        return_probabilities=False
    )

    end_time = time.time()
    inferencetimes.append(end_time - start_time)

    print(f"Inference time: {end_time - start_time:.4f} seconds")
    print(f"Minimum inference time: {min(inferencetimes):.4f} seconds")
    print(f"Maximum inference time: {max(inferencetimes):.4f} seconds")
    print(f"Average inference time: {sum(inferencetimes)/len(inferencetimes):.4f} seconds")

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

    # Default fields so frontend always gets consistent shape
    result.setdefault("alert_id", None)
    result.setdefault("timestamp", datetime.now(timezone.utc).isoformat())

    # Apply same threshold logic as /predict
    should_trigger_alert = (
        result.get("predicted_action") == "fall"
        and result.get("confidence", 0) >= 0.80
    )
    result["should_trigger_alert"] = should_trigger_alert

    # Only persist real alerts when threshold passes
    if should_trigger_alert:
        alert_meta = await insert_fall_event(
            db=db,
            member_id=str(member_id),
            member_name=member_name,
            confidence=result.get("confidence", 0),
        )
        result["alert_id"] = alert_meta["alert_id"]
        result["timestamp"] = alert_meta["timestamp"]

        print(
            f"Fall event saved to MongoDB for member {member_id}, alert_id={result['alert_id']}"
        )
    else:
        print(
            f"No alert created. predicted_action={result.get('predicted_action')}, "
            f"confidence={result.get('confidence')}, should_trigger_alert={should_trigger_alert}"
        )

    print("Prediction result:", result)

    await create_audit_log(
        db=db,
        action="activity_prediction_requested",
        user=current_user,
        metadata={
            "member_id": str(member_id),
            "member_name": member_name,
            "predicted_action": result.get("predicted_action"),
            "confidence": result.get("confidence"),
            "alert_id": result.get("alert_id"),
            "should_trigger_alert": result.get("should_trigger_alert"),
            "modalities_provided": {
                "skeleton": skeleton_file is not None,
                "inertial": inertial_file is not None,
                "depth": depth_file is not None,
            },
        },
    )

    if connected_clients:
        await broadcast_prediction(result)

    return {
        "status": "ok",
        "clients_notified": len(connected_clients),
        "result": result,
    }