import assert from 'node:assert/strict';

export function installMobileOpeningObserver(classic) {
  const log = window.__mobileOpening = { preparations: [], frames: [], keys: [], changes: [], touches: [], errors: [] };
  if (classic) localStorage.setItem('baye/mobileSystemUiMode', 'classic');
  let api, draws = null;
  function presentation() {
    const s = api.debugSnapshot();
    return { at: performance.now(), id: s.spe.id, active: s.spe.active, frame: s.spe.frameIndex,
      logicalValid: s.spe.frameValid, display: s.spe.display?.frameIndex, open: s.open, reason: s.fallbackReason,
      source: s.source, stamp: s.flushKey, state: document.body.dataset.hdMobileSpe };
  }
  for (const name of ['pointerdown', 'pointerup']) document.addEventListener(name, event => {
    if (api && window.baye?.hd?.ready()) log.touches.push({ ...presentation(), type: name,
      target: event.target.id, isPrimary: event.isPrimary, button: event.button,
      x: event.clientX, y: event.clientY });
  }, true);
  const originalDraw = CanvasRenderingContext2D.prototype.drawImage;
  CanvasRenderingContext2D.prototype.drawImage = function (image, ...rect) {
    const value = originalDraw.apply(this, arguments);
    if (draws && this.canvas.id === 'hd-spe-canvas' && image.tagName === 'IMG') {
      draws.push({ src: image.getAttribute('src'), rect });
    }
    return value;
  };
  Object.defineProperty(window, 'BayeHdSpe', { configurable: true, get: () => api, set(value) {
    api = value;
    const send = window.sendKey;
    window.sendKey = function (code) { log.keys.push(code); return send.apply(this, arguments); };
    const prepare = api.prepareStart;
    api.prepareStart = function (callback, options) {
      return prepare.call(this, function (result) {
        log.preparations.push({ result, keys: log.keys.length });
        return callback.apply(this, arguments);
      }, options);
    };
    const notify = api.onEngineSpe;
    api.onEngineSpe = function () {
      const value = notify.apply(this, arguments);
      if (window.baye?.hd?.ready()) {
        const sample = presentation();
        if ([3, 6].includes(sample.id) || log.changes.at(-1)?.active) log.changes.push(sample);
      }
      return value;
    };
    const flush = api.onLcdFlush;
    api.onLcdFlush = function () {
      draws = [];
      try {
        const value = flush.apply(this, arguments);
        if (!window.baye?.hd?.ready()) return value;
        const spe = baye.hd.spe(), maker = baye.hd.maker(), display = spe.display;
        if ((!spe.active || ![3, 6].includes(spe.id)) && !(maker.active && maker.phase === 'hold')) return value;
        const ui = api.debugSnapshot(), root = document.getElementById('hd-spe'), lcd = document.getElementById('lcd');
        log.frames.push({ at: performance.now(), id: maker.active ? 6 : spe.id, makerPhase: maker.phase, generation: spe.generation,
          event: display.eventId, frame: display.frameIndex, commit: display.commitSeq, bits: display.visibleFrames,
          nativeValid: display.frameValid === true && (spe.active ? spe.eventId === display.eventId : maker.sourceValid === true),
          source: ui.source, scale: ui.scale, open: ui.open, visible: getComputedStyle(root).display !== 'none',
          lcdVisible: getComputedStyle(lcd).visibility === 'visible', draws });
        return value;
      } catch (error) { log.errors.push(String(error)); throw error; }
      finally { draws = null; }
    };
  }});
}

const title = 'baye.hd.menuItems().active===1 && baye.hd.menuItems().context===4 && baye.hd.menuItems().kind===1';
const hold = 'baye.hd.maker().active && baye.hd.maker().phase==="hold"';
const hd = 'BayeHdSpe.getLcdPresentation()==="hd" && getComputedStyle(document.getElementById("hd-spe")).display!=="none"';
const lcd = 'getComputedStyle(document.getElementById("lcd")).visibility==="visible" && !BayeHdSpe.isOpen()';

function verifyFrames(observations, entry, expectHd) {
  const valid = observations.filter(sample => sample.id === entry.speId && sample.nativeValid && sample.commit > 0);
  assert.ok(valid.length, 'The original engine produced valid LCD display commits');
  const displayed = new Set();
  for (const sample of valid) {
    displayed.add(sample.frame);
    if (!expectHd) {
      assert.equal(sample.open, false);
      assert.equal(sample.draws.length, 0);
      assert.equal(sample.lcdVisible, true);
      continue;
    }
    assert.equal(sample.source, 'hd-assets');
    assert.equal(sample.open && sample.visible && !sample.lcdVisible, true, 'The current HD frame owns the visible surface');
    const activeUnits = entry.units.filter(unit => sample.bits[unit.frame >> 3] & (1 << (unit.frame & 7)));
    if (sample.draws.length) {
      assert.deepEqual(sample.draws, activeUnits.map(unit => {
        const picture = entry.pictures.find(p => p.picIndex === unit.picIndex), scale = sample.scale;
        return { src: picture.src, rect: [unit.x * scale, unit.y * scale, picture.logicalWidth * scale, picture.logicalHeight * scale] };
      }));
    }
  }
  if (expectHd) assert.ok(valid.some(sample => sample.draws.length), 'Witness actual draws of the mapped HD pictures');
  return { samples: valid.length, frames: [...displayed] };
}

export async function runMobileOpeningChecks(c) {
  const { report, openingCase, entries, evaluate, until, delay, metrics, checkpoint, buttonPoint, button, touches, tap } = c;
  const classic = openingCase === 'classic', skip = openingCase === 'skip';
  const openingHd = openingCase !== 'missing-opening' && !classic;
  const makerHd = openingCase !== 'missing-maker' && !classic;
  const keys = () => evaluate('__mobileOpening.keys');
  const currentTitle = async () => {
    await until('current native title', title, 12000);
    await until('animation released the title', '!BayeHdSpe.isOpen()');
  };
  const point = async selector => {
    const p = await buttonPoint(selector);
    assert.ok(p.width >= 44 && p.height >= 44, 'Current animation action has a full-size touch target');
    return p;
  };
  if (skip) {
    await until('first actual mobile HD opening', `baye.hd.spe().active && baye.hd.spe().id===3 && ${hd}`);
    await tap(await point('#hd-spe-skip'));
    await currentTitle();
    assert.deepEqual(await keys(), [39], 'One trusted opening tap produces one native Enter');
  } else {
    await currentTitle();
    assert.deepEqual(await keys(), [], 'Original opening reaches title naturally');
  }
  const afterOpening = await evaluate('__mobileOpening');
  assert.equal(afterOpening.preparations.length, 1);
  assert.equal(afterOpening.preparations[0].keys, 0);
  assert.equal(afterOpening.preparations[0].result.ready, openingHd);
  assert.equal(afterOpening.preparations[0].result.reason, classic ? 'classic' : openingHd ? 'assets-ready' : 'asset-load-failed');
  report.openingDisplay = verifyFrames(afterOpening.frames, entries[3], openingHd);
  if (!skip) assert.ok(report.openingDisplay.frames.includes(8), 'Natural opening reaches original final frame');
  await checkpoint('01-mobile-opening-title');

  if (classic) {
    const maker = await evaluate(`(() => {
      const config=baye.data.g_engineConfig.mainMenuButtonRects,rect=document.getElementById('lcd').getBoundingClientRect();
      const x=(Number(config[8])+Number(config[10]))/2,y=(Number(config[9])+Number(config[11]))/2;
      return {x:rect.left+x*rect.width/lcdWidth,y:rect.top+y*rect.height/lcdHeight};
    })()`);
    await tap(maker);
  } else {
    await button('#hd-system-ui [data-hd-sys="2"]');
  }
  await until('actual Maker scroll', 'baye.hd.spe().active && baye.hd.spe().id===6');
  const makerKeys = await keys();
  assert.deepEqual(makerKeys, classic ? [] : skip ? [39,35,35,39] : [35,35,39]);
  if (skip) {
    await until('actual Maker HD scroll progressed', `baye.hd.spe().display.frameIndex>=8 && ${hd}`);
    await tap(await point('#hd-spe-skip'));
  }
  await until('native Maker hold', hold, 16000);
  const owner = await evaluate('baye.hd.maker()');
  assert.equal(owner.returnEligible, true);
  assert.equal(owner.scrollEnd.reason, skip ? 'key' : 'complete');
  if (skip) assert.ok(owner.display.frameIndex < 95, 'Original skip keeps the actual partial credits frame');
  else assert.equal(owner.display.frameIndex, 95);
  await until('current credits surface', makerHd ? hd : lcd);
  await checkpoint('02-mobile-maker-hold');
  if (makerHd) {
    if (skip) {
      const back = await point('#hd-spe-return'), before = await keys();
      await touches('touchStart', [back]);
      await metrics(375, 667);
      await until('portrait shows original Maker LCD', lcd);
      await metrics(667, 375);
      await until('same Maker hold restored in landscape', hd);
      await touches('touchEnd');
      assert.deepEqual(await keys(), before, 'A return press is retired across orientation changes');
      assert.deepEqual(await evaluate('baye.hd.maker()'), owner);
      await checkpoint('03-mobile-maker-restored');
    }
    await tap(await point('#hd-spe-return'));
  } else {
    const target = await evaluate(`(() => {const r=document.getElementById('lcd').getBoundingClientRect();return {x:(r.left+r.right)/2,y:(r.top+r.bottom)/2};})()`);
    await tap(target);
  }
  await currentTitle();
  await delay(150);
  const evidence = await evaluate('__mobileOpening');
  assert.deepEqual(evidence.errors, []);
  assert.deepEqual(evidence.keys, [...makerKeys, ...(skip ? [39] : []), ...(makerHd ? [39] : [])]);
  report.makerDisplay = verifyFrames(evidence.frames, entries[6], makerHd);
  report.openingObservation = evidence;
  await checkpoint('04-mobile-maker-title-return');
}
