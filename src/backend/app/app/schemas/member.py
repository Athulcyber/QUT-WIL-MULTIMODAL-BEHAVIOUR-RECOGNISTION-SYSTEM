from pydantic import BaseModel, Field, validator, ConfigDict
from datetime import date
from uuid import UUID, uuid4

class MemberBase(BaseModel):
    first_name: str
    last_name: str
    date_of_birth: date
    
    model_config = ConfigDict(from_attributes=True)  # Updated from orm_mode

class MemberCreate(MemberBase):
    first_name: str = Field(..., min_length=2, max_length=50, description="First name of the member")
    last_name: str = Field(..., min_length=2, max_length=50, description="Last name of the member")
    date_of_birth: date = Field(..., description="Date of birth of the member")

    @validator('date_of_birth')
    def validate_birth_date(cls, v):
        if v > date.today():
            raise ValueError("Date of birth cannot be in the future")
        return v

class MemberCreateWithID(MemberCreate):
    id: UUID = Field(..., description="UUID of the member")

class Member(MemberBase):
    id: UUID = Field(default_factory=uuid4)

class MemberUpdate(BaseModel):
    first_name: str | None = Field(None, min_length=2, max_length=50, description="First name of the member")
    last_name: str | None = Field(None, min_length=2, max_length=50, description="Last name of the member")
    date_of_birth: date | None = Field(None, description="Date of birth of the member")

    @validator('date_of_birth')
    def validate_birth_date(cls, v):
        if v and v > date.today():
            raise ValueError("Date of birth cannot be in the future")
        return v

    model_config = ConfigDict(from_attributes=True)