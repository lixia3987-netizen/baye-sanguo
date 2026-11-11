import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

const ORIGINAL_BYTES = 207195;
const ORIGINAL_SHA256 = '3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e';
const NAME_RESOURCES = [62, 70, 71, 72];

/**
 * Decode only the exact original ROM, without invoking an engine or Mod hook.
 * Resource IDs follow consdef.h. Record offsets follow tactic.c loadPerson /
 * loadCity's sequential field copies (19 / 37 bytes), not C alignment guesses.
 * LoadPeriod later resets OldBelong, Thew and Arms; those are not ROM oracles.
 */
export function readOriginalPersonIdentityRom(libBytes, period = 4) {
  assert.ok(libBytes instanceof Uint8Array, 'Original library bytes must be a Uint8Array or Buffer');
  assert.ok(Number.isInteger(period) && period >= 1 && period <= 4, 'Original period must be 1..4');
  const bytes = Buffer.from(libBytes);
  assert.equal(bytes.length, ORIGINAL_BYTES, 'Exact original library size');
  assert.equal(createHash('sha256').update(bytes).digest('hex'), ORIGINAL_SHA256, 'Exact original library SHA256');
  const decoder = new TextDecoder('gbk', {fatal: true});

  function header(resource) {
    const start = bytes.readUInt32LE((resource - 1) * 4);
    assert.ok(start > 0 && start + 14 <= bytes.length, 'Original resource header ' + resource);
    const length = bytes.readUInt32LE(start);
    assert.equal(bytes.readUInt16LE(start + 4), resource, 'Original resource ID ' + resource);
    assert.ok(length >= 14 && start + length <= bytes.length, 'Original resource extent ' + resource);
    assert.equal(bytes[start + 12], 0, 'Original resource is unencrypted ' + resource);
    return {start, length, count: bytes.readUInt16LE(start + 6), fixed: bytes.readUInt32LE(start + 8)};
  }

  function item(resource, index) {
    const h = header(resource);
    assert.ok(Number.isInteger(index) && index >= 0 && index < h.count, 'Original resource item ' + resource + '/' + index);
    let offset, size;
    if (h.fixed) {
      offset = 14 + index * h.fixed;
      size = h.fixed;
    } else if (h.count === 1) {
      offset = 14;
      size = h.length - 14;
    } else {
      const tableEnd = 14 + h.count * 8;
      assert.ok(tableEnd <= h.length, 'Original resource directory ' + resource);
      offset = bytes.readUInt32LE(h.start + 14 + index * 8);
      size = bytes.readUInt32LE(h.start + 18 + index * 8);
      assert.ok(offset >= tableEnd, 'Original item follows its directory ' + resource + '/' + index);
    }
    // Unused name entries genuinely have zero-length payloads.
    assert.ok(offset >= 14 && offset + size <= h.length, 'Original item extent ' + resource + '/' + index);
    return bytes.subarray(h.start + offset, h.start + offset + size);
  }

  function text(resource, index) {
    const payload = item(resource, index), zero = payload.indexOf(0);
    const original = zero < 0 ? payload : payload.subarray(0, zero);
    return {name: decoder.decode(original), gbkBytes: original.length};
  }

  const nameTables = NAME_RESOURCES.map((resource, p) => {
    assert.equal(header(resource).count, 200, 'Original name count for period ' + (p + 1));
    return Array.from({length: 200}, (_, id) => {
      const value = text(resource, id);
      return {period: p + 1, id, name: value.name, codepoints: Array.from(value.name).length, gbkBytes: value.gbkBytes};
    });
  });
  const allPeriodMaxNameCodePoints = Math.max(...nameTables.flat().map(row => row.codepoints));
  const periodRows = nameTables[period - 1];
  const periodMaxNameCodePoints = Math.max(...periodRows.map(row => row.codepoints));
  assert.equal(allPeriodMaxNameCodePoints, 4, 'Original full-library longest actual name');
  assert.equal(periodMaxNameCodePoints, 4, 'Original selected-period longest actual name');

  assert.equal(header(61).count, 4, 'Original person periods');
  assert.equal(header(61).fixed, 3800, '200 packed original person records');
  const personData = item(61, period - 1);
  assert.equal(personData.length, 200 * 19, 'Sequential original Person record width');
  // OldBelong[0..1], Belong[2..3], Level/Force/IQ/Devotion[4..7],
  // Character/Experience/Thew/ArmsType[8..11], Arms[12..13],
  // Equip[14..17], Age[18]. Only stable ownership is needed here.
  const people = Array.from({length: 200}, (_, id) => ({Belong: personData.readUInt16LE(id * 19 + 2)}));
  assert.ok(people.every(p => p.Belong === 65535 || p.Belong >= 0 && p.Belong <= 200), 'Original person ownership domain');

  assert.equal(header(57).count, 4, 'Original city periods');
  assert.equal(header(57).fixed, 1408, '38 sequential original cities plus year');
  const cityData = item(57, period - 1);
  assert.equal(cityData.length, 38 * 37 + 2, 'Sequential original City record width');
  // State[0], Belong[1..2], Satrap[3..4], four U16 farming/commerce
  // fields[5..12], devotion/calamity[13..14], populations[15..22],
  // Money/Food/Mothball[23..28], PersonQueue[29..30], Persons[31..32],
  // ToolQueue[33..34], Tools[35..36].
  const cities = Array.from({length: 38}, (_, id) => ({
    Belong: cityData.readUInt16LE(id * 37 + 1),
    PersonQueue: cityData.readUInt16LE(id * 37 + 29),
    Persons: cityData.readUInt16LE(id * 37 + 31)
  }));
  assert.equal(header(65).count, 4, 'Original person-queue periods');
  const queueData = item(65, period - 1);
  assert.equal(queueData.length % 2, 0, 'Original queue uses U16 person IDs');
  // The ROM stores only queued entries, not every one of its 200 people.
  const queue = Array.from({length: queueData.length / 2}, (_, i) => queueData.readUInt16LE(i * 2));
  assert.ok(queue.every(id => id >= 0 && id < 200), 'Original queued person ID domain');
  for (const city of cities) {
    assert.ok(city.Belong >= 0 && city.Belong <= 200, 'Original city ownership domain');
    assert.ok(city.PersonQueue + city.Persons <= queue.length, 'Original city slice stays within stored queue');
  }
  assert.equal(header(58).count, 38, 'Original city-name count');
  const cityNames38 = Array.from({length: 38}, (_, id) => text(58, id).name);
  // sconst.h ATRR_STR67/68/69 are one-based STRING_CONST items 47/48/49.
  const nativeLabels = {king: text(64, 47).name, free: text(64, 46).name, captive: text(64, 48).name};
  return {
    period,
    names200: periodRows.map(row => row.name),
    nativeLabels,
    allPeriodMaxNameCodePoints,
    periodMaxNameCodePoints,
    cityNames38,
    people,
    cities,
    queue,
    maxNameRows: nameTables.flat().filter(row => row.codepoints === allPeriodMaxNameCodePoints)
  };
}
