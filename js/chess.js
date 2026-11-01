/*
 * chess.js — Luật cờ vua đầy đủ (biểu diễn bàn cờ 0x88).
 * Hỗ trợ: FEN, nước đi hợp lệ, nhập thành, bắt tốt qua đường, phong cấp,
 * ký hiệu SAN, chiếu / chiếu hết / hòa pat / hòa do lặp lại / thiếu quân / luật 50 nước.
 * Chạy được cả trong trình duyệt (window.Chess) và Node (module.exports).
 */
(function (root) {
  'use strict';

  const W = 'w';
  const B = 'b';
  const DEFAULT_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

  const PAWN_DIR = { w: -16, b: 16 };
  const OFFSETS = {
    n: [-18, -33, -31, -14, 18, 33, 31, 14],
    b: [-17, -15, 17, 15],
    r: [-16, 1, 16, -1],
    q: [-17, -16, -15, 1, 17, 16, 15, -1],
    k: [-17, -16, -15, 1, 17, 16, 15, -1],
  };
  const SLIDER = { b: true, r: true, q: true };

  // Quyền nhập thành dạng bitmask: 1 = K, 2 = Q, 4 = k, 8 = q
  const CR = { K: 1, Q: 2, k: 4, q: 8 };
  const CR_MASK = new Array(128).fill(15);
  CR_MASK[116] = 12; // e1
  CR_MASK[119] = 14; // h1
  CR_MASK[112] = 13; // a1
  CR_MASK[4] = 3; // e8
  CR_MASK[7] = 11; // h8
  CR_MASK[0] = 7; // a8

  function other(c) { return c === W ? B : W; }
  function sqName(i) { return 'abcdefgh'[i & 7] + (8 - (i >> 4)); }
  function sqIdx(s) {
    if (typeof s !== 'string' || s.length !== 2) return -1;
    const f = s.charCodeAt(0) - 97;
    const r = s.charCodeAt(1) - 49;
    if (f < 0 || f > 7 || r < 0 || r > 7) return -1;
    return (7 - r) * 16 + f;
  }

  class Chess {
    constructor(fen) {
      this.load(fen || DEFAULT_FEN);
    }

    load(fen) {
      const parts = String(fen).trim().split(/\s+/);
      if (parts.length < 2) throw new Error('FEN không hợp lệ');
      const rows = parts[0].split('/');
      if (rows.length !== 8) throw new Error('FEN không hợp lệ: cần 8 hàng');
      const b = new Array(128).fill(null);
      const kings = { w: -1, b: -1 };
      for (let r = 0; r < 8; r++) {
        let f = 0;
        for (const ch of rows[r]) {
          if (ch >= '1' && ch <= '8') { f += +ch; continue; }
          const type = ch.toLowerCase();
          if (!'pnbrqk'.includes(type) || f > 7) throw new Error('FEN không hợp lệ: ký tự "' + ch + '"');
          const color = ch === type ? B : W;
          const i = r * 16 + f;
          b[i] = { type, color };
          if (type === 'k') {
            if (kings[color] >= 0) throw new Error('FEN không hợp lệ: có hai Vua cùng màu');
            kings[color] = i;
          }
          f++;
        }
        if (f !== 8) throw new Error('FEN không hợp lệ: hàng ' + (8 - r) + ' không đủ 8 ô');
      }
      if (kings.w < 0 || kings.b < 0) throw new Error('FEN không hợp lệ: thiếu Vua');
      this.b = b;
      this.kings = kings;
      this.turn = parts[1] === 'b' ? B : W;
      const c = parts[2] || '-';
      let cr = 0;
      for (const ch of c) if (CR[ch]) cr |= CR[ch];
      // Loại bỏ quyền nhập thành không khớp với vị trí quân.
      const isP = (sq, type, color) => b[sq] && b[sq].type === type && b[sq].color === color;
      if (!isP(116, 'k', W)) cr &= ~3;
      if (!isP(119, 'r', W)) cr &= ~1;
      if (!isP(112, 'r', W)) cr &= ~2;
      if (!isP(4, 'k', B)) cr &= ~12;
      if (!isP(7, 'r', B)) cr &= ~4;
      if (!isP(0, 'r', B)) cr &= ~8;
      this.cr = cr;
      this.ep = !parts[3] || parts[3] === '-' ? -1 : sqIdx(parts[3]);
      this.half = parseInt(parts[4] || '0', 10) || 0;
      this.full = parseInt(parts[5] || '1', 10) || 1;
      this.hist = [];
      this.pubHist = [];
      this.posCount = {};
      this._bump(1);
      return this;
    }

    reset() { return this.load(DEFAULT_FEN); }

    clone() {
      const c = Object.create(Chess.prototype);
      c.b = this.b.slice();
      c.kings = { w: this.kings.w, b: this.kings.b };
      c.turn = this.turn;
      c.cr = this.cr;
      c.ep = this.ep;
      c.half = this.half;
      c.full = this.full;
      c.hist = [];
      c.pubHist = this.pubHist.slice();
      c.posCount = Object.assign({}, this.posCount);
      return c;
    }

    fen() {
      let s = '';
      for (let r = 0; r < 8; r++) {
        let e = 0;
        for (let f = 0; f < 8; f++) {
          const p = this.b[r * 16 + f];
          if (!p) { e++; continue; }
          if (e) { s += e; e = 0; }
          s += p.color === W ? p.type.toUpperCase() : p.type;
        }
        if (e) s += e;
        if (r < 7) s += '/';
      }
      let c = '';
      if (this.cr & 1) c += 'K';
      if (this.cr & 2) c += 'Q';
      if (this.cr & 4) c += 'k';
      if (this.cr & 8) c += 'q';
      return [s, this.turn, c || '-', this.ep < 0 ? '-' : sqName(this.ep), this.half, this.full].join(' ');
    }

    _key() { return this.fen().split(' ').slice(0, 4).join(' '); }
    _bump(d) {
      const k = this._key();
      this.posCount[k] = (this.posCount[k] || 0) + d;
    }

    /** Danh sách ô (chỉ số 0x88) của các quân màu `color` đang tấn công ô `sq`. */
    _attackers(sq, color, first) {
      const b = this.b;
      const res = first ? null : [];
      const pd = color === W ? [15, 17] : [-15, -17];
      for (let k = 0; k < 2; k++) {
        const s = sq + pd[k];
        if (s & 0x88) continue;
        const p = b[s];
        if (p && p.color === color && p.type === 'p') { if (first) return true; res.push(s); }
      }
      const N = OFFSETS.n;
      for (let k = 0; k < 8; k++) {
        const s = sq + N[k];
        if (s & 0x88) continue;
        const p = b[s];
        if (p && p.color === color && p.type === 'n') { if (first) return true; res.push(s); }
      }
      const K = OFFSETS.k;
      for (let k = 0; k < 8; k++) {
        const d = K[k];
        const diag = d === -17 || d === -15 || d === 15 || d === 17;
        let s = sq + d;
        let dist = 1;
        while (!(s & 0x88)) {
          const p = b[s];
          if (p) {
            if (p.color === color) {
              const t = p.type;
              if (t === 'q' || (diag ? t === 'b' : t === 'r') || (t === 'k' && dist === 1)) {
                if (first) return true;
                res.push(s);
              }
            }
            break;
          }
          s += d;
          dist++;
        }
      }
      return first ? false : res;
    }

    /** Các ô mà quân ở `i` đang kiểm soát (tấn công), kể cả ô có quân. */
    _attacksFrom(i) {
      const p = this.b[i];
      if (!p) return [];
      const res = [];
      if (p.type === 'p') {
        const d = PAWN_DIR[p.color];
        for (const t of [i + d - 1, i + d + 1]) if (!(t & 0x88)) res.push(t);
        return res;
      }
      for (const d of OFFSETS[p.type]) {
        let t = i + d;
        while (!(t & 0x88)) {
          res.push(t);
          if (this.b[t] || !SLIDER[p.type]) break;
          t += d;
        }
      }
      return res;
    }

    _inCheck(color) {
      return this._attackers(this.kings[color], other(color), true);
    }

    /** Sinh nước đi giả hợp lệ (chưa kiểm tra Vua bị chiếu). */
    _gen(capOnly) {
      const moves = [];
      const us = this.turn;
      const them = other(us);
      const b = this.b;
      const add = (from, to, piece, captured, flags, promo) => {
        moves.push({ color: us, from, to, piece, captured: captured || null, promotion: promo || null, flags });
      };
      const addPawn = (from, to, captured, flags) => {
        const r = to >> 4;
        if (r === 0 || r === 7) {
          add(from, to, 'p', captured, flags + 'p', 'q');
          add(from, to, 'p', captured, flags + 'p', 'n');
          add(from, to, 'p', captured, flags + 'p', 'r');
          add(from, to, 'p', captured, flags + 'p', 'b');
        } else add(from, to, 'p', captured, flags);
      };
      for (let i = 0; i < 128; i++) {
        if (i & 0x88) { i += 7; continue; }
        const p = b[i];
        if (!p || p.color !== us) continue;
        if (p.type === 'p') {
          const dir = PAWN_DIR[us];
          const t = i + dir;
          if (!(t & 0x88) && !b[t]) {
            const r = t >> 4;
            if (!capOnly || r === 0 || r === 7) addPawn(i, t, null, 'n');
            const startRow = us === W ? 6 : 1;
            if (!capOnly && (i >> 4) === startRow && !b[t + dir]) add(i, t + dir, 'p', null, 'b');
          }
          for (const cd of [dir - 1, dir + 1]) {
            const c = i + cd;
            if (c & 0x88) continue;
            const q = b[c];
            if (q && q.color === them) addPawn(i, c, q.type, 'c');
            else if (c === this.ep && !q) add(i, c, 'p', 'p', 'e');
          }
        } else {
          const offs = OFFSETS[p.type];
          const slide = SLIDER[p.type];
          for (let k = 0; k < offs.length; k++) {
            const d = offs[k];
            let t = i + d;
            while (!(t & 0x88)) {
              const q = b[t];
              if (q) {
                if (q.color === them) add(i, t, p.type, q.type, 'c');
                break;
              }
              if (!capOnly) add(i, t, p.type, null, 'n');
              if (!slide) break;
              t += d;
            }
          }
        }
      }
      if (!capOnly) {
        const home = us === W ? 116 : 4;
        const kBit = us === W ? 1 : 4;
        const qBit = us === W ? 2 : 8;
        if (this.kings[us] === home && (this.cr & (kBit | qBit)) && !this._attackers(home, them, true)) {
          const rook = (s) => b[s] && b[s].type === 'r' && b[s].color === us;
          if ((this.cr & kBit) && !b[home + 1] && !b[home + 2] && rook(home + 3) &&
            !this._attackers(home + 1, them, true) && !this._attackers(home + 2, them, true)) {
            add(home, home + 2, 'k', null, 'k');
          }
          if ((this.cr & qBit) && !b[home - 1] && !b[home - 2] && !b[home - 3] && rook(home - 4) &&
            !this._attackers(home - 1, them, true) && !this._attackers(home - 2, them, true)) {
            add(home, home - 2, 'k', null, 'q');
          }
        }
      }
      return moves;
    }

    _make(m) {
      const b = this.b;
      const us = m.color;
      const isEp = m.flags.indexOf('e') >= 0;
      const capSq = isEp ? (us === W ? m.to + 16 : m.to - 16) : m.to;
      this.hist.push({ m, pieceObj: b[m.from], capObj: b[capSq], cr: this.cr, ep: this.ep, half: this.half, full: this.full });
      b[m.to] = b[m.from];
      b[m.from] = null;
      if (isEp) b[capSq] = null;
      if (m.promotion) b[m.to] = { type: m.promotion, color: us };
      if (m.piece === 'k') {
        this.kings[us] = m.to;
        if (m.flags.indexOf('k') >= 0) { b[m.to - 1] = b[m.to + 1]; b[m.to + 1] = null; }
        else if (m.flags.indexOf('q') >= 0) { b[m.to + 1] = b[m.to - 2]; b[m.to - 2] = null; }
      }
      this.cr &= CR_MASK[m.from] & CR_MASK[m.to];
      this.ep = m.flags.indexOf('b') >= 0 ? (us === W ? m.to + 16 : m.to - 16) : -1;
      this.half = m.piece === 'p' || m.captured ? 0 : this.half + 1;
      if (us === B) this.full++;
      this.turn = other(us);
    }

    _unmake() {
      const h = this.hist.pop();
      const m = h.m;
      const b = this.b;
      const us = m.color;
      this.turn = us;
      this.cr = h.cr;
      this.ep = h.ep;
      this.half = h.half;
      this.full = h.full;
      b[m.from] = h.pieceObj;
      if (m.flags.indexOf('e') >= 0) {
        b[m.to] = null;
        b[us === W ? m.to + 16 : m.to - 16] = h.capObj;
      } else b[m.to] = h.capObj;
      if (m.piece === 'k') {
        this.kings[us] = m.from;
        if (m.flags.indexOf('k') >= 0) { b[m.to + 1] = b[m.to - 1]; b[m.to - 1] = null; }
        else if (m.flags.indexOf('q') >= 0) { b[m.to - 2] = b[m.to + 1]; b[m.to + 1] = null; }
      }
    }

    /** Danh sách nước đi hợp lệ (dạng nội bộ). */
    _legal() {
      const us = this.turn;
      const out = [];
      for (const m of this._gen(false)) {
        this._make(m);
        if (!this._inCheck(us)) out.push(m);
        this._unmake();
      }
      return out;
    }

    _san(m, legal) {
      let s;
      if (m.flags.indexOf('k') >= 0) s = 'O-O';
      else if (m.flags.indexOf('q') >= 0) s = 'O-O-O';
      else {
        s = '';
        if (m.piece !== 'p') {
          s += m.piece.toUpperCase();
          const amb = legal.filter((o) => o.piece === m.piece && o.to === m.to && o.from !== m.from);
          if (amb.length) {
            const sameFile = amb.some((o) => (o.from & 7) === (m.from & 7));
            const sameRank = amb.some((o) => (o.from >> 4) === (m.from >> 4));
            if (!sameFile) s += sqName(m.from)[0];
            else if (!sameRank) s += sqName(m.from)[1];
            else s += sqName(m.from);
          }
        }
        if (m.captured) s += (m.piece === 'p' ? sqName(m.from)[0] : '') + 'x';
        s += sqName(m.to);
        if (m.promotion) s += '=' + m.promotion.toUpperCase();
      }
      this._make(m);
      if (this._inCheck(this.turn)) s += this._legal().length ? '+' : '#';
      this._unmake();
      return s;
    }

    _toPublic(m, legal) {
      return {
        color: m.color,
        from: sqName(m.from),
        to: sqName(m.to),
        piece: m.piece,
        captured: m.captured,
        promotion: m.promotion,
        flags: m.flags,
        san: this._san(m, legal || this._legal()),
        lan: sqName(m.from) + sqName(m.to) + (m.promotion || ''),
      };
    }

    /** moves({square, verbose}) */
    moves(opts) {
      opts = opts || {};
      const legal = this._legal();
      let list = legal;
      if (opts.square) {
        const s = sqIdx(opts.square);
        list = legal.filter((m) => m.from === s);
      }
      const pub = list.map((m) => this._toPublic(m, legal));
      return opts.verbose ? pub : pub.map((m) => m.san);
    }

    _find(mv, legal) {
      let from = -1;
      let to = -1;
      let promo = null;
      if (typeof mv === 'string') {
        const s = mv.trim();
        if (/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(s)) {
          from = sqIdx(s.slice(0, 2));
          to = sqIdx(s.slice(2, 4));
          promo = s[4] || null;
        } else {
          const clean = s.replace(/[+#?!]/g, '').replace(/0/g, 'O');
          const f = legal.find((m) => this._san(m, legal).replace(/[+#]/g, '') === clean);
          if (f) return f;
          return null;
        }
      } else if (mv && mv.from) {
        from = sqIdx(mv.from);
        to = sqIdx(mv.to);
        promo = mv.promotion || null;
      }
      if (from < 0 || to < 0) return null;
      return legal.find((m) => m.from === from && m.to === to && (!m.promotion || m.promotion === (promo || 'q'))) || null;
    }

    /** Thực hiện nước đi (SAN, UCI hoặc {from,to,promotion}). Trả về nước đi hoặc null. */
    move(mv) {
      const legal = this._legal();
      const found = this._find(mv, legal);
      if (!found) return null;
      const pub = this._toPublic(found, legal);
      pub.fenBefore = this.fen();
      this._make(found);
      this._bump(1);
      this.pubHist.push(pub);
      return pub;
    }

    undo() {
      if (!this.hist.length) return null;
      this._bump(-1);
      this._unmake();
      return this.pubHist.pop() || null;
    }

    history(opts) {
      return opts && opts.verbose ? this.pubHist.slice() : this.pubHist.map((m) => m.san);
    }

    get(sq) {
      const i = sqIdx(sq);
      return i < 0 ? null : this.b[i];
    }

    board() {
      const rows = [];
      for (let r = 0; r < 8; r++) {
        const row = [];
        for (let f = 0; f < 8; f++) {
          const p = this.b[r * 16 + f];
          row.push(p ? { type: p.type, color: p.color, square: sqName(r * 16 + f) } : null);
        }
        rows.push(row);
      }
      return rows;
    }

    attackers(sq, color) { return this._attackers(sqIdx(sq), color).map(sqName); }
    kingSquare(color) { return sqName(this.kings[color]); }
    inCheck() { return this._inCheck(this.turn); }
    isCheckmate() { return this.inCheck() && this._legal().length === 0; }
    isStalemate() { return !this.inCheck() && this._legal().length === 0; }
    isThreefold() { return (this.posCount[this._key()] || 0) >= 3; }
    isInsufficientMaterial() {
      const minors = [];
      for (let i = 0; i < 128; i++) {
        if (i & 0x88) { i += 7; continue; }
        const p = this.b[i];
        if (!p || p.type === 'k') continue;
        if (p.type === 'b' || p.type === 'n') minors.push({ t: p.type, c: ((i >> 4) + (i & 7)) % 2 });
        else return false;
      }
      if (minors.length <= 1) return true;
      return minors.every((m) => m.t === 'b' && m.c === minors[0].c);
    }
    isDraw() { return this.half >= 100 || this.isStalemate() || this.isInsufficientMaterial() || this.isThreefold(); }
    isGameOver() { return this.isCheckmate() || this.isDraw(); }
  }

  const api = { Chess, DEFAULT_FEN, sqName, sqIdx, other, OFFSETS, SLIDER };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.ChessLib = api; root.Chess = Chess; }
})(typeof self !== 'undefined' ? self : this);
