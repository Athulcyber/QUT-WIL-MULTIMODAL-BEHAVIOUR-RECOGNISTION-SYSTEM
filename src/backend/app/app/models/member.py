from datetime import date, datetime
from uuid import UUID, uuid4
from odmantic import Model, Field
from bson import Binary

class Member(Model):
    id: UUID = Field(default_factory=uuid4, primary_field=True)
    first_name: str
    last_name: str
    date_of_birth: datetime

    model_config = {
        "collection": "member"
    }
