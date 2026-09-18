# backend/routers/stt.py
import os
import tempfile
import azure.cognitiveservices.speech as speechsdk
from fastapi import APIRouter, UploadFile, File
from pydub import AudioSegment

from config import AZURE_SPEECH_KEY, AZURE_SPEECH_REGION

router = APIRouter()

SUPPORTED_STT_LANGUAGES = ["ko-KR", "en-US"]


@router.post("/api/luna/stt")
async def stt(audio: UploadFile = File(...)):
    raw_bytes = await audio.read()
    src_tmp = tempfile.NamedTemporaryFile(suffix=".webm", delete=False)
    src_tmp.write(raw_bytes)
    src_tmp.close()

    sound = AudioSegment.from_file(src_tmp.name)
    sound = sound.set_frame_rate(16000).set_channels(1)
    wav_path = src_tmp.name + ".wav"
    sound.export(wav_path, format="wav")
    os.remove(src_tmp.name)

    speech_config = speechsdk.SpeechConfig(
        subscription=AZURE_SPEECH_KEY,
        region=AZURE_SPEECH_REGION,
    )
    auto_detect_config = speechsdk.languageconfig.AutoDetectSourceLanguageConfig(
        languages=SUPPORTED_STT_LANGUAGES
    )
    audio_config = speechsdk.AudioConfig(filename=wav_path)

    recognizer = speechsdk.SpeechRecognizer(
        speech_config=speech_config,
        auto_detect_source_language_config=auto_detect_config,
        audio_config=audio_config,
    )
    result = recognizer.recognize_once()
    del recognizer
    del audio_config
    try:
        os.remove(wav_path)
    except PermissionError:
        pass

    if result.reason != speechsdk.ResultReason.RecognizedSpeech:
        return {"error": f"STT 실패: {result.reason}"}

    detected_language = speechsdk.AutoDetectSourceLanguageResult(result).language
    return {"text": result.text, "detected_language": detected_language}