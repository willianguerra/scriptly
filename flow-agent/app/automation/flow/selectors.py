import re
import unicodedata

# This is the only module that contains Google Flow selector values.
AUTH_URL_HOST = "accounts.google.com"
BUTTON_ROLE = "button"
IMAGE_ROLE = "img"
PUBLIC_CREATE_BUTTON_NAME = re.compile(r"Create with Google Flow", re.IGNORECASE)
NEW_PROJECT_BUTTON_NAME = re.compile(r"(?:Novo projeto|New project)", re.IGNORECASE)
COMPOSER_EDITOR_CSS = 'div[role="textbox"][contenteditable="true"]'
COMPOSER_CONTAINER_XPATH = "xpath=../.."
COMPOSER_BUTTON_CSS = "button"
CONFIG_BUTTON_INDEX = 2
SUBMIT_BUTTON_INDEX = 3
SUBMIT_BUTTON_NAME = re.compile(r"(?:Criar|Create|arrow_forward)", re.IGNORECASE)
MENU_ROLE = "menu"
TAB_ROLE = "tab"
VIDEO_TAB_NAME = re.compile(
    r"^(?:videocam\s*)?(?:Vídeo|Video)$", re.IGNORECASE
)
ELEMENTS_TAB_NAME = re.compile(
    r"^(?:chrome_extension\s*)?(?:Elementos|Elements)$", re.IGNORECASE
)
ASPECT_RATIO_NAME = re.compile(r"^(?:crop_16_9\s*)?16:9$", re.IGNORECASE)
DURATION_NAME = "4s"
COUNT_NAME = "x1"
MODEL_BUTTON_NAME = re.compile(
    r"(?:Omni Flash|Veo 3\.1 - (?:Lite|Fast|Quality).*)", re.IGNORECASE
)
FREE_VIDEO_MODEL_NAME = re.compile(
    r"^Veo 3\.1 - Lite \[Lower Priority\]$", re.IGNORECASE
)
SELECTED_FREE_VIDEO_MODEL_NAME = re.compile(
    r"^Veo 3\.1 - Lite \[Lower Priority\](?:\s*arrow_drop_down)?$",
    re.IGNORECASE,
)
MENUITEM_ROLE = "menuitem"
COST_LINK_CSS = "a"
COST_TEXT_PATTERN = re.compile(
    r"^\s*\d+\s+(?:créditos?|credits?)\s*$", re.IGNORECASE
)
ZERO_COST_TEXT_PATTERN = re.compile(
    r"^\s*0\s+(?:créditos?|credits?)\s*$", re.IGNORECASE
)
COST_SETTLE_TIMEOUT_MS = 5_000
EMPTY_PROJECT_NAME = re.compile(
    r"(?:Comece a criar ou adicione arquivos|Start creating or add files)",
    re.IGNORECASE,
)
PROGRESS_TEXT_PATTERN = re.compile(r"^\d{1,3}%$")
VIDEO_THUMBNAIL_NAME = re.compile(
    r"(?:Miniatura do vídeo|Video thumbnail)", re.IGNORECASE
)
VIDEO_CSS = "video"
THUMBNAIL_BUTTON_XPATH = "xpath=ancestor::button[1]"
DOWNLOAD_BUTTON_NAME = re.compile(r"(?:download\s*)?(?:Baixar|Download)", re.IGNORECASE)
AUTH_REQUIRED_TEXT_PATTERN = re.compile(
    r"(?:Fazer login|Sign in|Verifique se é você|Verify it.s you|CAPTCHA)",
    re.IGNORECASE,
)
TERMINAL_FAILURE_TEXT_PATTERN = re.compile(
    r"^(?:Falha|Failed|Não foi possível gerar|Couldn.t generate)$", re.IGNORECASE
)
HUMAN_INTERACTION_TEXT_PATTERN = re.compile(
    r"(?:CAPTCHA|verifique se é você|verify it.s you)", re.IGNORECASE
)

_COST_VALUE_PATTERN = re.compile(r"^\s*(\d+)\s+(?:cr.ditos?|credits?)\s*$", re.I)


def parse_credit_cost(text: str) -> int | None:
    """Parse the UI cost label; unknown formats intentionally fail closed."""

    normalized = unicodedata.normalize("NFKC", text)
    normalized = "".join(
        character
        for character in normalized
        if unicodedata.category(character) != "Cf"
    )
    match = _COST_VALUE_PATTERN.fullmatch(normalized)
    return int(match.group(1)) if match else None
