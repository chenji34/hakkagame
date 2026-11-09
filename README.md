# 客語練習所

以 Gohakka Pro 翻譯、TTS 與 ASR API 製作的客語聽說練習遊戲。玩家抽取中文情境題，聽客語參考答案後自行錄音；ASR 轉錄回答，再以文字相似度提供練習分數。分數是口說練習提示，不是聲調或發音的專業評測。

## 本機啟動

需要 Python 3.10 或更新版本。設定環境變數 `GOHAKKA_API_KEY` 後執行：

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
$env:GOHAKKA_API_KEY="你的 API Key"
python app.py
```

開啟 http://localhost:5000。瀏覽器需有麥克風權限；錄音使用瀏覽器 MediaRecorder，需在 localhost 或 HTTPS 上執行。

## Render 部署

將此 GitHub repository 連接 Render，建立 Web Service；Render 會讀取 `render.yaml`。在 Render service 的 Environment 設定 `GOHAKKA_API_KEY`，再部署。金鑰只由 Flask 伺服器讀取，不會傳給瀏覽器。

## Gohakka API

- `POST /v3/pro/text/translations`：中文轉客語（multipart/form-data，`targetCode=hak`）
- `POST /v3/pro/audio/speech`：客語 TTS，回傳 `audioBase64`
- `POST /v3/pro/audio/transcriptions`：客語 ASR，回傳辨識文字

文件：https://api.gohakka.org/v3/pro/docs
