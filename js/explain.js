/*
 * explain.js — Giải thích nước đi bằng tiếng Việt.
 * Nhận diện các mô-típ chiến thuật (chiếu hết, đánh đôi, ghim, xiên, tấn công mở,
 * ăn quân treo, loại bỏ quân phòng thủ, đe dọa chiếu hết...) và nguyên tắc chiến lược
 * (phát triển quân, chiếm trung tâm, nhập thành), rồi kết hợp với đánh giá của máy.
 */
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;
  const lib = isNode ? require('./chess.js') : root.ChessLib;
  const Engine = isNode ? require('./engine.js') : root.Engine;
  const { Chess, sqName, sqIdx, other, OFFSETS, SLIDER } = lib;

  const NAME = { p: 'Tốt', n: 'Mã', b: 'Tượng', r: 'Xe', q: 'Hậu', k: 'Vua' };
  const VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };
  const SIDE = { w: 'Trắng', b: 'Đen' };
  const CENTER = ['d4', 'e4', 'd5', 'e5'];

  function pn(p, sq) { return NAME[p.type] + ' ' + sq; }
  function val(t) { return VAL[t]; }

  /** Quân ở ô `i` có đang "treo" (bị ăn mà lỗ) không? */
  function isHanging(pos, i) {
    const p = pos.b[i];
    if (!p || p.type === 'k') return false;
    const att = pos._attackers(i, other(p.color));
    if (!att.length) return false;
    const def = pos._attackers(i, p.color);
    if (!def.length) return true;
    const minAtt = Math.min(...att.map((s) => val(pos.b[s].type)));
    return minAtt < val(p.type);
  }

  /** Quân ở ô `i` có bị ghim tuyệt đối (vào Vua của nó) không? */
  function isPinned(pos, i) {
    const p = pos.b[i];
    if (!p || p.type === 'k') return false;
    const enemy = other(p.color);
    if (pos._inCheck(p.color)) return false;
    pos.b[i] = null;
    const r = pos._attackers(pos.kings[p.color], enemy, true);
    pos.b[i] = p;
    return r;
  }

  function hangingPieces(pos, color) {
    const out = [];
    for (let i = 0; i < 128; i++) {
      if (i & 0x88) { i += 7; continue; }
      const p = pos.b[i];
      if (p && p.color === color && isHanging(pos, i)) out.push(i);
    }
    return out;
  }

  function materialOf(pos, color) {
    let s = 0;
    for (let i = 0; i < 128; i++) {
      if (i & 0x88) { i += 7; continue; }
      const p = pos.b[i];
      if (p && p.color === color && p.type !== 'k') s += val(p.type);
    }
    return s;
  }

  function enemyTargetsFrom(pos, i, color) {
    return pos._attacksFrom(i).filter((s) => pos.b[s] && pos.b[s].color === other(color));
  }

  /** Tìm các nước chiếu hết ngay (mate-in-1) cho bên đang đi. */
  function mateInOneMoves(pos) {
    const res = [];
    const legal = pos._legal();
    for (const m of legal) {
      pos._make(m);
      const mate = pos._inCheck(pos.turn) && pos._legal().length === 0;
      pos._unmake();
      if (mate) res.push(pos._toPublic(m, legal));
    }
    return res;
  }

  /** Bản sao thế cờ với lượt đi đổi bên (nước "bỏ lượt"), hoặc null nếu không hợp lệ. */
  function nullFlip(pos) {
    if (pos.inCheck()) return null;
    const parts = pos.fen().split(' ');
    parts[1] = other(pos.turn);
    parts[3] = '-';
    try { return new Chess(parts.join(' ')); } catch (e) { return null; }
  }

  function listNames(arr) {
    if (arr.length <= 1) return arr.join('');
    return arr.slice(0, -1).join(', ') + ' và ' + arr[arr.length - 1];
  }

  /**
   * Nhận diện mô-típ của nước đi `mv` (dạng công khai) trong thế cờ `before`.
   * Trả về mảng { key, w (độ quan trọng), text, bad? }.
   */
  function motifs(before, mv) {
    const out = [];
    const add = (key, w, text, bad) => out.push({ key, w, text, bad: !!bad });
    const us = mv.color;
    const them = other(us);
    const after = before.clone();
    if (!after.move({ from: mv.from, to: mv.to, promotion: mv.promotion })) return out;
    const toI = sqIdx(mv.to);
    const fromI = sqIdx(mv.from);
    const moved = after.b[toI];
    const movedType = moved.type;
    const movedName = NAME[movedType];

    if (after.isCheckmate()) {
      add('mate', 100, 'Chiếu hết! Vua ' + SIDE[them] + ' bị chiếu và không còn ô nào để thoát, cũng không thể chặn hay ăn quân chiếu.');
      return out;
    }
    if (after.isStalemate()) {
      add('stalemate', 90, 'Cẩn thận: nước này làm đối phương hết nước đi hợp lệ mà không bị chiếu — ván cờ HÒA PAT.', true);
    }

    // --- Nhập thành / phong cấp ---
    if (mv.flags.includes('k') || mv.flags.includes('q')) {
      add('castle', 25, 'Nhập thành: đưa Vua vào góc an toàn sau hàng tốt và đưa Xe ra trung tâm để tham chiến.');
    }
    if (mv.promotion) {
      add('promo', 70, 'Phong cấp: Tốt đi đến hàng cuối và trở thành ' + NAME[mv.promotion] + ' — lợi thế vật chất rất lớn.');
    }

    // --- Chiếu ---
    let isCheck = false;
    if (after.inCheck()) {
      isCheck = true;
      const ks = after.kings[them];
      const checkers = after._attackers(ks, us);
      if (checkers.length >= 2) {
        add('double', 65, 'Chiếu đôi: hai quân cùng chiếu Vua một lúc — đối phương bắt buộc phải di chuyển Vua, không thể chặn hay ăn quân chiếu.');
      } else if (checkers.length === 1 && checkers[0] !== toI) {
        add('discheck', 66, 'Chiếu mở: ' + movedName + ' di chuyển để lộ đường cho ' + NAME[after.b[checkers[0]].type] + ' ' + sqName(checkers[0]) + ' chiếu Vua. Trong lúc đối phương lo đỡ chiếu, ' + movedName + ' được tự do gây sát thương.');
      } else {
        add('check', 15, 'Chiếu Vua — buộc đối phương phải đối phó ngay, giúp bạn giữ thế chủ động.');
      }
    }

    // --- Ăn quân ---
    if (mv.captured) {
      const capV = val(mv.captured);
      const myV = val(mv.piece);
      const recap = after._attackers(toI, them);
      if (!recap.length) {
        add('free', 55, 'Ăn ' + NAME[mv.captured] + ' ' + mv.to + ' miễn phí — quân này không được bảo vệ (quân "treo"), đối phương không thể ăn lại.');
      } else if (capV > myV) {
        add('trade+', 50, 'Đổi quân có lợi: dùng ' + NAME[mv.piece] + ' (giá trị ' + myV + ') ăn ' + NAME[mv.captured] + ' (giá trị ' + capV + '). Dù bị ăn lại bạn vẫn lời ' + (capV - myV) + ' điểm.');
      } else if (capV === myV) {
        add('trade=', 12, 'Trao đổi ngang giá: ' + NAME[mv.piece] + ' đổi lấy ' + NAME[mv.captured] + '.');
      } else {
        add('sac', 30, 'Ăn ' + NAME[mv.captured] + ' dù ' + movedName + ' có thể bị ăn lại — đây là một đòn hy sinh (thí quân) có tính toán.');
      }

      // Loại bỏ quân phòng thủ: quân bị ăn đang bảo vệ quân khác của đối phương
      const defended = before._attacksFrom(toI).filter((s) => {
        const p = before.b[s];
        return p && p.color === them && p.type !== 'k';
      });
      const nowWeak = defended.filter((s) => after.b[s] && after.b[s].color === them && isHanging(after, s) && !isHanging(before, s));
      if (nowWeak.length) {
        add('removedef', 52, 'Loại bỏ quân phòng thủ: ' + NAME[mv.captured] + ' ' + mv.to + ' đang bảo vệ ' + listNames(nowWeak.map((s) => pn(after.b[s], sqName(s)))) + '. Giờ quân đó không còn được che chở và có thể bị ăn.');
      }
    }

    // --- Đánh đôi / đe dọa ---
    const targets = enemyTargetsFrom(after, toI, us).filter((s) => {
      const p = after.b[s];
      return p.type === 'k' || val(p.type) > val(movedType) || !after._attackers(s, them).length;
    });
    const movedSafe = !isHanging(after, toI);
    if (targets.length >= 2 && (movedSafe || isCheck)) {
      add('fork', 62, 'Đánh đôi (chĩa đôi): ' + movedName + ' ' + mv.to + ' tấn công cùng lúc ' + listNames(targets.map((s) => pn(after.b[s], sqName(s)))) + '. Đối phương chỉ cứu được một quân!');
    } else if (targets.length === 1 && after.b[targets[0]].type !== 'k' && movedSafe) {
      const t = after.b[targets[0]];
      let reason = !after._attackers(targets[0], them).length ? 'quân này không được bảo vệ' : 'quân này có giá trị cao hơn ' + movedName;
      if (isPinned(after, targets[0])) reason += ', và nó đang bị ghim vào Vua nên không thể chạy thoát';
      add('threat', 22, 'Tạo đe dọa: tấn công ' + pn(t, sqName(targets[0])) + ' — ' + reason + '.');
    }

    // --- Ghim / Xiên (chỉ quân trượt: Tượng, Xe, Hậu) ---
    if (SLIDER[movedType]) {
      for (const d of OFFSETS[movedType]) {
        let s = toI + d;
        let first = -1;
        while (!(s & 0x88)) {
          const p = after.b[s];
          if (p) {
            if (first < 0) {
              if (p.color !== them) break;
              first = s;
            } else {
              if (p.color === them) {
                const P1 = after.b[first];
                const P2 = p;
                if (P2.type === 'k' && P1.type !== 'k') {
                  add('pin', 45, 'Ghim tuyệt đối: ' + pn(P1, sqName(first)) + ' bị ghim vào Vua — nó không được phép di chuyển. ' + (val(P1.type) > val(movedType) ? 'Quân bị ghim lại có giá trị lớn hơn ' + movedName + ', bạn sắp thắng vật chất.' : 'Bạn có thể dồn thêm quân tấn công quân bị ghim.'));
                } else if (P1.type === 'k') {
                  add('skewer', 55, 'Đòn xiên: chiếu Vua, khi Vua tránh đi thì ' + pn(P2, sqName(s)) + ' phía sau sẽ bị ăn.');
                } else if (val(P2.type) > val(P1.type) && val(P2.type) > val(movedType)) {
                  add('pin', 35, 'Ghim: ' + pn(P1, sqName(first)) + ' bị ghim vào ' + pn(P2, sqName(s)) + ' — nếu nó di chuyển, ' + NAME[P2.type] + ' sẽ bị ăn.');
                } else if (val(P1.type) > val(P2.type) && val(P1.type) >= 5 && val(P1.type) > val(movedType)) {
                  add('skewer', 45, 'Đòn xiên: tấn công ' + pn(P1, sqName(first)) + '; khi quân này tránh đi, ' + pn(P2, sqName(s)) + ' phía sau sẽ bị lộ.');
                }
              }
              break;
            }
          }
          s += d;
        }
      }
    }

    // --- Tấn công mở (không phải chiếu) ---
    if (!isCheck) {
      for (let i = 0; i < 128; i++) {
        if (i & 0x88) { i += 7; continue; }
        const p = after.b[i];
        if (!p || p.color !== us || !SLIDER[p.type] || i === toI) continue;
        const beforeT = new Set(enemyTargetsFrom(before, i, us));
        const newT = enemyTargetsFrom(after, i, us).filter((s) => !beforeT.has(s) && after.b[s].type !== 'k' &&
          (val(after.b[s].type) > val(p.type) || !after._attackers(s, them).length));
        if (newT.length && after._attacksFrom(i).length > before._attacksFrom(i).length) {
          add('discovered', 50, 'Tấn công mở: ' + movedName + ' rời ' + mv.from + ' mở đường cho ' + NAME[p.type] + ' ' + sqName(i) + ' tấn công ' + listNames(newT.map((s) => pn(after.b[s], sqName(s)))) + '.');
        }
      }
    }

    // --- Đe dọa chiếu hết ---
    if (!isCheck) {
      const nul = nullFlip(after);
      if (nul) {
        const mates = mateInOneMoves(nul);
        if (mates.length) add('matethreat', 48, 'Đe dọa chiếu hết: nếu đối phương không phòng thủ, nước tiếp theo ' + mates[0].san + ' sẽ chiếu hết.');
      }
    }

    // --- Ngăn chặn / cho phép đối phương chiếu hết ---
    const oppMatesAfter = mateInOneMoves(after);
    if (oppMatesAfter.length) {
      add('allowmate', 95, 'Nước này cho phép đối phương chiếu hết ngay bằng ' + oppMatesAfter[0].san + '!', true);
    } else {
      const nb = nullFlip(before);
      const threats = nb ? mateInOneMoves(nb) : [];
      if (threats.length) {
        add('stopmate', 57, 'Ngăn chặn đe dọa chiếu hết: đối phương đang dọa ' + threats[0].san + '. Sau nước này, mối đe dọa đó không còn.');
      }
    }

    // --- Phòng thủ: cứu quân / bảo vệ quân ---
    const hangBefore = hangingPieces(before, us);
    if (hangBefore.includes(fromI) && movedSafe && !mv.captured) {
      add('escape', 40, 'Đưa ' + movedName + ' ra khỏi vùng nguy hiểm: ở ' + mv.from + ' nó đang bị tấn công mà không được bảo vệ đủ.');
    }
    const hangAfter = new Set(hangingPieces(after, us));
    const saved = hangBefore.filter((s) => s !== fromI && after.b[s] && !hangAfter.has(s));
    if (saved.length) {
      add('defend', 35, 'Bảo vệ ' + listNames(saved.map((s) => pn(after.b[s], sqName(s)))) + ' đang bị đe dọa.');
    }

    // --- Cảnh báo: quân vừa đi bị treo ---
    if (!movedSafe && !mv.captured && movedType !== 'k') {
      const att = after._attackers(toI, them);
      add('hang', 58, movedName + ' ở ' + mv.to + ' có thể bị ' + NAME[after.b[att[0]].type] + ' ' + sqName(att[0]) + ' ăn mà không được bù đắp xứng đáng.', true);
    }
    const newlyHanging = [...hangAfter].filter((s) => s !== toI && !hangBefore.includes(s));
    if (newlyHanging.length) {
      add('exposed', 40, 'Nước này để lộ ' + listNames(newlyHanging.map((s) => pn(after.b[s], sqName(s)))) + ' — quân đó trở thành mục tiêu không được bảo vệ.', true);
    }

    // --- Nguyên tắc khai cuộc / chiến lược ---
    const opening = before.full <= 12;
    if (opening && (mv.piece === 'n' || mv.piece === 'b') && ((us === 'w' && mv.from[1] === '1') || (us === 'b' && mv.from[1] === '8'))) {
      add('develop', 18, 'Phát triển quân: đưa ' + movedName + ' ra khỏi hàng cuối để tham gia trận đấu — một trong những nguyên tắc quan trọng nhất của khai cuộc.');
    }
    if (mv.piece === 'p' && CENTER.includes(mv.to)) {
      add('center', 16, 'Chiếm trung tâm: Tốt ' + mv.to + ' kiểm soát các ô trung tâm, tạo không gian cho quân của bạn.');
    } else if (mv.piece !== 'k' && mv.piece !== 'p') {
      const ctrl = after._attacksFrom(toI).map(sqName).filter((s) => CENTER.includes(s));
      if (ctrl.length >= 2 && opening) add('center', 10, movedName + ' kiểm soát các ô trung tâm ' + listNames(ctrl) + '.');
    }
    if (opening && mv.piece === 'q' && before.full <= 6 && !mv.captured && !isCheck) {
      add('earlyqueen', 8, 'Lưu ý: đưa Hậu ra quá sớm dễ bị quân nhẹ của đối phương đuổi đánh, mất nhịp phát triển.', true);
    }
    if (opening && mv.piece === 'p' && mv.from[0] === 'f' && (mv.to === 'f3' || mv.to === 'f6')) {
      add('fpawn', 20, 'Đẩy Tốt f lên ' + mv.to + ' ở khai cuộc làm hở đường chéo dẫn tới Vua và chiếm mất ô phát triển tự nhiên của Mã.', true);
    }
    if (opening && mv.piece === 'k' && !mv.flags.includes('k') && !mv.flags.includes('q') && !isCheck && !before.inCheck()) {
      add('kingwalk', 20, 'Di chuyển Vua ở khai cuộc làm mất quyền nhập thành và khiến Vua kém an toàn.', true);
    }

    // --- Tăng hoạt động quân (fallback) ---
    if (movedType !== 'p' && movedType !== 'k') {
      const mobBefore = before._attacksFrom(fromI).length;
      const mobAfter = after._attacksFrom(toI).length;
      if (mobAfter - mobBefore >= 3) {
        add('activity', 6, 'Tăng hoạt động: ' + movedName + ' kiểm soát ' + mobAfter + ' ô thay vì ' + mobBefore + ' ô như trước.');
      }
    }

    out.sort((a, b) => b.w - a.w);
    return out;
  }

  function scoreText(cp, mate) {
    if (mate != null) return mate > 0 ? 'chiếu hết sau ' + mate + ' nước' : 'bị chiếu hết sau ' + -mate + ' nước';
    const a = Math.abs(cp);
    let lvl;
    if (a < 30) lvl = 'thế cờ cân bằng';
    else if (a < 90) lvl = cp > 0 ? 'bạn hơi nhỉnh hơn' : 'đối phương hơi nhỉnh hơn';
    else if (a < 250) lvl = cp > 0 ? 'bạn có ưu thế rõ rệt' : 'đối phương có ưu thế rõ rệt';
    else lvl = cp > 0 ? 'bạn đang thắng thế' : 'đối phương đang thắng thế';
    return lvl + ' (' + (cp >= 0 ? '+' : '') + (cp / 100).toFixed(1) + ')';
  }

  function pvText(line, startFull, color) {
    // Định dạng 12. Nf3 Nc6 13. ...
    let n = startFull;
    let s = '';
    let side = color;
    line.forEach((san, i) => {
      if (side === 'w') s += n + '. ' + san + ' ';
      else s += (i === 0 ? n + '... ' : '') + san + ' ';
      if (side === 'b') n++;
      side = other(side);
    });
    return s.trim();
  }

  /** Thay đổi vật chất (theo bên đi) sau khi đi hết biến chính. */
  function materialSwing(before, pvMoves) {
    const us = before.turn;
    const t = before.clone();
    const m0 = materialOf(t, us) - materialOf(t, other(us));
    for (const m of pvMoves) if (!t.move(m.lan)) break;
    return materialOf(t, us) - materialOf(t, other(us)) - m0;
  }

  /**
   * Giải thích tại sao `line` (từ Engine.analyse) là nước đi tốt.
   * Trả về { san, headline, reasons: [string], warnings: [string], pv, evalText }
   */
  function explainLine(before, line) {
    const mv = line.move;
    const ms = motifs(before, mv);
    const good = ms.filter((m) => !m.bad);
    const reasons = good.slice(0, 4).map((m) => m.text);
    const warnings = ms.filter((m) => m.bad).map((m) => m.text);
    const pv = pvText(line.pv.slice(0, 8), before.full, before.turn);
    const evalText = scoreText(line.score, line.mate);

    if (line.mate != null && line.mate > 1) {
      reasons.unshift('Chuỗi nước ép buộc dẫn tới chiếu hết sau ' + line.mate + ' nước: ' + pv + '.');
    }
    const swing = materialSwing(before, line.pvMoves.slice(0, 6));
    if (line.mate == null && swing >= 2 && !good.some((m) => m.w >= 40)) {
      reasons.push('Tính toán trước vài nước, chuỗi ' + pv + ' giúp bạn thắng khoảng ' + swing + ' điểm vật chất.');
    }
    if (good.some((m) => m.key === 'sac') && line.score > -50) {
      reasons.push('Hy sinh này đúng đắn: sau ' + pv + ' bạn lấy lại nhiều hơn những gì đã bỏ ra.');
    }
    // Bị đe dọa trước nước đi → nước này giải quyết thế nào?
    if (!reasons.length) {
      const reply = line.pvMoves[1];
      if (reply) {
        reasons.push('Đây là nước giữ thế cờ vững chắc nhất. Máy dự tính đối phương sẽ đáp lại ' + reply.san + ' và thế cờ tiếp tục: ' + pv + '.');
      } else {
        reasons.push('Nước đi cải thiện vị trí quân tốt nhất theo tính toán của máy.');
      }
    }
    let headline = mv.san;
    const top = good[0];
    if (top) {
      const tag = {
        mate: 'Chiếu hết', fork: 'Đánh đôi', pin: 'Ghim', skewer: 'Xiên', discovered: 'Tấn công mở', discheck: 'Chiếu mở',
        double: 'Chiếu đôi', free: 'Ăn quân treo', 'trade+': 'Đổi quân có lợi', removedef: 'Loại bỏ quân phòng thủ',
        matethreat: 'Đe dọa chiếu hết', stopmate: 'Chặn đe dọa chiếu hết', promo: 'Phong cấp', castle: 'Nhập thành', escape: 'Cứu quân', defend: 'Phòng thủ',
        develop: 'Phát triển quân', center: 'Chiếm trung tâm', threat: 'Tạo đe dọa', sac: 'Thí quân', check: 'Chiếu',
      }[top.key];
      if (line.mate != null && line.mate > 1) headline += ' — Ép chiếu hết sau ' + line.mate + ' nước';
      else if (tag) headline += ' — ' + tag;
    }
    return { san: mv.san, uci: mv.lan, headline, reasons, warnings, pv, evalText, motifs: ms };
  }

  const CLASSES = [
    { key: 'best', max: 0, label: 'Nước tốt nhất', icon: '★', css: 'best' },
    { key: 'excellent', max: 25, label: 'Xuất sắc', icon: '!', css: 'excellent' },
    { key: 'good', max: 60, label: 'Tốt', icon: '✓', css: 'good' },
    { key: 'inaccuracy', max: 130, label: 'Thiếu chính xác', icon: '?!', css: 'inaccuracy' },
    { key: 'mistake', max: 300, label: 'Sai lầm', icon: '?', css: 'mistake' },
    { key: 'blunder', max: Infinity, label: 'Sai lầm nghiêm trọng', icon: '??', css: 'blunder' },
  ];

  /**
   * Đánh giá nước đi của người chơi so với nước tốt nhất.
   * analysis: kết quả Engine.analyse(before, { focus: mv.lan })
   */
  function judgeMove(before, mv, analysis) {
    const lines = analysis.all || analysis.lines;
    const best = lines[0];
    const mine = lines.find((l) => l.uci === mv.lan) || null;
    const isBest = best && best.uci === mv.lan;
    const myScore = mine ? mine.score : best.score - 1000;
    let loss = Math.max(0, best.score - myScore);
    // Cả hai đều thắng chắc (chiếu hết / hơn rất nhiều) → không phạt nặng
    if (best.score > 600 && myScore > 600) loss = Math.min(loss, 40);
    if (best.mate != null && best.mate > 0 && mine && mine.mate != null && mine.mate > 0) loss = Math.min(loss, 20);
    let cls = CLASSES[CLASSES.length - 1];
    if (isBest) cls = CLASSES[0];
    else for (const c of CLASSES.slice(1)) if (loss <= c.max) { cls = c; break; }

    const myMotifs = motifs(before, mv);
    const result = {
      cls,
      loss,
      isBest,
      san: mv.san,
      score: myScore,
      mate: mine ? mine.mate : null,
      bestSan: best.san,
      bestUci: best.uci,
      good: [],
      problems: [],
      best: isBest ? null : explainLine(before, best),
      evalText: scoreText(myScore, mine ? mine.mate : null),
    };

    if (['best', 'excellent', 'good'].includes(cls.key)) {
      result.good = myMotifs.filter((m) => !m.bad).slice(0, 3).map((m) => m.text);
      if (!result.good.length) result.good.push('Nước đi vững chắc, giữ được thế cờ (' + result.evalText + ').');
    } else {
      result.problems.push(...myMotifs.filter((m) => m.bad).map((m) => m.text));
      // Đối phương sẽ trừng phạt thế nào?
      if (mine && mine.pvMoves[1]) {
        const afterMine = before.clone();
        afterMine.move(mv.lan);
        const reply = mine.pvMoves[1];
        const rm = motifs(afterMine, reply).filter((m) => !m.bad);
        const replyLine = pvText(mine.pv.slice(1, 7), afterMine.full, afterMine.turn);
        const dup = myMotifs.some((m) => m.key === 'allowmate') || (reply.to === mv.to && myMotifs.some((m) => m.key === 'hang'));
        if (dup) {
          // đã giải thích ở trên
        } else if (rm.length && rm[0].w >= 30) {
          result.problems.push('Đối phương có thể đáp trả ' + reply.san + ': ' + rm[0].text.charAt(0).toLowerCase() + rm[0].text.slice(1));
        } else if (!result.problems.length) {
          result.problems.push('Nước này không mất quân, nhưng kém hiệu quả hơn ' + best.san + ' (thế cờ kém đi khoảng ' + (loss / 100).toFixed(1) + ' điểm). Máy dự tính tiếp theo: ' + replyLine + '.');
        }
      }
      if (!result.problems.length) result.problems.push('Nước này bỏ lỡ cơ hội tốt hơn và làm thế cờ kém đi khoảng ' + (loss / 100).toFixed(1) + ' điểm.');
    }
    return result;
  }

  const api = { motifs, explainLine, judgeMove, scoreText, pvText, isHanging, NAME, SIDE, CLASSES };
  if (isNode) module.exports = api;
  else root.Explain = api;
})(typeof self !== 'undefined' ? self : this);
