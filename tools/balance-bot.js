// balance-test bot: open index.html#debug on a local server, then in the console run
//   __g.paused = true; eval(await (await fetch("tools/balance-bot.js")).text()); study("avg", 30, 3)
// balance(), progression(skill, maxL) and study(skill, maxL, reps) print win rates, boss seconds and coins.
(() => {
const g = window.__g;
const OFFX = []; for (let i = 0; i < 90; i++) OFFX.push(Math.cos(i * 2.39996) * 0.36 * Math.sqrt(i));
function fracAt(x, c, test) { const n = Math.min(Math.ceil(c), 90); let k = 0; for (let i = 0; i < n; i++) if (test(x + OFFX[i])) k++; return n ? k / n : 0; }
function outcome(gt, c) { return gt.op === 'x' ? c * gt.val : gt.op === '/' ? Math.ceil(c / gt.val) : c + gt.val; }
function makeBot(skill) {
  return () => {
    const s = g.squad, pz = g.playerZ, c = s.count;
    const boss = g.ents.find(e => e.type === 'boss' && e.alive);
    if (boss && boss.warn) {
      if (boss.warn.ignore === undefined) boss.warn.ignore = Math.random() > skill.dodge;
      if (boss.warn.ignore) return;
      let best = s.tx, bf = 9;
      for (let x = -4.3; x <= 4.31; x += 0.1) {
        const f = fracAt(x, c, ux => boss.warn.zones.some(z => Math.abs(ux - z.x) < z.w / 2)) + Math.abs(x - s.x) * 0.01;
        if (f < bf) { bf = f; best = x; }
      }
      s.tx = best; return;
    }
    const ahead = g.ents.filter(e => e.alive && e.z > pz - 0.2 && e.z - pz < 22).sort((a, b) => a.z - b.z);
    for (const e of ahead) {
      if (e.type === 'saw' && !e.done && e.z - pz < 5) { if (e.decide === undefined) e.decide = Math.random() < skill.saw; if (e.decide) s.tx = e.x > 0 ? -3.8 : 3.8; return; }
      if (e.type === 'brute' && e.z - pz < 8) { if (e.decide === undefined) e.decide = Math.random() < skill.saw; if (e.decide) s.tx = -e.x; return; }
      if (e.type === 'orb' && !e.done) { if (e.decide === undefined) e.decide = Math.random() < skill.gate; if (e.decide) { s.tx = e.x; return; } }
      if (e.type === 'gate' && !e.used && e.val != null) {
        const pair = g.ents.filter(p => p.pair === e.pair);
        pair.sort((a, b) => outcome(b, c) - outcome(a, c));
        if (e.decide === undefined) e.decide = Math.random() < skill.gate;
        s.tx = (e.decide ? pair[0] : pair[1]).x; return;
      }
    }
  };
}
window.__mk = makeBot;
function runLvl(level, skill) {
  g.start(level);
  const bot = makeBot(skill), c0 = g.save.coins;
  let tt = 0, bossT = null, atBoss = null, prev = g.squad.count, cause = '';
  while (g.state === 'play' && tt < 300) {
    bot(); g.step(1 / 60); tt += 1 / 60;
    if (g.squad.count < prev - 0.5) cause = (g.ents.filter(e => Math.abs(e.z - g.playerZ) < 3 && e.type !== 'gate').map(e => e.type))[0] || 'gate';
    prev = g.squad.count;
    const b = g.ents.find(e => e.type === 'boss');
    if (b && bossT === null && b.z - g.playerZ < 16) { bossT = tt; atBoss = Math.ceil(g.squad.count); }
  }
  return { res: g.state, total: Math.round(tt), boss: bossT === null ? null : Math.round(tt - bossT), atBoss, coins: g.save.coins - c0, cause: g.state === 'lose' ? cause : '' };
}
const SK = { good: { dodge: 0.9, saw: 0.9, gate: 0.95 }, avg: { dodge: 0.6, saw: 0.6, gate: 0.8 } };
window.balance = function () {
  const out = {};
  for (const [name, skill] of Object.entries(SK)) {
    out[name] = [];
    for (const L of [1, 3, 6, 10]) {
      const rs = []; for (let k = 0; k < 8; k++) { g.save.up = { troops: 0, power: 0, rate: 0 }; rs.push(runLvl(L, skill)); }
      out[name].push(`L${L} win ${rs.filter(r => r.res === 'win').length}/8 | run ${rs.map(r => r.total)} | boss ${rs.map(r => r.boss)} | atBoss ${rs.map(r => r.atBoss)} | coins ${rs.map(r => r.coins)} | died ${rs.map(r => r.cause).filter(Boolean)}`);
    }
  }
  return out;
};
// progression with upgrades: buys the cheapest affordable upgrade after each run
window.progression = function (skillName, maxL = 15) {
  g.save.coins = 0; g.save.up = { troops: 0, power: 0, rate: 0 };
  const ups = window.__g.ups;
  const prog = []; let L = 1, tries = 0, total = 0;
  while (L <= maxL && total < 80) {
    const r = runLvl(L, SK[skillName]); tries++; total++;
    for (;;) {
      const opts = ups.map((u, i) => ({ i, c: u.cost(g.save.up[u.id]) })).sort((a, b) => a.c - b.c);
      if (g.save.coins < opts[0].c) break;
      g.save.coins -= opts[0].c; g.save.up[ups[opts[0].i].id]++;
    }
    if (r.res === 'win') { prog.push(`L${L}:${tries}`); L++; tries = 0; }
  }
  return prog.join(' ') + (L <= maxL ? ` | stuck at L${L} after ${tries}` : '') + ' | ups ' + JSON.stringify(g.save.up);
};
})();
// summary of several progressions: total runs, boss seconds on wins, coins per run, by level band
window.study = function (skillName, maxL = 25, reps = 3) {
  const SKs = { good: { dodge: 0.9, saw: 0.9, gate: 0.95 }, avg: { dodge: 0.6, saw: 0.6, gate: 0.8 } };
  const g = window.__g, ups = g.ups, bands = {};
  let stuck = 0;
  for (let r = 0; r < reps; r++) {
    g.save.coins = 0; g.save.up = { troops: 0, power: 0, rate: 0 };
    let L = 1, tries = 0, total = 0;
    while (L <= maxL && total < 120) {
      g.start(L);
      const c0 = g.save.coins; let tt = 0, bossT = null;
      const bot = window.__mk(SKs[skillName]);
      while (g.state === 'play' && tt < 300) {
        bot(); g.step(1 / 60); tt += 1 / 60;
        const b = g.ents.find(e => e.type === 'boss');
        if (b && bossT === null && b.z - g.playerZ < 16) bossT = tt;
      }
      const k = 'L' + (Math.floor((L - 1) / 5) * 5 + 1) + '-' + (Math.floor((L - 1) / 5) * 5 + 5);
      const B = bands[k] = bands[k] || { runs: 0, wins: 0, boss: 0, coins: 0 };
      B.runs++; B.coins += g.save.coins - c0;
      if (g.state === 'win') { B.wins++; B.boss += tt - bossT; }
      tries++; total++;
      for (;;) {
        const opts = ups.map((u, i) => ({ i, c: u.cost(g.save.up[u.id]) })).filter(o => g.save.up[ups[o.i].id] < ups[o.i].max).sort((a, b) => a.c - b.c);
        if (!opts.length || g.save.coins < opts[0].c) break;
        g.save.coins -= opts[0].c; g.save.up[ups[opts[0].i].id]++;
      }
      if (g.state === 'win') { L++; tries = 0; }
    }
    if (L <= maxL) stuck++;
  }
  const out = {};
  for (const [k, B] of Object.entries(bands)) out[k] = `runs/level ${(B.runs / reps / 5).toFixed(1)} | boss ${(B.boss / Math.max(1, B.wins)).toFixed(1)}s | coins/run ${Math.round(B.coins / B.runs)}`;
  out.stuck = stuck;
  return out;
};
