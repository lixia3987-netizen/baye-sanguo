// Read-only original-ROM person identity evidence. Navigation and trusted scrolling belong to the caller.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

const ORIGINAL_SHA = '3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e';
const EPSILON = 1;
const CORE = '#hd-city-menu-person-fields > section.hd-city-menu-info-group:first-of-type > .hd-city-menu-info-rows';
const TARGETS = [
  {kind: 'heading', selector: '#hd-city-menu-person-name'},
  {kind: 'ownership', selector: CORE + ' > .hd-city-menu-stat:nth-child(1)'},
  {kind: 'priorOwnership', selector: CORE + ' > .hd-city-menu-stat:nth-child(2)'},
  {kind: 'nativeOwnership', selector: '#hd-city-menu-person-properties-fields [data-hd-person-property="0"]'}
];

function originalOwnershipTitle(lib) {
  // STRING_CONST / ATRR_STR18: resource 64, original one-based item 24 (zero-based 23).
  const resource = 64, index = 23, base = lib.readUInt32LE((resource - 1) * 4);
  assert.ok(base > 0 && base + 14 <= lib.length);assert.equal(lib.readUInt16LE(base + 4), resource);
  const end = base + lib.readUInt32LE(base), count = lib.readUInt16LE(base + 6), fixed = lib.readUInt32LE(base + 8);
  assert.ok(index < count && end <= lib.length);assert.equal(lib.readUInt16LE(base + 12), 0);
  const row = base + 14 + index * 8, offset = fixed ? base + 14 + index * fixed : base + lib.readUInt32LE(row);
  const length = fixed || lib.readUInt32LE(row + 4);assert.ok(length > 0 && offset >= base + 14 && offset + length <= end);
  const bytes = lib.subarray(offset, offset + length), zero = bytes.indexOf(0);
  return new TextDecoder('gbk', {fatal: true}).decode(zero < 0 ? bytes : bytes.subarray(0, zero));
}

function expectedIdentity(personId, person, rom, nativeTitle) {
  const name = rom.names[personId], belong = person.Belong, previous = person.OldBelong;
  assert.ok(name.length > 0, 'The selected original person has a complete nonempty ROM name');
  assert.ok(Number.isInteger(belong) && (belong === 0 || belong === 65535 || belong >= 1 && belong <= rom.names.length), 'Original current allegiance is a known native person ID or sentinel');
  assert.ok(Number.isInteger(previous) && previous >= 0 && previous <= 65535, 'Original prior allegiance is U16');
  let ownership, nativeOwnership;
  if (belong === 0) {
    ownership = {kind: 'free', value: 0, personIndex: null, name: '', label: '在野'};
    nativeOwnership = rom.nativeLabels.free;
  } else if (belong === 65535) {
    ownership = {kind: 'captive', value: belong, personIndex: null, name: '', label: '俘虏'};
    nativeOwnership = rom.nativeLabels.captive;
  } else {
    const lord = belong === personId + 1, ownerName = rom.names[belong - 1];
    assert.ok(ownerName.length > 0, 'The actual current lord reference has a nonempty ROM name');
    ownership = {kind: lord ? 'lord' : 'owned', value: belong, personIndex: belong - 1, name: ownerName, label: lord ? '君主 · ' + ownerName : ownerName};
    nativeOwnership = lord ? rom.nativeLabels.king : ownerName;
  }
  if (previous > 0 && previous <= rom.names.length) assert.ok(rom.names[previous - 1].length > 0, 'The actual prior lord reference has a nonempty ROM name');
  const priorOwnership = previous === 0 ? '未记录（0）' : previous <= rom.names.length ? rom.names[previous - 1] : '原归属未知（码 ' + previous + '）';
  return {personId, period: rom.period, name, belong, oldBelong: previous, ownership, priorOwnership, nativeOwnership, nativeTitle};
}

function assertCurrent(sample, personId, expected) {
  const {world, native, state} = sample, menu = state.menu, ui = state.cityUi;
  assert.equal(world.people.length, 200);assert.equal(world.period, expected.period);
  assert.deepEqual(native.menu, menu, 'The sampled native and UI menu are the same complete current ticket');
  assert.ok(menu.active === 1 && menu.context === 1 && menu.kind === 3 && menu.idsValid === true);
  assert.ok(Number.isSafeInteger(menu.seq) && menu.seq > 0 && Number.isSafeInteger(menu.detailGeneration) && menu.detailGeneration > 0);
  assert.equal(menu.generation, menu.detailGeneration);assert.equal(native.generation, menu.detailGeneration);
  assert.equal(menu.count, menu.ids.length);assert.equal(menu.names.length, menu.count);
  assert.ok(Array.isArray(menu.packedNames) && menu.packedNames.length === menu.count && menu.packedNames.every(n => typeof n === 'string'));
  assert.ok(Number.isInteger(menu.itemLen) && menu.itemLen > 0 && menu.itemLen <= 64);
  assert.equal(new Set(menu.ids).size, menu.ids.length);
  assert.ok(menu.ids.every(id => Number.isInteger(id) && id >= 0 && id < world.people.length));
  assert.ok(Number.isInteger(menu.index) && menu.index >= 0 && menu.index < menu.count);
  assert.equal(menu.ids[menu.index], personId);assert.equal(menu.names[menu.index], expected.name);
  assert.equal(native.march.phase, 0);assert.equal(native.march.pick, 0);assert.equal(native.march.battlePick, 0);
  assert.equal(native.report.active, 0);assert.equal(native.qty.active, 0);
  assert.ok(ui.open === true && ui.showHd === true && ui.layer === 'deep' && !ui.sending && !ui.queueLen && !ui.personPagePending);
  const owner = ui.deepMenuOwner, detail = ui.personDetail, properties = ui.personProperties, p = native.person;
  assert.ok(owner && typeof owner.key === 'string' && owner.key.length > 0 && detail && properties && p);
  assert.equal(owner.context, 1);assert.equal(owner.kind, 3);assert.equal(owner.seq, menu.seq);assert.equal(owner.detailGeneration, menu.detailGeneration);
  for (const view of [detail, properties]) {
    assert.equal(view.ownerKey, owner.key);assert.equal(view.context, 1);assert.equal(view.kind, 3);
    assert.equal(view.seq, menu.seq);assert.equal(view.nativeIndex, menu.index);assert.equal(view.personIndex, personId);assert.equal(view.name, expected.name);
  }
  assert.equal(detail.corePresentation, 'default');assert.deepEqual(detail.ownership, expected.ownership);
  const identityRows = detail.groups.find(group => group.title === '身份与经历')?.rows;
  assert.ok(identityRows);assert.deepEqual(identityRows.filter(row => row[0] === '归属'), [['归属', expected.ownership.label]]);
  assert.deepEqual(identityRows.filter(row => row[0] === '原归属'), [['原归属', expected.priorOwnership]]);
  assert.equal(p.protocolVersion, 1);assert.equal(p.active, 1);assert.equal(p.custom, 0);
  assert.equal(p.context, 1);assert.equal(p.kind, 3);assert.equal(p.person, personId);assert.equal(p.index, menu.index);
  assert.equal(p.generation, menu.detailGeneration);assert.equal(p.detailGeneration, menu.detailGeneration);assert.equal(p.menuSeq, menu.seq);
  assert.equal(p.name, expected.name);assert.equal(p.propertyCount, 13);assert.equal(p.properties.length, 13);
  assert.equal(p.pageIndex, 0);assert.equal(p.pageStart, 0);assert.equal(p.pageComplete, 1);
  assert.ok(p.pageEnd > 0 && p.pageEnd <= p.propertyCount && Number.isSafeInteger(p.paintSeq) && p.paintSeq > 0);
  assert.equal(properties.generation, p.generation);assert.equal(properties.detailGeneration, p.detailGeneration);
  assert.equal(properties.pageIndex, 0);assert.equal(properties.pageStart, 0);assert.equal(properties.pageEnd, p.pageEnd);
  assert.equal(properties.pageComplete, true);assert.equal(properties.custom, false);assert.equal(properties.paintSeq, p.paintSeq);
  assert.equal(properties.propertyCount, 13);assert.equal(properties.properties.length, 13);
  const first = p.properties[0], uiFirst = properties.properties[0];
  assert.ok(first.captured === true && first.titleCaptured === true && first.valueCaptured === true);
  assert.equal(first.index, 0);assert.equal(first.title, expected.nativeTitle);assert.equal(first.value, expected.nativeOwnership);
  assert.equal(first.titlePaintSeq, p.paintSeq);assert.equal(first.valuePaintSeq, p.paintSeq);
  assert.equal(uiFirst.current, true);assert.equal(uiFirst.title, first.title);assert.equal(uiFirst.value, first.value);
  assert.ok(uiFirst.captured === true && uiFirst.titleCaptured === true && uiFirst.valueCaptured === true);
  assert.equal(uiFirst.titlePaintSeq, p.paintSeq);assert.equal(uiFirst.valuePaintSeq, p.paintSeq);
  assert.equal(world.people[personId].Belong, expected.belong);assert.equal(world.people[personId].OldBelong, expected.oldBelong);
}

// This function is serialized only as a fixed read-only DOM sampler; it never installs a hook or changes scroll/focus.
function identityDomSnapshot(selector, kind) {
  const binding = () => {
    const ui = BayeHdCityMenu.debugSnapshot();
    return {menu: baye.hd.menuItems(), properties: baye.hd.personProperties(), owner: ui.deepMenuOwner,
      detail: ui.personDetail, uiProperties: ui.personProperties, open: ui.open, showHd: ui.showHd,
      layer: ui.layer, sending: ui.sending, queueLen: ui.queueLen, personPagePending: ui.personPagePending, hidden: document.hidden};
  };
  const before = binding(), node = document.querySelector(selector);
  if (!node) return {missing: true, before, after: binding()};
  const rect = r => ({left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height});
  const geometry = (element, textNode = null) => {
    const bounds = rect(element.getBoundingClientRect()), clip = {left: 0, top: 0, right: innerWidth, bottom: innerHeight}, ancestors = [];
    let shown = true;
    for (let parent = element; parent; parent = parent.parentElement) {
      const s = getComputedStyle(parent), r = parent.getBoundingClientRect();
      if (parent.hidden || s.display === 'none' || s.visibility === 'hidden' || s.visibility === 'collapse' || Number(s.opacity) <= 0) shown = false;
      // Root normal-flow boxes do not clip fixed HD overlays; the viewport already supplies their clip.
      if (parent === document.body || parent === document.documentElement) continue;
      const x = /^(auto|scroll|hidden|clip)$/.test(s.overflowX), y = /^(auto|scroll|hidden|clip)$/.test(s.overflowY);
      if (!x && !y) continue;
      const sx = parent.offsetWidth ? r.width / parent.offsetWidth : 1, sy = parent.offsetHeight ? r.height / parent.offsetHeight : 1;
      const content = {left: r.left + parent.clientLeft * sx, top: r.top + parent.clientTop * sy};
      content.right = content.left + parent.clientWidth * sx;content.bottom = content.top + parent.clientHeight * sy;
      ancestors.push({tag: parent.tagName, id: parent.id, overflowX: s.overflowX, overflowY: s.overflowY, bounds: rect(r), clip: content});
      if (x) {clip.left = Math.max(clip.left, content.left);clip.right = Math.min(clip.right, content.right);}
      if (y) {clip.top = Math.max(clip.top, content.top);clip.bottom = Math.min(clip.bottom, content.bottom);}
    }
    const range = document.createRange();range.selectNodeContents(textNode || element);
    const lines = Array.from(range.getClientRects(), r => rect(r)).filter(r => r.width > 0 && r.height > 0);
    const style = getComputedStyle(element);
    return {text: element.textContent, rangeText: range.toString(), bounds, clip, ancestors, shown, lines,
      lineHits: lines.map(r => {const hit = document.elementFromPoint((r.left + r.right) / 2, (r.top + r.bottom) / 2);return !!hit && (hit === element || element.contains(hit));}),
      clientWidth: element.clientWidth, scrollWidth: element.scrollWidth, clientHeight: element.clientHeight, scrollHeight: element.scrollHeight,
      style: {whiteSpace: style.whiteSpace, overflowWrap: style.overflowWrap, textOverflow: style.textOverflow, lineClamp: style.getPropertyValue('-webkit-line-clamp')}};
  };
  const nameTarget = kind === 'heading' || kind === 'listName';
  const label = nameTarget ? null : node.querySelector(':scope > span'), value = nameTarget ? node : node.querySelector(':scope > strong');
  const group = nameTarget ? null : node.closest('.hd-city-menu-info-group');
  const directText = Array.from(node.childNodes).filter(n => n.nodeType === Node.TEXT_NODE);
  const nameNode = kind === 'listName' && directText.length === 1 ? directText[0] : null;
  const previewSibling = kind === 'listName' && node.parentElement?.classList.contains('hd-city-menu-preview-row') ? node.parentElement.querySelector('[data-hd-deep-preview]') : null;
  return {selector, kind, before, tag: node.tagName, id: node.id, text: node.textContent,
    groupTitle: group?.querySelector('h3')?.textContent ?? null, field: node.getAttribute('data-hd-person-property'),
    list: kind === 'listName' ? {index: node.getAttribute('data-hd-deep'), name: node.getAttribute('data-hd-deep-name'), personId: node.getAttribute('data-hd-deep-pind'),
      owner: node.getAttribute('data-hd-deep-owner'), context: node.getAttribute('data-hd-menu-context'), kind: node.getAttribute('data-hd-menu-kind'), seq: node.getAttribute('data-hd-menu-seq'),
      directText: directText.map(n => n.data), childNodeCount: node.childNodes.length, elementChildren: node.children.length} : null,
    current: node.getAttribute('data-hd-person-property-current'), titlePaintSeq: node.getAttribute('data-hd-person-property-title-paint-seq'),
    valuePaintSeq: node.getAttribute('data-hd-person-property-value-paint-seq'),
    propertiesPaintSeq: document.getElementById('hd-city-menu-person-properties-fields')?.getAttribute('data-hd-person-paint-seq'),
    corePresentation: document.getElementById('hd-city-menu-person-fields')?.getAttribute('data-hd-person-core-presentation'),
    row: geometry(node), label: label && geometry(label), value: value && geometry(value, nameNode),
    neighbors: kind === 'listName' ? [previewSibling].filter(Boolean).map(n => rect(n.getBoundingClientRect())) : kind === 'heading' ? [node.nextElementSibling?.querySelector('h3')].filter(Boolean).map(n => rect(n.getBoundingClientRect())) :
      [node.previousElementSibling, node.nextElementSibling].filter(n => n && (n.classList.contains('hd-city-menu-stat') || n.classList.contains('hd-city-menu-person-property-row'))).map(n => rect(n.getBoundingClientRect())),
    after: binding()};
}

const contains = (outer, inner) => inner.left >= outer.left - EPSILON && inner.top >= outer.top - EPSILON && inner.right <= outer.right + EPSILON && inner.bottom <= outer.bottom + EPSILON;
const overlaps = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > EPSILON && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > EPSILON;

function assertGeometry(g, text, label) {
  assert.ok(g && g.shown && g.lines.length > 0, label + ' is genuinely displayed');
  assert.equal(g.text, text, label + ' preserves the complete text');assert.equal(g.rangeText, text);
  for (const r of [g.bounds, ...g.lines]) {
    assert.ok(['left', 'top', 'right', 'bottom', 'width', 'height'].every(k => Number.isFinite(r[k])) && r.width > 0 && r.height > 0);
    assert.ok(contains(g.clip, r), label + ' remains inside the viewport and every clipping ancestor');
  }
  for (const r of g.lines) assert.ok(contains(g.bounds, r), label + ' text remains inside its own box');
  assert.ok(g.lineHits.every(Boolean), label + ' has no covering element on its displayed lines');
  assert.ok(g.clientWidth > 0 && g.scrollWidth <= g.clientWidth + EPSILON, label + ' has no horizontal text overflow');
  assert.ok(g.clientHeight > 0 && g.scrollHeight <= g.clientHeight + EPSILON, label + ' has no clipped text height');
  assert.notEqual(g.style.textOverflow, 'ellipsis');assert.ok(!g.style.lineClamp || ['none', '0'].includes(g.style.lineClamp), label + ' is not line-clamped');
}

export async function checkPersonIdentity(ctx, driver, entry, personId, rom) {
  const {evaluate, until, readKeys, libBytes} = ctx;
  const lib = Buffer.from(libBytes);assert.equal(lib.length, 207195);assert.equal(createHash('sha256').update(lib).digest('hex'), ORIGINAL_SHA);
  assert.ok(Number.isInteger(personId) && personId >= 0 && personId < 200);
  assert.ok(rom && Array.isArray(rom.names) && rom.names.length === 200 && rom.names.every(n => typeof n === 'string'));
  assert.ok(Number.isInteger(rom.period) && rom.period >= 1 && rom.period <= 4);
  for (const key of ['king', 'free', 'captive']) assert.ok(typeof rom.nativeLabels?.[key] === 'string' && rom.nativeLabels[key].length > 0);
  assert.ok(entry && !entry.identity, 'One identity evidence record per independently selected focus');
  const evidence = entry.identity = {personId, accepted: false, observations: []};
  await until('current original person identity and complete native first page', `(() => {const m=baye.hd.menuItems(),p=baye.hd.personProperties(),u=BayeHdCityMenu.debugSnapshot();return m.active===1&&m.context===1&&m.kind===3&&m.idsValid&&m.ids[m.index]===${personId}&&p.active===1&&p.person===${personId}&&p.pageIndex===0&&p.pageStart===0&&p.pageComplete===1&&u.personDetail?.personIndex===${personId}&&u.personDetail.corePresentation==='default'&&!u.sending&&!u.queueLen&&!u.personPagePending;})()`);
  const before = evidence.before = await driver.sample(), expected = evidence.expected = expectedIdentity(personId, before.world.people[personId], rom, originalOwnershipTitle(lib));
  assertCurrent(before, personId, expected);
  evidence.menuName = {index: before.state.menu.index, fullName: before.state.menu.names[before.state.menu.index],
    packedName: before.state.menu.packedNames[before.state.menu.index], itemLen: before.state.menu.itemLen,
    packedDiffersFromFullName: before.state.menu.packedNames[before.state.menu.index] !== expected.name,
    note: 'The original fixed-width packed name is retained as evidence, never used as the complete-name oracle'};
  const unchanged = async label => {
    const measured = await driver.sample(), keys = await readKeys(before.state.keyCount);
    assertCurrent(measured, personId, expected);assert.deepEqual(measured.native, before.native, label + ' preserves the complete sampled native owner/cursor/paint');
    assert.deepEqual(measured.world, before.world, label + ' preserves every measured world field');assert.deepEqual(keys, [], label + ' sends no native keys');
    assert.equal(measured.state.keyCount, before.state.keyCount);assert.equal(measured.state.touchCount, before.state.touchCount, label + ' sends no original LCD touches');
    return {sample: measured, keys};
  };
  const targets = [{kind: 'listName', selector: '#hd-city-menu-deep [data-hd-deep="' + before.state.menu.index + '"]'}, ...TARGETS];
  for (const target of targets) {
    const observation = {kind: target.kind, selector: target.selector};evidence.observations.push(observation);
    observation.reveal = await driver.reveal(target.selector, {control: false});assert.equal(observation.reveal.visible, true);
    observation.afterReveal = await unchanged(target.kind + ' genuine scroll');
    const dom = observation.dom = await evaluate('(' + identityDomSnapshot.toString() + ')(' + JSON.stringify(target.selector) + ',' + JSON.stringify(target.kind) + ')');
    assert.ok(dom && !dom.missing);assert.deepEqual(dom.before, dom.after, 'DOM read remains under one complete current owner and paint');
    assert.equal(dom.before.hidden, false);assert.equal(dom.before.open, true);assert.equal(dom.before.showHd, true);assert.equal(dom.before.layer, 'deep');
    assert.ok(!dom.before.sending && !dom.before.queueLen && !dom.before.personPagePending);
    assert.deepEqual(dom.before.menu, before.state.menu);assert.deepEqual(dom.before.properties, before.native.person);
    assert.deepEqual(dom.before.owner, before.state.cityUi.deepMenuOwner);assert.deepEqual(dom.before.detail, before.state.cityUi.personDetail);
    assert.deepEqual(dom.before.uiProperties, before.state.cityUi.personProperties);assert.equal(dom.corePresentation, 'default');
    if (target.kind === 'heading' || target.kind === 'listName') {
      if (target.kind === 'heading') {assert.equal(dom.tag, 'H2');assert.equal(dom.id, 'hd-city-menu-person-name');}
      else {
        assert.equal(dom.tag, 'BUTTON');assert.equal(dom.list.childNodeCount, 1);assert.equal(dom.list.elementChildren, 0);
        assert.deepEqual(dom.list.directText, [expected.name], 'The selected button contains one complete name text node, separate from its preview sibling');
        assert.equal(dom.list.index, String(before.state.menu.index));assert.equal(dom.list.name, expected.name);assert.equal(dom.list.personId, String(personId));
        assert.equal(dom.list.owner, before.state.cityUi.deepMenuOwner.key);assert.equal(dom.list.context, '1');assert.equal(dom.list.kind, '3');assert.equal(dom.list.seq, String(before.state.menu.seq));
      }
      assertGeometry(dom.value, expected.name, 'Full ROM person name in ' + target.kind);
    } else {
      const title = target.kind === 'nativeOwnership' ? expected.nativeTitle : target.kind === 'priorOwnership' ? '原归属' : '归属';
      const value = target.kind === 'ownership' ? expected.ownership.label : target.kind === 'priorOwnership' ? expected.priorOwnership : expected.nativeOwnership;
      assertGeometry(dom.label, title, target.kind + ' label');assertGeometry(dom.value, value, target.kind + ' value');
      assert.ok(!overlaps(dom.label.bounds, dom.value.bounds), 'Identity label and value boxes never overlap');
      for (const a of dom.label.lines) for (const b of dom.value.lines) assert.ok(!overlaps(a, b), 'Identity label and value text lines never overlap');
      if (target.kind === 'nativeOwnership') {
        assert.equal(dom.field, '0');assert.equal(dom.current, '1');assert.equal(Number(dom.titlePaintSeq), before.native.person.paintSeq);assert.equal(Number(dom.valuePaintSeq), before.native.person.paintSeq);
        assert.equal(Number(dom.propertiesPaintSeq), before.native.person.paintSeq);
      } else assert.equal(dom.groupTitle, '身份与经历');
    }
    for (const r of dom.neighbors) if (r.width > 0 && r.height > 0) assert.ok(!overlaps(dom.row.bounds, r), 'Identity target never overlaps an adjacent heading or row');
    observation.snapLabel = 'identity-person-' + personId + '-' + target.kind;
    observation.screenshot = await driver.snap(observation.snapLabel) ?? null;
    observation.afterScreenshot = await unchanged(target.kind + ' screenshot');
  }
  const final = await unchanged('Complete person identity inspection');evidence.after = final.sample;evidence.keys = final.keys;
  evidence.accepted = true;return evidence;
}
