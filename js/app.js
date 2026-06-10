/* =============================================================================
   APP  —  the conductor.
   Drives the question flow, records reflections, and keeps the map in sync.
   ============================================================================= */

(function () {
  "use strict";

  // ---- element refs -------------------------------------------------------
  const $ = (sel) => document.querySelector(sel);

  const canvas = $("#map");
  const promptDim = $("#prompt-dim");
  const promptText = $("#prompt-text");
  const answerInput = $("#answer");
  const chargeWrap = $("#charge");
  const recordBtn = $("#record-btn");
  const skipBtn = $("#skip-btn");
  const dimPills = $("#dim-pills");
  const countEl = $("#thought-count");
  const composer = $("#composer");

  const detail = $("#detail");
  const detailDim = $("#detail-dim");
  const detailQ = $("#detail-question");
  const detailA = $("#detail-answer");
  const detailMeta = $("#detail-meta");
  const detailTags = $("#detail-tags");
  const detailClose = $("#detail-close");
  const detailDelete = $("#detail-delete");

  // ---- state --------------------------------------------------------------
  let pool = buildQuestionPool();
  let current = null;        // { dimId, text }
  let charge = 3;
  let filterDim = null;      // dimension filter for the next prompt
  let pendingFollowup = null;
  let recentlyAsked = [];    // avoid immediate repeats

  // ---- map ----------------------------------------------------------------
  const map = new MindMap(canvas, {
    onSelect: (node) => {
      if (node && node.type === "thought") openDetail(node.thought);
      else closeDetail();
    },
  });

  // ---- question selection -------------------------------------------------
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function nextQuestion() {
    // honour a pending follow-up first
    if (pendingFollowup) {
      current = pendingFollowup;
      pendingFollowup = null;
      renderPrompt();
      return;
    }

    let candidates = pool;
    if (filterDim) candidates = pool.filter((q) => q.dimId === filterDim);

    // avoid the last few asked
    let fresh = candidates.filter((q) => !recentlyAsked.includes(q.dimId + "::" + q.index));
    if (fresh.length === 0) {
      recentlyAsked = [];
      fresh = candidates;
    }
    const pick = shuffle(fresh)[0];
    current = { dimId: pick.dimId, text: pick.text };
    recentlyAsked.push(pick.dimId + "::" + pick.index);
    if (recentlyAsked.length > 12) recentlyAsked.shift();
    renderPrompt();
  }

  function renderPrompt() {
    const dim = DIMENSION_BY_ID[current.dimId];
    promptDim.textContent = dim.label;
    promptDim.style.color = dim.color;
    promptDim.style.textShadow = `0 0 16px ${dim.color}66`;
    composer.style.setProperty("--accent", dim.color);
    promptText.textContent = current.text;
    answerInput.value = "";
    answerInput.focus();
    setCharge(3);
  }

  // ---- charge selector ----------------------------------------------------
  function buildCharge() {
    chargeWrap.innerHTML = "";
    for (let i = 1; i <= 5; i++) {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = "charge-dot";
      dot.dataset.value = i;
      dot.title = ["barely", "mild", "notable", "strong", "raw nerve"][i - 1];
      dot.addEventListener("click", () => setCharge(i));
      chargeWrap.appendChild(dot);
    }
  }

  function setCharge(v) {
    charge = v;
    [...chargeWrap.children].forEach((dot, i) => {
      dot.classList.toggle("on", i < v);
    });
  }

  // ---- recording ----------------------------------------------------------
  function record() {
    const answer = answerInput.value.trim();
    if (!answer) {
      answerInput.focus();
      answerInput.classList.remove("nudge");
      void answerInput.offsetWidth;
      answerInput.classList.add("nudge");
      return;
    }
    const tags = Store.extractTags(answer);
    Store.addThought({ dimId: current.dimId, question: current.text, answer, charge, tags });

    // maybe offer a follow-up from the same dimension
    const dim = DIMENSION_BY_ID[current.dimId];
    if (dim.followups && dim.followups.length && Math.random() < 0.55) {
      const f = dim.followups[Math.floor(Math.random() * dim.followups.length)];
      pendingFollowup = { dimId: current.dimId, text: f };
    }

    refresh();
    nextQuestion();
    flashRecorded();
  }

  function flashRecorded() {
    recordBtn.classList.remove("pulse");
    void recordBtn.offsetWidth;
    recordBtn.classList.add("pulse");
  }

  // ---- map / counts refresh ----------------------------------------------
  function refresh() {
    const thoughts = Store.thoughts();
    map.setData(thoughts);
    countEl.textContent = thoughts.length;
    renderDimPills(thoughts);
  }

  function renderDimPills(thoughts) {
    const counts = {};
    for (const t of thoughts) counts[t.dimId] = (counts[t.dimId] || 0) + 1;

    dimPills.innerHTML = "";
    // "all" pill
    const all = pill("All regions", null, "#9fc6ff", thoughts.length);
    dimPills.appendChild(all);
    for (const dim of DIMENSIONS) {
      dimPills.appendChild(pill(dim.label, dim.id, dim.color, counts[dim.id] || 0));
    }
  }

  function pill(label, dimId, color, count) {
    const el = document.createElement("button");
    el.className = "pill" + (filterDim === dimId ? " active" : "");
    el.style.setProperty("--c", color);
    el.innerHTML = `<span class="pill-dot"></span>${label}<span class="pill-count">${count}</span>`;
    el.addEventListener("click", () => {
      filterDim = dimId;
      renderDimPills(Store.thoughts());
      pendingFollowup = null;
      nextQuestion();
    });
    return el;
  }

  // ---- detail panel -------------------------------------------------------
  let currentDetailThought = null;

  function openDetail(t) {
    currentDetailThought = t;
    const ai = $("#detail-ai");
    if (ai) { ai.style.display = "none"; ai.innerHTML = ""; }
    const dim = DIMENSION_BY_ID[t.dimId];
    detail.classList.add("open");
    detailDim.textContent = dim.label;
    detailDim.style.color = dim.color;
    detail.style.setProperty("--accent", dim.color);
    detailQ.textContent = t.question;
    detailA.textContent = t.answer;
    const d = new Date(t.createdAt);
    detailMeta.textContent =
      d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) +
      " · " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) +
      " · charge " + (t.charge || 3) + "/5";
    detailTags.innerHTML = "";
    (t.tags || []).forEach((tag) => {
      const el = document.createElement("span");
      el.className = "tag";
      el.textContent = "#" + tag;
      detailTags.appendChild(el);
    });
    detailDelete.onclick = () => {
      Store.deleteThought(t.id);
      closeDetail();
      refresh();
    };
    map.setSelected(t.id);
    map.focusNode(t.id);
  }

  function closeDetail() {
    currentDetailThought = null;
    detail.classList.remove("open");
    map.setSelected(null);
  }

  // ---- toolbar actions ----------------------------------------------------
  $("#reset-view").addEventListener("click", () => map.resetView());

  $("#export-btn").addEventListener("click", () => {
    const blob = new Blob([Store.exportJSON()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "consciousness-map-" + new Date().toISOString().slice(0, 10) + ".json";
    a.click();
    URL.revokeObjectURL(url);
  });

  $("#import-btn").addEventListener("click", () => $("#import-file").click());
  $("#import-file").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        Store.importJSON(reader.result);
        refresh();
      } catch (err) {
        alert(err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  });

  $("#wipe-btn").addEventListener("click", () => {
    if (confirm("Erase the entire map? This cannot be undone.")) {
      Store.wipe();
      refresh();
      closeDetail();
    }
  });

  // ---- events -------------------------------------------------------------
  recordBtn.addEventListener("click", record);
  skipBtn.addEventListener("click", () => { pendingFollowup = null; nextQuestion(); });
  detailClose.addEventListener("click", closeDetail);

  answerInput.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      record();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeDetail();
  });

  // panel collapse
  $("#panel-toggle").addEventListener("click", () => {
    document.body.classList.toggle("panel-collapsed");
  });

  // ---- public hooks (used by insight.js) -----------------------------------
  window.FormApp = {
    askQuestion(dimId, text) {
      pendingFollowup = null;
      current = { dimId, text };
      renderPrompt();
    },
    getCurrentDetailThought: () => currentDetailThought,
    refresh,
  };

  // ---- boot ---------------------------------------------------------------
  buildCharge();
  refresh();
  nextQuestion();

  // gentle intro: if empty, the map shows nothing but the prompt invites entry.
})();
