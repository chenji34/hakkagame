import os
import re
from difflib import SequenceMatcher

import requests
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 12 * 1024 * 1024
API_BASE = "https://api.gohakka.org/v3/pro"
DIALECTS = {"sixian", "hailu", "dapu", "raoping", "zhaoan", "nansixian"}


def api_request(path, *, data=None, files=None):
    token = os.environ.get("GOHAKKA_API_KEY", "").strip()
    if not token:
        raise RuntimeError("伺服器尚未設定 Gohakka API Key。請在 Render 加入 GOHAKKA_API_KEY 環境變數。")
    try:
        response = requests.post(f"{API_BASE}/{path}", headers={"Authorization": f"Bearer {token}"}, data=data, files=files, timeout=60)
        response.raise_for_status()
        result = response.json()
    except (requests.RequestException, ValueError) as exc:
        raise RuntimeError("Gohakka API 目前無法連線或回應格式無效，請稍後再試。") from exc
    if not result.get("success") or result.get("data") is None:
        raise RuntimeError((result.get("error") or {}).get("message", "Gohakka API 暫時無法處理這項請求。"))
    return result["data"]


@app.get("/")
def home():
    return render_template("index.html")


@app.post("/api/question")
def question():
    body = request.get_json(silent=True) or {}
    dialect, prompt = body.get("dialect", "sixian"), str(body.get("prompt", "")).strip()
    if dialect not in DIALECTS:
        return jsonify(error="請選擇有效的客語腔調。"), 400
    if not prompt or len(prompt) > 300:
        return jsonify(error="題目文字不可空白，且需在 300 字以內。"), 400
    try:
        translated = api_request("text/translations", data={"text": prompt, "dialectCode": dialect, "targetCode": "hak", "engine": "model"})
        answers = translated.get("hak") or []
        if isinstance(answers, str):
            answers = [answers]
        answer = "、".join(str(item) for item in answers if item).strip()
        if not answer:
            return jsonify(error="這題暫時沒有客語參考答案，請換一題。"), 502
        speech = api_request("audio/speech", data={"text": answer[:300], "dialectCode": dialect, "sourceCode": "hak"})
        return jsonify(prompt=prompt, answer=answer, audio="data:audio/mpeg;base64," + speech["audioBase64"])
    except RuntimeError as exc:
        return jsonify(error=str(exc)), 502


@app.post("/api/score")
def score():
    dialect, answer = request.form.get("dialect", "sixian"), request.form.get("answer", "").strip()
    audio = request.files.get("audio")
    if dialect not in DIALECTS:
        return jsonify(error="請選擇有效的客語腔調。"), 400
    if not answer or not audio:
        return jsonify(error="請先錄下你的回答。"), 400
    try:
        transcript = api_request("audio/transcriptions", data={"dialectCode": dialect}, files={"audioFile": (audio.filename or "answer.webm", audio.stream, audio.mimetype or "audio/webm")})
    except RuntimeError as exc:
        return jsonify(error=str(exc)), 502
    said = transcript.get("text", "").strip()
    normalize = lambda value: re.sub(r"[\s，。！？、,.!?；;：:'’\"「」『』（）()\-]", "", value).lower()
    expected, actual = normalize(answer), normalize(said)
    percent = round(SequenceMatcher(None, expected, actual).ratio() * 100) if expected else 0
    message = "講得真好！" if percent >= 80 else "不錯，再聽一次參考發音試試看。" if percent >= 45 else "再試一次，慢慢唸也可以。"
    return jsonify(transcript=said, score=percent, message=message)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "5000")))
