/*
 * engine.js — Máy tính cờ vua: alpha-beta + tìm kiếm tĩnh (quiescence),
 * đào sâu lặp, sắp xếp nước đi MVV-LVA / killer / history, bảng điểm vị trí.
 * analyse() trả về nhiều phương án (multi-PV) kèm điểm số và biến chính.
 */
(function (root) {
  'use strict';
  const lib = typeof module !== 'undefined' && module.exports ? require('./chess.js') : root.ChessLib;
  const { sqName, other } = lib;

  const VAL = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
  const MATE = 100000;
  const INF = 1000000;
  const MAXPLY = 64;

  /* Bảng điểm vị trí (góc nhìn quân Trắng, hàng 8 trước). */
  const PST = {
    p: [0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5,
      0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0],
    n: [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30,
      -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50],
    b: [-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10,
      -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20],
    r: [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5,
      -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0],
    q: [-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5,
      0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20],
    k: [-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30,
      -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20],
    ke: [-50, -40, -30, -20, -20, -30, -40, -50, -30, -20, -10, 0, 0, -10, -20, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30,
      -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -30, 0, 0, 0, 0, -30, -30, -50, -30, -30, -30, -30, -30, -30, -50],
  };

  /** Đánh giá tĩnh, trả về điểm (centipawn) theo góc nhìn bên Trắng. */
  function evaluateWhite(c) {
    const b = c.b;
    let mg = 0;
    let nonPawn = 0;
    const mat = { w: 0, b: 0 };
    const bishops = { w: 0, b: 0 };
    for (let i = 0; i < 128; i++) {
      if (i & 0x88) { i += 7; continue; }
      const p = b[i];
      if (!p || p.type === 'k') continue;
      const v = VAL[p.type];
      mat[p.color] += v;
      if (p.type !== 'p') nonPawn += v;
      if (p.type === 'b') bishops[p.color]++;
      const idx = p.color === 'w' ? (i >> 4) * 8 + (i & 7) : (7 - (i >> 4)) * 8 + (i & 7);
      const s = v + PST[p.type][idx];
      mg += p.color === 'w' ? s : -s;
    }
    const endgame = nonPawn <= 2600;
    for (const col of ['w', 'b']) {
      const i = c.kings[col];
      const idx = col === 'w' ? (i >> 4) * 8 + (i & 7) : (7 - (i >> 4)) * 8 + (i & 7);
      const s = (endgame ? PST.ke : PST.k)[idx];
      mg += col === 'w' ? s : -s;
    }
    if (bishops.w >= 2) mg += 30;
    if (bishops.b >= 2) mg -= 30;
    // Dồn Vua đối phương vào góc khi đang hơn nhiều quân ở tàn cuộc.
    if (endgame && Math.abs(mat.w - mat.b) >= 400) {
      const strong = mat.w > mat.b ? 'w' : 'b';
      const weak = other(strong);
      const wk = c.kings[weak];
      const sk = c.kings[strong];
      const wf = wk & 7;
      const wr = wk >> 4;
      const centerDist = Math.max(3 - wf, wf - 4) + Math.max(3 - wr, wr - 4);
      const kd = Math.abs((wk & 7) - (sk & 7)) + Math.abs((wk >> 4) - (sk >> 4));
      const bonus = 10 * centerDist + 4 * (14 - kd);
      mg += strong === 'w' ? bonus : -bonus;
    }
    return mg;
  }

  function evaluate(c) {
    const s = evaluateWhite(c);
    return c.turn === 'w' ? s : -s;
  }

  function sameMove(a, b) {
    return a && b && a.from === b.from && a.to === b.to && a.promotion === b.promotion;
  }

  function createSearch(c, deadline) {
    const S = {
      c,
      nodes: 0,
      deadline,
      stop: false,
      killers: [],
      history: {},
      pv: [],
      pvLen: new Array(MAXPLY + 2).fill(0),
    };
    for (let i = 0; i <= MAXPLY + 1; i++) { S.pv.push(new Array(MAXPLY + 2)); S.killers.push([null, null]); }

    function orderScore(m, ply, pvMove) {
      if (pvMove && sameMove(m, pvMove)) return 1e7;
      let s = 0;
      if (m.captured) s += 1e6 + VAL[m.captured] * 10 - VAL[m.piece] / 10;
      if (m.promotion) s += 9e5 + VAL[m.promotion];
      const k = S.killers[ply];
      if (!m.captured) {
        if (sameMove(m, k[0])) s += 8e5;
        else if (sameMove(m, k[1])) s += 7e5;
        s += S.history[m.from * 128 + m.to] || 0;
      }
      return s;
    }

    function sortMoves(moves, ply, pvMove) {
      for (const m of moves) m._o = orderScore(m, ply, pvMove);
      moves.sort((a, b) => b._o - a._o);
    }

    function updatePv(ply, m) {
      S.pv[ply][ply] = m;
      const len = S.pvLen[ply + 1];
      for (let j = ply + 1; j < len; j++) S.pv[ply][j] = S.pv[ply + 1][j];
      S.pvLen[ply] = Math.max(len, ply + 1);
    }

    function tick() {
      if ((++S.nodes & 1023) === 0 && Date.now() > S.deadline) S.stop = true;
    }

    function quiesce(alpha, beta, ply) {
      tick();
      S.pvLen[ply] = ply;
      if (S.stop) return 0;
      const stand = evaluate(c);
      if (ply >= MAXPLY) return stand;
      if (stand >= beta) return stand;
      if (stand > alpha) alpha = stand;
      const us = c.turn;
      const moves = c._gen(true);
      sortMoves(moves, ply, null);
      for (const m of moves) {
        if (!m.promotion && stand + VAL[m.captured] + 200 < alpha) continue; // cắt tỉa delta
        c._make(m);
        if (c._inCheck(us)) { c._unmake(); continue; }
        const score = -quiesce(-beta, -alpha, ply + 1);
        c._unmake();
        if (S.stop) return 0;
        if (score > alpha) {
          alpha = score;
          updatePv(ply, m);
          if (alpha >= beta) return alpha;
        }
      }
      return alpha;
    }

    function negamax(depth, alpha, beta, ply, pvLine) {
      tick();
      S.pvLen[ply] = ply;
      if (S.stop) return 0;
      if (ply >= MAXPLY) return evaluate(c);
      const us = c.turn;
      const inCheck = c._inCheck(us);
      if (inCheck) depth++;
      if (depth <= 0) return quiesce(alpha, beta, ply);
      if (c.half >= 100) return 0;
      // Lặp lại thế cờ trong nhánh tìm kiếm → coi như hòa
      if (ply > 0 && isRepetition(c)) return 0;

      const moves = c._gen(false);
      const pvMove = pvLine ? pvLine[ply] : null;
      sortMoves(moves, ply, pvMove);
      let legal = 0;
      let best = -INF;
      for (const m of moves) {
        c._make(m);
        if (c._inCheck(us)) { c._unmake(); continue; }
        legal++;
        const followPv = pvLine && pvMove && sameMove(m, pvMove) ? pvLine : null;
        const score = -negamax(depth - 1, -beta, -alpha, ply + 1, followPv);
        c._unmake();
        if (S.stop) return 0;
        if (score > best) best = score;
        if (score > alpha) {
          alpha = score;
          updatePv(ply, m);
          if (alpha >= beta) {
            if (!m.captured) {
              const k = S.killers[ply];
              if (!sameMove(m, k[0])) { k[1] = k[0]; k[0] = m; }
              const hk = m.from * 128 + m.to;
              S.history[hk] = Math.min(5e5, (S.history[hk] || 0) + depth * depth);
            }
            break;
          }
        }
      }
      if (!legal) return inCheck ? -MATE + ply : 0;
      return best;
    }

    S.negamax = negamax;
    return S;
  }

  /** Lặp lại thế cờ: so sánh với các thế cờ trước đó trong lịch sử nội bộ (cùng bên đi). */
  function isRepetition(c) {
    const h = c.hist;
    const n = h.length;
    if (n < 4 || c.half < 4) return false;
    const key = boardKey(c);
    // So sánh tối đa `half` nước gần nhất, cách 2 nước một lần.
    const limit = Math.min(c.half, n);
    const saved = [];
    let found = false;
    for (let i = 1; i <= limit; i++) {
      saved.push(h[n - i]);
      c._unmake();
      if (i % 2 === 0 && boardKey(c) === key) { found = true; break; }
    }
    for (let i = saved.length - 1; i >= 0; i--) c._make(saved[i].m);
    return found;
  }

  function boardKey(c) {
    let s = c.turn + c.cr + ':' + c.ep;
    const b = c.b;
    for (let i = 0; i < 128; i++) {
      if (i & 0x88) { i += 7; continue; }
      const p = b[i];
      s += p ? (p.color === 'w' ? p.type.toUpperCase() : p.type) : '.';
    }
    return s;
  }

  function isMateScore(s) { return Math.abs(s) > MATE - 1000; }
  function mateIn(s) {
    if (!isMateScore(s)) return null;
    const plies = MATE - Math.abs(s);
    const n = Math.ceil(plies / 2);
    return s > 0 ? n : -n;
  }

  /**
   * Phân tích thế cờ.
   * opts: { timeMs, maxDepth, multiPV, focus (uci), window }
   * Trả về { depth, nodes, lines: [{ move, uci, san, score, mate, exact, pv, pvMoves }] }
   * score: centipawn theo góc nhìn bên đang tới lượt đi.
   */
  function analyse(chess, opts) {
    opts = opts || {};
    const timeMs = opts.timeMs != null ? opts.timeMs : 1000;
    const maxDepth = opts.maxDepth || 64;
    const windowCp = opts.window || 400;
    const focus = opts.focus || null;
    const c = chess.clone();
    const legal = c._legal();
    const start = Date.now();
    if (!legal.length) return { depth: 0, nodes: 0, lines: [], ms: 0 };

    let root = legal.map((m) => ({ m, score: 0, pv: [m] }));
    let completed = null;
    let nodes = 0;
    const S = createSearch(c, Infinity);
    const pvArr = new Array(MAXPLY + 2);

    for (let d = 1; d <= maxDepth; d++) {
      S.deadline = d === 1 ? Infinity : start + timeMs;
      S.stop = false;
      let best = -INF;
      const results = [];
      for (const rm of root) {
        const uci = sqName(rm.m.from) + sqName(rm.m.to) + (rm.m.promotion || '');
        const isFocus = focus && focus === uci;
        const floor = best === -INF || isFocus ? -INF : best - windowCp;
        // biến chính từ vòng trước, để sắp xếp nước đi tốt hơn
        for (let i = 0; i < rm.pv.length; i++) pvArr[i] = rm.pv[i];
        for (let i = rm.pv.length; i < pvArr.length; i++) pvArr[i] = null;
        c._make(rm.m);
        const score = -S.negamax(d - 1, -INF, -floor, 1, pvArr);
        const pv = [rm.m];
        for (let j = 1; j < S.pvLen[1]; j++) pv.push(S.pv[1][j]);
        c._unmake();
        if (S.stop) break;
        results.push({ m: rm.m, score, exact: score > floor, pv });
        if (score > best) best = score;
      }
      nodes = S.nodes;
      if (S.stop) break;
      results.sort((a, b) => b.score - a.score);
      root = results.map((r) => ({ m: r.m, score: r.score, pv: r.pv }));
      completed = { depth: d, results };
      if (isMateScore(best) && best > 0 && MATE - best <= d) break; // đã tìm ra chiếu hết ngắn nhất
      if (legal.length === 1 && d >= 2) break;
      if (Date.now() - start > timeMs * 0.45) break; // không đủ thời gian cho vòng tiếp theo
    }

    // Chuyển sang dạng công khai (SAN + biến chính)
    const lines = completed.results.map((r) => {
      const pvMoves = [];
      const t = chess.clone();
      for (const m of r.pv) {
        const l = t._legal();
        const found = l.find((x) => sameMove(x, m));
        if (!found) break;
        pvMoves.push(t._toPublic(found, l));
        t._make(found);
      }
      return {
        move: pvMoves[0],
        uci: pvMoves[0].lan,
        san: pvMoves[0].san,
        score: r.score,
        mate: r.exact ? mateIn(r.score) : null,
        exact: r.exact,
        pv: pvMoves.map((m) => m.san),
        pvMoves,
      };
    });
    const multi = opts.multiPV || lines.length;
    return {
      depth: completed.depth,
      nodes,
      ms: Date.now() - start,
      lines: lines.slice(0, Math.max(multi, 1)),
      all: lines,
      best: lines[0],
    };
  }

  /** Cấp độ máy: độ sâu / thời gian / độ ngẫu nhiên (cp). */
  const LEVELS = {
    1: { name: 'Mới tập', maxDepth: 1, timeMs: 300, randomCp: 250 },
    2: { name: 'Dễ', maxDepth: 2, timeMs: 400, randomCp: 90 },
    3: { name: 'Trung bình', maxDepth: 3, timeMs: 800, randomCp: 30 },
    4: { name: 'Khó', maxDepth: 64, timeMs: 1500, randomCp: 0 },
  };

  function chooseMove(chess, level) {
    const L = LEVELS[level] || LEVELS[3];
    const a = analyse(chess, { timeMs: L.timeMs, maxDepth: L.maxDepth, window: Math.max(400, L.randomCp + 50) });
    if (!a.lines.length) return null;
    const best = a.lines[0].score;
    let pool = a.all.filter((l) => l.exact && best - l.score <= L.randomCp);
    // Không bao giờ bỏ qua nước chiếu hết
    if (isMateScore(best) && best > 0) pool = [a.lines[0]];
    const pick = pool[Math.floor(Math.random() * pool.length)] || a.lines[0];
    return { line: pick, analysis: a };
  }

  const api = { analyse, evaluate, evaluateWhite, chooseMove, LEVELS, VAL, MATE, isMateScore, mateIn };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Engine = api;
})(typeof self !== 'undefined' ? self : this);
