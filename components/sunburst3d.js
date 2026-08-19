/* ═══════════════════════════════════════════════════════════════════
   Sunburst3D — anéis concêntricos em SVG puro (sem libs, sem Canvas).
   Componente genérico: não conhece nada do domínio (não sabe o que é
   "Locação" ou "proprietário") — só recebe, por anel, uma lista de
   {key,value,color,selected?,locked?} e desenha.

   O desenho é PLANO (o nome ficou por compatibilidade). Saíram a
   extrusão lateral, o gradiente de iluminação, o brilho especular, o
   sheen e todas as drop-shadow das fatias: cada fatia é uma cor chapada
   com um contorno fino. Além de mais leve, isso é o que devolve a
   definição — todo drop-shadow/blur força o navegador a rasterizar o
   trecho do SVG num bitmap, e era daí que vinha o aspecto borrado; sem
   eles o desenho continua vetorial e nítido em qualquer densidade de
   tela.

   Uso:
     const chart = new Sunburst3D(containerEl, {
       rings: [
         {id:'inner', rIn:100, rOut:188, mode:'icon',   gapDeg:.9, power:.3},
         {id:'outer', rIn:200, rOut:312, mode:'avatar', gapDeg:.7, power:.5},
       ],
       getIcon:  (ringId,key) => '<path .../>' | null,
       getLabel: (ringId,key) => 'AB' | null,
       onToggle: (ringId,key) => {...},   // clique na fatia/tag/quadrado da legenda
       onOpen:   (ringId,key) => {...},   // clique no nome da legenda
     });
     chart.update({ inner:[{key,value,color,selected}, ...], outer:[...] });
     chart.setHub({label,value,sub,subIcon});
     chart.renderLegend('inner', ulEl, {title:'Tipo'});
   ═══════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  const SVGNS = 'http://www.w3.org/2000/svg';
  const el = (tag, cls) => { const e = document.createElementNS(SVGNS, tag); if (cls) e.setAttribute('class', cls); return e; };

  function luminance(hex) {
    const h = hex.replace('#', '');
    const [r, g, b] = [0, 2, 4].map(i => {
      const c = parseInt(h.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  const markColor = hex => (luminance(hex) > 0.42 ? '#16202E' : '#ffffff');

  let uid = 0;

  class Sunburst3D {
    constructor(container, opts) {
      this.container = container;
      this.size = opts.size || 640;
      this.cx = this.size / 2; this.cy = this.size / 2;
      this.rings = opts.rings || [];
      this.getIcon = opts.getIcon || (() => null);
      this.getLabel = opts.getLabel || (() => null);
      this.getShortLabel = opts.getShortLabel || (() => null);
      this.onToggle = opts.onToggle || (() => {});
      this.onOpen = opts.onOpen || (() => {});
      this.uid = ++uid;
      this._els = {}; // ringId -> { key -> record }
      this._prevSig = {}; // ringId -> signature string (pra saber quando repovoar)
      this._lastData = {};
      this._build();
    }

    // ─── ângulo -> ponto ───
    polar(r, angDeg) {
      const a = (angDeg - 90) * Math.PI / 180;
      return { x: this.cx + r * Math.cos(a), y: this.cy + r * Math.sin(a) };
    }
    ringPath(rOut, rIn, a0, a1) {
      const p1 = this.polar(rOut, a0), p2 = this.polar(rOut, a1);
      const p3 = this.polar(rIn, a1), p4 = this.polar(rIn, a0);
      const large = a1 - a0 > 180 ? 1 : 0;
      return `M${p1.x} ${p1.y} A${rOut} ${rOut} 0 ${large} 1 ${p2.x} ${p2.y} L${p3.x} ${p3.y} A${rIn} ${rIn} 0 ${large} 0 ${p4.x} ${p4.y} Z`;
    }
    // Maior fonte (até maxFs) que cabe na corda da fatia nesse raio, sem
    // passar de minFs; se nem o rótulo curto cabe no mínimo, não mostra
    // nada em vez de estourar/sobrepor a fatia vizinha.
    fitLabel(radius, spanDeg, full, short) {
      const chord = 2 * radius * Math.sin(Math.min(spanDeg, 170) * Math.PI / 360) * 0.82;
      const maxFs = 18, minFs = 10.5, avgCharW = 0.58;
      const tryFit = text => {
        if (!text) return null;
        const fs = Math.min(maxFs, chord / (text.length * avgCharW));
        return fs >= minFs ? { text, fs: fs.toFixed(1) } : null;
      };
      return tryFit(full) || tryFit(short);
    }

    _build() {
      const c = this.container;
      c.classList.add('sb3d-stage');
      c.innerHTML = '';
      const svg = el('svg'); svg.setAttribute('viewBox', `0 0 ${this.size} ${this.size}`); svg.setAttribute('aria-hidden', 'true');
      // Sem <defs>: com as fatias chapadas não há mais gradiente nenhum
      // pra declarar.
      const connG = el('g');
      svg.appendChild(connG);
      this._svg = svg; this._connG = connG;

      this._ringGroups = {};
      this.rings.forEach(cfg => {
        const g = el('g', 'sb3d-ring' + (cfg.big ? ' sb3d-ring-outer' : ''));
        g.dataset.ring = cfg.id;
        svg.appendChild(g);
        this._ringGroups[cfg.id] = g;
        this._els[cfg.id] = {};
      });

      c.appendChild(svg);

      const cards = document.createElement('div'); cards.className = 'sb3d-cards';
      c.appendChild(cards); this._cards = cards;

      const hub = document.createElement('div'); hub.className = 'sb3d-hub';
      hub.innerHTML = '<div class="sb3d-hub-label"></div><div class="sb3d-hub-value"></div><div class="sb3d-hub-sub" style="display:none"></div><div class="sb3d-hub-sub2" style="display:none"></div>';
      hub.addEventListener('click', () => this._hubClick && this._hubClick());
      // O disco do miolo preenche o vão livre no meio do anel mais interno
      // (2× o rIn dele, em % do stage) — nasce do próprio config, não é
      // um número fixo solto no CSS.
      const innerMost = Math.min(...this.rings.map(r => r.rIn));
      const hubPct = (innerMost * 2 / this.size * 100 * 0.94).toFixed(2) + '%';
      hub.style.width = hubPct; hub.style.height = hubPct;
      c.appendChild(hub); this._hub = hub;
    }

    onHubClick(fn) { this._hubClick = fn; }

    setHub({ label, value, sub, sub2 }) {
      const lblEl = this._hub.querySelector('.sb3d-hub-label');
      const valEl = this._hub.querySelector('.sb3d-hub-value');
      const mudou = lblEl.textContent !== (label || '') || valEl.textContent !== (value || '');
      lblEl.textContent = label || '';
      valEl.textContent = value || '';
      // Troca de conteúdo entra com um fade curto. Tirar a classe e ler
      // offsetWidth força o reflow — sem isso o navegador não reinicia
      // uma animação que já está aplicada, e da segunda troca em diante
      // o texto trocaria seco.
      if (mudou) {
        this._hub.classList.remove('sb3d-hub-troca');
        void this._hub.offsetWidth;
        this._hub.classList.add('sb3d-hub-troca');
      }
      const subEl = this._hub.querySelector('.sb3d-hub-sub');
      if (sub) { subEl.style.display = ''; subEl.textContent = sub; } else subEl.style.display = 'none';
      const sub2El = this._hub.querySelector('.sb3d-hub-sub2');
      if (sub2) { sub2El.style.display = ''; sub2El.textContent = sub2; } else sub2El.style.display = 'none';
    }

    // ─── calcula ângulos a partir dos valores (proporcional, com
    // suavização opcional via power<1 pra fatias minúsculas não
    // sumirem) — a única "matemática de gráfico" do componente. ───
    _computeSegs(cfg, items) {
      const p = cfg.power || 1;
      const weights = items.map(it => Math.pow(Math.max(it.value, 0), p));
      const wSum = weights.reduce((a, b) => a + b, 0) || 1;
      const total = items.reduce((a, b) => a + Math.max(b.value, 0), 0) || 1;
      const gap = cfg.gapDeg != null ? cfg.gapDeg : 1;
      let acc = 0;
      return items.map((it, i) => {
        const frac = Math.max(weights[i] / wSum, 0.004);
        const startA = acc * 360, endA = (acc + frac) * 360;
        acc += frac;
        const mid = (startA + endA) / 2;
        const rad = (mid - 90) * Math.PI / 180;
        return { ...it, startA: startA + gap / 2, endA: endA - gap / 2, mid,
          pct: it.value / total * 100, dir: { x: Math.cos(rad), y: Math.sin(rad) } };
      });
    }

    update(dataByRing) {
      this._lastData = dataByRing;
      // Esmaecer é uma decisão GLOBAL, não por anel: se algo está
      // selecionado em qualquer anel (ex.: um tipo), o outro anel (ex.:
      // proprietário) não tem nada "selecionado" nele mesmo, mas também
      // não deve ficar em destaque — senão a fatia que sobra ali (às
      // vezes um anel inteiro, se só um dono tiver aquele tipo) parece
      // uma segunda seleção por engano.
      const anySelected = this.rings.some(cfg => (dataByRing[cfg.id] || []).some(it => it.selected));
      this.rings.forEach(cfg => {
        const items = dataByRing[cfg.id] || [];
        this._renderRing(cfg, items, anySelected);
      });
    }

    _renderRing(cfg, items, anySelected) {
      const segs = this._computeSegs(cfg, items);
      const sig = segs.map(s => s.key).join('|');
      const group = this._ringGroups[cfg.id];
      if (this._prevSig[cfg.id] !== sig) {
        Array.from(group.querySelectorAll(':scope > g.sb3d-slice')).forEach(n => n.remove());
        this._connG.querySelectorAll(`[data-ring="${cfg.id}"]`).forEach(n => n.remove());
        this._cards.querySelectorAll(`[data-ring="${cfg.id}"]`).forEach(n => n.remove());
        this._els[cfg.id] = {};
        this._prevSig[cfg.id] = sig;
      }

      segs.forEach(s => {
        let rec = this._els[cfg.id][s.key];
        let isNew = false;
        if (!rec) {
          isNew = true;
          rec = this._createSlice(cfg, s);
          this._els[cfg.id][s.key] = rec;
          group.appendChild(rec.g);
        }
        rec.g.classList.toggle('dimmed', anySelected && !s.selected);
        this._updateSlice(cfg, rec, s);
        if (isNew) {
          rec.g.classList.add('sb3d-entering');
          rec.g.addEventListener('animationend', () => rec.g.classList.remove('sb3d-entering'), { once: true });
        }
      });
    }

    _createSlice(cfg, s) {
      const g = el('g', `sb3d-slice mode-${cfg.mode}`);
      g.dataset.ring = cfg.id; g.dataset.key = s.key;

      // Cor chapada, sem gradiente: além de ser o que dá o aspecto plano,
      // é o que mantém a fatia 100% vetorial (nada aqui obriga o
      // navegador a rasterizar).
      const path = el('path', 'main'); path.setAttribute('pointer-events', 'none');
      g.appendChild(path);

      const markG = el('g', cfg.mode === 'icon' ? 'sb3d-icon' : 'sb3d-avatar');
      g.appendChild(markG);

      // Área de toque menor que a fatia visual e recuada das bordas
      // (ver _updateSlice) — no celular, o dedo cobre com facilidade um
      // pedaço do anel vizinho perto da fronteira entre os dois anéis;
      // encolher e centralizar a área clicável evita pegar a fatia
      // errada. path.main fica só visual (pointer-events:none).
      const hit = el('path', 'hit'); hit.setAttribute('fill', 'transparent'); hit.setAttribute('pointer-events', 'all');
      g.appendChild(hit);

      hit.addEventListener('click', () => { if (!s.locked) this.onToggle(cfg.id, s.key); });
      hit.addEventListener('pointerenter', () => this._hoverTag(cfg, s.key, true));
      hit.addEventListener('pointerleave', () => this._hoverTag(cfg, s.key, false));

      const line = el('line', 'sb3d-connector'); line.dataset.ring = cfg.id; line.dataset.key = s.key;
      this._connG.appendChild(line);

      const tag = document.createElement('div');
      tag.className = 'sb3d-tag'; tag.dataset.ring = cfg.id; tag.dataset.key = s.key;
      tag.innerHTML = '<span class="sb3d-tag-dot"></span><span class="sb3d-tag-txt"><span class="sb3d-tag-name"></span><span class="sb3d-tag-val"></span></span><span class="sb3d-tag-pct"></span>';
      tag.addEventListener('click', () => { if (!s.locked) this.onToggle(cfg.id, s.key); });
      this._cards.appendChild(tag);

      return { g, path, hit, markG, line, tag, hover: false };
    }

    _hoverTag(cfg, key, on) {
      const rec = this._els[cfg.id][key];
      if (!rec) return;
      rec.hover = on;
      this._positionTag(cfg, rec, this._lastSeg(cfg, key));
    }
    _lastSeg(cfg, key) {
      const items = this._lastData[cfg.id] || [];
      const segs = this._computeSegs(cfg, items);
      return segs.find(s => s.key === key);
    }

    _updateSlice(cfg, rec, s) {
      const d = this.ringPath(cfg.rOut, cfg.rIn, s.startA, s.endA);
      rec.path.setAttribute('d', d);
      rec.path.setAttribute('fill', s.color);
      rec.g.classList.toggle('is-selected', !!s.selected);

      // Área de clique bem recuada (~28% da espessura em cada borda,
      // centralizada) — bem menor que a fatia pintada, pra sobrar uma
      // faixa "morta" bem mais folgada entre os dois anéis onde nenhum
      // dos dois responde ao toque, em vez do dedo grudar sempre no
      // anel vizinho (17% não bastou no teste real em celular).
      const inset = (cfg.rOut - cfg.rIn) * 0.28;
      rec.hit.setAttribute('d', this.ringPath(cfg.rOut - inset, cfg.rIn + inset, s.startA, s.endA));

      const mc = markColor(s.color);
      if (cfg.mode === 'icon') {
        const icon = this.getIcon(cfg.id, s.key);
        const ip = this.polar(cfg.markR || (cfg.rOut + cfg.rIn) / 2, s.mid);
        if (icon) rec.markG.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${icon}</svg>`;
        else rec.markG.innerHTML = '';
        rec.markG.style.color = mc;
        const scale = s.selected ? 2.25 : 1.7;
        rec.markG.setAttribute('transform', `translate(${ip.x - 12 * scale} ${ip.y - 12 * scale}) scale(${scale})`);
        rec.g.style.transform = s.selected ? `translate(${s.dir.x * (cfg.explode || 18)}px, ${s.dir.y * (cfg.explode || 18)}px)` : '';
      } else {
        // Nome completo do proprietário direto na fatia, numa fonte que
        // encolhe pra caber na corda da fatia (2·R·sen(ângulo/2)) — fatia
        // larga (Silvio, ~80%) lê o nome grande; fatia fina (Silvio 2,
        // ~2%) cai pra um tamanho bem menor e, se nem assim couber, usa
        // as iniciais (getShortLabel) como último recurso.
        const markR = cfg.markR || (cfg.rOut + cfg.rIn) / 2;
        const label = s.locked ? '' : this.fitLabel(markR, s.endA - s.startA, this.getLabel(cfg.id, s.key), this.getShortLabel(cfg.id, s.key));
        if (label) {
          const ap = this.polar(markR, s.mid);
          rec.markG.innerHTML = `<text x="${ap.x}" y="${ap.y + 0.5}" style="fill:${mc};font-size:${label.fs}px">${label.text}</text>`;
        } else rec.markG.innerHTML = '';
        const op = this.polar((cfg.rOut + cfg.rIn) / 2, s.mid);
        rec.g.style.transformOrigin = `${op.x}px ${op.y}px`;
        // A fatia selecionada cresce um tico. O halo colorido que ficava
        // atrás dela saiu: ele era desenhado num raio maior e sem a
        // escala da fatia, então no desenho plano — sem as sombras que
        // antes o disfarçavam — aparecia como um trapézio solto de um
        // lado só. O contorno da fatia, o resto esmaecido e a etiqueta
        // já dizem o que está selecionado.
      }

      this._positionTag(cfg, rec, s);
    }

    _positionTag(cfg, rec, s) {
      if (!s) return;
      const labelR = cfg.labelR != null ? cfg.labelR : cfg.rOut + 40;
      const lp = this.polar(labelR, s.mid);
      const show = !!s.selected || !!rec.hover;
      rec.tag.classList.toggle('show', show);
      rec.tag.style.left = (lp.x / this.size * 100) + '%';
      rec.tag.style.top = (lp.y / this.size * 100) + '%';
      rec.tag.classList.toggle('left', s.dir.x < -0.15);
      // A tag ficou mais larga com o % (Locação/Silvio, perto da lateral,
      // tomam quase o anel inteiro) — precisa de mais folga que antes
      // pra não estourar a borda da tela.
      const tx = -50 - Math.max(-42, Math.min(42, s.dir.x * 42));
      rec.tag.style.setProperty('--tx', tx + '%');
      rec.tag.querySelector('.sb3d-tag-dot').style.background = s.color;
      rec.tag.querySelector('.sb3d-tag-name').textContent = s.key;
      rec.tag.querySelector('.sb3d-tag-val').textContent = s.valueLabel != null ? s.valueLabel : s.value;
      rec.tag.querySelector('.sb3d-tag-pct').textContent = s.pct.toFixed(s.pct < 10 ? 1 : 0) + '%';

      if (s.selected) {
        const edgeR = cfg.rOut + (cfg.mode === 'icon' ? (cfg.explode || 18) : 8);
        const outerP = this.polar(edgeR, s.mid);
        rec.line.setAttribute('x1', outerP.x); rec.line.setAttribute('y1', outerP.y);
        rec.line.setAttribute('x2', lp.x); rec.line.setAttribute('y2', lp.y);
        rec.line.style.opacity = 0.32;
      } else {
        rec.line.style.opacity = 0;
      }
    }

    // ─── Legenda premium: quadrado, nome, valor, percentual, barra ───
    renderLegend(ringId, ulEl, opts) {
      opts = opts || {};
      const items = this._lastData[ringId] || [];
      const segs = this._computeSegs(this._ringById(ringId), items);
      ulEl.innerHTML = '';
      segs.forEach(s => {
        const li = document.createElement('li');
        li.className = s.locked ? 'nosel' : (s.selected ? 'on' : '');
        li.dataset.ring = ringId; li.dataset.key = s.key;
        const barPct = Math.max(s.pct, s.pct > 0 ? 0.6 : 0);
        li.innerHTML =
          `<span class="sb3d-legend-sq" style="background:${s.color}"></span>` +
          `<span class="sb3d-legend-nm">${s.key}</span>` +
          `<span class="sb3d-legend-right"><span class="sb3d-legend-val">${s.valueLabel != null ? s.valueLabel : s.value}</span></span>` +
          `<span class="sb3d-legend-bar-wrap"><span class="sb3d-legend-bar" style="width:${barPct}%;background:${s.color};--bc:${s.color}66"></span></span>`;
        if (!s.locked) {
          li.querySelector('.sb3d-legend-sq').addEventListener('click', e => { e.stopPropagation(); this.onToggle(ringId, s.key); });
          li.addEventListener('click', () => this.onOpen(ringId, s.key));
        }
        ulEl.appendChild(li);
      });
      if (opts.title) ulEl.setAttribute('aria-label', opts.title);
    }

    _ringById(id) { return this.rings.find(r => r.id === id); }
  }

  global.Sunburst3D = Sunburst3D;
})(window);
