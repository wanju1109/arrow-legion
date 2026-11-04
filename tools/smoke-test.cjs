// No browser profile or real player save is used. Run: node tools/smoke-test.cjs
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8').split('<script>')[1].split('</script>')[0];
let seed = 91027;
const math = Object.create(Math);
math.random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const events = {}, pointer = {};
let frame;
const noop = () => {};
const gradient = { addColorStop: noop };
const ctx = new Proxy({ measureText: text => ({ width: String(text).length * 8 }), createLinearGradient: () => gradient, createRadialGradient: () => gradient }, { get: (o, k) => k in o ? o[k] : noop, set: (o, k, v) => (o[k] = v, true) });
const canvas = { getContext: () => ctx, getBoundingClientRect: () => ({ width: 390, height: 844, left: 0, top: 0 }), addEventListener: (name, fn) => pointer[name] = fn, setPointerCapture: noop };
const originalSave = JSON.stringify({ level: 7, best: 9, coins: 123, muted: true, up: { troops: 2, power: 3, rate: 1 } });
const storage = new Map([['arrowLegionSave', originalSave], ['arrowLegionTestSave', originalSave]]);
const sandbox = { Math: math, console, performance: { now: () => 10000 }, location: { hash: '#debug', hostname: '127.0.0.1' }, navigator: {}, document: { getElementById: () => canvas }, localStorage: { getItem: k => storage.get(k), setItem: (k, v) => storage.set(k, v) }, requestAnimationFrame: fn => frame = fn };
sandbox.window = sandbox; sandbox.addEventListener = (name, fn) => events[name] = fn;
vm.createContext(sandbox); vm.runInContext(source, sandbox);
const g = sandbox.__g;
assert.equal(g.save.coins, 123); assert.equal(g.save.up.power, 3); assert.equal(g.save.best, 9);
g.paused = true;
const render = () => frame(10000);
const press = key => events.keydown({ key, repeat: false, preventDefault: noop });
render();
g.start(1); assert.equal(g.energy, 35); assert.equal(g.storm(), false);
// Move past safe opening gates, then explicitly verify the choice pauses simulation.
g.squad.count = 200;
for (let i = 0; i < 1800 && g.state === 'play'; i++) { g.squad.count = Math.max(200, g.squad.count); g.step(1 / 60); }
assert.equal(g.state, 'draft'); render();
assert.equal(g.choices.length, 3); assert.equal(new Set(g.choices.map(p => p.id)).size, 3);
const before = { z: g.playerZ, count: g.squad.count, hp: g.ents.find(e => e.type === 'boss').hp };
g.step(10);
assert.equal(g.playerZ, before.z); assert.equal(g.squad.count, before.count); assert.equal(g.ents.find(e => e.type === 'boss').hp, before.hp);
press('1'); assert.equal(g.state, 'play');
g.step(1 / 60); assert.notEqual(g.playerZ, before.z);
for (let i = 0; i < 1800 && g.state === 'play'; i++) { g.squad.count = Math.max(200, g.squad.count); g.step(1 / 60); }
assert.equal(g.state, 'draft'); render();
g.choose(0); assert.equal(g.state, 'play');
// Let passive and reward charge fill, trigger using actual keyboard handler.
for (let i = 0; i < 10000 && g.state === 'play' && g.energy < 100; i++) { g.squad.count = Math.max(200, g.squad.count); g.step(1 / 60); }
assert.equal(g.energy, 100); press(' '); assert.equal(g.stormT, 4); assert.equal(g.energy, 0); assert.equal(g.storm(), false);
render(); g.step(4.1); assert.equal(g.stormT, 0);
g.start(1); assert.equal(g.energy, 35); assert.equal(g.stormT, 0); assert.equal(g.tactics.power, 0);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'balance-bot.js'), 'utf8'), sandbox);
const result = vm.runInContext("study('avg', 30, 3)", sandbox);
assert.equal(result.stuck, 0); console.log('PASS save compatibility, draft pause/resume, two checkpoints, keyboard storm, expiration, reset');
console.log(JSON.stringify(result, null, 2));
// Every boss pattern resolves exactly the promised number of hits; aiming locks before impact.
for (const [kind, total] of [['hunt', 1], ['sweep', 3], ['pincer', 1], ['wave', 2]]) {
  g.start(1); g.bossPattern(kind);
  const boss = g.ents[0]; boss.hp = boss.max = 1e9;
  assert.equal(boss.patternTotal, total); assert.equal(boss.warn.kind, kind);
  if (kind === 'hunt') {
    g.squad.x = g.squad.tx = 2; g.step(0.2);
    assert.equal(boss.warn.locked, false); assert.equal(boss.warn.zones[0].x, 2);
    g.step(0.25); assert.equal(boss.warn.locked, true);
    const lockedX = boss.warn.zones[0].x;
    g.squad.x = g.squad.tx = -3; g.step(0.2);
    assert.equal(boss.warn.zones[0].x, lockedX);
  }
  if (kind === 'pincer') {
    const safe = boss.warn.safe;
    assert.ok(!boss.warn.zones.some(z => Math.abs(safe - z.x) < z.w / 2));
    g.squad.x = g.squad.tx = safe;
  }
  let hits = 0, hadWarning = true;
  for (let i = 0; i < 600 && hits < total; i++) {
    g.squad.count = Math.max(10, g.squad.count);
    g.step(1 / 60); render();
    if (hadWarning && !boss.warn) hits++;
    hadWarning = !!boss.warn;
  }
  assert.equal(hits, total, kind + ' hit count');
  assert.equal(boss.steps.length, 0);
}
g.start(1); g.bossPattern('wave');
const rageBoss = g.ents[0], normalDuration = rageBoss.warn.dur;
rageBoss.hp = rageBoss.max * 0.4; g.bossPattern('wave');
assert.ok(rageBoss.warn.dur < normalDuration); assert.ok(rageBoss.warn.dur >= 0.9);
assert.equal(storage.get('arrowLegionSave'), originalSave);
console.log('PASS four boss patterns, hit sequences, aim lock, safe corridor, rage tempo, production save isolation');
render();
