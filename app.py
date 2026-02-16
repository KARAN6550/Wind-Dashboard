import json
import boto3
import uuid
import os
import traceback
from datetime import datetime

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel


# --------------------------------------------------
# CONFIG
# --------------------------------------------------

# Single region for everything
AWS_REGION = "us-east-1"

# S3
S3_BUCKET = "wind-turbine-dashboard"
KPI_FILE_KEY = "kpis_final.json"

# Bedrock Model (OpenAI on-demand)
MODEL_ID = "openai.gpt-oss-120b-1:0"

# Limits
MAX_USER_CHARS = 2000
MAX_TOKENS = 800


# --------------------------------------------------
# AWS CLIENTS
# --------------------------------------------------

bedrock = boto3.client(
    "bedrock-runtime",
    region_name=AWS_REGION
)

s3 = boto3.client(
    "s3",
    region_name=AWS_REGION
)


# --------------------------------------------------
# FASTAPI APP
# --------------------------------------------------

app = FastAPI(
    title="Wind Turbine Analytics AI",
    version="1.0.0"
)


# CORS (restrict later)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)


# --------------------------------------------------
# DATA MODELS
# --------------------------------------------------

class ChatRequest(BaseModel):
    session_id: str
    message: str


class ChatResponse(BaseModel):
    answer: str
    session_id: str


# --------------------------------------------------
# LOAD DASHBOARD DATA FROM S3
# --------------------------------------------------

def load_dashboard_data():

    try:

        response = s3.get_object(
            Bucket=S3_BUCKET,
            Key=KPI_FILE_KEY
        )

        raw = response["Body"].read().decode("utf-8")

        return json.loads(raw)

    except Exception as e:

        print("S3 READ ERROR:", str(e))

        return None


import re

def clean_llm_output(text: str) -> str:
    """
    Remove <reasoning>...</reasoning> blocks if present
    """
    return re.sub(r"<reasoning>.*?</reasoning>", "", text, flags=re.DOTALL).strip()

# --------------------------------------------------
# CALL OPENAI GPT-OSS VIA BEDROCK
# --------------------------------------------------

def call_llm(prompt: str) -> str:

    body = {
        "messages": [
            {
                "role": "system",
                "content": "You are a precise data analytics assistant."
            },
            {
                "role": "user",
                "content": prompt
            }
        ],
        "max_tokens": MAX_TOKENS,
        "temperature": 0.2
    }

    try:

        response = bedrock.invoke_model(
            modelId=MODEL_ID,
            contentType="application/json",
            accept="application/json",
            body=json.dumps(body)
        )

        result = json.loads(response["body"].read())

        # OpenAI-style parsing
        if "choices" in result:
            raw = result["choices"][0]["message"]["content"]
            return clean_llm_output(raw)

        print("UNEXPECTED BEDROCK RESPONSE:", result)

        return "Model returned unexpected response."

    except Exception as e:

        print("========== BEDROCK ERROR ==========")
        print(traceback.format_exc())
        print("===================================")

        return f"Bedrock error: {str(e)}"


# --------------------------------------------------
# STORE CHAT LOGS TO S3
# --------------------------------------------------

def store_chat(session_id: str, question: str, answer: str):

    key = f"chatlogs/{session_id}/{uuid.uuid4()}.json"

    data = {
        "timestamp": datetime.utcnow().isoformat(),
        "session_id": session_id,
        "question": question,
        "answer": answer
    }

    try:

        s3.put_object(
            Bucket=S3_BUCKET,
            Key=key,
            Body=json.dumps(data),
            ContentType="application/json",
            ServerSideEncryption="AES256"
        )

    except Exception as e:

        print("S3 WRITE ERROR:", str(e))


# --------------------------------------------------
# MAIN API ENDPOINT
# --------------------------------------------------

@app.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest):

    # Limit input size
    user_msg = req.message[:MAX_USER_CHARS]

    # Load KPI data
    dashboard_data = load_dashboard_data()

    if not dashboard_data:
        return {
            "answer": "Dashboard data unavailable.",
            "session_id": req.session_id
        }

    context = json.dumps(dashboard_data, indent=2)

    # Analytics Prompt
    prompt = f"""
You are a data analytics assistant.

You MUST answer using only the provided dashboard data.

If the answer cannot be derived from the data,
respond with: "Insufficient data."

Dashboard Data:
{context}

User Question:
{user_msg}

Rules:
- No guessing
- No assumptions
- No external knowledge
- Be concise
"""

    # Call LLM
    answer = call_llm(prompt)

    # Store audit log
    store_chat(
        req.session_id,
        user_msg,
        answer
    )

    return {
        "answer": answer,
        "session_id": req.session_id
    }


# --------------------------------------------------
# HEALTH CHECK
# --------------------------------------------------

@app.get("/health")
def health():

    return {
        "status": "ok",
        "service": "wind-turbine-ai",
        "region": AWS_REGION,
        "model": MODEL_ID
    }
