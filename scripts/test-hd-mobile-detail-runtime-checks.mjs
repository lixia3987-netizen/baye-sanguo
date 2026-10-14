import assert from 'node:assert/strict';
import test from 'node:test';
import { createMobileDetailRuntimeDriver } from './hd-mobile-preview-runtime-checks.mjs';

// Exercise the exported runtime driver, including its measured-world and DOM
// assertions. No browser, game input, or native state is supplied by this test.
function fixture(kind, { empty = false } = {}) {
  const person = kind === 3;
  const id = person ? 20 : 0;
  const name = person ? '吕布' : '方天画戟';
  const properties = [
    { index: 0, captured: 1, title: empty ? '' : '武力', value: empty ? '' : '110', titlePaintSeq: 17, valuePaintSeq: 17 },
    { index: 1, captured: 1, title: '状态', value: '正常', titlePaintSeq: 17, valuePaintSeq: 17 },
  ];
  const native = {
    active: 1, menuSeq: 23, index: 0, generation: 41, detailGeneration: 41,
    name, propertyCount: properties.length, pageStart: 0, pageEnd: properties.length,
    paintSeq: 17, pageIndex: 0, pageComplete: 1, complete: 1, properties,
    [person ? 'person' : 'tool']: id,
  };
  const ui = {
    ownerKey: 'detail-owner-23', seq: 23, context: 1, kind,
    generation: 41, detailGeneration: 41, nativeIndex: 0, name,
    [person ? 'personIndex' : 'toolIndex']: id,
    propertyCount: properties.length, pageStart: 0, pageEnd: properties.length,
    paintSeq: 17, pageIndex: 0,
    properties: properties.map((p, i) => ({
      ...p, current: true,
      title: person ? p.title : p.title || '属性 ' + (i + 1) + '（标题为空）',
      value: person ? p.value : p.value || '（空）',
    })),
  };
  const dom = {
    name, text: name + ' 资料',
    rows: properties.map((p, i) => ({
      index: i, current: '1',
      title: person ? p.title || '（空标题）' : ui.properties[i].title,
      value: person ? p.value || '（空）' : ui.properties[i].value,
    })),
  };
  const measured = {
    state: {
      touchCount: 0,
      menu: { active: 1, context: 1, kind, idsValid: true, seq: 23, generation: 7,
        detailGeneration: 41, index: 0, count: 1, ids: [id], names: [name] },
      cityUi: { deepMenuOwner: { key: 'detail-owner-23' },
        [person ? 'personProperties' : 'toolDetail']: ui },
    },
    native: { menuSeq: 23, city: 10 },
    world: { marker: 'measured original world', people: [{ id: 20, arms: 100 }] },
  };
  const entry = { baseline: structuredClone(measured), checks: [], scrollChecks: [] };
  const calls = { ready: 0, native: 0, dom: 0, world: 0 };
  const ctx = {
    label: 'detail-unit',
    ready: async () => { calls.ready++; return measured; },
    evaluate: async source => {
      if (source === '({person:baye.hd.personProperties(),goods:baye.hd.goods()})') {
        calls.native++;
        return { person: person ? native : { active: 0 }, goods: person ? { active: 0 } : native };
      }
      assert.ok(source.includes('const kind=' + kind + ',root=document.getElementById('), 'The actual driver requests its current DOM rows');
      calls.dom++;
      return dom;
    },
    worldSame: (before, after, message) => {
      calls.world++;
      assert.deepEqual(after.world, before.world, message);
    },
  };
  return { kind, native, ui, dom, measured, entry, calls, ctx };
}

async function attributes(f) {
  const driver = await createMobileDetailRuntimeDriver(f.ctx, f.entry);
  return driver.attributes(f.kind);
}

for (const kind of [3, 4]) {
  for (const empty of [false, true]) {
    test((kind === 3 ? 'PERSON' : 'GOODS') + (empty ? ' empty' : ' nonempty') + ' native/UI/DOM values follow the actual runtime contract', async () => {
      const f = fixture(kind, { empty });
      const result = await attributes(f);
      assert.equal(result.sample.attributes[kind === 3 ? 'person' : 'goods'], f.native);
      assert.equal(result.dom, f.dom);
      assert.deepEqual(f.calls, { ready: 1, native: 1, dom: 1, world: 1 });
      if (empty) {
        assert.equal(f.native.properties[0].value, '');
        assert.equal(f.ui.properties[0].value, kind === 3 ? '' : '（空）');
        assert.equal(f.dom.rows[0].value, '（空）');
        assert.equal(f.dom.rows[0].title, kind === 3 ? '（空标题）' : '属性 1（标题为空）');
      }
    });
  }
}

const rejects = [
  ['PERSON UI must retain the captured empty native string', 3, f => { f.ui.properties[0].value = '（空）'; }],
  ['PERSON DOM must display the empty-value placeholder', 3, f => { f.dom.rows[0].value = ''; }],
  ['GOODS UI must use its existing empty-value placeholder', 4, f => { f.ui.properties[0].value = ''; }],
  ['GOODS DOM must match the converted UI value', 4, f => { f.dom.rows[0].value = ''; }],
  ['a stale UI owner cannot validate current native properties', 3, f => { f.ui.ownerKey = 'previous-owner-21'; }],
];
for (const [name, kind, mutate] of rejects) {
  test(name, async () => {
    const f = fixture(kind, { empty: true });
    mutate(f);
    await assert.rejects(() => attributes(f), { code: 'ERR_ASSERTION' });
    assert.equal(f.calls.world, 1, 'Negative detail checks still pass through exact measured-world comparison');
  });
}
