const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const html = readFileSync(require('node:path').join(__dirname, '../index.html'), 'utf8');
function scene() {
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, { dataset: {}, attrs: {}, hidden: false,
      textContent: '', disabled: false, addEventListener(name, fn) { this[name] = fn; },
      setAttribute(name, value) { this.attrs[name] = value; } });
    return elements.get(id);
  };
  let nextFrame = 0;
  const frames = new Map(), listeners = {};
  const ctx = { $: element, merit: { bow: 0 }, audio() {}, chime() {},
    refreshMerit() {}, logMerit() {}, toast() {},
    document: { hidden: false, addEventListener: (event, fn) => listeners[event] = fn },
    requestAnimationFrame: fn => { frames.set(++nextFrame, fn); return nextFrame; },
    cancelAnimationFrame: id => frames.delete(id) };
  vm.createContext(ctx);
  vm.runInContext(html.slice(html.indexOf('        /* Full articulated poses.'), html.indexOf('        /* ============ 撞钟')), ctx);
  let now = 0;
  function tick(ms) {
    for (let end = now + ms; now < end;) {
      now += Math.min(20, end - now);
      const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn(now));
    }
  }
  function click(id) { element(id).click.call(element(id)); }
  return { ctx, element, tick, click, listeners };
}
test('three visible contact holds, slow continuous movement, and one completion', () => {
  const s = scene(); s.click('bowBtn');
  const contacts = [], completed = [];
  let last = 'prayer';
  for (let ms = 0; ms < 27200; ms += 20) {
    s.tick(20);
    const phase = s.element('bowScene').dataset.phase;
    if (phase === 'contact' && last !== 'contact') contacts.push(ms);
    if (last === 'contact' && phase !== 'contact') completed.push(ms);
    last = phase;
  }
  assert.equal(contacts.length, 3);
  completed.forEach((end, i) => assert.ok(end - contacts[i] >= 1180));
  assert.equal(s.ctx.merit.bow, 1);
  assert.equal(s.element('bowBtn').disabled, false);
  assert.match(s.element('bowStatus').textContent, /三拜礼成/);
});
test('forehead touches cushion while both hands rest on its two sides', () => {
  const s = scene(); s.ctx.bowPose(4500);
  assert.equal(s.element('bowHead').attrs.transform, 'translate(213 210) rotate(90)');
  // Local forehead (19,-7) rotated 90deg and translated gives (220,229).
  // Cushion is ellipse center (225,237), radii (45,8), within 0.06px of contact.
  const cushionY = 237 - 8 * Math.sqrt(1 - ((220 - 225) / 45) ** 2);
  assert.ok(Math.abs(cushionY - 229) < 0.06);
  assert.match(s.element('bowFarHand').attrs.d, /194.00 233.00$/);
  assert.match(s.element('bowNearHand').attrs.d, /251.00 240.00$/);
  s.ctx.bowPose(1900);
  assert.match(s.element('bowHead').attrs.transform, /translate\(135 106\) rotate\(0\)/);
});
test('stop earns no merit and restart requires three whole bows', () => {
  const s = scene(); s.click('bowBtn'); s.tick(12000); s.click('bowStop');
  assert.equal(s.ctx.merit.bow, 0); assert.equal(s.element('bowStop').hidden, true);
  s.click('bowBtn'); s.tick(26000); assert.equal(s.ctx.merit.bow, 0);
  s.tick(1200); assert.equal(s.ctx.merit.bow, 1);
});
test('background time never skips bows or awards completion', () => {
  const s = scene(); s.click('bowBtn'); s.tick(3000);
  s.ctx.document.hidden = true; s.listeners.visibilitychange(); s.tick(60000);
  assert.equal(s.ctx.merit.bow, 0);
  s.ctx.document.hidden = false; s.listeners.visibilitychange(); s.tick(1000);
  assert.equal(s.ctx.bowCompleted, 0); assert.equal(s.ctx.merit.bow, 0);
  s.tick(24000); assert.equal(s.ctx.merit.bow, 1);
});
