/*
 * app.js — Điều khiển giao diện: Bài học, Đấu với máy, Phân tích.
 */
(function () {
  'use strict';
  const { Chess } = window.ChessLib;
  const $ = (id) => document.getElementById(id);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms || 30));
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const store = {
    get(k, d) { try { const v = localStorage.getItem('cvht:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('cvht:' + k, JSON.stringify(v)); } catch (e) { /* bỏ qua */ } },
  };

  const board = new BoardView($('board'), $('arrows'), $('promo'));
  const SIDE = { w: 'Trắng', b: 'Đen' };

  // ---------------------------------------------------------------- tiện ích
  function setStatus(html, kind) {
    const s = $('status');
    s.innerHTML = html || '';
    s.className = 'status' + (kind ? ' ' + kind : '');
  }

  function setBars(top, bottom) {
    $('barTop').innerHTML = top || '';
    $('barBottom').innerHTML = bottom || '';
  }

  /** Cập nhật thanh đánh giá. cpWhite: điểm theo góc nhìn Trắng; mateWhite: số nước chiếu hết (+ Trắng thắng). */
  function setEval(cpWhite, mateWhite) {
    let pct;
    let text;
    if (mateWhite != null) {
      pct = mateWhite > 0 ? 100 : 0;
      text = 'M' + Math.abs(mateWhite);
    } else if (cpWhite == null) {
      pct = 50;
      text = '–';
    } else {
      pct = 50 + 50 * (2 / (1 + Math.exp(-cpWhite / 350)) - 1);
      text = (cpWhite >= 0 ? '+' : '') + (cpWhite / 100).toFixed(1);
    }
    const flipped = board.orientation === 'b';
    const fill = $('evalfill');
    fill.style.height = pct + '%';
    fill.style.top = flipped ? '0' : 'auto';
    fill.style.bottom = flipped ? 'auto' : '0';
    $('evaltext').textContent = text;
    $('evaltext').className = 'evaltext ' + ((pct >= 50) !== flipped ? 'on-bottom' : 'on-top');
  }

  function scoreLabel(score, mate, turn) {
    // hiển thị theo góc nhìn Trắng
    const s = turn === 'w' ? 1 : -1;
    if (mate != null) return (mate * s > 0 ? '+' : '-') + 'M' + Math.abs(mate);
    const v = (score * s) / 100;
    return (v >= 0 ? '+' : '') + v.toFixed(1);
  }

  function renderMoveList(el, game, notes) {
    const h = game.history({ verbose: true });
    if (!h.length) { el.innerHTML = '<span class="muted">Chưa có nước nào.</span>'; return; }
    const startBlack = h[0].color === 'b';
    let html = '';
    let num = h[0].fenBefore ? +h[0].fenBefore.split(' ')[5] : 1;
    h.forEach((m, i) => {
      if (m.color === 'w') html += '<span class="mnum">' + num + '.</span>';
      else if (i === 0 && startBlack) html += '<span class="mnum">' + num + '…</span>';
      const n = notes && notes[i];
      html += '<span class="mv' + (n ? ' ' + n.css : '') + '"' + (n ? ' title="' + esc(n.label) + '"' : '') + '>' + esc(m.san) + (n && n.icon ? '<sup>' + esc(n.icon) + '</sup>' : '') + '</span>';
      if (m.color === 'b') num++;
    });
    el.innerHTML = html;
    el.scrollTop = el.scrollHeight;
  }

  function list(items, cls) {
    if (!items || !items.length) return '';
    return '<ul class="' + (cls || '') + '">' + items.map((t) => '<li>' + esc(t) + '</li>').join('') + '</ul>';
  }

  /** Thẻ giải thích cho một nước đi tốt nhất (từ Explain.explainLine). */
  function explainCard(ex, title) {
    return '<div class="card explain">' +
      '<div class="explain-title">' + esc(title || 'Nước tốt nhất') + ': <b class="san">' + esc(ex.headline) + '</b></div>' +
      '<div class="why">Tại sao?</div>' + list(ex.reasons, 'reasons') +
      (ex.warnings.length ? list(ex.warnings, 'warns') : '') +
      '<div class="pv"><span class="muted">Diễn biến dự kiến:</span> ' + esc(ex.pv) + '</div>' +
      '<div class="muted small">Đánh giá: ' + esc(ex.evalText) + '</div>' +
      '</div>';
  }

  function linesTable(before, lines) {
    return '<table class="lines"><thead><tr><th>#</th><th>Nước</th><th>Đánh giá</th><th>Ý tưởng</th></tr></thead><tbody>' +
      lines.map((l, i) => {
        const ex = Explain.explainLine(before, l);
        const tag = ex.headline.includes('—') ? ex.headline.split('—')[1].trim() : '';
        return '<tr class="' + (i === 0 ? 'top' : '') + '"><td>' + (i + 1) + '</td><td class="san">' + esc(l.san) + '</td><td>' +
          esc(scoreLabel(l.score, l.mate, before.turn)) + '</td><td class="muted">' + esc(tag || l.pv.slice(1, 4).join(' ')) + '</td></tr>';
      }).join('') + '</tbody></table>';
  }

  function arrowsFor(lines) {
    return lines.slice(0, 3).map((l, i) => ({ from: l.move.from, to: l.move.to, kind: i === 0 ? 'best' : 'alt' })).reverse();
  }

  function gameOverText(g, playerColor) {
    if (g.isCheckmate()) {
      const winner = g.turn === 'w' ? 'b' : 'w';
      if (playerColor) return winner === playerColor ? '🏆 Chiếu hết — Bạn thắng!' : '😞 Bạn bị chiếu hết. Hãy xem lại các nước sai để rút kinh nghiệm!';
      return 'Chiếu hết — ' + SIDE[winner] + ' thắng.';
    }
    if (g.isStalemate()) return '🤝 Hòa pat — bên đi không còn nước hợp lệ nhưng không bị chiếu.';
    if (g.isThreefold()) return '🤝 Hòa do lặp lại thế cờ 3 lần.';
    if (g.isInsufficientMaterial()) return '🤝 Hòa — không đủ quân để chiếu hết.';
    if (g.half >= 100) return '🤝 Hòa theo luật 50 nước.';
    return '';
  }

  // ================================================================ BÀI HỌC
  const Lessons = {
    li: null,
    pi: 0,
    game: null,
    step: 0,
    solved: false,
    hintLevel: 0,
    busy: false,
    progress: store.get('progress', {}),

    init() {
      this.renderGrid();
      $('lessonBack').onclick = () => this.showList();
      $('pzHint').onclick = () => this.hint();
      $('pzSolution').onclick = () => this.solution();
      $('pzRetry').onclick = () => this.loadPuzzle(this.pi);
      $('pzNext').onclick = () => this.next();
    },

    renderGrid() {
      $('lessonGrid').innerHTML = LESSONS.map((L, i) => {
        const done = (this.progress[L.id] || []).filter(Boolean).length;
        const total = L.puzzles.length;
        return '<button class="lesson-card' + (done === total ? ' done' : '') + '" data-i="' + i + '">' +
          '<span class="lc-icon">' + L.icon + '</span>' +
          '<span class="lc-body"><b>' + esc(L.title) + '</b><span class="muted small">' + esc(L.summary) + '</span>' +
          '<span class="progress"><span style="width:' + (100 * done / total) + '%"></span></span>' +
          '<span class="small muted">' + done + '/' + total + ' bài tập</span></span></button>';
      }).join('');
      [...$('lessonGrid').querySelectorAll('.lesson-card')].forEach((b) => { b.onclick = () => this.openLesson(+b.dataset.i); });
    },

    showList() {
      $('lessonView').classList.add('hidden');
      $('lessonList').classList.remove('hidden');
      this.renderGrid();
    },

    activate() {
      board.onMove = (m) => this.onMove(m);
      board.canMove = (c) => this.game && !this.solved && !this.busy && c === this.playerColor;
      if (!this.game) {
        this.game = new Chess(LESSONS[0].puzzles[0].fen);
        this.playerColor = this.game.turn;
        this.solved = true;
        board.setOrientation('w');
        setStatus('Chọn một chủ đề trong danh sách bài học để bắt đầu.');
      }
      board.setGame(this.game);
      board.setArrows([]);
      setEval(null);
      setBars('', '');
      if (this.li != null) this.updateStatus();
    },

    openLesson(i) {
      this.li = i;
      const L = LESSONS[i];
      $('lessonList').classList.add('hidden');
      $('lessonView').classList.remove('hidden');
      $('lessonTitle').textContent = L.icon + ' ' + L.title;
      $('lessonTheory').innerHTML = L.theory.map((p) => '<p>' + p + '</p>').join('') +
        (L.tips && L.tips.length ? '<div class="tips"><b>Mẹo:</b>' + list(L.tips) + '</div>' : '');
      const firstUnsolved = L.puzzles.findIndex((_, j) => !(this.progress[L.id] || [])[j]);
      this.loadPuzzle(firstUnsolved < 0 ? 0 : firstUnsolved);
    },

    renderNav() {
      const L = LESSONS[this.li];
      const prog = this.progress[L.id] || [];
      $('puzzleNav').innerHTML = L.puzzles.map((p, j) =>
        '<button class="pz-dot' + (j === this.pi ? ' cur' : '') + (prog[j] ? ' ok' : '') + '" data-j="' + j + '" title="' + esc(p.title) + '">' + (prog[j] ? '✓' : j + 1) + '</button>').join('');
      [...$('puzzleNav').querySelectorAll('.pz-dot')].forEach((b) => { b.onclick = () => this.loadPuzzle(+b.dataset.j); });
    },

    loadPuzzle(j) {
      const L = LESSONS[this.li];
      const P = L.puzzles[j];
      this.pi = j;
      this.game = new Chess(P.fen);
      this.playerColor = this.game.turn;
      this.step = 0;
      this.solved = false;
      this.hintLevel = 0;
      this.busy = false;
      board.setOrientation(this.playerColor);
      board.setLastMove(null);
      board.setArrows([]);
      board.setMarks({});
      board.setGame(this.game);
      $('puzzleTitle').textContent = 'Bài ' + (j + 1) + ': ' + P.title;
      $('puzzleTurn').textContent = SIDE[this.playerColor] + ' đi';
      $('puzzleTurn').className = 'pill ' + (this.playerColor === 'w' ? 'pill-w' : 'pill-b');
      const n = Math.ceil(P.solution.length / 2);
      $('puzzleFeedback').innerHTML = '<p>Bạn cầm quân <b>' + SIDE[this.playerColor] + '</b>. Hãy tìm nước đi tốt nhất' + (n > 1 ? ' (lời giải gồm ' + n + ' nước của bạn)' : '') + '.</p>';
      this.renderNav();
      this.updateStatus();
    },

    updateStatus() {
      if (this.solved) setStatus('✅ Đã giải xong! Bấm "Bài tiếp" để tiếp tục.', 'ok');
      else setStatus('Lượt của <b>' + SIDE[this.game.turn] + '</b> — tìm nước tốt nhất.');
    },

    async onMove(mv) {
      if (this.busy || this.solved) return;
      const P = LESSONS[this.li].puzzles[this.pi];
      const before = this.game.clone();
      const m = this.game.move(mv);
      if (!m) return;
      board.setLastMove(m);
      board.setArrows([]);
      board.setMarks({});
      board.render();
      const expected = P.solution[this.step];
      const accepted = [expected].concat(this.step === 0 ? P.alt || [] : []);
      const isMate = this.game.isCheckmate();
      if (accepted.includes(m.lan) || isMate) {
        const ms = Explain.motifs(before, m).filter((x) => !x.bad).slice(0, 2).map((x) => x.text);
        this.step++;
        const finished = isMate || m.lan !== expected || this.step >= P.solution.length;
        let html = '<div class="verdict ok">✓ Chính xác! <b>' + esc(m.san) + '</b></div>' + list(ms, 'reasons');
        if (finished) {
          this.finish(html + '<div class="lesson-explain"><b>Giải thích:</b> ' + esc(P.explain) + '</div>');
          return;
        }
        $('puzzleFeedback').innerHTML = html + '<p class="muted">Đối phương đáp lại…</p>';
        this.busy = true;
        await wait(650);
        const reply = this.game.move(P.solution[this.step]);
        this.step++;
        this.busy = false;
        board.setLastMove(reply);
        board.render();
        $('puzzleFeedback').innerHTML = html + '<p>Đối phương đi <b>' + esc(reply.san) + '</b>. Tiếp tục — nước tiếp theo của bạn là gì?</p>';
        this.hintLevel = 0;
        this.updateStatus();
      } else {
        this.busy = true;
        setStatus('Đang xem vì sao nước này chưa tốt…');
        $('puzzleFeedback').innerHTML = '<div class="verdict bad">✗ Chưa đúng: <b>' + esc(m.san) + '</b></div><p class="muted">Đang phân tích…</p>';
        await wait();
        const a = Engine.analyse(before, { timeMs: 600, focus: m.lan });
        const j = Explain.judgeMove(before, m, a);
        const probs = j.problems.length ? j.problems : ['Nước này hợp lệ nhưng không tận dụng được cơ hội chiến thuật trong thế cờ.'];
        $('puzzleFeedback').innerHTML = '<div class="verdict bad">✗ Chưa đúng: <b>' + esc(m.san) + '</b></div>' + list(probs, 'warns') +
          '<p class="muted">Gợi ý: ' + esc(P.hint) + '</p>';
        await wait(1400);
        this.game.undo();
        const h = this.game.history({ verbose: true });
        board.setLastMove(h[h.length - 1] || null);
        board.render();
        this.busy = false;
        setStatus('Thử lại nhé! Lượt của <b>' + SIDE[this.game.turn] + '</b>.');
      }
    },

    finish(html) {
      this.solved = true;
      const L = LESSONS[this.li];
      const prog = this.progress[L.id] || [];
      prog[this.pi] = true;
      this.progress[L.id] = prog;
      store.set('progress', this.progress);
      const allDone = L.puzzles.every((_, j) => prog[j]);
      $('puzzleFeedback').innerHTML = html + (allDone ? '<div class="verdict ok">🎉 Bạn đã hoàn thành chủ đề "' + esc(L.title) + '"!</div>' : '');
      this.renderNav();
      this.updateStatus();
      board.render();
    },

    hint() {
      if (this.solved || this.li == null) return;
      const P = LESSONS[this.li].puzzles[this.pi];
      const uci = P.solution[this.step];
      const from = uci.slice(0, 2);
      const to = uci.slice(2, 4);
      this.hintLevel++;
      if (this.hintLevel === 1) {
        board.setMarks({ [from]: 'hint' });
        $('puzzleFeedback').innerHTML = '<p>💡 ' + esc(P.hint) + '</p><p class="muted">Quân cần đi được đánh dấu trên bàn cờ. Bấm Gợi ý lần nữa để xem nước đi.</p>';
      } else {
        board.setMarks({ [from]: 'hint' });
        board.setArrows([{ from, to, kind: 'best' }]);
        const m = this.game.moves({ verbose: true }).find((x) => x.lan === uci);
        const ms = Explain.motifs(this.game, m).filter((x) => !x.bad).slice(0, 2).map((x) => x.text);
        $('puzzleFeedback').innerHTML = '<p>💡 Nước cần đi: <b>' + esc(m.san) + '</b></p>' + list(ms, 'reasons');
      }
    },

    async solution() {
      if (this.solved || this.li == null || this.busy) return;
      const P = LESSONS[this.li].puzzles[this.pi];
      this.busy = true;
      let lastMine = null;
      const before = this.game.clone();
      while (this.step < P.solution.length) {
        const m = this.game.move(P.solution[this.step]);
        if (this.step % 2 === 0 && !lastMine) lastMine = m;
        this.step++;
        board.setLastMove(m);
        board.setArrows([]);
        board.render();
        await wait(700);
      }
      this.busy = false;
      const ms = lastMine ? Explain.motifs(before, lastMine).filter((x) => !x.bad).slice(0, 2).map((x) => x.text) : [];
      this.solved = true;
      $('puzzleFeedback').innerHTML = '<div class="verdict">Đáp án: <b>' + esc(this.game.history().slice(-P.solution.length).join(' ')) + '</b></div>' +
        list(ms, 'reasons') + '<div class="lesson-explain"><b>Giải thích:</b> ' + esc(P.explain) + '</div><p class="muted">Bấm "Làm lại" để tự giải lại bài này.</p>';
      setStatus('Đã xem đáp án.');
    },

    next() {
      if (this.li == null) return;
      const L = LESSONS[this.li];
      if (this.pi + 1 < L.puzzles.length) this.loadPuzzle(this.pi + 1);
      else if (this.li + 1 < LESSONS.length) this.openLesson(this.li + 1);
      else this.showList();
    },
  };

  // ================================================================ ĐẤU VỚI MÁY
  const Play = {
    game: new Chess(),
    color: 'w',
    level: 3,
    busy: false,
    notes: [],
    started: false,
    lastEval: null,
    token: 0,

    init() {
      $('playLevel').value = String(store.get('level', 3));
      $('playColor').value = store.get('color', 'w');
      $('playCoach').checked = store.get('coach', true);
      $('playNew').onclick = () => this.newGame();
      $('playHint').onclick = () => this.hint();
      $('playUndo').onclick = () => this.undo();
      $('playFlip').onclick = () => { board.flip(); this.bars(); this.showEval(); };
      $('playLevel').onchange = () => { this.level = +$('playLevel').value; store.set('level', this.level); this.bars(); };
      $('playCoach').onchange = () => store.set('coach', $('playCoach').checked);
      $('playColor').onchange = () => store.set('color', $('playColor').value);
    },

    activate() {
      board.onMove = (m) => this.onMove(m);
      board.canMove = (c) => !this.busy && c === this.color && !this.game.isGameOver();
      if (!this.started) { this.newGame(); return; }
      board.setOrientation(board.orientation);
      board.setGame(this.game);
      const h = this.game.history({ verbose: true });
      board.setLastMove(h[h.length - 1] || null);
      board.setArrows([]);
      board.render();
      this.bars();
      this.showEval();
      this.refreshStatus();
      // Nước của máy bị gián đoạn khi chuyển tab → đi tiếp
      if (!this.game.isGameOver() && this.game.turn !== this.color) this.engineMove();
    },

    bars() {
      const L = Engine.LEVELS[this.level];
      const eng = '<span class="who">🤖 Máy · ' + L.name + '</span>';
      const me = '<span class="who">🙂 Bạn (' + SIDE[this.color] + ')</span>';
      const bottomIsMe = board.orientation === this.color;
      setBars(bottomIsMe ? eng : me, bottomIsMe ? me : eng);
    },

    showEval() {
      if (!this.lastEval) setEval(0);
      else setEval(this.lastEval.cp, this.lastEval.mate);
    },

    newGame() {
      this.token++;
      let c = $('playColor').value;
      if (c === 'r') c = Math.random() < 0.5 ? 'w' : 'b';
      this.color = c;
      this.level = +$('playLevel').value;
      this.game = new Chess();
      this.notes = [];
      this.lastEval = null;
      this.started = true;
      this.busy = false;
      board.setOrientation(c);
      board.setLastMove(null);
      board.setArrows([]);
      board.setMarks({});
      board.setGame(this.game);
      $('playCoachBox').innerHTML = '<div class="card tip">Mẹo: trước mỗi nước, hãy tự hỏi <b>"Đối phương vừa đe dọa gì?"</b> và <b>"Có quân nào đang treo không?"</b>. Bấm 💡 nếu cần gợi ý.</div>';
      $('playHintBox').innerHTML = '';
      this.bars();
      this.showEval();
      renderMoveList($('playMoves'), this.game, this.notes);
      if (this.game.turn !== this.color) this.engineMove();
      else this.refreshStatus();
    },

    refreshStatus() {
      const over = gameOverText(this.game, this.color);
      if (over) { setStatus(over, 'end'); return; }
      if (this.busy) return;
      setStatus(this.game.turn === this.color ? 'Đến lượt bạn' + (this.game.inCheck() ? ' — <b>bạn đang bị chiếu!</b>' : '.') : 'Máy đang suy nghĩ…');
    },

    async onMove(mv) {
      if (this.busy) return;
      const tok = this.token;
      const before = this.game.clone();
      const m = this.game.move(mv);
      if (!m) return;
      board.setLastMove(m);
      board.setArrows([]);
      board.setMarks({});
      board.render();
      $('playHintBox').innerHTML = '';
      renderMoveList($('playMoves'), this.game, this.notes);
      this.busy = true;
      if ($('playCoach').checked) {
        setStatus('🧑‍🏫 Huấn luyện viên đang đánh giá nước đi…', 'busy');
        await wait();
        const a = Engine.analyse(before, { timeMs: 800, focus: m.lan });
        if (tok !== this.token) return;
        const j = Explain.judgeMove(before, m, a);
        this.notes[this.game.history().length - 1] = j.cls;
        renderMoveList($('playMoves'), this.game, this.notes);
        this.lastEval = { cp: this.color === 'w' ? j.score : -j.score, mate: j.mate == null ? null : (this.color === 'w' ? j.mate : -j.mate) };
        this.showEval();
        this.showFeedback(j, before);
      }
      if (this.game.isGameOver()) { this.busy = false; this.refreshStatus(); return; }
      await this.engineMove();
    },

    showFeedback(j, before) {
      let html = '<div class="card coach ' + j.cls.css + '">' +
        '<div class="verdict-line"><span class="badge ' + j.cls.css + '">' + esc(j.cls.icon) + '</span> <b>' + esc(j.san) + '</b> — ' + esc(j.cls.label) +
        (j.loss > 0 && !j.isBest && j.loss < 5000 ? ' <span class="muted small">(−' + (j.loss / 100).toFixed(1) + ')</span>' : '') + '</div>';
      if (j.good.length) html += list(j.good, 'reasons');
      if (j.problems.length) html += '<div class="why">Vì sao chưa tốt?</div>' + list(j.problems, 'warns');
      html += '</div>';
      if (j.best && !['best', 'excellent'].includes(j.cls.key)) {
        html += explainCard(j.best, 'Nước tốt hơn là');
        board.setArrows([{ from: j.best.uci.slice(0, 2), to: j.best.uci.slice(2, 4), kind: 'alt' }]);
      }
      $('playCoachBox').innerHTML = html;
    },

    async engineMove() {
      const tok = this.token;
      this.busy = true;
      setStatus('🤖 Máy đang suy nghĩ…', 'busy');
      await wait(250);
      if (tok !== this.token) return;
      const r = Engine.chooseMove(this.game, this.level);
      if (tok !== this.token) return;
      const engColor = this.game.turn;
      const m = this.game.move(r.line.uci);
      const s = r.line.score;
      this.lastEval = { cp: engColor === 'w' ? s : -s, mate: r.line.mate == null ? null : (engColor === 'w' ? r.line.mate : -r.line.mate) };
      this.busy = false;
      board.setLastMove(m);
      board.render();
      this.showEval();
      renderMoveList($('playMoves'), this.game, this.notes);
      this.refreshStatus();
    },

    async hint() {
      if (this.busy || this.game.isGameOver() || this.game.turn !== this.color) return;
      const tok = this.token;
      this.busy = true;
      setStatus('💡 Đang tìm nước tốt nhất…', 'busy');
      $('playHintBox').innerHTML = '<div class="card muted">Đang tính toán…</div>';
      await wait();
      const a = Engine.analyse(this.game, { timeMs: 1500, multiPV: 3 });
      if (tok !== this.token) return;
      this.busy = false;
      const lines = a.lines.filter((l) => l.exact);
      const ex = Explain.explainLine(this.game, lines[0]);
      board.setArrows(arrowsFor(lines));
      $('playHintBox').innerHTML = explainCard(ex, '💡 Gợi ý') +
        '<div class="card"><h3>Các lựa chọn hàng đầu</h3>' + linesTable(this.game, lines) +
        '<div class="muted small">Độ sâu tính toán: ' + a.depth + ' nước · ' + a.nodes.toLocaleString('vi-VN') + ' thế cờ</div></div>';
      this.refreshStatus();
    },

    undo() {
      if (this.busy) return;
      const h = this.game.history();
      if (!h.length) return;
      // Chỉ có nước đầu tiên của máy (bạn cầm Đen) → không có gì để đi lại
      if (h.length === 1 && this.game.turn === this.color) return;
      this.game.undo();
      if (this.game.turn !== this.color && this.game.history().length) this.game.undo();
      this.notes.length = this.game.history().length;
      this.lastEval = null;
      this.showEval();
      const hv = this.game.history({ verbose: true });
      board.setLastMove(hv[hv.length - 1] || null);
      board.setArrows([]);
      board.setGame(this.game);
      $('playCoachBox').innerHTML = '';
      $('playHintBox').innerHTML = '';
      renderMoveList($('playMoves'), this.game, this.notes);
      this.refreshStatus();
    },
  };

  // ================================================================ PHÂN TÍCH
  const Analysis = {
    game: new Chess(),
    token: 0,
    busy: false,

    init() {
      $('fenLoad').onclick = () => this.loadFen($('fenInput').value);
      $('fenInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') this.loadFen($('fenInput').value); });
      $('anRun').onclick = () => this.run();
      $('anUndo').onclick = () => { if (this.game.undo()) this.after(); };
      $('anReset').onclick = () => { this.game = new Chess(); board.setGame(this.game); this.after(); };
      $('anFlip').onclick = () => { board.flip(); this.after(true); };
      $('anAuto').checked = store.get('anAuto', true);
      $('anAuto').onchange = () => store.set('anAuto', $('anAuto').checked);
    },

    activate() {
      board.onMove = (m) => this.onMove(m);
      board.canMove = () => !this.busy && !this.game.isGameOver();
      board.setOrientation('w');
      board.setGame(this.game);
      setBars('', '');
      this.after(true);
    },

    loadFen(fen) {
      try {
        const g = new Chess(fen.trim());
        this.game = g;
        board.setGame(g);
        this.after();
      } catch (e) {
        $('anResult').innerHTML = '<div class="card warn">' + esc(e.message) + '</div>';
      }
    },

    onMove(mv) {
      const m = this.game.move(mv);
      if (m) this.after();
    },

    after(noAuto) {
      const h = this.game.history({ verbose: true });
      board.setLastMove(h[h.length - 1] || null);
      board.setArrows([]);
      board.render();
      renderMoveList($('anMoves'), this.game, null);
      $('fenOut').textContent = this.game.fen();
      const over = gameOverText(this.game);
      setStatus(over || 'Lượt của <b>' + SIDE[this.game.turn] + '</b>' + (this.game.inCheck() ? ' (đang bị chiếu)' : ''), over ? 'end' : '');
      if (!noAuto && $('anAuto').checked && !over) this.run();
      else if (over) {
        $('anResult').innerHTML = '';
        if (this.game.isCheckmate()) setEval(null, this.game.turn === 'w' ? -1 : 1);
        else setEval(0);
      }
    },

    async run() {
      if (this.game.isGameOver()) return;
      const tok = ++this.token;
      this.busy = true;
      $('anResult').innerHTML = '<div class="card muted">Đang phân tích…</div>';
      await wait();
      if (tok !== this.token) return;
      const a = Engine.analyse(this.game, { timeMs: 1300, multiPV: 3 });
      this.busy = false;
      if (tok !== this.token) return;
      const lines = a.lines.filter((l) => l.exact);
      const best = lines[0];
      const t = this.game.turn;
      setEval(t === 'w' ? best.score : -best.score, best.mate == null ? null : (t === 'w' ? best.mate : -best.mate));
      board.setArrows(arrowsFor(lines));
      const ex = Explain.explainLine(this.game, best);
      $('anResult').innerHTML = explainCard(ex, 'Nước tốt nhất cho ' + SIDE[t]) +
        '<div class="card"><h3>Top ' + lines.length + ' nước (đánh giá theo góc nhìn Trắng)</h3>' + linesTable(this.game, lines) +
        '<div class="muted small">Độ sâu: ' + a.depth + ' · ' + a.nodes.toLocaleString('vi-VN') + ' thế cờ · ' + a.ms + ' ms</div></div>';
    },
  };

  // ================================================================ TAB
  const MODES = { lessons: Lessons, play: Play, analysis: Analysis };
  let current = null;
  function switchTab(name) {
    if (current === name) return;
    current = name;
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
    document.querySelectorAll('.tab-panel').forEach((p) => p.classList.toggle('hidden', p.id !== 'panel-' + name));
    document.body.dataset.mode = name;
    Play.token++;
    Play.busy = false;
    Analysis.token++;
    Analysis.busy = false;
    MODES[name].activate();
    store.set('tab', name);
  }

  Lessons.init();
  Play.init();
  Analysis.init();
  document.querySelectorAll('.tab').forEach((t) => { t.onclick = () => switchTab(t.dataset.tab); });
  switchTab(store.get('tab', 'lessons'));
})();
