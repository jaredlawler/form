/* =============================================================================
   INSIGHT — the AI mirror.
   Sends your map to Claude (with YOUR OWN API key, stored only on this device)
   and returns real analysis: recurring patterns, contradictions, reframes, and
   follow-up questions tailored to what you actually wrote.

   Nothing is sent anywhere until you explicitly press "read my mind" or
   "challenge". The rest of the app remains fully offline.
   ============================================================================= */

const Insight = (() => {
  "use strict";

  const KEY_STORAGE = "consciousness-map.apikey";
  const MODEL_STORAGE = "consciousness-map.model";
  const DEFAULT_MODEL = "claude-opus-4-8";

  const MODELS = [
    { id: "claude-opus-4-8", label: "Opus 4.8 — deepest insight (default)" },
    { id: "claude-sonnet-4-6", label: "Sonnet 4.6 — fast + sharp" },
    { id: "claude-haiku-4-5", label: "Haiku 4.5 — cheapest" },
  ];

  /* ---- key + model management ------------------------------------------- */
  const getKey = () => localStorage.getItem(KEY_STORAGE) || "";
  const setKey = (k) => localStorage.setItem(KEY_STORAGE, k.trim());
  const clearKey = () => localStorage.removeItem(KEY_STORAGE);
  const getModel = () => localStorage.getItem(MODEL_STORAGE) || DEFAULT_MODEL;
  const setModel = (m) => localStorage.setItem(MODEL_STORAGE, m);

  /* ---- API call ----------------------------------------------------------- */
  async function callClaude({ system, user, schema, maxTokens }) {
    const model = getModel();
    const body = {
      model,
      max_tokens: maxTokens || 16000,
      system,
      messages: [{ role: "user", content: user }],
    };
    // Adaptive thinking on models that support it (Haiku 4.5 does not).
    if (!model.startsWith("claude-haiku")) {
      body.thinking = { type: "adaptive" };
    }
    if (schema) {
      body.output_config = { format: { type: "json_schema", schema } };
    }

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": getKey(),
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      let detail = "";
      try {
        const err = await res.json();
        detail = err?.error?.message || "";
      } catch (_) { /* non-JSON error body */ }
      if (res.status === 401) throw new Error("That API key was rejected. Check it in the Anthropic Console and re-enter it.");
      if (res.status === 429) throw new Error("Rate limited — wait a moment and try again.");
      if (res.status >= 500) throw new Error("Anthropic's API is having a moment. Try again shortly.");
      throw new Error(detail || `Request failed (${res.status}).`);
    }

    const data = await res.json();
    const text = (data.content || []).find((b) => b.type === "text");
    if (!text) throw new Error("The model returned no text. Try again.");
    return text.text;
  }

  /* ---- context building --------------------------------------------------- */
  function buildMapContext() {
    const thoughts = Store.thoughts();
    const byDim = {};
    for (const t of thoughts) (byDim[t.dimId] = byDim[t.dimId] || []).push(t);

    let out = "";
    for (const dim of DIMENSIONS) {
      const group = byDim[dim.id];
      if (!group || !group.length) continue;
      out += `\n## Region: ${dim.label}\n`;
      // newest first; cap per-region to keep payloads sane
      const recent = [...group].sort((a, b) => b.createdAt - a.createdAt).slice(0, 30);
      for (const t of recent) {
        const d = new Date(t.createdAt).toISOString().slice(0, 10);
        out += `- [${d}, charge ${t.charge}/5] Q: ${t.question}\n  A: ${t.answer}\n`;
      }
    }
    // hard cap ~60k chars to bound cost
    if (out.length > 60000) out = out.slice(0, 60000) + "\n[...truncated...]";
    return out;
  }

  const SYSTEM_PROMPT =
    "You are the analysis engine inside FORM, a private consciousness-mapping " +
    "instrument. The user has been answering deep introspective questions; you " +
    "receive their raw reflections organized by region of mind. Your job is to " +
    "be an incisive, honest mirror — not a flatterer and not a therapist. " +
    "Speak directly to the user in second person. Ground every observation in " +
    "what they actually wrote (quote short fragments when useful). Name " +
    "patterns they may not see, point out contradictions gently but plainly, " +
    "and offer genuinely useful reframes rather than platitudes. Be warm but " +
    "do not soften the truth into mush. This is introspection support, not " +
    "clinical care: if the material suggests acute crisis or self-harm risk, " +
    "say clearly that this deserves a real human professional and keep your " +
    "analysis brief and kind.";

  const INSIGHT_SCHEMA = {
    type: "object",
    properties: {
      reflection: {
        type: "string",
        description: "The core insight narrative, 200-400 words, second person, direct and specific to what they wrote.",
      },
      patterns: {
        type: "array",
        description: "2-5 recurring patterns across regions, each grounded in their words.",
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "Short punchy name for the pattern." },
            description: { type: "string", description: "1-3 sentences of evidence and meaning." },
          },
          required: ["name", "description"],
          additionalProperties: false,
        },
      },
      tensions: {
        type: "array",
        description: "0-4 contradictions or tensions between things they wrote, stated plainly.",
        items: { type: "string" },
      },
      reframes: {
        type: "array",
        description: "1-4 specific, non-platitude reframes of beliefs they expressed.",
        items: { type: "string" },
      },
      questions: {
        type: "array",
        description: "3-5 follow-up questions tailored to their actual answers, each assigned to the most fitting region.",
        items: {
          type: "object",
          properties: {
            dimension: {
              type: "string",
              enum: ["present", "ego", "thinking", "fear", "values", "desire", "relationship", "story", "meaning", "body"],
            },
            text: { type: "string" },
          },
          required: ["dimension", "text"],
          additionalProperties: false,
        },
      },
    },
    required: ["reflection", "patterns", "tensions", "reframes", "questions"],
    additionalProperties: false,
  };

  async function analyzeMap() {
    const context = buildMapContext();
    const raw = await callClaude({
      system: SYSTEM_PROMPT,
      user:
        "Here is my consciousness map so far. Analyze it: find the patterns, " +
        "name the tensions, challenge my thinking where it deserves challenging, " +
        "and give me follow-up questions that would actually go somewhere.\n" +
        context,
      schema: INSIGHT_SCHEMA,
    });
    return JSON.parse(raw);
  }

  async function challengeThought(t) {
    const dim = DIMENSION_BY_ID[t.dimId];
    return callClaude({
      system: SYSTEM_PROMPT,
      user:
        `One reflection from my map, region "${dim.label}" (emotional charge ${t.charge}/5):\n` +
        `Question: ${t.question}\nMy answer: ${t.answer}\n\n` +
        "Challenge this. What assumption am I making? What might I be protecting? " +
        "Offer one honest reframe and end with a single question that goes one " +
        "level deeper. Keep it under 150 words.",
      maxTokens: 4000,
    });
  }

  /* ---- UI ------------------------------------------------------------------ */
  const $ = (sel) => document.querySelector(sel);
  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function openPanel() {
    $("#insight-overlay").classList.add("open");
    renderPanel();
  }
  function closePanel() {
    $("#insight-overlay").classList.remove("open");
  }

  function renderPanel() {
    const body = $("#insight-body");
    if (!getKey()) {
      body.innerHTML = `
        <p class="ins-text">Insight mode sends your reflections to Claude for real analysis —
        patterns, contradictions, reframes, and questions written for <em>you</em>.
        It needs your own Anthropic API key (get one at
        <span class="ins-mono">console.anthropic.com</span>).</p>
        <p class="ins-text ins-dim">The key is stored only in this browser. Your reflections
        are sent to the API only when you press the button — never automatically.
        A full reading typically costs a few cents. Consider setting a spend limit on the key.</p>
        <input type="password" id="ins-key" class="ins-input" placeholder="sk-ant-..." autocomplete="off" />
        <select id="ins-model" class="ins-input">
          ${MODELS.map((m) => `<option value="${m.id}"${m.id === getModel() ? " selected" : ""}>${m.label}</option>`).join("")}
        </select>
        <button id="ins-save" class="primary ins-btn">save key</button>`;
      $("#ins-save").onclick = () => {
        const k = $("#ins-key").value.trim();
        if (!k) return;
        setKey(k);
        setModel($("#ins-model").value);
        renderPanel();
      };
      return;
    }

    const count = Store.thoughts().length;
    body.innerHTML = `
      <p class="ins-text">${count} thought${count === 1 ? "" : "s"} on the map.
      ${count < 5 ? "Record at least 5 before a reading — the mirror needs material." : "Ready for a reading."}</p>
      <button id="ins-run" class="primary ins-btn" ${count < 5 ? "disabled" : ""}>◉ read my mind</button>
      <div id="ins-result"></div>
      <div class="ins-foot">
        <span class="ins-dim ins-mono">${esc(getModel())}</span>
        <button id="ins-forget" class="ghost">forget key</button>
      </div>`;
    $("#ins-forget").onclick = () => { clearKey(); renderPanel(); };
    const runBtn = $("#ins-run");
    if (runBtn && !runBtn.disabled) runBtn.onclick = runReading;
  }

  async function runReading() {
    const result = $("#ins-result");
    const btn = $("#ins-run");
    btn.disabled = true;
    btn.textContent = "reading…";
    result.innerHTML = `<p class="ins-text ins-dim ins-pulse">Claude is moving through your map…</p>`;
    try {
      const r = await analyzeMap();
      result.innerHTML = renderReading(r);
      // wire up question chips
      result.querySelectorAll("[data-q]").forEach((el) => {
        el.addEventListener("click", () => {
          const dimId = el.dataset.dim;
          const text = el.dataset.q;
          if (window.FormApp) {
            window.FormApp.askQuestion(dimId, text);
            closePanel();
          }
        });
      });
    } catch (e) {
      result.innerHTML = `<p class="ins-text ins-error">${esc(e.message)}</p>`;
    } finally {
      btn.disabled = false;
      btn.textContent = "◉ read my mind";
    }
  }

  function renderReading(r) {
    let html = "";
    html += `<div class="ins-section"><h3>reflection</h3>${
      r.reflection.split(/\n{2,}/).map((p) => `<p class="ins-text">${esc(p)}</p>`).join("")
    }</div>`;

    if (r.patterns?.length) {
      html += `<div class="ins-section"><h3>patterns</h3>${r.patterns
        .map((p) => `<div class="ins-pattern"><b>${esc(p.name)}</b><span>${esc(p.description)}</span></div>`)
        .join("")}</div>`;
    }
    if (r.tensions?.length) {
      html += `<div class="ins-section"><h3>tensions</h3><ul class="ins-list">${r.tensions
        .map((t) => `<li>${esc(t)}</li>`).join("")}</ul></div>`;
    }
    if (r.reframes?.length) {
      html += `<div class="ins-section"><h3>reframes</h3><ul class="ins-list">${r.reframes
        .map((t) => `<li>${esc(t)}</li>`).join("")}</ul></div>`;
    }
    if (r.questions?.length) {
      html += `<div class="ins-section"><h3>go deeper</h3><p class="ins-text ins-dim">Tap one to answer it.</p>${r.questions
        .map((q) => {
          const dim = DIMENSION_BY_ID[q.dimension] || DIMENSIONS[0];
          return `<button class="ins-q" data-dim="${esc(dim.id)}" data-q="${esc(q.text)}" style="--c:${dim.color}">
            <span class="ins-q-dim">${esc(dim.label)}</span>${esc(q.text)}</button>`;
        }).join("")}</div>`;
    }
    return html;
  }

  /* ---- per-thought challenge (wired from the detail panel) --------------- */
  async function challengeCurrent() {
    const t = window.FormApp && window.FormApp.getCurrentDetailThought();
    if (!t) return;
    const out = $("#detail-ai");
    const btn = $("#detail-challenge");
    if (!getKey()) {
      openPanel(); // route them through key setup first
      return;
    }
    btn.disabled = true;
    btn.textContent = "thinking…";
    out.innerHTML = `<p class="ins-text ins-dim ins-pulse">…</p>`;
    out.style.display = "block";
    try {
      const text = await challengeThought(t);
      out.innerHTML = text.split(/\n{2,}/).map((p) => `<p class="ins-text">${esc(p)}</p>`).join("");
    } catch (e) {
      out.innerHTML = `<p class="ins-text ins-error">${esc(e.message)}</p>`;
    } finally {
      btn.disabled = false;
      btn.textContent = "⚡ challenge this";
    }
  }

  /* ---- boot ---------------------------------------------------------------- */
  function init() {
    $("#insight-btn").addEventListener("click", openPanel);
    $("#insight-close").addEventListener("click", closePanel);
    $("#insight-overlay").addEventListener("click", (e) => {
      if (e.target === $("#insight-overlay")) closePanel();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closePanel();
    });
    const ch = $("#detail-challenge");
    if (ch) ch.addEventListener("click", challengeCurrent);
  }

  return { init };
})();

document.addEventListener("DOMContentLoaded", Insight.init);
if (document.readyState !== "loading") Insight.init();
