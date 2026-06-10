export const CHAT_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>ableton-mind local copilot</title>
  <style>
    :root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #111; color: #f2f2f2; }
    body { margin: 0; min-height: 100vh; display: grid; grid-template-rows: auto 1fr auto; }
    header { display: flex; gap: 12px; align-items: center; padding: 14px 18px; border-bottom: 1px solid #2b2b2b; background: #171717; }
    h1 { font-size: 15px; margin: 0; font-weight: 650; }
    select, input, button, textarea { background: #202020; color: #f2f2f2; border: 1px solid #3a3a3a; border-radius: 6px; font: inherit; }
    input, select { height: 32px; padding: 0 9px; }
    button { height: 34px; padding: 0 12px; cursor: pointer; }
    button.primary { background: #7c3aed; border-color: #7c3aed; }
    main { overflow: auto; padding: 18px; display: flex; flex-direction: column; gap: 12px; }
    .msg { max-width: 920px; white-space: pre-wrap; line-height: 1.45; padding: 12px 14px; border-radius: 8px; background: #1c1c1c; border: 1px solid #2a2a2a; }
    .user { align-self: flex-end; background: #26212f; }
    .assistant { align-self: flex-start; }
    .tool { align-self: flex-start; color: #bcbcbc; font-size: 13px; background: #171717; }
    footer { display: grid; grid-template-columns: 1fr auto; gap: 10px; padding: 14px 18px; border-top: 1px solid #2b2b2b; background: #171717; }
    textarea { min-height: 52px; max-height: 180px; padding: 10px; resize: vertical; }
    .status { margin-left: auto; color: #aaa; font-size: 13px; }
    @media (max-width: 760px) { header { flex-wrap: wrap; } footer { grid-template-columns: 1fr; } button { width: 100%; } }
  </style>
</head>
<body>
  <header>
    <h1>ableton-mind local copilot</h1>
    <select id="tier" title="Tool tier"><option value="safe">safe</option><option value="standard">standard</option><option value="creative">creative</option></select>
    <input id="model" title="Model" />
    <input id="baseUrl" title="Endpoint" />
    <button id="save">Save</button>
    <button id="pull">Pull model</button>
    <span class="status" id="status">loading...</span>
  </header>
  <main id="log"></main>
  <footer>
    <textarea id="input" placeholder="Ask about the Live set..."></textarea>
    <button class="primary" id="send">Send</button>
  </footer>
  <script>
    const log = document.querySelector("#log");
    const input = document.querySelector("#input");
    const statusEl = document.querySelector("#status");
    const tierEl = document.querySelector("#tier");
    const modelEl = document.querySelector("#model");
    const baseUrlEl = document.querySelector("#baseUrl");
    let messages = [];
    function add(cls, text) {
      const div = document.createElement("div");
      div.className = "msg " + cls;
      div.textContent = text;
      log.appendChild(div);
      log.scrollTop = log.scrollHeight;
      return div;
    }
    async function refresh() {
      const h = await fetch("/health").then(r => r.json());
      tierEl.value = h.lockedTier || h.defaultTier || "safe";
      modelEl.value = h.model || "";
      baseUrlEl.value = h.baseUrl || "";
      statusEl.textContent = h.ok ? h.detail : "LLM offline: " + h.detail;
    }
    async function save() {
      await fetch("/settings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ model: modelEl.value, baseUrl: baseUrlEl.value }) });
      await refresh();
    }
    async function pull() {
      statusEl.textContent = "pulling...";
      const res = await fetch("/pull", { method: "POST" });
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split("\\n\\n");
        buf = parts.pop() || "";
        for (const part of parts) {
          const line = part.replace(/^data: /, "");
          if (!line) continue;
          const evt = JSON.parse(line);
          statusEl.textContent = evt.status || evt.type || "pulling...";
        }
      }
      await refresh();
    }
    async function send() {
      const text = input.value.trim();
      if (!text) return;
      input.value = "";
      messages.push({ role: "user", content: text });
      add("user", text);
      const assistant = add("assistant", "");
      const res = await fetch("/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ messages, tier: tierEl.value }) });
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split("\\n\\n");
        buf = parts.pop() || "";
        for (const part of parts) {
          const line = part.replace(/^data: /, "");
          if (!line) continue;
          const evt = JSON.parse(line);
          if (evt.type === "token") assistant.textContent += evt.text;
          if (evt.type === "tool" && evt.status === "start") add("tool", "tool: " + evt.name + " " + evt.args);
          if (evt.type === "tool" && evt.status === "done") add("tool", (evt.ok ? "ok: " : "failed: ") + evt.summary);
          if (evt.type === "answer" && !assistant.textContent) assistant.textContent = evt.content;
          if (evt.type === "error") assistant.textContent += "\\n" + evt.message;
          if (evt.type === "final") messages = evt.messages || messages;
        }
      }
    }
    document.querySelector("#save").onclick = save;
    document.querySelector("#pull").onclick = pull;
    document.querySelector("#send").onclick = send;
    input.addEventListener("keydown", e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send(); });
    refresh().catch(err => { statusEl.textContent = String(err); });
  </script>
</body>
</html>`;
