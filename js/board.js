/*
 * board.js — Bàn cờ tương tác: bấm-để-đi và kéo-thả, mũi tên gợi ý,
 * đánh dấu nước vừa đi, ô đang bị chiếu, chọn quân phong cấp.
 */
(function (root) {
  'use strict';

  const GLYPH = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
  const FILES = 'abcdefgh';

  class BoardView {
    constructor(el, arrowsSvg, promoEl) {
      this.el = el;
      this.svg = arrowsSvg;
      this.promoEl = promoEl;
      this.orientation = 'w';
      this.game = null;
      this.selected = null;
      this.targets = [];
      this.lastMove = null;
      this.arrows = [];
      this.marks = {}; // square -> css class
      this.canMove = () => false; // (color) => bool
      this.onMove = null; // ({from,to,promotion}) => void
      this.squares = {};
      this.drag = null;
      this._build();
    }

    _build() {
      this.el.innerHTML = '';
      for (let i = 0; i < 64; i++) {
        const d = document.createElement('div');
        d.className = 'sq';
        this.el.appendChild(d);
      }
      this.el.addEventListener('pointerdown', (e) => this._down(e));
      window.addEventListener('pointermove', (e) => this._moveDrag(e));
      window.addEventListener('pointerup', (e) => this._up(e));
      this.el.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    _sqAt(idx) {
      const r = Math.floor(idx / 8);
      const f = idx % 8;
      return this.orientation === 'w' ? FILES[f] + (8 - r) : FILES[7 - f] + (r + 1);
    }

    setGame(game) { this.game = game; this.selected = null; this.targets = []; this.render(); }
    setOrientation(c) { this.orientation = c; this.render(); }
    flip() { this.setOrientation(this.orientation === 'w' ? 'b' : 'w'); }
    setLastMove(m) { this.lastMove = m ? { from: m.from, to: m.to } : null; }
    setArrows(a) { this.arrows = a || []; this._drawArrows(); }
    setMarks(m) { this.marks = m || {}; this.render(); }
    clearSelection() { this.selected = null; this.targets = []; }

    render() {
      if (!this.game) return;
      const kids = this.el.children;
      const inCheck = this.game.inCheck();
      const checkSq = inCheck ? this.game.kingSquare(this.game.turn) : null;
      this.squares = {};
      for (let i = 0; i < 64; i++) {
        const sq = this._sqAt(i);
        const d = kids[i];
        this.squares[sq] = d;
        const fileIdx = FILES.indexOf(sq[0]);
        const rank = +sq[1];
        const light = (fileIdx + rank) % 2 === 1;
        let cls = 'sq ' + (light ? 'light' : 'dark');
        if (this.lastMove && (this.lastMove.from === sq || this.lastMove.to === sq)) cls += ' last';
        if (this.selected === sq) cls += ' sel';
        if (checkSq === sq) cls += ' check';
        if (this.marks[sq]) cls += ' ' + this.marks[sq];
        const p = this.game.get(sq);
        if (this.targets.includes(sq)) cls += p ? ' target cap' : ' target';
        d.className = cls;
        d.dataset.square = sq;
        let html = '';
        if (p) {
          const hidden = this.drag && this.drag.from === sq && this.drag.active ? ' dragging' : '';
          html += '<span class="pc ' + (p.color === 'w' ? 'white' : 'black') + hidden + '">' + GLYPH[p.type] + '︎</span>';
        }
        const showFile = this.orientation === 'w' ? rank === 1 : rank === 8;
        const showRank = this.orientation === 'w' ? fileIdx === 0 : fileIdx === 7;
        if (showFile) html += '<span class="coord f">' + sq[0] + '</span>';
        if (showRank) html += '<span class="coord r">' + sq[1] + '</span>';
        d.innerHTML = html;
      }
      this._drawArrows();
    }

    _center(sq) {
      const f = FILES.indexOf(sq[0]);
      const r = +sq[1];
      return this.orientation === 'w' ? [f + 0.5, 8 - r + 0.5] : [7 - f + 0.5, r - 1 + 0.5];
    }

    _drawArrows() {
      const ns = 'http://www.w3.org/2000/svg';
      [...this.svg.querySelectorAll('line,circle')].forEach((n) => n.remove());
      for (const a of this.arrows) {
        const [x1, y1] = this._center(a.from);
        const [x2, y2] = this._center(a.to);
        const kind = a.kind || 'best';
        const dx = x2 - x1;
        const dy = y2 - y1;
        const len = Math.hypot(dx, dy) || 1;
        const sx = x1 + (dx / len) * 0.25;
        const sy = y1 + (dy / len) * 0.25;
        const ex = x2 - (dx / len) * 0.38;
        const ey = y2 - (dy / len) * 0.38;
        const line = document.createElementNS(ns, 'line');
        line.setAttribute('x1', sx); line.setAttribute('y1', sy);
        line.setAttribute('x2', ex); line.setAttribute('y2', ey);
        line.setAttribute('class', 'arrow arrow-' + kind);
        line.setAttribute('marker-end', 'url(#ah-' + kind + ')');
        this.svg.appendChild(line);
      }
    }

    _squareFromEvent(e) {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const sq = el && el.closest ? el.closest('.sq') : null;
      return sq && this.el.contains(sq) ? sq.dataset.square : null;
    }

    _legalTargets(from) {
      return this.game.moves({ square: from, verbose: true }).map((m) => m.to);
    }

    _down(e) {
      if (!this.game || e.button > 0) return;
      const sq = this._squareFromEvent(e);
      if (!sq) return;
      e.preventDefault();
      if (this.selected && this.targets.includes(sq)) {
        this._attempt(this.selected, sq);
        return;
      }
      const p = this.game.get(sq);
      if (p && p.color === this.game.turn && this.canMove(p.color)) {
        this.selected = sq;
        this.targets = this._legalTargets(sq);
        this.drag = { from: sq, x: e.clientX, y: e.clientY, active: false, ghost: null, glyph: GLYPH[p.type], color: p.color };
        this.render();
      } else {
        this.clearSelection();
        this.render();
      }
    }

    _moveDrag(e) {
      const d = this.drag;
      if (!d) return;
      if (!d.active) {
        if (Math.hypot(e.clientX - d.x, e.clientY - d.y) < 6) return;
        d.active = true;
        const g = document.createElement('div');
        g.className = 'drag-ghost pc ' + (d.color === 'w' ? 'white' : 'black');
        g.textContent = d.glyph + '︎';
        const size = this.el.getBoundingClientRect().width / 8;
        g.style.width = g.style.height = size + 'px';
        g.style.fontSize = size * 0.8 + 'px';
        document.body.appendChild(g);
        d.ghost = g;
        d.size = size;
        this.render();
      }
      d.ghost.style.left = e.clientX - d.size / 2 + 'px';
      d.ghost.style.top = e.clientY - d.size / 2 + 'px';
    }

    _up(e) {
      const d = this.drag;
      if (!d) return;
      this.drag = null;
      if (d.ghost) d.ghost.remove();
      if (d.active) {
        const sq = this._squareFromEvent(e);
        if (sq && sq !== d.from && this.targets.includes(sq)) { this._attempt(d.from, sq); return; }
        if (sq !== d.from) this.clearSelection();
      }
      this.render();
    }

    _attempt(from, to) {
      const p = this.game.get(from);
      const isPromo = p && p.type === 'p' && (to[1] === '8' || to[1] === '1');
      this.clearSelection();
      const go = (promotion) => {
        if (this.onMove) this.onMove({ from, to, promotion });
        this.render();
      };
      if (isPromo) this._askPromotion(p.color, go);
      else go();
    }

    _askPromotion(color, cb) {
      const el = this.promoEl;
      el.innerHTML = '<div class="promo-box"><div class="promo-title">Phong cấp thành:</div>' +
        ['q', 'r', 'b', 'n'].map((t) => '<button data-p="' + t + '" class="pc ' + (color === 'w' ? 'white' : 'black') + '">' + GLYPH[t] + '︎</button>').join('') +
        '</div>';
      el.classList.remove('hidden');
      el.onclick = (e) => {
        const b = e.target.closest('button');
        el.classList.add('hidden');
        el.onclick = null;
        if (b) cb(b.dataset.p);
        else this.render();
      };
    }
  }

  root.BoardView = BoardView;
})(this);
