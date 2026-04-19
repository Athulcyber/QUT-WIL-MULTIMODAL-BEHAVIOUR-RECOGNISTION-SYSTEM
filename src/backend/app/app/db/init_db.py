from uuid import UUID
from pymongo.database import Database

from app import crud, schemas
from app.core.config import settings


async def init_db(db: Database) -> None:
    await init_default_members(db)
    await init_default_users(db)


async def init_default_users(db: Database) -> None:
    """Initialize default admin and carer users if they do not exist."""

    admin_user = await crud.user.get_by_email(db, email=settings.FIRST_SUPERUSER)
    if not admin_user:
        admin_in = schemas.UserCreate(
            email=settings.FIRST_SUPERUSER,
            password=settings.FIRST_SUPERUSER_PASSWORD,
            is_superuser=True,
            full_name=settings.FIRST_SUPERUSER,
        )
        await crud.user.create(db, obj_in=admin_in)

    default_carer_email = "carer@example.com"
    existing_carer = await crud.user.get_by_email(db, email=default_carer_email)
    if not existing_carer:
        carer_in = schemas.UserCreate(
            email=default_carer_email,
            password="CarerDemo123!",
            is_superuser=False,
            full_name="Carer User",
        )
        await crud.user.create(db, obj_in=carer_in)


async def init_default_members(db: Database) -> None:
    """Initialize default members if none exist."""
    print("Initializing default members...")

    default_members = [
        {
            "id": UUID("2e921ac3-4a2a-47bf-a92d-9d4689717e57"),
            "first_name": "Resident",
            "last_name": "001",
            "date_of_birth": "1950-01-01",
        },
        {
            "id": UUID("3e921ac3-4a2a-47bf-a92d-9d4689717e57"),
            "first_name": "Resident",
            "last_name": "002",
            "date_of_birth": "1950-01-02",
        },
    ]

    for member_data in default_members:
        existing_member = await crud.member.get_by_id(db, id=member_data["id"])
        if existing_member:
            continue
        member_in = schemas.MemberCreateWithID(**member_data)
        member = await crud.member.create(db, obj_in=member_in)
        assert member.id == member_data["id"]