import assert from 'node:assert/strict';
import { verifyNativePersonSelection } from './hd-city-person-navigation-checks.mjs';
import { verifyOriginalTroopTokenReward } from './hd-mobile-equipment-runtime-oracle.mjs';

export const rewardTokenScenarios = {
    mystic: { period: 1, lord: '公孙瓒', city: '北平', tool: 31, name: '太玄兵符', arm: '玄兵', stat: 'IQ', label: '智力' },
    water: { period: 2, lord: '孙策', city: '建业', tool: 32, name: '水战兵符', arm: '水军' },
    iron: { period: 4, lord: '孙权', city: '江夏', tool: 30, name: '铁骑兵符', arm: '极兵', stat: 'Force', label: '武力' }
};

const reportVisible = `(() => {
    const r=baye.hd.report(),s=BayeHdDialog.debugSnapshot();
    return r.active===1&&s.open&&!s.pass&&s.kind==='report'&&s.reportOwner?.seq===r.seq&&
        s.reportOwner?.inputSeq===r.inputSeq&&r;
})()`;

export async function runRewardTokenChecks(ctx) {
    const { spec, report, world, evaluate, until, click, key, chooseCityItem, reopenInterior,
        waitPlayerMap, observeNativeInputs, checkpoint, mobile, libBytes } = ctx;
    const cityIndex = report.cityIndex;
    const run = report.rewardToken = { spec, months: [], accepted: false };
    const keyCount = () => evaluate('__miniNativeInputs.keys.length');
    const keysSince = start => evaluate(`__miniNativeInputs.keys.slice(${start})`);
    const inventory = w => {
        const c = w.cities[cityIndex];
        return w.goodsQueue.slice(c.ToolQueue, c.ToolQueue + c.Tools);
    };
    const found = w => inventory(w).includes(0x8000 | spec.tool);
    const picker = (kind, priorSeq, label) => until(label, `(() => {
        const m=baye.hd.menuItems(),s=BayeHdCityMenu.debugSnapshot();
        return m.active===1&&m.context===1&&m.kind===${kind}&&m.seq!==${priorSeq}&&m.idsValid&&s.open&&s.showHd&&
            s.deepMenuOwner?.seq===m.seq&&s.deepMenuOwner.kind===m.kind&&m;
    })()`);
    const chooseRow = async (menu, id, field) => {
        const index = menu.ids.indexOf(id);
        assert.ok(index >= 0, 'Choose an item published by the original menu');
        const count = await keyCount();
        await click(`#hd-city-menu [data-hd-deep="${index}"][data-hd-deep-${field}="${id}"]`);
        return { index, count };
    };
    const waitReport = () => until('Current visible native report', reportVisible);
    const acknowledge = async r => {
        const count = await keyCount();
        await click('#hd-dialog [data-hd-dlg-ok]');
        await until('Native report retires after one confirmation', `(() => {
            const r=baye.hd.report();return r.active===0||r.seq!==${r.seq}||r.inputSeq!==${r.inputSeq};
        })()`);
        assert.deepEqual(await keysSince(count), [39]);
    };
    const originalDate = w => w.year * 12 + w.month;

    await observeNativeInputs();
    const initial = await world();
    assert.equal(initial.period, spec.period);
    assert.equal(initial.cities[cityIndex].Belong, initial.king + 1);
    assert.ok(inventory(initial).includes(spec.tool), 'This original period has the actual hidden token in the city');
    assert.ok(!found(initial));
    const height = await evaluate('Number(baye.data.g_screenHeight)');

    for (let month = 1; month <= 16 && !found(await world()); month++) {
        await reopenInterior('Dispatch original searches');
        const { menu: sub } = await chooseCityItem('搜寻', 'data-hd-sub', 2);
        let current = await picker(3, sub.seq, 'Current original Search person list');
        const before = await world();
        const residents = current.ids.filter(id => before.people[id].Thew >= 8)
            .sort((a, b) => before.people[b].IQ - before.people[a].IQ);
        const actors = residents.slice(0, Math.min(residents.length, current.count - 1));
        assert.ok(actors.length > 0, 'Keep at least one resident in the original city');
        const orders = [];
        for (const actor of actors) {
            const selection = await chooseRow(current, actor, 'pind');
            const speech = await waitReport();
            assert.equal(speech.kind, 2);
            assert.equal(speech.person, actor);
            verifyNativePersonSelection(current, selection.index, await keysSince(selection.count), height);
            await acknowledge(speech);
            current = await picker(3, current.seq, 'Original Search updates the available residents');
            const queued = await world();
            const order = queued.orders.findIndex(o => o.OrderId === 3 && o.City === cityIndex && o.Person === actor);
            assert.ok(order >= 0 && !current.ids.includes(actor));
            assert.equal(queued.orders[order].TimeCount, 0);
            assert.equal(queued.people[actor].Thew, before.people[actor].Thew - 8);
            orders.push({ actor, order });
        }
        await click('#hd-city-menu [data-hd-menu-back]');
        await waitPlayerMap('Original map before monthly settlement');
        const start = await keyCount();
        if (mobile) await click('#hd-mobile-system-open');
        else await key('Escape');
        await until('Current original strategy menu', `(() => {
            const m=baye.hd.menuItems(),s=BayeHdSystemUi.debugSnapshot();
            return m.active===1&&m.context===2&&m.kind===1&&m.names[0]==='策略结束'&&s.open&&!s.pending;
        })()`);
        assert.deepEqual(await keysSince(start), [40]);
        const expected = originalDate(before) + 1;
        const confirm = await keyCount();
        await click('#hd-system-ui [data-hd-sys="0"]');
        assert.deepEqual(await keysSince(confirm), [39]);
        const reports = [];
        for (let step = 0; step < 64; step++) {
            const next = await until('Original strategy month or its current report', `(() => {
                const d=baye.data,m=baye.hd.menuItems(),r=${reportVisible};
                if(baye.hd.fight().active||m.active&&m.context===5)return {campaign:m};
                if(r)return {report:r};
                return !m.active&&!baye.hd.report().active&&baye.hd.march().pick===1&&
                    Number(d.g_YearDate)*12+Number(d.g_MonthDate)===${expected}&&{map:true};
            })()`, 90000);
            assert.ok(!next.campaign, 'This Search route remains on the original strategy map');
            if (next.map) break;
            reports.push(next.report);
            await acknowledge(next.report);
        }
        await waitPlayerMap('Settled original map');
        const after = await world();
        assert.equal(originalDate(after), originalDate(before) + 1);
        for (const { actor } of orders) {
            assert.ok(!after.orders.some(o => o.OrderId === 3 && o.City === cityIndex && o.Person === actor));
            const c = after.cities[cityIndex];
            assert.ok(after.queue.slice(c.PersonQueue, c.PersonQueue + c.Persons).includes(actor));
        }
        if (found(after)) assert.ok(reports.some(r => actors.includes(r.person) && r.text.endsWith(spec.name)), 'Actual discovery report names the token');
        run.months.push({ year: after.year, month: after.month, orders, reports, found: found(after) });
        await checkpoint('token-search-month-' + month);
    }
    const stock = await world();
    assert.ok(found(stock), 'Original searches discovered the token within the bounded route');
    assert.equal(stock.tools[spec.tool].useflag, 1);
    await reopenInterior('Open discovered token inventory');
    const { menu: sub } = await chooseCityItem('赏赐', 'data-hd-sub', 2);
    const goods = await picker(4, sub.seq, 'Original reward inventory');
    const requirement = '使用后转为' + spec.arm + ' · ' + (spec.stat ? spec.label + '至少 106，' : '') + '需空装备栏';
    const summary = `#hd-city-menu [data-hd-deep][data-hd-deep-tool="${spec.tool}"] [data-hd-tool-summary]`;
    await until('Visible token requirement in the current inventory', `document.querySelector(${JSON.stringify(summary)})?.textContent===${JSON.stringify(requirement)}`);
    await checkpoint('token-inventory-requirement');
    const item = await chooseRow(goods, spec.tool, 'tool');
    const current = await picker(3, goods.seq, 'Native recipients for the selected token');
    assert.equal((await keysSince(item.count)).at(-1), 39);
    assert.deepEqual(await world(), stock);
    const personId = current.ids.find(id => {
        const p = stock.people[id];
        return id !== stock.king && (!p.Tool1 || !p.Tool2) && (spec.stat ? p[spec.stat] <= 105 : p.ArmsType !== 3);
    });
    assert.ok(Number.isInteger(personId));
    const status = spec.stat ? 'below' : 'eligible';
    const personSelector = `#hd-city-menu [data-hd-deep][data-hd-deep-pind="${personId}"]`;
    const readHints = (seq) => until('Current recipient hint and selected token title', `(() => {
        const title=document.querySelector('#hd-city-menu [data-hd-reward-tool="${spec.tool}"]');
        const row=document.querySelector(${JSON.stringify(personSelector)}),hint=row?.querySelector('[data-hd-reward-status="${status}"]');
        const first=document.querySelector('#hd-city-menu [data-hd-deep][data-hd-deep-pind]');
        const titleBounds=title?.getBoundingClientRect(),firstBounds=first?.getBoundingClientRect();
        return title?.textContent===${JSON.stringify('选择武将 · ' + spec.name + ' · ' + requirement)}&&
            document.getElementById('hd-city-menu-sub')?.textContent.includes('人物')&&
            titleBounds?.height>0&&firstBounds?.height>0&&titleBounds.bottom<=firstBounds.top+1&&
            hint&&row.dataset.hdMenuSeq===String(${seq})&&!row.disabled&&{title:title.textContent,hint:hint.textContent};
    })()`);
    run.hints = await readHints(current.seq);
    if (spec.stat) assert.equal(run.hints.hint, spec.label + ' ' + stock.people[personId][spec.stat] + ' · 未达到要求');
    await checkpoint('token-recipient-hints');
    const chosen = await chooseRow(current, personId, 'pind');
    const speech = await waitReport();
    verifyNativePersonSelection(current, chosen.index, await keysSince(chosen.count), height);
    const reportWorld = await world();
    if (spec.stat) {
        assert.equal(speech.kind, 1);
        assert.equal(speech.person, 65535);
        assert.equal(speech.text, '该将条件无法使用');
        assert.deepEqual(reportWorld, stock);
        await checkpoint('token-original-rejection');
        await acknowledge(speech);
        const retry = await picker(3, current.seq, 'Original recipient list returns after refusal');
        assert.deepEqual(retry.ids, current.ids);
        assert.deepEqual(await readHints(retry.seq), run.hints);
        await click('#hd-city-menu [data-hd-menu-back]');
        const returned = await picker(4, retry.seq, 'Same original token returns to inventory');
        assert.deepEqual(returned.ids, goods.ids);
        await click('#hd-city-menu [data-hd-menu-back]');
        await waitPlayerMap('Map after declining to award the token');
        assert.deepEqual(await world(), stock);
        run.outcome = 'rejected';
    } else {
        assert.equal(speech.kind, 2);
        assert.equal(speech.person, personId);
        await checkpoint('token-original-conversion');
        await acknowledge(speech);
        const empty = await waitReport();
        assert.equal(empty.text, '城中无道具');
        run.oracle = verifyOriginalTroopTokenReward({before:stock, after:await world(), reportWorld, cityIndex, personId, toolId:spec.tool, libBytes});
        await acknowledge(empty);
        await waitPlayerMap('Map after using the original token');
        run.outcome = 'converted';
    }
    await until('Reward picker and hints retire at the original map', `!BayeHdCityMenu.debugSnapshot().open &&
        !document.querySelector('#hd-city-menu [data-hd-reward-tool="${spec.tool}"]')?.getClientRects().length`);
    assert.deepEqual(await evaluate('__miniNativeInputs.touches'), []);
    run.personId = personId;
    run.personName = current.names[chosen.index];
    run.report = speech;
    run.accepted = true;
    await checkpoint('token-returned-map');
}
