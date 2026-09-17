import os
import io
import re
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from dotenv import load_dotenv
from openai import AzureOpenAI
import azure.cognitiveservices.speech as speechsdk

load_dotenv(dotenv_path=Path(__file__).parent / ".env")
app = FastAPI()

# 로컬 프론트 개발 서버 주소로 제한 (배포 시 실제 도메인으로 교체)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 채팅(텍스트 응답) 클라이언트 — Azure AI Foundry (gpt-5.6-luna) ---
client = AzureOpenAI(
    azure_endpoint=os.environ["AZURE_FOUNDRY_ENDPOINT"],
    api_key=os.environ["AZURE_FOUNDRY_API_KEY"],
    api_version=os.environ["AZURE_OPENAI_API_VERSION"],
)

# TODO: 정식 페르소나별 시스템 프롬프트는 RAG 담당자가 설계한 버전으로 교체 예정 (임시 placeholder)
EMOJI_BAN = "답변에 이모티콘이나 이모지를 절대 사용하지 마. 텍스트로만 자연스럽게 대화해."
# B-2: 답변 길이는 짧게(2~3문장 이내)로 유지
LENGTH_LIMIT = "답변은 2~3문장 이내로 짧고 자연스럽게 해. 차량 이동 중 음성으로 듣는 대화이므로 장황한 설명은 피해."
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

def get_persona_code(persona_kr_or_code: str) -> str:
    """프론트에서 온 값(한글 또는 이미 영문 코드)을 내부 표준 영문 코드로 변환"""
    if persona_kr_or_code in PERSONA_DISPLAY_MAP:
        return persona_kr_or_code
    return PERSONA_CODE_MAP.get(persona_kr_or_code, DEFAULT_PERSONA_CODE)

PERSONA_PROMPTS = {
    "moove": f"너는 무브, moov 앱의 말동무 AI야. 캐주얼하고 편안한 잡담 상대로, 공감하면서 자연스럽게 대화해. {EMOJI_BAN} {LENGTH_LIMIT}",
    "todaki": f"너는 토닥이, moov 앱의 상담 페르소나야. 고민 상담에 집중하고, 따뜻하게 공감하며 천천히 들어주는 태도로 대화해. 공감을 우선하고, 섣부른 해결책이나 조언을 먼저 제시하지 마. {EMOJI_BAN} {LENGTH_LIMIT}",
    "expert": f"너는 척척박사, moov 앱의 지식 안내 페르소나야. 아는 정보를 정확하고 신뢰감 있게, 핵심 위주로 짧게 설명해. 실시간성 정보가 필요한 질문(오늘 날씨, 현재 시세, 최신 뉴스 등)은 모른다고 명시해. 의료나 법률처럼 전문가 판단이 필요한 질문에는 답변 뒤에 '전문가 상담을 권장해요' 문구를 반드시 포함해. {EMOJI_BAN} {LENGTH_LIMIT}",
    "lingo": f"너는 링고, moov 앱의 통역·투어가이드 페르소나야. 실시간 통역과 주변 관광정보 안내에 집중해서 대화해. {EMOJI_BAN} {LENGTH_LIMIT}",
}
DEFAULT_PERSONA_PROMPT = PERSONA_PROMPTS[DEFAULT_PERSONA_CODE]

class ChatRequest(BaseModel):
    message: str
    persona: str = "무브"
    history: list[dict] = []

# 사용자 발화 안에서 페르소나 "이름"을 찾을 때는 한글 그대로 매칭 (사용자가 한글로 말하니까)
PERSONA_NAMES_KR = ["무브", "토닥이", "척척박사", "링고"]

# D-1 공통 정책: 확정적 명령 동사가 포함된 경우에만 "명령"으로 판별해 즉시 전환.
# 명령 동사 없이 페르소나 이름만 언급된 경우는 일반 대화로 취급(자동 전환 X).
COMMAND_VERBS = ["바꿔줘", "바꿔", "전환해줘", "전환해", "전환", "보여줘", "틀어줘"]

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

# --- RAG 연결 지점 (뼈대) ---
# TODO: 데이터 담당자(지훈)의 Azure AI Search 인덱스 + service_knowledge_docs 테이블
# 준비 완료 후 실제 검색 로직으로 교체.
#
# 예정 데이터 소스 (2026-09-17 공통 설계서 기준으로 정정):
#   - 무브: Silver.service_knowledge_docs (doc_id, title, content, source_type[D/S], topic, updated_at)
#          → MOOV 서비스 안내·FAQ RAG는 척척박사가 아니라 무브(moove) 담당. content가 Azure AI Search 인덱싱 대상.
#   - 링고: Silver.course_points (place_name_en, address_en, address_source, category) + courses(duration_seconds, distance_m)
#          → 코스 대표 이미지·타이틀 컬럼은 계획에 없어 요청하지 않음. 코스 명칭은 경유지 장소명 조합으로 대체 (기획서 수정 반영).
#   - 척척박사: 공식 설계서에 아직 프롬프트 미작성 (작성 영역) — RAG 범위 확정 전
#
# 예정 로깅 연동: ai_sessions.rag_used(BOOLEAN), ai_sessions.rag_source_ids(STRING, 콤마구분)
#   → 이 함수가 실제로 근거를 찾았는지, 어떤 doc_id/course_point를 썼는지 chat() 쪽에서 기록해야 함
def search_local_knowledge(query: str, persona: str) -> dict | None:
    """
    RAG 검색 — 아직 미구현 (테이블/인덱스 준비 전).
    반환 예정 형태: {"content": str, "source_type": "D" | "S", "doc_id": str}
    """
    return None


@app.post("/api/luna/chat")
def chat(req: ChatRequest):
    persona_code = get_persona_code(req.persona)  # 프론트가 보낸 한글/영문 값을 내부 표준 코드로 변환
    switched_to_code = detect_persona_switch(req.message, persona_code)
    active_code = switched_to_code or persona_code
    system_prompt = PERSONA_PROMPTS.get(active_code, DEFAULT_PERSONA_PROMPT)

    # RAG 검색 결과가 있으면 시스템 프롬프트에 컨텍스트로 추가
    # TODO: ai_sessions.rag_used / rag_source_ids 로깅은 실제 검색 연동 시 함께 구현
    rag_result = search_local_knowledge(req.message, active_code)
    if rag_result:
        source_tag = f"[{rag_result['source_type']}] " if rag_result.get("source_type") else ""
        system_prompt += f"\n\n[참고 정보]\n{source_tag}{rag_result['content']}\n위 정보를 참고해서 답변해. 정보에 없는 내용은 지어내지 마."

    # 프론트에는 다시 한글로 돌려줌 (프론트 코드 변경 없이 기존과 동일하게 동작)
    switched_to_kr = PERSONA_DISPLAY_MAP.get(switched_to_code) if switched_to_code else None

    messages = [{"role": "system", "content": system_prompt}]
    messages.extend(req.history)
    messages.append({"role": "user", "content": req.message})

    response = client.chat.completions.create(
        model=os.environ["AZURE_OPENAI_DEPLOYMENT_NAME"],
        messages=messages,
    )
    return {"reply": response.choices[0].message.content, "switched_persona": switched_to_kr}


# --- 음성 응답(TTS) — Azure AI Speech ---
# 페르소나별 목소리 매핑 (지금은 한국어 고정)
# TODO: 언어 전환 브랜치 머지 후, (persona, language) 튜플 키로 확장 필요
VOICE_MAP = {
    "moove": "ko-KR-SeoHyeonNeural",
    "todaki": "ko-KR-YuJinNeural",
    "expert": "ko-KR-InJoonNeural",
    "lingo": "en-US-AndrewMultilingualNeural",
}
DEFAULT_VOICE = "ko-KR-SunHiNeural"

class TTSRequest(BaseModel):
    text: str
    persona: str = "무브"

@app.post("/api/luna/tts")
def tts(req: TTSRequest):
    voice_name = VOICE_MAP.get(get_persona_code(req.persona), DEFAULT_VOICE)

    # 이모지 제거 (TTS가 이상하게 읽는 것 방지)
    emoji_pattern = re.compile(
        "["
        "\U0001F300-\U0001FAFF"  # 각종 이모지
        "\U00002600-\U000027BF"  # 기타 심볼
        "\U0001F1E6-\U0001F1FF"  # 국기
        "]+",
        flags=re.UNICODE,
    )
    clean_text = emoji_pattern.sub("", req.text).strip()

    speech_config = speechsdk.SpeechConfig(
        subscription=os.environ["AZURE_SPEECH_KEY"],
        region=os.environ["AZURE_SPEECH_REGION"],
    )
    speech_config.speech_synthesis_voice_name = voice_name
    speech_config.set_speech_synthesis_output_format(
        speechsdk.SpeechSynthesisOutputFormat.Audio16Khz32KBitRateMonoMp3
    )

    ssml = f"""
    <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="ko-KR">
        <voice name="{voice_name}">
            <prosody rate="+30%">{clean_text}</prosody>
        </voice>
    </speak>
    """

    synthesizer = speechsdk.SpeechSynthesizer(speech_config=speech_config, audio_config=None)
    result = synthesizer.speak_ssml_async(ssml).get()

    if result.reason != speechsdk.ResultReason.SynthesizingAudioCompleted:
        return {"error": f"TTS 실패: {result.reason}"}

    audio_stream = io.BytesIO(result.audio_data)
    return StreamingResponse(audio_stream, media_type="audio/mpeg")