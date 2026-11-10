from typing import get_args

import pytest

from app.schemas import Appearance, CharacterInput, ConversationInput
from conftest import register, character


def test_original_and_new_hair_values_accept_all_face_shapes_and_hats():
    values = get_args(Appearance.model_fields["hair"].annotation)
    assert {"swept", "curly", "long", "bob", "short", "braids"}.issubset(values)
    assert len(values) == 16
    for hair in values:
        for face in ("oval", "round", "angular"):
            for hat in ("none", "cap", "beanie"):
                value = CharacterInput(
                    name="Alex", appearance=Appearance(hair=hair, face=face, hat=hat)
                )
                restored = CharacterInput.model_validate_json(value.model_dump_json())
                assert restored.appearance == value.appearance


def test_hair_and_accessory_edits_are_saved_without_changing_previous_conversation(
    client, ai
):
    register(client)
    friend = character(client)
    original = client.post(
        "/api/conversations", json={"character_id": friend["id"], "scene": "kyoto"}
    ).json()
    for hair in ("swept", "afro", "bun", "locs"):
        friend["appearance"].update(
            hair=hair, face="round", hat="beanie", glasses="round", earrings=True
        )
        response = client.put(f"/api/characters/{friend['id']}", json=friend)
        assert response.status_code == 200
        assert response.json()["appearance"] == friend["appearance"]
    unchanged = client.get(f"/api/conversations/{original['id']}").json()
    assert unchanged["snapshot"]["appearance"] == original["snapshot"]["appearance"]


@pytest.mark.parametrize(
    "scene", ["stadium", "theme", "oktoberfest", "london", "rio", "venice"]
)
def test_image_scenes_are_saved_and_reopened_with_the_avatar(client, ai, scene):
    register(client)
    friend = character(client)
    friend["appearance"]["hair"] = "bun"
    assert client.put(f"/api/characters/{friend['id']}", json=friend).status_code == 200
    response = client.post(
        "/api/conversations", json={"character_id": friend["id"], "scene": scene}
    )
    assert response.status_code == 200
    assert response.json()["scene"] == scene
    assert response.json()["snapshot"]["appearance"]["hair"] == "bun"
    reopened = client.get(f"/api/conversations/{response.json()['id']}")
    assert reopened.status_code == 200
    assert reopened.json()["scene"] == scene
    assert client.get("/api/conversations").json()[0]["scene"] == scene


def test_unknown_values_remain_rejected():
    with pytest.raises(ValueError):
        Appearance(hair="unknown")
    with pytest.raises(ValueError):
        ConversationInput(character_id="friend", scene="unknown")


@pytest.mark.parametrize(
    "voice,expected", [("male", "masculine"), ("female", "feminine")]
)
@pytest.mark.parametrize("presentation", ["masculine", "feminine", "neutral"])
def test_gender_is_derived_from_voice_including_legacy_characters(
    voice, expected, presentation
):
    payload = {
        "name": "Alex",
        "voice": voice,
        "appearance": {"presentation": presentation, "hair": "bun"},
    }
    friend = CharacterInput.model_validate(payload)
    assert friend.appearance.presentation == expected
    assert friend.appearance.hair == "bun"
    assert payload["appearance"]["presentation"] == presentation
    assert get_args(Appearance.model_fields["presentation"].annotation) == (
        "masculine",
        "feminine",
    )


def test_gender_and_voice_remain_linked_after_saving_and_reopening(client, ai):
    register(client)
    response = client.post(
        "/api/characters",
        json={
            "name": "Alex",
            "voice": "female",
            "appearance": {
                "presentation": "masculine",
                "hair": "afro",
                "glasses": "round",
            },
        },
    )
    assert response.status_code == 200
    friend = response.json()
    assert friend["appearance"]["presentation"] == "feminine"
    original = client.post(
        "/api/conversations", json={"character_id": friend["id"]}
    ).json()
    friend["voice"] = "male"
    updated = client.put(f"/api/characters/{friend['id']}", json=friend)
    assert updated.status_code == 200
    assert updated.json()["appearance"]["presentation"] == "masculine"
    reopened = client.get("/api/characters").json()[0]
    assert reopened["voice"] == "male"
    assert reopened["appearance"]["presentation"] == "masculine"
    assert reopened["appearance"]["hair"] == "afro"
    assert reopened["appearance"]["glasses"] == "round"
    previous = client.get(f"/api/conversations/{original['id']}").json()
    assert previous["snapshot"]["voice"] == "female"
    assert previous["snapshot"]["appearance"]["presentation"] == "feminine"
