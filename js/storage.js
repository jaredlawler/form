/* =============================================================================
   STORAGE
   Everything stays on this device. No server, no account, no telemetry.
   The map is yours alone — persisted to localStorage as a single JSON blob.
   ============================================================================= */

const STORAGE_KEY = "consciousness-map.v1";

const Store = {
  /* Shape:
     {
       version: 1,
       createdAt, updatedAt,
       thoughts: [
         { id, dimId, question, answer, charge (1-5), tags[], createdAt,
           x, y  // last-known map position, so the constellation feels stable }
       ]
     }
  */
  _data: null,

  load() {
    if (this._data) return this._data;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      this._data = raw ? JSON.parse(raw) : this._fresh();
    } catch (e) {
      console.warn("Could not read map, starting fresh.", e);
      this._data = this._fresh();
    }
    return this._data;
  },

  _fresh() {
    const now = Date.now();
    return { version: 1, createdAt: now, updatedAt: now, thoughts: [] };
  },

  save() {
    if (!this._data) return;
    this._data.updatedAt = Date.now();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this._data));
    } catch (e) {
      console.error("Could not save map.", e);
    }
  },

  thoughts() {
    return this.load().thoughts;
  },

  addThought({ dimId, question, answer, charge, tags }) {
    const t = {
      id: "t_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      dimId,
      question,
      answer: (answer || "").trim(),
      charge: charge || 3,
      tags: tags || [],
      createdAt: Date.now(),
      x: null,
      y: null,
    };
    this.load().thoughts.push(t);
    this.save();
    return t;
  },

  updateThought(id, patch) {
    const t = this.load().thoughts.find((x) => x.id === id);
    if (t) {
      Object.assign(t, patch);
      this.save();
    }
    return t;
  },

  deleteThought(id) {
    const d = this.load();
    d.thoughts = d.thoughts.filter((x) => x.id !== id);
    this.save();
  },

  /* Persist positions in a batch (called by the graph as it settles). */
  savePositions(positions) {
    const d = this.load();
    let changed = false;
    for (const t of d.thoughts) {
      const p = positions[t.id];
      if (p && (t.x !== p.x || t.y !== p.y)) {
        t.x = p.x;
        t.y = p.y;
        changed = true;
      }
    }
    if (changed) this.save();
  },

  exportJSON() {
    return JSON.stringify(this.load(), null, 2);
  },

  importJSON(json) {
    const parsed = JSON.parse(json);
    if (!parsed || !Array.isArray(parsed.thoughts)) {
      throw new Error("That doesn't look like a consciousness map file.");
    }
    this._data = parsed;
    this.save();
  },

  wipe() {
    this._data = this._fresh();
    this.save();
  },

  /* Lightweight keyword extraction for tags — no NLP, just signal-mining. */
  extractTags(text) {
    const stop = new Set(
      ("the a an and or but if then of to in on at for with about into over after " +
        "is am are was were be been being do does did done have has had i you he she " +
        "it we they me him her them my your his its our their this that these those " +
        "what which who whom whose when where why how not no yes so just very really " +
        "can could would should will shall may might must im ive id dont cant wont " +
        "thing things something anything everything nothing get got go going like " +
        "feel feels felt think thought know knew want wanted because as than too out up")
        .split(/\s+/)
    );
    const counts = {};
    (text.toLowerCase().match(/[a-z']{4,}/g) || []).forEach((w) => {
      w = w.replace(/'/g, "");
      if (stop.has(w) || w.length < 4) return;
      counts[w] = (counts[w] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
      .slice(0, 4)
      .map(([w]) => w);
  },
};
