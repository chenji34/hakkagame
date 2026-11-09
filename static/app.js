const prompts = ['今天想吃什麼？', '你平常幾點起床？', '今天天氣真好，你想去哪裡？', '你最喜歡吃哪一道客家菜？', '週末你打算做什麼？', '請問最近的車站怎麼走？', '你今天過得好嗎？', '想不想一起喝杯茶？', '你家裡有幾個人？', '這件衣服多少錢？', '你最喜歡什麼季節？', '下次再來我家玩喔！'];
const $ = id => document.getElementById(id);
let current = null, recorder = null, chunks = [], stream = null, busy = false;
const dialect = $('dialect');
function notify(message) { const toast = $('toast'); toast.textContent = message; toast.classList.add('show'); clearTimeout(notify.timer); notify.timer = setTimeout(() => toast.classList.remove('show'), 3800); }
async function jsonFetch(url, options) { const response = await fetch(url, options); const result = await response.json(); if (!response.ok) throw new Error(result.error || '發生錯誤，請稍後再試。'); return result; }
function setBusy(value, status) { busy = value; $('new-question').disabled = value; $('status').textContent = status; }
function nextPrompt() { const choices = prompts.filter(item => item !== $('prompt').textContent); return choices[Math.floor(Math.random() * choices.length)]; }
async function newQuestion() {
  if (busy) return;
  const prompt = nextPrompt(); $('prompt').textContent = prompt; $('answer').textContent = '正在準備客語題目…'; $('answer').style.color = '';
  $('play').disabled = $('sound-toggle').disabled = $('record').disabled = true; $('feedback').hidden = true; $('practice').classList.remove('has-feedback');
  setBusy(true, '題目準備中…');
  try {
    current = await jsonFetch('/api/question', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({prompt, dialect: dialect.value})});
    $('answer').textContent = current.answer; $('answer').style.color = 'var(--green)'; $('play').disabled = $('sound-toggle').disabled = $('record').disabled = false; setBusy(false, '聽完後試著回答'); playAnswer();
  } catch (error) { $('answer').textContent = '參考答案暫時無法載入'; setBusy(false, '準備開始'); notify(error.message); }
}
function playAnswer() { if (!current?.audio) return; const audio = new Audio(current.audio); audio.play().catch(() => notify('請點擊播放按鈕聆聽參考答案。')); }
async function toggleRecording() {
  if (busy) return;
  if (recorder?.state === 'recording') { recorder.stop(); return; }
  if (!current) return;
  try {
    stream = await navigator.mediaDevices.getUserMedia({audio: true}); chunks = [];
    const preferred = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find(type => MediaRecorder.isTypeSupported(type));
    recorder = new MediaRecorder(stream, preferred ? {mimeType: preferred} : undefined);
    recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); }; recorder.onstop = submitRecording; recorder.start();
    $('record').classList.add('is-recording'); $('record-label').textContent = '完成錄音'; $('status').textContent = '正在錄音…再按一次完成';
  } catch (error) { notify(error.name === 'NotAllowedError' ? '請允許使用麥克風，再開始錄音。' : '無法使用麥克風，請確認瀏覽器設定。'); }
}
async function submitRecording() {
  stream?.getTracks().forEach(track => track.stop()); stream = null; $('record').classList.remove('is-recording'); $('record-label').textContent = '開始錄音作答';
  const blob = new Blob(chunks, {type: recorder.mimeType || 'audio/webm'}); if (!blob.size) { $('status').textContent = '沒有錄到聲音，請再試一次'; return; }
  const extension = blob.type.includes('mp4') ? 'm4a' : 'webm'; const form = new FormData(); form.append('audio', blob, `answer.${extension}`); form.append('answer', current.answer); form.append('dialect', dialect.value);
  setBusy(true, '正在辨識客語回答…'); $('record').disabled = true;
  try {
    const result = await jsonFetch('/api/score', {method: 'POST', body: form}); const panel = $('feedback'); panel.classList.remove('error');
    panel.innerHTML = `<div><strong>${result.score} 分</strong>${escapeHTML(result.message)}</div><div>辨識內容：${escapeHTML(result.transcript || '沒有辨識到文字')}</div>`; panel.hidden = false; $('practice').classList.add('has-feedback'); $('status').textContent = '練習完成';
  } catch (error) { const panel = $('feedback'); panel.textContent = error.message; panel.classList.add('error'); panel.hidden = false; $('status').textContent = '辨識失敗，請再試一次'; }
  finally { setBusy(false, $('status').textContent); $('record').disabled = false; }
}
function escapeHTML(value) { return String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char])); }
$('new-question').addEventListener('click', newQuestion); $('record').addEventListener('click', toggleRecording); $('play').addEventListener('click', playAnswer); $('sound-toggle').addEventListener('click', playAnswer);
dialect.addEventListener('change', () => { if (current) newQuestion(); });
