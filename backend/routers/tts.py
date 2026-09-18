# backend/routers/tts.py
import io
import re
import azure.cognitiveservices.speech as speechsdk
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from config import AZURE_SPEECH_KEY, AZURE_SPEECH_REGION
from personas import get_persona_code

router = APIRouter()

# 페르소나별 목소리 매핑 (한국어 기본)
VOICE_MAP = {
    "moove": "ko-KR-SeoHyeonNeural",
    "todaki": "ko-KR-YuJinNeural",
    "expert": "ko-KR-InJoonNeural",
    "lingo": "en-US-AndrewMultilingualNeural",
}
DEFAULT_VOICE = "ko-KR-SunHiNeural"

# 감지된 언어가 영어일 때 쓸 대체 목소리 — 톤(성별·분위기)을 최대한 맞춤
VOICE_MAP_EN = {
    "moove": "en-US-AriaNeural",
    "todaki": "en-US-JennyNeural",
    "expert": "en-US-GuyNeural",
    "lingo": "en-US-AndrewMultilingualNeural",
}


class TTSRequest(BaseModel):
    text: str
    persona: str = "무브"
    detected_language: str | None = None


@router.post("/api/luna/tts")
def tts(req: TTSRequest):
    persona_code = get_persona_code(req.persona)
    if req.detected_language and req.detected_language.startswith("en"):
        voice_name = VOICE_MAP_EN.get(persona_code, DEFAULT_VOICE)
        ssml_lang = "en-US"
    else:
        voice_name = VOICE_MAP.get(persona_code, DEFAULT_VOICE)
        ssml_lang = "ko-KR"

    emoji_pattern = re.compile(
        "["
        "\U0001F300-\U0001FAFF"
        "\U00002600-\U000027BF"
        "\U0001F1E6-\U0001F1FF"
        "]+",
        flags=re.UNICODE,
    )
    clean_text = emoji_pattern.sub("", req.text).strip()

    speech_config = speechsdk.SpeechConfig(
        subscription=AZURE_SPEECH_KEY,
        region=AZURE_SPEECH_REGION,
    )
    speech_config.speech_synthesis_voice_name = voice_name
    speech_config.set_speech_synthesis_output_format(
        speechsdk.SpeechSynthesisOutputFormat.Audio16Khz32KBitRateMonoMp3
    )

    ssml = f"""
    <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="{ssml_lang}">
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