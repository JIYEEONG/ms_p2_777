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
PERSONA_PROMPTS = {
    "무브": f"너는 무브, moov 앱의 말동무 AI야. 캐주얼하고 편안한 잡담 상대로, 공감하면서 자연스럽게 대화해. {EMOJI_BAN}",
    "토닥이": f"너는 토닥이, moov 앱의 상담 페르소나야. 고민 상담에 집중하고, 따뜻하게 공감하며 천천히 들어주는 태도로 대화해. {EMOJI_BAN}",
    "척척박사": f"너는 척척박사, moov 앱의 지식 안내 페르소나야. 아는 정보를 정확하고 신뢰감 있게, 핵심 위주로 짧게 설명해. {EMOJI_BAN}",
    "링고": f"너는 링고, moov 앱의 통역·투어가이드 페르소나야. 실시간 통역과 주변 관광정보 안내에 집중해서 대화해. {EMOJI_BAN}",
}
DEFAULT_PERSONA_PROMPT = PERSONA_PROMPTS["무브"]

class ChatRequest(BaseModel):
    message: str
    persona: str = "무브"

PERSONA_NAMES = ["무브", "토닥이", "척척박사", "링고"]

def detect_persona_switch(message: str, current_persona: str) -> str | None:
    """사용자 발화에서 다른 페르소나로 바꿔달라는 요청을 감지하면 그 이름을 반환, 아니면 None"""
    for name in PERSONA_NAMES:
        if name == current_persona:
            continue
        if name in message and any(kw in message for kw in ["바꿔", "전환", "모드로", "랑 얘기", "와 얘기", "로 바꾸"]):
            return name
    return None

@app.post("/api/luna/chat")
def chat(req: ChatRequest):
    switched_to = detect_persona_switch(req.message, req.persona)
    active_persona = switched_to or req.persona
    system_prompt = PERSONA_PROMPTS.get(active_persona, DEFAULT_PERSONA_PROMPT)

    response = client.chat.completions.create(
        model=os.environ["AZURE_OPENAI_DEPLOYMENT_NAME"],
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": req.message},
        ],
    )
    return {"reply": response.choices[0].message.content, "switched_persona": switched_to}


# --- 음성 응답(TTS) — Azure AI Speech ---
# 페르소나별 목소리 매핑 (지금은 한국어 고정)
# TODO: 언어 전환 브랜치 머지 후, (persona, language) 튜플 키로 확장 필요
VOICE_MAP = {
    "무브": "ko-KR-SeoHyeonNeural",
    "토닥이": "ko-KR-YuJinNeural",
    "척척박사": "ko-KR-InJoonNeural",
    "링고": "en-US-AndrewMultilingualNeural",
}
DEFAULT_VOICE = "ko-KR-SunHiNeural"

class TTSRequest(BaseModel):
    text: str
    persona: str = "무브"

@app.post("/api/luna/tts")
def tts(req: TTSRequest):
    voice_name = VOICE_MAP.get(req.persona, DEFAULT_VOICE)

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