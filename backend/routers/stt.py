# backend/routers/stt.py
import os
import subprocess
import tempfile
import azure.cognitiveservices.speech as speechsdk
from fastapi import APIRouter, UploadFile, File
import imageio_ffmpeg

from config import AZURE_SPEECH_KEY, AZURE_SPEECH_REGION

router = APIRouter()

SUPPORTED_STT_LANGUAGES = ["ko-KR", "en-US"]


@router.post("/api/luna/stt")
async def stt(audio: UploadFile = File(...)):
    raw_bytes = await audio.read()
    src_tmp = tempfile.NamedTemporaryFile(suffix=".webm", delete=False)
    src_tmp.write(raw_bytes)
    src_tmp.close()

    # webm → WAV(16kHz mono): pip 패키지에 포함된 ffmpeg 사용 (시스템 ffmpeg 설치 불필요)
    wav_path = src_tmp.name + ".wav"
    try:
        subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), "-y", "-i", src_tmp.name, "-ar", "16000", "-ac", "1", wav_path],
                       check=True, capture_output=True)
    except subprocess.CalledProcessError:
        return {"error": "STT 실패: 오디오 변환 오류"}
    finally:
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