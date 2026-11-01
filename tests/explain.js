// Kiểm tra bộ chấm điểm: nước sai lầm phải bị nhận diện, nước tốt nhất phải được khen.
const { Chess } = require('../js/chess.js');
const E = require('../js/engine.js');
const X = require('../js/explain.js');
let fail = 0;
function check(fen, uci, expectKeys, label) {
  const c = new Chess(fen);
  const mv = c.moves({ verbose: true }).find((m) => m.lan === uci);
  const a = E.analyse(c, { timeMs: 1200, focus: uci });
  const j = X.judgeMove(c, mv, a);
  const ok = expectKeys.includes(j.cls.key);
  if (!ok) fail++;
  console.log((ok ? 'OK  ' : 'FAIL') + ` ${label}: ${j.san} → ${j.cls.label} (mất ${j.loss}cp)`);
  if (j.good.length) console.log('   + ' + j.good.join('\n   + '));
  if (j.problems.length) console.log('   - ' + j.problems.join('\n   - '));
  if (j.best) console.log('   ★ ' + j.best.headline + ': ' + j.best.reasons.join(' / ') + ' [' + j.best.pv + ']');
}
check('r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3', 'g8f6', ['blunder'], 'Bỏ qua đe dọa chiếu hết Mục đồng');
check('r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3', 'g7g6', ['best', 'excellent', 'good'], 'Chặn đe dọa');
check('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 'e2e4', ['best', 'excellent', 'good'], 'Khai cuộc e4');
check('r3kb1r/pp3ppp/8/3N4/8/8/PPP2PPP/R3KB1R w KQkq - 0 1', 'd5f6', ['mistake', 'blunder'], 'Bỏ lỡ đánh đôi');
check('rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2', 'd1g4', ['mistake', 'blunder'], 'Treo Hậu');
process.exit(fail ? 1 : 0);
