from typing import Literal, get_args
from pydantic import BaseModel, Field, EmailStr, ConfigDict, field_validator

Language = Literal["en", "es", "fr", "de", "it", "pt", "ja"]
Level = Literal["A1", "A2", "B1", "B2", "C1", "C2"]
Scene = Literal["park", "therapy", "candy", "paris", "theme", "kyoto"]
Trait = Literal[
    "Bem-humorado",
    "Calmo",
    "Curioso",
    "Extrovertido",
    "Introvertido",
    "Aventureiro",
    "Criativo",
    "Intelectual",
    "Sarcástico",
    "Empático",
    "Sonhador",
    "Espontâneo",
]
Interest = Literal[
    "Jogos",
    "Tecnologia",
    "Cinema",
    "Música",
    "Esportes",
    "Viagens",
    "Livros",
    "Gastronomia",
    "Arte",
    "Natureza",
    "Moda",
    "Animais",
    "História",
    "Ciência",
]
TRAITS = get_args(Trait)
INTERESTS = get_args(Interest)


class Appearance(BaseModel):
    presentation: Literal["masculine", "feminine", "neutral"] = "masculine"
    skin: str = "#e8ad7b"
    face: Literal["oval", "round", "angular"] = "oval"
    eyes: Literal["almond", "round", "relaxed"] = "almond"
    eye_color: str = "#604630"
    brows: Literal["soft", "bold", "arched"] = "bold"
    nose: Literal["soft", "straight", "round"] = "soft"
    mouth: Literal["smile", "gentle", "wide"] = "smile"
    hair: Literal["swept", "curly", "long", "bob", "short", "braids"] = "swept"
    hair_color: str = "#54382c"
    outfit: Literal["jacket", "hoodie", "shirt", "sweater"] = "jacket"
    clothing_color: str = "#31556d"
    glasses: Literal["none", "round", "square"] = "none"
    hat: Literal["none", "cap", "beanie"] = "none"
    earrings: bool = False
    necklace: bool = False
    freckles: bool = False
    beard: bool = False

    @field_validator("skin", "eye_color", "hair_color", "clothing_color")
    @classmethod
    def color(cls, value):
        import re

        if not re.fullmatch(r"#[0-9a-fA-F]{6}", value):
            raise ValueError("Cor inválida")
        return value


class Persona(BaseModel):
    description_language: Language = "en"
    traits: list[Trait] = Field(default_factory=list, max_length=3)
    profession: str = Field(default="", max_length=80)
    age: int | None = Field(default=None, ge=13, le=120)
    origin: str = Field(default="", max_length=100)
    interests: list[Interest] = Field(default_factory=list, max_length=14)
    style: Literal["balanced", "talkative", "listener"] = "balanced"
    biography: str = Field(default="", max_length=1500)
    preferences: dict[str, str] = Field(default_factory=dict, max_length=20)

    @field_validator("traits", "interests")
    @classmethod
    def short_items(cls, items):
        if any(len(i) > 50 for i in items):
            raise ValueError("Opção muito longa")
        return list(dict.fromkeys(items))


class CharacterInput(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    appearance: Appearance = Field(default_factory=Appearance)
    persona: Persona = Field(default_factory=Persona)
    voice: Literal["male", "female"] = "male"

    @field_validator("name")
    @classmethod
    def nonblank(cls, value):
        if not value.strip():
            raise ValueError("Dê um nome ao seu amigo.")
        return value.strip()


class SurpriseInput(BaseModel):
    language: Language = "en"


class ConversationInput(BaseModel):
    character_id: str
    language: Language = "en"
    level: Level = "B1"
    scene: Scene = "park"


class Credentials(BaseModel):
    email: EmailStr
    password: str = Field(min_length=10, max_length=128)


class Registration(Credentials):
    name: str = Field(min_length=1, max_length=80)


class UserOutput(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    email: str


class TurnInput(BaseModel):
    action: Literal["message", "start", "regenerate", "topic"] = "message"
    text: str = Field(default="", max_length=4000)
    request_id: str = Field(pattern=r"^[a-zA-Z0-9-]{8,36}$")
    expected_version: int = Field(ge=0)


class RenameInput(BaseModel):
    title: str = Field(min_length=1, max_length=100)
