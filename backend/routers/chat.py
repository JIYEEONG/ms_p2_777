# backend/routers/chat.py
import os
from fastapi import APIRouter
from pydantic import BaseModel

from config import client, AZURE_OPENAI_DEPLOYMENT_NAME
from personas import (
    get_persona_code,
    detect_persona_switch,
    is_crisis_message,
    PERSONA_PROMPTS,
    PERSONA_DISPLAY_MAP,
    DEFAULT_PERSONA_PROMPT,
)
from rag import search_local_knowledge
import db

router = APIRouter()


class ChatRequest(BaseModel):
    message: str
    persona: str = "무브"
    history: list[dict] = []
    detected_language: str | None = None
    session_id: str | None = None
    save_consent: bool = False


@router.post("/api/luna/chat")
def chat(req: ChatRequest):
    persona_code = get_persona_code(req.persona)
    switched_to_code = detect_persona_switch(req.message, persona_code)
    active_code = switched_to_code or persona_code
    system_prompt = PERSONA_PROMPTS.get(active_code, DEFAULT_PERSONA_PROMPT)

    if req.detected_language and not req.detected_language.startswith("ko"):
        system_prompt += f"\n\n사용자가 {req.detected_language} 언어로 말했다. 이번 답변은 반드시 그 언어로 자연스럽게 작성해."

    rag_result = search_local_knowledge(req.message, active_code)
    if rag_result:
        source_tag = f"[{rag_result['source_type']}] " if rag_result.get("source_type") else ""
        system_prompt += f"\n\n[참고 정보]\n{source_tag}{rag_result['content']}\n위 정보를 참고해서 답변해. 정보에 없는 내용은 지어내지 마."

    switched_to_kr = PERSONA_DISPLAY_MAP.get(switched_to_code) if switched_to_code else None

    messages = [{"role": "system", "content": system_prompt}]
    messages.extend(req.history)
    messages.append({"role": "user", "content": req.message})

    is_crisis = is_crisis_message(req.message)
    if is_crisis:
        try:
            db.log_crisis_event(
                conversation_id=req.session_id,
                user_id="anonymous",
                persona=active_code,
                message_content=req.message,
            )
        except Exception as e:
            print(f"위기 로그 저장 실패: {e}")

    try:
        response = client.chat.completions.create(
            model=AZURE_OPENAI_DEPLOYMENT_NAME,
            messages=messages,
        )
        reply_text = response.choices[0].message.content
    except Exception as e:
        print(f"GPT 응답 실패: {e}")
        if is_crisis:
            reply_text = "지금 많이 힘드신 것 같아요. 혼자 견디기 어려운 순간이라면 1393(자살예방상담전화)으로 연결해서 도움을 받을 수 있어요."
        else:
            reply_text = "죄송해요, 지금 답변을 만드는 데 문제가 생겼어요. 다시 한 번 말씀해 주시겠어요?"

    if req.save_consent and req.session_id:
        try:
            db.ensure_session(req.session_id, "anonymous", active_code, req.detected_language)
            db.log_turn_event(req.session_id, "user", req.message, "anonymous")
            db.log_turn_event(req.session_id, "ai", reply_text, "anonymous")
        except Exception as e:
            print(f"대화 저장 실패: {e}")

    return {"reply": reply_text, "switched_persona": switched_to_kr}