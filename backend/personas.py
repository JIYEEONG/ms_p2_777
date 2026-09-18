# backend/personas.py

# MOOV AI 말동무 공통 설계서 — [페르소나 코드] 기준 (moove/todaki/expert/lingo)
# 프론트는 한글("무브" 등)을 그대로 보내고, 백엔드 진입점(get_persona_code)에서 영문 코드로 변환해 내부에서 사용한다.
PERSONA_CODE_MAP = {
    "무브": "moove",
    "토닥이": "todaki",
    "척척박사": "expert",
    "링고": "lingo",
}
PERSONA_DISPLAY_MAP = {v: k for k, v in PERSONA_CODE_MAP.items()}
DEFAULT_PERSONA_CODE = "moove"

# TODO: 정식 페르소나별 시스템 프롬프트는 RAG 담당자가 설계한 버전으로 교체 예정 (임시 placeholder)
EMOJI_BAN = "답변에 이모티콘이나 이모지를 절대 사용하지 마. 텍스트로만 자연스럽게 대화해."
# B-2: 답변 길이는 짧게(2~3문장 이내)로 유지
LENGTH_LIMIT = "답변은 2~3문장 이내로 짧고 자연스럽게 해. 차량 이동 중 음성으로 듣는 대화이므로 장황한 설명은 피해."

PERSONA_PROMPTS = {
    "moove": f"너는 무브, moov 앱의 말동무 AI야. 캐주얼하고 편안한 잡담 상대로, 공감하면서 자연스럽게 대화해. {EMOJI_BAN} {LENGTH_LIMIT}",
    "todaki": f"너는 토닥이, moov 앱의 상담 페르소나야. 고민 상담에 집중하고, 따뜻하게 공감하며 천천히 들어주는 태도로 대화해. 공감을 우선하고, 섣부른 해결책이나 조언을 먼저 제시하지 마. {EMOJI_BAN} {LENGTH_LIMIT}",
    "expert": f"너는 척척박사, moov 앱의 지식 안내 페르소나야. 아는 정보를 정확하고 신뢰감 있게, 핵심 위주로 짧게 설명해. 실시간성 정보가 필요한 질문(오늘 날씨, 현재 시세, 최신 뉴스 등)은 모른다고 명시해. 의료나 법률처럼 전문가 판단이 필요한 질문에는 답변 뒤에 '전문가 상담을 권장해요' 문구를 반드시 포함해. {EMOJI_BAN} {LENGTH_LIMIT}",
    "lingo": f"너는 링고, moov 앱의 통역·투어가이드 페르소나야. 실시간 통역과 주변 관광정보 안내에 집중해서 대화해. {EMOJI_BAN} {LENGTH_LIMIT}",
}
DEFAULT_PERSONA_PROMPT = PERSONA_PROMPTS[DEFAULT_PERSONA_CODE]

# 사용자 발화 안에서 페르소나 "이름"을 찾을 때는 한글 그대로 매칭 (사용자가 한글로 말하니까)
PERSONA_NAMES_KR = ["무브", "토닥이", "척척박사", "링고"]

# D-1 공통 정책: 확정적 명령 동사가 포함된 경우에만 "명령"으로 판별해 즉시 전환.
# 명령 동사 없이 페르소나 이름만 언급된 경우는 일반 대화로 취급(자동 전환 X).
COMMAND_VERBS = ["바꿔줘", "바꿔", "전환해줘", "전환해", "전환", "보여줘", "틀어줘"]

# front의 checkCrisisKeywords와 동일한 목록 — 위기 로그 판단용
CRISIS_KEYWORDS = ["우울해", "우울하", "죽고싶", "죽고 싶", "살기싫", "살기 싫", "힘들어 죽겠", "자살"]


def get_persona_code(persona_kr_or_code: str) -> str:
    """프론트에서 온 값(한글 또는 이미 영문 코드)을 내부 표준 영문 코드로 변환"""
    if persona_kr_or_code in PERSONA_DISPLAY_MAP:
        return persona_kr_or_code
    return PERSONA_CODE_MAP.get(persona_kr_or_code, DEFAULT_PERSONA_CODE)


def is_crisis_message(text: str) -> bool:
    return any(keyword in text for keyword in CRISIS_KEYWORDS)


def detect_persona_switch(message: str, current_persona_code: str) -> str | None:
    """D-1: 명령 동사 + 페르소나 이름이 함께 있을 때만 전환 대상으로 판별.
    반환값은 내부 표준 영문 코드(moove/todaki/expert/lingo), 없으면 None."""
    if not any(verb in message for verb in COMMAND_VERBS):
        return None
    for name_kr in PERSONA_NAMES_KR:
        target_code = PERSONA_CODE_MAP[name_kr]
        if target_code == current_persona_code:
            continue
        if name_kr in message:
            return target_code
    return None