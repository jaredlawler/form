/* =============================================================================
   MIND MAP  —  a living force-directed constellation on canvas.

   Two kinds of nodes:
     - HUB nodes: one per dimension you've touched. They anchor a region.
     - THOUGHT nodes: each reflection you've recorded, orbiting its hub.

   Physics: hubs repel each other and drift toward a ring; thoughts are pulled
   toward their hub by a spring and repelled by their siblings. Everything is
   gently damped so the field breathes rather than vibrates.

   Rendering: dark space, drifting starfield, glowing nodes with bloom, links
   drawn as faint energy filaments. Pan with drag, zoom with wheel, click a
   node to inspect.
   ============================================================================= */

class MindMap {
  constructor(canvas, { onSelect } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.onSelect = onSelect || (() => {});

    this.nodes = [];
    this.links = [];
    this.nodeById = {};

    // view transform
    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;

    // interaction state
    this.dragging = false;
    this.draggingNode = null;
    this.lastX = 0;
    this.lastY = 0;
    this.hoverNode = null;
    this.selectedId = null;
    this.moved = false;

    // ambient starfield
    this.stars = [];

    this._raf = null;
    this._savePosTimer = null;

    this._bindEvents();
    this._resize();
    window.addEventListener("resize", () => this._resize());
    this._seedStars();
    this._loop = this._loop.bind(this);
    this._raf = requestAnimationFrame(this._loop);
  }

  /* ---- public API ------------------------------------------------------- */

  setData(thoughts) {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    const cx = w / 2;
    const cy = h / 2;

    // Which dimensions are present?
    const dimIds = [...new Set(thoughts.map((t) => t.dimId))];

    // Preserve existing positions where possible.
    const prev = {};
    for (const n of this.nodes) prev[n.id] = { x: n.x, y: n.y };

    this.nodes = [];
    this.links = [];
    this.nodeById = {};

    // Hub nodes arranged on a ring.
    dimIds.forEach((dimId, i) => {
      const dim = DIMENSION_BY_ID[dimId];
      const angle = (i / Math.max(1, dimIds.length)) * Math.PI * 2 - Math.PI / 2;
      const ringR = Math.min(w, h) * 0.28;
      const id = "hub_" + dimId;
      const p = prev[id];
      this.nodes.push({
        id,
        type: "hub",
        dimId,
        label: dim.label,
        color: dim.color,
        x: p ? p.x : cx + Math.cos(angle) * ringR + (Math.random() - 0.5) * 10,
        y: p ? p.y : cy + Math.sin(angle) * ringR + (Math.random() - 0.5) * 10,
        vx: 0,
        vy: 0,
        homeAngle: angle,
        r: 16,
        count: 0,
      });
    });

    // Thought nodes.
    for (const t of thoughts) {
      const dim = DIMENSION_BY_ID[t.dimId];
      const hub = this.nodes.find((n) => n.id === "hub_" + t.dimId);
      if (hub) hub.count++;
      const p = prev[t.id];
      const seedX = t.x != null ? t.x : hub.x + (Math.random() - 0.5) * 80;
      const seedY = t.y != null ? t.y : hub.y + (Math.random() - 0.5) * 80;
      const node = {
        id: t.id,
        type: "thought",
        dimId: t.dimId,
        color: dim ? dim.color : "#88aaff",
        x: p ? p.x : seedX,
        y: p ? p.y : seedY,
        vx: 0,
        vy: 0,
        charge: t.charge || 3,
        r: 6 + Math.min(10, (t.answer ? t.answer.length : 0) / 45) + (t.charge || 3) * 0.8,
        thought: t,
        twinkle: Math.random() * Math.PI * 2,
      };
      this.nodes.push(node);
      this.nodeById[node.id] = node;
      this.links.push({ a: "hub_" + t.dimId, b: node.id });
    }

    for (const n of this.nodes) this.nodeById[n.id] = n;

    // size hubs by population
    for (const n of this.nodes) {
      if (n.type === "hub") n.r = 14 + Math.min(18, n.count * 1.6);
    }
  }

  focusNode(id) {
    const n = this.nodeById[id];
    if (!n) return;
    this.selectedId = id;
    // ease the view so the node lands near center
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    this._targetOffset = {
      x: w / 2 - n.x * this.scale,
      y: h / 2 - n.y * this.scale,
    };
  }

  setSelected(id) {
    this.selectedId = id;
  }

  resetView() {
    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;
    this._targetOffset = null;
  }

  /* ---- internals -------------------------------------------------------- */

  _resize() {
    const dpr = window.devicePixelRatio || 1;
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  _seedStars() {
    this.stars = [];
    for (let i = 0; i < 160; i++) {
      this.stars.push({
        x: Math.random(),
        y: Math.random(),
        z: Math.random() * 0.8 + 0.2,
        t: Math.random() * Math.PI * 2,
      });
    }
  }

  _bindEvents() {
    const c = this.canvas;

    c.addEventListener("mousedown", (e) => this._onDown(e.clientX, e.clientY));
    window.addEventListener("mousemove", (e) => this._onMove(e.clientX, e.clientY));
    window.addEventListener("mouseup", () => this._onUp());

    c.addEventListener("wheel", (e) => {
      e.preventDefault();
      const rect = c.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      this._zoomAt(mx, my, factor);
    }, { passive: false });

    // touch — one finger pans / drags nodes, two fingers pinch-zoom
    this._pinch = null;
    c.addEventListener("touchstart", (e) => {
      if (e.touches.length === 1) {
        this._onDown(e.touches[0].clientX, e.touches[0].clientY);
      } else if (e.touches.length === 2) {
        this.dragging = false;
        this.draggingNode = null;
        this._pinch = this._pinchInfo(e);
      }
    }, { passive: true });
    c.addEventListener("touchmove", (e) => {
      if (e.touches.length === 1 && !this._pinch) {
        this._onMove(e.touches[0].clientX, e.touches[0].clientY);
      } else if (e.touches.length === 2) {
        e.preventDefault();
        const p = this._pinchInfo(e);
        if (this._pinch) {
          this._zoomAt(p.cx, p.cy, p.dist / this._pinch.dist);
          this.offsetX += p.cx - this._pinch.cx;
          this.offsetY += p.cy - this._pinch.cy;
        }
        this._pinch = p;
      }
    }, { passive: false });
    c.addEventListener("touchend", (e) => {
      if (e.touches.length < 2) this._pinch = null;
      if (e.touches.length === 0) this._onUp();
    });

    c.addEventListener("mousemove", (e) => {
      const rect = c.getBoundingClientRect();
      this.hoverNode = this._hitTest(e.clientX - rect.left, e.clientY - rect.top);
      c.style.cursor = this.hoverNode ? "pointer" : (this.dragging ? "grabbing" : "grab");
    });
  }

  _pinchInfo(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x1 = e.touches[0].clientX - rect.left;
    const y1 = e.touches[0].clientY - rect.top;
    const x2 = e.touches[1].clientX - rect.left;
    const y2 = e.touches[1].clientY - rect.top;
    return {
      cx: (x1 + x2) / 2,
      cy: (y1 + y2) / 2,
      dist: Math.hypot(x2 - x1, y2 - y1) || 1,
    };
  }

  _screenToWorld(sx, sy) {
    return { x: (sx - this.offsetX) / this.scale, y: (sy - this.offsetY) / this.scale };
  }

  _zoomAt(sx, sy, factor) {
    const before = this._screenToWorld(sx, sy);
    this.scale = Math.max(0.3, Math.min(3.5, this.scale * factor));
    this.offsetX = sx - before.x * this.scale;
    this.offsetY = sy - before.y * this.scale;
    this._targetOffset = null;
  }

  _hitTest(sx, sy) {
    const w = this._screenToWorld(sx, sy);
    let best = null;
    let bestD = Infinity;
    for (const n of this.nodes) {
      const dx = n.x - w.x;
      const dy = n.y - w.y;
      const d = dx * dx + dy * dy;
      const rr = (n.r + 6) * (n.r + 6);
      if (d < rr && d < bestD) {
        best = n;
        bestD = d;
      }
    }
    return best;
  }

  _onDown(cx, cy) {
    const rect = this.canvas.getBoundingClientRect();
    const sx = cx - rect.left;
    const sy = cy - rect.top;
    this.lastX = sx;
    this.lastY = sy;
    this.moved = false;
    this.dragging = true;
    this._targetOffset = null;
    const hit = this._hitTest(sx, sy);
    this.draggingNode = hit;
  }

  _onMove(cx, cy) {
    if (!this.dragging) return;
    const rect = this.canvas.getBoundingClientRect();
    const sx = cx - rect.left;
    const sy = cy - rect.top;
    const dx = sx - this.lastX;
    const dy = sy - this.lastY;
    if (Math.abs(dx) + Math.abs(dy) > 3) this.moved = true;
    this.lastX = sx;
    this.lastY = sy;

    if (this.draggingNode) {
      this.draggingNode.x += dx / this.scale;
      this.draggingNode.y += dy / this.scale;
      this.draggingNode.vx = 0;
      this.draggingNode.vy = 0;
      this.draggingNode.pinned = true;
    } else {
      this.offsetX += dx;
      this.offsetY += dy;
    }
  }

  _onUp() {
    if (this.dragging && !this.moved && this.draggingNode) {
      // a click on a node
      this.selectedId = this.draggingNode.id;
      this.onSelect(this.draggingNode);
    } else if (this.dragging && !this.moved && !this.draggingNode) {
      this.onSelect(null);
    }
    if (this.draggingNode) this.draggingNode.pinned = false;
    this.dragging = false;
    this.draggingNode = null;
    this._schedulePositionSave();
  }

  _schedulePositionSave() {
    clearTimeout(this._savePosTimer);
    this._savePosTimer = setTimeout(() => {
      const positions = {};
      for (const n of this.nodes) {
        if (n.type === "thought") positions[n.id] = { x: Math.round(n.x), y: Math.round(n.y) };
      }
      Store.savePositions(positions);
    }, 1200);
  }

  _physics() {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    const cx = w / 2;
    const cy = h / 2;

    const hubs = this.nodes.filter((n) => n.type === "hub");

    // Hub-hub repulsion + pull toward home ring position.
    for (let i = 0; i < hubs.length; i++) {
      const a = hubs[i];
      for (let j = i + 1; j < hubs.length; j++) {
        const b = hubs[j];
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        let d2 = dx * dx + dy * dy || 1;
        const force = 90000 / d2;
        const d = Math.sqrt(d2);
        const fx = (dx / d) * force;
        const fy = (dy / d) * force;
        a.vx += fx; a.vy += fy;
        b.vx -= fx; b.vy -= fy;
      }
      const ringR = Math.min(w, h) * 0.30;
      const hx = cx + Math.cos(a.homeAngle) * ringR;
      const hy = cy + Math.sin(a.homeAngle) * ringR;
      a.vx += (hx - a.x) * 0.008;
      a.vy += (hy - a.y) * 0.008;
    }

    // Thought physics: spring to hub, repel siblings within same dimension.
    const byDim = {};
    for (const n of this.nodes) {
      if (n.type === "thought") (byDim[n.dimId] = byDim[n.dimId] || []).push(n);
    }

    for (const dimId in byDim) {
      const group = byDim[dimId];
      const hub = this.nodeById["hub_" + dimId];
      for (let i = 0; i < group.length; i++) {
        const a = group[i];
        if (a.pinned) continue;
        // spring to hub — higher charge orbits closer (more gravity)
        const desired = 60 + (5 - a.charge) * 12;
        let dx = a.x - hub.x;
        let dy = a.y - hub.y;
        let d = Math.sqrt(dx * dx + dy * dy) || 1;
        const pull = (d - desired) * 0.02;
        a.vx -= (dx / d) * pull;
        a.vy -= (dy / d) * pull;

        // sibling repulsion
        for (let j = 0; j < group.length; j++) {
          if (i === j) continue;
          const b = group[j];
          let bx = a.x - b.x;
          let by = a.y - b.y;
          let bd2 = bx * bx + by * by || 1;
          const force = 1400 / bd2;
          const bd = Math.sqrt(bd2);
          a.vx += (bx / bd) * force;
          a.vy += (by / bd) * force;
        }
      }
    }

    // global repulsion between thoughts of different dimensions (light)
    const thoughts = this.nodes.filter((n) => n.type === "thought");
    for (let i = 0; i < thoughts.length; i++) {
      const a = thoughts[i];
      if (a.pinned) continue;
      for (let j = i + 1; j < thoughts.length; j++) {
        const b = thoughts[j];
        if (a.dimId === b.dimId) continue;
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        let d2 = dx * dx + dy * dy;
        if (d2 > 12000) continue;
        d2 = d2 || 1;
        const force = 600 / d2;
        const d = Math.sqrt(d2);
        a.vx += (dx / d) * force;
        a.vy += (dy / d) * force;
        b.vx -= (dx / d) * force;
        b.vy -= (dy / d) * force;
      }
    }

    // integrate + damp
    for (const n of this.nodes) {
      if (n.pinned) continue;
      n.vx *= 0.86;
      n.vy *= 0.86;
      n.x += n.vx;
      n.y += n.vy;
    }
  }

  _loop() {
    this._physics();

    // ease toward target offset if focusing
    if (this._targetOffset) {
      this.offsetX += (this._targetOffset.x - this.offsetX) * 0.12;
      this.offsetY += (this._targetOffset.y - this.offsetY) * 0.12;
      if (Math.abs(this._targetOffset.x - this.offsetX) < 0.5) this._targetOffset = null;
    }

    this._render();
    this._raf = requestAnimationFrame(this._loop);
  }

  _render() {
    const ctx = this.ctx;
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    const time = performance.now() / 1000;

    // backdrop
    const bg = ctx.createRadialGradient(w / 2, h * 0.42, 0, w / 2, h * 0.42, Math.max(w, h) * 0.8);
    bg.addColorStop(0, "#0a1020");
    bg.addColorStop(1, "#04060d");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // starfield (parallax with pan)
    for (const s of this.stars) {
      const px = ((s.x * w + this.offsetX * 0.04 * s.z) % w + w) % w;
      const py = ((s.y * h + this.offsetY * 0.04 * s.z) % h + h) % h;
      const tw = 0.4 + 0.6 * Math.abs(Math.sin(time * 0.6 + s.t));
      ctx.globalAlpha = 0.18 * s.z * tw;
      ctx.fillStyle = "#9fc6ff";
      ctx.fillRect(px, py, s.z * 1.6, s.z * 1.6);
    }
    ctx.globalAlpha = 1;

    ctx.save();
    ctx.translate(this.offsetX, this.offsetY);
    ctx.scale(this.scale, this.scale);

    // links
    ctx.lineWidth = 1 / this.scale;
    for (const l of this.links) {
      const a = this.nodeById[l.a];
      const b = this.nodeById[l.b];
      if (!a || !b) continue;
      const active = this.selectedId === b.id || this.hoverNode === b || this.hoverNode === a;
      const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
      grad.addColorStop(0, this._rgba(a.color, active ? 0.55 : 0.18));
      grad.addColorStop(1, this._rgba(b.color, active ? 0.5 : 0.10));
      ctx.strokeStyle = grad;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    // nodes — thoughts first, hubs on top
    const ordered = [...this.nodes].sort((a, b) => (a.type === "hub" ? 1 : 0) - (b.type === "hub" ? 1 : 0));
    for (const n of ordered) {
      const selected = this.selectedId === n.id;
      const hovered = this.hoverNode === n;
      const pulse = n.type === "thought" ? 0.85 + 0.15 * Math.sin(time * 1.6 + (n.twinkle || 0)) : 1;
      const r = n.r * pulse;

      // bloom
      const glowR = r * (selected ? 4.5 : hovered ? 3.6 : 2.8);
      const glow = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, glowR);
      glow.addColorStop(0, this._rgba(n.color, selected ? 0.9 : 0.5));
      glow.addColorStop(0.4, this._rgba(n.color, 0.18));
      glow.addColorStop(1, this._rgba(n.color, 0));
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(n.x, n.y, glowR, 0, Math.PI * 2);
      ctx.fill();

      // core
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.fillStyle = n.type === "hub" ? this._rgba(n.color, 0.92) : this._rgba(n.color, 0.96);
      ctx.fill();
      ctx.lineWidth = (selected ? 2.5 : 1.2) / this.scale;
      ctx.strokeStyle = this._rgba("#ffffff", selected ? 0.9 : 0.4);
      ctx.stroke();

      // inner light
      ctx.beginPath();
      ctx.arc(n.x - r * 0.25, n.y - r * 0.25, r * 0.4, 0, Math.PI * 2);
      ctx.fillStyle = this._rgba("#ffffff", 0.5);
      ctx.fill();

      // hub label
      if (n.type === "hub") {
        ctx.font = `${600} ${12 / this.scale + 4}px 'Space Grotesk', system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillStyle = this._rgba("#eaf2ff", 0.92);
        ctx.shadowColor = n.color;
        ctx.shadowBlur = 12;
        ctx.fillText(n.label.toUpperCase(), n.x, n.y + r + 6);
        ctx.shadowBlur = 0;
      }
    }

    // hovered thought: floating snippet
    if (this.hoverNode && this.hoverNode.type === "thought") {
      const n = this.hoverNode;
      const snippet = (n.thought.answer || "").slice(0, 60) + (n.thought.answer.length > 60 ? "…" : "");
      ctx.font = `${13 / this.scale}px 'Space Grotesk', system-ui, sans-serif`;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      const padX = 8 / this.scale;
      const tw = ctx.measureText(snippet).width;
      const bx = n.x + n.r + 8 / this.scale;
      const by = n.y;
      ctx.fillStyle = this._rgba("#04060d", 0.85);
      ctx.strokeStyle = this._rgba(n.color, 0.6);
      ctx.lineWidth = 1 / this.scale;
      this._roundRect(ctx, bx, by - 12 / this.scale, tw + padX * 2, 24 / this.scale, 6 / this.scale);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#dfe9ff";
      ctx.fillText(snippet, bx + padX, by);
    }

    ctx.restore();
  }

  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  _rgba(hex, a) {
    const h = hex.replace("#", "");
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${a})`;
  }
}
