# backend/config.py
import os
from pathlib import Path
from dotenv import load_dotenv
from openai import AzureOpenAI

load_dotenv(dotenv_path=Path(__file__).parent / ".env")

# --- 채팅/임베딩 클라이언트 — Azure AI Foundry ---
client = AzureOpenAI(
    azure_endpoint=os.environ["AZURE_FOUNDRY_ENDPOINT"],
    api_key=os.environ["AZURE_FOUNDRY_API_KEY"],
    api_version=os.environ["AZURE_OPENAI_API_VERSION"],
)

AZURE_OPENAI_DEPLOYMENT_NAME = os.environ["AZURE_OPENAI_DEPLOYMENT_NAME"]
AZURE_EMBEDDING_DEPLOYMENT_NAME = os.environ["AZURE_EMBEDDING_DEPLOYMENT_NAME"]
AZURE_SPEECH_KEY = os.environ["AZURE_SPEECH_KEY"]
AZURE_SPEECH_REGION = os.environ["AZURE_SPEECH_REGION"]