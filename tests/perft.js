const { Chess } = require('../js/chess.js');
function perft(c, d) {
  if (d === 0) return 1;
  let n = 0;
  for (const m of c._gen(false)) {
    const us = c.turn;
    c._make(m);
    if (!c._inCheck(us)) n += perft(c, d - 1);
    c._unmake();
  }
  return n;
}
const cases = [
  ['rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 4, 197281],
  ['r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1', 3, 97862],
  ['8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1', 4, 43238],
  ['r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1', 3, 9467],
  ['rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8', 3, 62379],
];
let ok = true;
for (const [fen, d, exp] of cases) {
  const t = Date.now();
  const n = perft(new Chess(fen), d);
  const pass = n === exp;
  ok = ok && pass;
  console.log((pass ? 'OK  ' : 'FAIL') + ` perft(${d})=${n} (mong đợi ${exp}) ${Date.now() - t}ms  ${fen}`);
}
const c = new Chess();
for (const s of ['e4', 'e5', 'Bc4', 'Nc6', 'Qh5', 'Nf6', 'Qxf7#']) if (!c.move(s)) { console.log('FAIL move', s); ok = false; }
console.log(c.history().join(' '), 'mate=', c.isCheckmate());
if (!c.isCheckmate()) ok = false;
process.exit(ok ? 0 : 1);
