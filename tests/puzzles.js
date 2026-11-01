// Kiểm tra mọi bài tập: nước đi hợp lệ, và máy đồng ý nước của người chơi là tốt nhất.
const { Chess } = require('../js/chess.js');
const E = require('../js/engine.js');
const X = require('../js/explain.js');
const { LESSONS } = require('../js/lessons.js');
let fail = 0;
for (const L of LESSONS) for (const [pi, P] of L.puzzles.entries()) {
  const tag = `${L.id}#${pi + 1} "${P.title}"`;
  let c;
  try { c = new Chess(P.fen); } catch (e) { console.log('FAIL', tag, e.message); fail++; continue; }
  const msgs = [];
  let ok = true;
  for (let i = 0; i < P.solution.length; i++) {
    const uci = P.solution[i];
    if (i % 2 === 0) {
      const a = E.analyse(c, { timeMs: 2500 });
      const best = a.lines[0];
      const accepted = [uci, ...(i === 0 ? P.alt || [] : [])];
      const solLine = a.all.find((l) => l.uci === uci);
      const good = accepted.includes(best.uci) || (solLine && solLine.exact && best.score - solLine.score <= 30) || (best.mate === 1 && solLine && solLine.mate === 1);
      msgs.push(`${uci}: máy=${best.san}(${best.score}${best.mate ? ' M' + best.mate : ''}) sol=${solLine ? solLine.score : '?'} d${a.depth}`);
      if (!good) ok = false;
      if (i === 0 && solLine) {
        const ex = X.explainLine(c, solLine);
        msgs.push('   → ' + ex.headline + ' | ' + ex.reasons[0]);
      }
    }
    if (!c.move(uci)) { msgs.push('nước không hợp lệ: ' + uci); ok = false; break; }
  }
  console.log((ok ? 'OK  ' : 'FAIL') + ' ' + tag + '\n   ' + msgs.join('\n   '));
  if (!ok) fail++;
}
console.log(fail ? `${fail} bài lỗi` : 'Tất cả bài tập hợp lệ');
process.exit(fail ? 1 : 0);
