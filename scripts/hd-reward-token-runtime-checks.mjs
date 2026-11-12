import assert from 'node:assert/strict';
import { verifyNativePersonSelection } from './hd-city-person-navigation-checks.mjs';
import { verifyMobileReward, verifyOriginalCampaignReward, verifyOriginalTroopTokenReward } from './hd-mobile-equipment-runtime-oracle.mjs';

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

export const originalRewardWorldSource = `(() => {
    const d=baye.data, take=(o,keys)=>Object.fromEntries(keys.map(k=>[k,Number(o[k])]));
    const cityFields=['State','Belong','SatrapId','FarmingLimit','Farming','CommerceLimit','Commerce',
        'PeopleDevotion','AvoidCalamity','PopulationLimit','Population','Money','Food','MothballArms',
        'PersonQueue','Persons','ToolQueue','Tools'];
    const personFields=['OldBelong','Belong','Level','Force','IQ','Devotion','Character','Experience','Thew','ArmsType','Arms','Age'];
    return {period:Number(d.g_PIdx),king:Number(d.g_PlayerKing),year:Number(d.g_YearDate),month:Number(d.g_MonthDate),
        people:Array.from({length:baye.getPersonCount()},(_,index)=>{const p=d.g_Persons[index];
            return {index,...take(p,personFields),Tool1:Number(p.Equip[0]),Tool2:Number(p.Equip[1])};}),
        cities:Array.from({length:baye.hd.realm().total},(_,index)=>({index,...take(d.g_Cities[index],cityFields)})),
        queue:Array.from(d.g_PersonsQueue,Number),goodsQueue:Array.from(d.g_GoodsQueue,Number),
        fighters:Array.from(d.FIGHTERS,Number),fighterIndex:Array.from(d.FIGHTERS_IDX,Number),
        tools:Array.from({length:baye.getToolCount()},(_,i)=>take(d.g_Tools[i],['useflag','changeAttackRange','at','iq','move','arm'])),
        orders:Array.from(d.g_OrderQueue,o=>take(o,['OrderId','City','Person','Object','TimeCount','Food'])),
        config:take(d.g_engineConfig,['disableAllPersonReport'])};
})()`;

function cityInventory(world, cityIndex) {
    const { ToolQueue, Tools } = world.cities[cityIndex];
    return world.goodsQueue.slice(ToolQueue, ToolQueue + Tools);
}

function cityResidents(world, cityIndex) {
    const { PersonQueue, Persons } = world.cities[cityIndex];
    return world.queue.slice(PersonQueue, PersonQueue + Persons);
}

function rewardControls({evaluate, until, click, nativeKeys = '__miniNativeInputs.keys'}) {
    const keyCount = () => evaluate(`(${nativeKeys}).length`);
    const keysSince = start => evaluate(`(${nativeKeys}).slice(${start})`);
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
    return { keyCount, keysSince, picker, chooseRow, waitReport, acknowledge };
}

const originalDate = w => w.year * 12 + w.month;

async function settleOriginalMonth(ctx, controls, before) {
    const { until, click, key, waitPlayerMap, mobile } = ctx;
    const { keyCount, keysSince } = controls;
    await waitPlayerMap('Original map before monthly settlement');
    const start = await keyCount();
    if (mobile) await click('#hd-mobile-system-open');
    else await key('Escape');
    await until('Current original strategy menu', `(() => {
        const m=baye.hd.menuItems(),s=BayeHdSystemUi.debugSnapshot();
        return m.active===1&&m.context===2&&m.kind===1&&m.names[0]==='策略结束'&&s.open&&!s.pending;
    })()`);
    assert.deepEqual(await keysSince(start), [40]);
    const confirm = await keyCount();
    await click('#hd-system-ui [data-hd-sys="0"]');
    assert.deepEqual(await keysSince(confirm), [39]);
    return observeOriginalSettlement(ctx, controls, before);
}

async function observeOriginalSettlement(ctx, controls, before) {
    const { world, until, waitPlayerMap, onDefense } = ctx;
    const { acknowledge } = controls;
    const expected = originalDate(before) + 1;
    const reports = [];
    const defenses = [];
    for (let step = 0; step < 64; step++) {
        const next = await until('Original strategy month or its current report', `(() => {
            const d=baye.data,m=baye.hd.menuItems(),f=baye.hd.fight(),r=${reportVisible};
            if(m.active&&m.context===5)return {campaign:m};
            if(r)return {report:r};
            if(f.active&&(!${Boolean(onDefense)}||f.wait===1&&f.inputKind>0))return {campaign:m};
            return !f.active&&!m.active&&!baye.hd.report().active&&baye.hd.march().pick===1&&
                Number(d.g_YearDate)*12+Number(d.g_MonthDate)===${expected}&&{map:true};
        })()`, 90000);
        if (next.campaign) {
            assert.ok(onDefense && next.campaign.active && next.campaign.context === 5 && next.campaign.kind === 2,
                'An original battle interrupted the preparation month');
            defenses.push(await onDefense(next.campaign));
            continue;
        }
        if (next.map) break;
        reports.push(next.report);
        await acknowledge(next.report);
    }
    await waitPlayerMap('Settled original map');
    const after = await world();
    assert.equal(originalDate(after), expected);
    for (const defense of defenses) {
        defense.afterBelong = after.cities[defense.cityIndex].Belong;
        assert.notEqual(defense.afterBelong, defense.beforeBelong, 'The native undefended outpost changed hands');
    }
    return { after, reports };
}

async function searchOriginalCity(ctx, controls, cityIndex, selectActors) {
    const {world, evaluate, click, chooseCityItem, reopenInterior} = ctx;
    const {picker, chooseRow, waitReport, acknowledge, keysSince} = controls;
    await reopenInterior('Dispatch original searches', cityIndex);
    const {menu:sub} = await chooseCityItem('搜寻', 'data-hd-sub', 2);
    let current = await picker(3, sub.seq, 'Current original Search person list');
    const before = await world();
    const residents = current.ids.filter(id => before.people[id].Thew >= 8)
        .sort((a, b) => before.people[b].IQ - before.people[a].IQ);
    const actors = selectActors(residents, current.count - 1);
    assert.ok(actors.length > 0 && actors.length < current.count, 'Keep a resident in the original city');
    const height = await evaluate('Number(baye.data.g_screenHeight)');
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
        orders.push({actor, order});
    }
    await click('#hd-city-menu [data-hd-menu-back]');
    const {after, reports} = await settleOriginalMonth(ctx, controls, before);
    for (const {actor} of orders) {
        assert.ok(!after.orders.some(o => o.OrderId === 3 && o.City === cityIndex && o.Person === actor));
        assert.ok(cityResidents(after, cityIndex).includes(actor));
    }
    return {after, actors, orders, reports};
}

async function discoverOriginalTools(ctx, controls, cityIndex, tools, months) {
    const {world, checkpoint} = ctx;
    const found = (w, tool) => cityInventory(w, cityIndex).includes(0x8000 | tool.id);
    const allFound = w => tools.every(tool => found(w, tool));
    let stock = await world();
    assert.equal(stock.cities[cityIndex].Belong, stock.king + 1);
    assert.ok(tools.every(tool => cityInventory(stock, cityIndex).includes(tool.id)), 'Required tools start hidden in this original city');

    for (let month = 1; month <= 16 && !allFound(stock); month++) {
        const {after, actors, orders, reports} = await searchOriginalCity(ctx, controls, cityIndex,
            (residents, limit) => residents.slice(0, limit));
        for (const tool of tools.filter(tool => !found(stock, tool) && found(after, tool))) {
            assert.ok(reports.some(r => actors.includes(r.person) && r.text.endsWith(tool.name)), 'Actual discovery report names ' + tool.name);
        }
        stock = after;
        months.push({ year: after.year, month: after.month, orders, reports, found: allFound(after) });
        await checkpoint('token-search-month-' + month);
    }
    assert.ok(allFound(stock), 'Original searches discovered all required tools within the route');
    return stock;
}

export async function runRewardTokenChecks(ctx) {
    const { spec, report, world, evaluate, until, click, chooseCityItem, reopenInterior,
        waitPlayerMap, observeNativeInputs, checkpoint, libBytes } = ctx;
    const cityIndex = report.cityIndex;
    const run = report.rewardToken = { spec, months: [], accepted: false };
    const controls = rewardControls(ctx);
    const { picker, chooseRow, waitReport, acknowledge, keysSince } = controls;
    await observeNativeInputs();
    assert.equal((await world()).period, spec.period);
    const height = await evaluate('Number(baye.data.g_screenHeight)');
    const stock = await discoverOriginalTools(ctx, controls, cityIndex, [{id:spec.tool,name:spec.name}], run.months);
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

async function moveOriginalOfficers(ctx, controls, from, to, people, evidence, prefix = 'mystic') {
    const {world, until, click, chooseCityItem, reopenInterior, waitPlayerMap, checkpoint} = ctx;
    const {picker, chooseRow, waitReport, acknowledge, keysSince} = controls;
    const phase = n => until('Original Move phase ' + n, `(() => {
        const t=baye.hd.transfer();return t.active===1&&t.command===14&&t.phase===${n}&&t;
    })()`);

    await reopenInterior('Move the original officer', from);
    const {menu: sub} = await chooseCityItem('移动', 'data-hd-sub', 2);
    await phase(5);
    await acknowledge(await waitReport());
    await phase(6);
    await until('Destination in the original transfer ticket', `BayeHdCityMenu.getTransferTargetTicket()?.targets.includes(${to})`);
    await click(`#hd-city-menu [data-hd-transfer-target="${to}"]`);
    await until('Original transfer destination selected', `BayeHdCityMenu.getTransferPresentation()?.pendingTarget===${to}`);
    await click('#hd-city-menu [data-hd-transfer-confirm]');
    const transfer = await phase(1);
    assert.equal(transfer.target, to);
    let current = await picker(3, sub.seq, 'Original Move officer list');
    const departures = [];
    const height = await ctx.evaluate('baye.data.g_screenHeight');
    for (const person of people) {
        const chosen = await chooseRow(current, person, 'pind');
        await phase(8);
        const departure = await waitReport();
        assert.equal(departure.person, person);
        verifyNativePersonSelection(current, chosen.index, await keysSince(chosen.count), height);
        await acknowledge(departure);
        current = await picker(3, current.seq, 'Original Move list after dispatch');
        departures.push(departure);
    }
    await click('#hd-city-menu [data-hd-menu-back]');
    await waitPlayerMap('Original map after Move');
    let stock = await world();
    const isMove = o => o.OrderId === 14 && o.City === from && o.Object === to && people.includes(o.Person);
    const orders = stock.orders.filter(isMove);
    assert.deepEqual(orders.map(o => o.Person).sort((a, b) => a - b), [...people].sort((a, b) => a - b));
    assert.ok(people.every(person => !cityResidents(stock, from).includes(person)));
    evidence.move = people.length === 1 ? {order:orders[0], departure:departures[0], months:[]} : {orders, departures, months:[]};
    await checkpoint(prefix + '-move-queued');
    const travelMonths = Math.max(...orders.map(order => order.TimeCount));
    for (let month = 0; month <= travelMonths && stock.orders.some(isMove); month++) {
        const {after, reports} = await settleOriginalMonth(ctx, controls, stock);
        stock = after;
        evidence.move.months.push({year:stock.year, month:stock.month, reports});
    }
    assert.ok(!stock.orders.some(isMove) && people.every(person => cityResidents(stock, to).includes(person)),
        'Original Move arrives at the selected owned destination');
    await checkpoint(prefix + '-move-arrived');
}

async function awardOriginalTool(ctx, controls, cityIndex, personId, goods, tool, verifyReward = verifyMobileReward) {
    const {world, evaluate, until, checkpoint, libBytes} = ctx;
    const {picker, chooseRow, waitReport, acknowledge, keysSince} = controls;
    await chooseRow(goods, tool.id, 'tool');
    const current = await picker(3, goods.seq, 'Original recipients of ' + tool.name);
    const before = await world();
    if (tool.convert) {
        await until('HD shows the qualified original mystic recipient', `(() => {
            const title=document.querySelector('[data-hd-reward-tool="${tool.id}"]');
            const hint=document.querySelector('[data-hd-deep-pind="${personId}"] [data-hd-reward-status="eligible"]');
            return title?.textContent.includes('太玄兵符')&&hint?.textContent==='智力 108 · 符合条件';
        })()`);
        await checkpoint('mystic-token-recipient');
    }
    const chosen = await chooseRow(current, personId, 'pind');
    const report = await waitReport();
    assert.equal(report.kind, 2);
    assert.equal(report.person, personId);
    verifyNativePersonSelection(current, chosen.index, await keysSince(chosen.count), await evaluate('baye.data.g_screenHeight'));
    const reportWorld = await world();
    await acknowledge(report);
    const returned = await until('Original reward inventory or empty-stock report', `(() => {
        const m=baye.hd.menuItems(),s=BayeHdCityMenu.debugSnapshot(),r=${reportVisible};
        if(r)return {report:r};
        return m.active===1&&m.context===1&&m.kind===4&&m.seq!==${goods.seq}&&m.idsValid&&
            s.open&&s.showHd&&s.deepMenuOwner?.seq===m.seq&&{goods:m};
    })()`);
    const verify = tool.convert ? verifyOriginalTroopTokenReward : verifyReward;
    const oracle = verify({before, after:await world(), reportWorld, cityIndex, personId, toolId:tool.id, libBytes});
    return {returned, report, oracle};
}

async function leaveOutpostUndefended(ctx, controls, menu, preparationCity, personId) {
    const {world, until, click} = ctx;
    const {keyCount, keysSince} = controls;
    const defense = await until('Current original defender selection', `(() => {
        const m=baye.hd.menuItems(),d=BayeHdDialog.debugSnapshot(),owner=d.defenseOwner;
        const finish=document.querySelector('#hd-dialog [data-hd-defenders-finish][data-hd-defender-seq="${menu.seq}"]');
        return m.active===1&&m.context===5&&m.kind===2&&m.seq===${menu.seq}&&d.open&&d.kind==='defenders'&&
            owner?.seq===m.seq&&owner.selected.length===0&&finish&&
            owner.cityIndex===baye.hd.fight().cityIndex&&{cityIndex:owner.cityIndex,menuSeq:m.seq};
    })()`);
    const stock = await world();
    const residents = cityResidents(stock, defense.cityIndex);
    assert.notEqual(defense.cityIndex, preparationCity, 'Keep the city needed for this original route defended');
    assert.ok(!residents.includes(stock.king) && !residents.includes(personId), 'Leave only an outpost away from the ruler and the officer');
    assert.ok(!stock.orders.some(o => o.OrderId === 14 && o.Person === personId && o.City === defense.cityIndex),
        'Keep the transfer origin until the officer has arrived');
    const beforeBelong = stock.cities[defense.cityIndex].Belong;
    assert.equal(beforeBelong, stock.king + 1);
    const start = await keyCount();
    await click(`#hd-dialog [data-hd-defenders-finish][data-hd-defender-seq="${menu.seq}"]`);
    await until('Original defender selection retires', `(() => {
        const m=baye.hd.menuItems();return !m.active||m.seq!==${menu.seq};
    })()`);
    const keys = await keysSince(start);
    assert.deepEqual(keys, [40]);
    return {...defense, beforeBelong, selected:0, keys};
}

async function dispatchOriginalCanvass(ctx, controls, cityIndex, personId, targetId) {
    const {world, evaluate, chooseCityItem, reopenDiplomacy, waitPlayerMap} = ctx;
    const {picker, chooseRow, keysSince} = controls;
    await reopenDiplomacy('Dispatch original Canvass', cityIndex);
    const {menu:sub} = await chooseCityItem('招揽', 'data-hd-sub', 2);
    const actors = await picker(3, sub.seq, 'Original Canvass actors');
    const before = await world();
    const start = await evaluate('baye.hd.diplomacy()');
    assert.deepEqual([start.active,start.command,start.origin,start.phase],[1,16,cityIndex,1]);
    const height = await evaluate('baye.data.g_screenHeight');
    const actor = await chooseRow(actors, personId, 'pind');
    const targets = await picker(3, actors.seq, 'Original Canvass targets');
    const picking = await evaluate('baye.hd.diplomacy()');
    assert.deepEqual([picking.session,picking.phase,picking.actor],[start.session,2,personId]);
    verifyNativePersonSelection(actors, actor.index, await keysSince(actor.count), height);
    const target = await chooseRow(targets, targetId, 'pind');
    await waitPlayerMap('Original map after the Canvass dispatch');
    const targetKeys = await keysSince(target.count);
    verifyNativePersonSelection(targets, target.index, targetKeys, height);
    const receipt = await evaluate('baye.hd.diplomacy()');
    assert.deepEqual([receipt.active,receipt.session,receipt.phase,receipt.actor,receipt.target,receipt.commitResult],
        [0,start.session,5,personId,targetId,1]);
    const after = await world();
    const order = after.orders.findIndex(o => o.OrderId === 16 && o.City === cityIndex && o.Person === personId && o.Object === targetId);
    assert.ok(order >= 0 && !cityResidents(after, cityIndex).includes(personId));
    assert.equal(after.orders[order].TimeCount, 10);
    assert.equal(after.cities[cityIndex].Money, before.cities[cityIndex].Money - 50);
    assert.equal(after.people[personId].Thew, before.people[personId].Thew - 20);
    assert.deepEqual(after.people[targetId], before.people[targetId], 'Dispatch does not settle the target');
    assert.equal(originalDate(after), originalDate(before));
    return {cityIndex, personId, targetId, order, receipt, targetKeys};
}

export const yunnanOfficers = [
    {id:185,name:'通宵虫',arm:4},
    {id:186,name:'南方小鬼',arm:5}
];

async function treatOriginalOfficer(ctx, controls, cityIndex, personId) {
    const {world, evaluate, reopenInterior, chooseCityItem, click, waitPlayerMap} = ctx;
    const before = await world(), officer = before.people[personId], city = before.cities[cityIndex];
    assert.ok(city.Money >= 100 && personId !== before.king);
    await reopenInterior('Restore the original officer with 宴请', cityIndex);
    const {menu:sub} = await chooseCityItem('宴请', 'data-hd-sub', 2);
    const current = await controls.picker(3,sub.seq,'Original banquet recipient');
    const selection = await controls.chooseRow(current,personId,'pind');
    const speech = await controls.waitReport();
    assert.deepEqual([speech.kind,speech.person],[2,personId]);
    verifyNativePersonSelection(current,selection.index,await controls.keysSince(selection.count),
        await evaluate('Number(baye.data.g_screenHeight)'));
    await controls.acknowledge(speech);
    if (city.Money >= 200) {
        await controls.picker(3,current.seq,'Original banquet picker after payment');
        await click('#hd-city-menu [data-hd-menu-back]');
    } else {
        const notice = await controls.waitReport();
        assert.match(notice.text,/金钱不足|无足够金钱/);
        await controls.acknowledge(notice);
    }
    await waitPlayerMap('Original map after the banquet');
    const after = await world();
    const expected = {...before, cities:before.cities.slice(), people:before.people.slice()};
    expected.cities[cityIndex] = {...city,Money:city.Money - 100};
    expected.people[personId] = {...officer,Thew:Math.min(100,officer.Thew + 50),
        Devotion:Math.min(100,officer.Devotion + 1)};
    assert.deepEqual(after,expected,'The original banquet only spends money and restores the selected officer');
    return {cityIndex,personId,year:after.year,month:after.month,thewBefore:officer.Thew,
        thewAfter:after.people[personId].Thew,moneyBefore:city.Money,moneyAfter:after.cities[cityIndex].Money};
}

export async function runYunnanOfficerPreparation(ctx, home, cityIndex, envoyId, searchLimit) {
    const {world, report, evaluate, checkpoint, save} = ctx;
    const controls = rewardControls(ctx);
    let stock = await world();
    assert.deepEqual([stock.period,stock.king],[1,15]);
    const owner = stock.king + 1;
    const run = report.yunnanPreparation = {home,cityIndex,envoyId,officers:yunnanOfficers,
        diplomacyMonths:[],searchMonths:[],banquets:[],recruitments:[],defenses:[],accepted:false};
    const resident = (city, id) => cityResidents(stock, city).includes(id);
    const allied = (city, id) => stock.people[id].Belong === owner && resident(city,id);
    const checkCities = () => {
        assert.equal(stock.cities[home].Belong, owner, 'Original 刘焉 must still hold 成都');
        assert.equal(stock.cities[cityIndex].Belong, owner, 'Original 刘焉 must still hold 云南');
    };
    const preparation = {...ctx, onDefense:async menu => {
        const defense = await leaveOutpostUndefended(ctx, controls, menu, cityIndex, envoyId);
        run.defenses.push(defense);
        return defense;
    }};

    if (!report.yunnanResume) {
        const before = stock;
        assert.equal(stock.cities[cityIndex].Belong, 0);
        for (const {id,arm} of yunnanOfficers) {
            assert.ok(resident(cityIndex,id));
            assert.deepEqual([stock.people[id].Belong,stock.people[id].ArmsType],[0,arm]);
        }
        const occupation = await ctx.occupy();
        const {after,reports} = await observeOriginalSettlement(preparation, controls, before);
        stock = after;
        checkCities();
        const {party,order} = occupation;
        assert.ok(party.every(id => allied(cityIndex,id)));
        assert.ok(allied(home,stock.king), 'The ruler remained in 成都');
        assert.equal(stock.fighterIndex[order.Person], 0);
        assert.ok(!stock.orders.some(o => o.OrderId === 27 && o.City === home && o.Object === cityIndex));
        run.occupation = {...occupation,year:stock.year,month:stock.month,reports};
        await checkpoint('yunnan-occupied-map');
        run.occupiedSave = await save('yunnan-occupied', 0);
    }

    checkCities();
    if (report.yunnanResume?.stage === 'ready') {
        assert.ok(allied(cityIndex,envoyId));
        assert.ok(yunnanOfficers.every(({id,arm}) => allied(cityIndex,id) && stock.people[id].ArmsType === arm));
        run.accepted = true;
        return;
    }
    for (let month = 0; month < 30 && stock.people[envoyId].Belong !== owner; month++) {
        checkCities();
        const foreign = stock.people[envoyId].Belong;
        assert.ok(foreign > 0 && foreign <= stock.people.length && foreign !== envoyId + 1 &&
            stock.cities.some(c => c.Belong === foreign && resident(c.index,envoyId)),
            '糜芳 must be available in the original Canvass target list');
        const orders = [];
        for (const origin of [home,cityIndex]) {
            const residents = cityResidents(stock,origin).filter(id => stock.people[id].Belong === owner);
            const ranked = residents.slice().sort((a,b) => stock.people[b].IQ - stock.people[a].IQ);
            const officer = ranked.find(id => id !== stock.king);
            if (residents.length > 1 && officer !== undefined && stock.cities[origin].Money >= 150 &&
                ranked.every(id => stock.people[id].Thew < 20)) {
                run.banquets.push(await treatOriginalOfficer(ctx,controls,origin,officer));
                stock = await world();
            }
            const eligible = ranked.filter(id => stock.people[id].Thew >= 20);
            const budget = Math.min(residents.length - 1, Math.floor(stock.cities[origin].Money / 50));
            for (const actor of eligible.slice(0,Math.max(0,budget))) {
                orders.push(await dispatchOriginalCanvass(ctx,controls,origin,actor,envoyId));
            }
        }
        const {after,reports} = await settleOriginalMonth(preparation, controls, stock);
        stock = after;
        for (const {cityIndex:origin,personId:actor} of orders) {
            assert.ok(!stock.orders.some(o => o.OrderId === 16 && o.Person === actor && o.Object === envoyId));
            assert.ok(allied(origin,actor));
        }
        if (orders.length) assert.ok(reports.some(r => r.person === envoyId));
        run.diplomacyMonths.push({year:stock.year,month:stock.month,orders,reports,envoy:stock.people[envoyId]});
        if (month === 0 || (month + 1) % 6 === 0) await checkpoint('yunnan-canvass-month-' + (month + 1));
    }
    assert.equal(stock.people[envoyId].Belong, owner, 'Original Canvass must recruit 糜芳');
    if (!['envoy','search'].includes(report.yunnanResume?.stage)) {
        const origin = stock.cities.find(c => c.Belong === owner && allied(c.index,envoyId));
        assert.ok(origin, 'Find the original city where 糜芳 joined');
        run.envoyRecruitment = {year:stock.year,month:stock.month,cityIndex:origin.index,person:stock.people[envoyId]};
        await checkpoint('yunnan-envoy-recruited');
        if (origin.index !== cityIndex) {
            await moveOriginalOfficers(preparation,controls,origin.index,cityIndex,[envoyId],run,'yunnan-envoy');
            stock = await world();
        }
        assert.ok(allied(cityIndex,envoyId));
        run.envoySave = await save('yunnan-envoy-arrived', 1);
        await checkpoint('yunnan-envoy-saved');
    }

    for (let month = 0; month < searchLimit && !yunnanOfficers.every(({id}) => allied(cityIndex,id)); month++) {
        checkCities();
        assert.ok(allied(cityIndex,envoyId), '糜芳 remains available to search 云南');
        const remaining = yunnanOfficers.filter(({id}) => !allied(cityIndex,id));
        for (const {id} of remaining) {
            assert.ok(resident(cityIndex,id) && stock.people[id].Belong === 0, 'Unrecruited original officer stays in 云南');
        }
        if (stock.people[envoyId].Thew < 8 && stock.cities[cityIndex].Money >= 100) {
            run.banquets.push(await treatOriginalOfficer(ctx,controls,cityIndex,envoyId));
            stock = await world();
        }
        const search = stock.people[envoyId].Thew >= 8
            ? await searchOriginalCity(preparation, controls, cityIndex, (residents, limit) => {
                assert.ok(residents.includes(envoyId), 'The original Search picker includes 糜芳');
                return [envoyId,...residents.filter(id => id !== envoyId)].slice(0,limit);
            })
            : {...await settleOriginalMonth(preparation,controls,stock),orders:[]};
        stock = search.after;
        const {orders,reports} = search;
        const sample = {year:stock.year,month:stock.month,orders,reports,envoyThew:stock.people[envoyId].Thew};
        run.searchMonths.push(sample);
        for (const {id,name,arm} of remaining) {
            if (!allied(cityIndex,id)) continue;
            assert.ok(reports.some(r => r.person === envoyId && r.text.endsWith(name)) && reports.some(r => r.person === id),
                'Original discovery reports identify 糜芳 and the joining officer');
            assert.equal(await evaluate(`baye.hd.personArmType(${id})`), arm);
            run.recruitments.push({id,name,arm,...sample,person:stock.people[id]});
            await checkpoint('yunnan-officer-' + id + '-recruited');
        }
        if ((month + 1) % 12 === 0) await checkpoint('yunnan-search-month-' + (month + 1));
    }
    checkCities();
    assert.ok(allied(cityIndex,envoyId));
    const alliedOfficers = yunnanOfficers.filter(({id}) => allied(cityIndex,id)).map(({id}) => id);
    if (alliedOfficers.length < yunnanOfficers.length) {
        assert.ok(yunnanOfficers.every(({id}) => resident(cityIndex,id) && [0,owner].includes(stock.people[id].Belong)));
        run.progressSave = {...await save('yunnan-search-progress',2),alliedOfficers};
        await checkpoint('yunnan-search-progress-saved');
        assert.fail('Original Search has not yet recruited both special officers');
    }
    run.readySave = await save('yunnan-officers-recruited', 2);
    run.accepted = true;
    await checkpoint('yunnan-officers-saved');
}

export async function runEliteAttackPreparation(ctx, marchCity, discovery) {
    const {world, report, evaluate, checkpoint, save, reopenInterior, chooseCityItem, click, waitPlayerMap} = ctx;
    const controls = rewardControls(ctx);
    const {cityIndex, envoyId, personId} = discovery;
    const book = {id:17, name:'鬼谷子'};
    const guards = [{personId:31,targetArms:1900},{personId:32,targetArms:1800}];
    const guardIds = guards.map(guard => guard.personId);
    const run = report.elitePreparation = {discovery, marchCity, diplomacyMonths:[], searchMonths:[],
        garrison:[], defenses:[], accepted:false};
    let stock = await world();
    if (report.eliteResume?.stage === 'ready') {
        assert.ok(cityResidents(stock, marchCity).includes(personId));
        assert.equal(stock.people[personId].Belong, stock.king + 1);
        assert.equal(stock.people[personId].ArmsType, 4);
        run.accepted = true;
        return;
    }
    assert.deepEqual([stock.period,stock.king,stock.people[personId].Belong,stock.people[personId].ArmsType],[2,2,0,4]);
    assert.ok(cityResidents(stock, cityIndex).includes(personId));
    const owner = stock.king + 1;
    const preparation = {...ctx, onDefense:async menu => {
        const defense = await leaveOutpostUndefended(ctx, controls, menu, cityIndex, envoyId);
        run.defenses.push(defense);
        return defense;
    }};

    for (let month = 0; !report.eliteResume && month < 16 && stock.people[envoyId].Belong !== owner; month++) {
        const originDate = stock;
        const orders = [];
        const batch = {startedYear:stock.year, startedMonth:stock.month, orders};
        run.diplomacyMonths.push(batch);
        for (const origin of [cityIndex, marchCity, 17]) {
            const city = stock.cities[origin];
            if (city.Belong !== owner || city.Money < 50) continue;
            const residents = cityResidents(stock, origin).filter(id => stock.people[id].Belong === owner);
            const eligible = residents.filter(id => id !== stock.king && stock.people[id].Thew >= 20)
                .sort((a, b) => stock.people[b].IQ - stock.people[a].IQ);
            const envoys = eligible.slice(0, Math.min(residents.length - 1, Math.floor(city.Money / 50)));
            for (const actor of envoys) orders.push(await dispatchOriginalCanvass(ctx, controls, origin, actor, envoyId));
        }
        if (month === 0 && orders.length) await checkpoint('elite-envoy-first-canvass');
        const {after, reports} = await settleOriginalMonth(preparation, controls, originDate);
        for (const {cityIndex:origin, personId:actor} of orders) {
            assert.ok(!after.orders.some(o => o.OrderId === 16 && o.Person === actor && o.Object === envoyId));
            assert.ok(cityResidents(after, origin).includes(actor));
        }
        if (orders.length) assert.ok(reports.some(r => r.person === envoyId), 'Original Canvass reports from 蔡中');
        stock = after;
        Object.assign(batch, {year:stock.year, month:stock.month, reports, envoyBelong:stock.people[envoyId].Belong});
        await checkpoint('elite-canvass-month-' + (month + 1));
    }
    assert.equal(stock.people[envoyId].Belong, owner, 'Original Canvass must recruit 蔡中');
    const envoyCity = stock.cities.find(c => c.Belong === owner && cityResidents(stock, c.index).includes(envoyId));
    assert.ok(envoyCity);
    if (!report.eliteResume) {
        run.envoyRecruitment = {year:stock.year, month:stock.month, cityIndex:envoyCity.index, person:stock.people[envoyId]};
        await checkpoint('elite-envoy-recruited');
        if (envoyCity.index !== cityIndex) {
            await moveOriginalOfficers(preparation, controls, envoyCity.index, cityIndex, [envoyId], run.envoyRecruitment, 'elite-envoy');
        }
        run.envoySave = await save('elite-envoy-arrived', 0);
        stock = await world();
    }
    assert.ok(cityResidents(stock, cityIndex).includes(envoyId));

    const alreadyEquipped = [stock.people[envoyId].Tool1, stock.people[envoyId].Tool2].includes(book.id + 1);
    for (let month = 0; month < 84 && stock.people[personId].Belong !== owner; month++) {
        assert.equal(stock.cities[marchCity].Belong, owner, 'Original campaign must still hold 徐州');
        assert.equal(stock.cities[cityIndex].Belong, owner, 'Original campaign must still hold 下邳');
        assert.ok(stock.people[envoyId].Belong === owner && cityResidents(stock, cityIndex).includes(envoyId),
            '蔡中 must remain an allied resident of 下邳');
        if (!alreadyEquipped && !run.book && cityInventory(stock, cityIndex).includes(0x8000 | book.id)) {
            await reopenInterior('Give 蔡中 the discovered original book', cityIndex);
            const {menu:sub} = await chooseCityItem('赏赐', 'data-hd-sub', 2);
            const inventory = await controls.picker(4, sub.seq, 'Original inventory with 鬼谷子');
            run.book = await awardOriginalTool(ctx, controls, cityIndex, envoyId, inventory, book, verifyOriginalCampaignReward);
            assert.deepEqual([run.book.oracle.stats.iqBefore, run.book.oracle.stats.iqAfter], [10,15]);
            if (run.book.returned.report) await controls.acknowledge(run.book.returned.report);
            else await click('#hd-city-menu [data-hd-menu-back]');
            await waitPlayerMap('Original map after awarding 鬼谷子');
            run.bookSave = await save('elite-envoy-equipped', 1);
            await checkpoint('elite-envoy-equipped');
            stock = await world();
        }
        const homeResident = id => stock.people[id].Belong === owner && cityResidents(stock, marchCity).includes(id);
        const nextGuard = guards.find(({personId:id,targetArms}) => homeResident(id) && stock.people[id].Arms < targetArms);
        const reinforcement = nextGuard && await ctx.fortify(marchCity, nextGuard, guardIds, month + 1);
        if (reinforcement) {
            run.garrison.push({year:stock.year,month:stock.month,...reinforcement});
            stock = await world();
        }
        // Slot 1 is available when the equipped envoy was restored into slot 0.
        if (!run.garrisonSave && alreadyEquipped && report.eliteResume?.stage !== 'garrison' &&
            guards.every(({personId:id,targetArms}) => homeResident(id) && stock.people[id].Arms >= targetArms)) {
            run.garrisonSave = {...await save('elite-home-garrison', 1),
                guards:guardIds.map(id => ({personId:id,arms:stock.people[id].Arms}))};
            await checkpoint('elite-home-garrison-saved');
        }
        const search = stock.people[envoyId].Thew >= 8
            ? await searchOriginalCity(preparation, controls, cityIndex, (residents, limit) => {
                assert.ok(residents.includes(envoyId), '蔡中 is present in the original Search picker');
                return [envoyId, ...residents.filter(id => id !== envoyId)].slice(0, limit);
            })
            : {...await settleOriginalMonth(preparation, controls, stock), orders:[]};
        const {after, orders, reports} = search;
        stock = after;
        for (const {recruiter} of reinforcement?.enlistments ?? []) {
            const id = recruiter.personIndex;
            assert.ok(!stock.orders.some(o => o.OrderId === 24 && o.City === marchCity && o.Person === id));
            assert.ok(homeResident(id), 'Original enlistment settles and returns its recruiter to 徐州');
        }
        const sample = {year:stock.year, month:stock.month, orders, reports, person:stock.people[personId]};
        run.searchMonths.push(sample);
        if ((month + 1) % 12 === 0) await checkpoint('elite-search-month-' + (month + 1));
        if (sample.person.Belong === owner) {
            assert.ok(reports.some(r => r.person === envoyId && r.text.endsWith('通宵虫')) &&
                reports.some(r => r.person === personId), 'Original discovery reports identify both people');
            assert.equal(sample.person.ArmsType, 4);
            assert.ok(cityResidents(stock, cityIndex).includes(personId));
            run.recruitment = sample;
        }
    }
    assert.ok(run.recruitment, 'The original Search must discover and recruit 通宵虫');
    await checkpoint('elite-officer-recruited');
    await moveOriginalOfficers(preparation, controls, cityIndex, marchCity, [personId], run, 'elite-officer');
    assert.equal(await evaluate(`baye.hd.personArmType(${personId})`), 4);
    run.readySave = await save('elite-officer-arrived', 2);
    run.accepted = true;
    await checkpoint('elite-preparation-complete');
}

export async function runMysticAttackPreparation(ctx, cityIndex, personId) {
    const {report, world, click, chooseCityItem, reopenInterior, waitPlayerMap, checkpoint} = ctx;
    const controls = rewardControls(ctx);
    const book = {id:11, name:'六韬'};
    const token = {id:31, name:'太玄兵符', convert:true};
    const from = 31;
    const start = await world();
    assert.deepEqual([start.period, start.king, start.people[personId].IQ, start.people[personId].ArmsType], [4, 1, 100, 1]);
    assert.ok(cityResidents(start, from).includes(personId));
    assert.equal(start.cities[from].Belong, start.king + 1);
    const run = report.mysticPreparation = {personId, from, cityIndex, months:[], defenses:[], accepted:false};
    const preparation = {...ctx, onDefense:async menu => {
        const defense = await leaveOutpostUndefended(ctx, controls, menu, cityIndex, personId);
        run.defenses.push(defense);
        return defense;
    }};
    await moveOriginalOfficers(preparation, controls, from, cityIndex, [personId], run);
    await discoverOriginalTools(preparation, controls, cityIndex, [book, token], run.months);
    await reopenInterior('Award the discovered original book and token', cityIndex);
    const {menu: sub} = await chooseCityItem('赏赐', 'data-hd-sub', 2);
    const goods = await controls.picker(4, sub.seq, 'Original inventory with 六韬 and 太玄兵符');
    const equipped = run.book = await awardOriginalTool(ctx, controls, cityIndex, personId, goods, book);
    assert.deepEqual([equipped.oracle.stats.iqBefore, equipped.oracle.stats.iqAfter], [100, 108]);
    assert.ok(equipped.returned.goods?.ids.includes(token.id));
    const converted = run.token = await awardOriginalTool(ctx, controls, cityIndex, personId, equipped.returned.goods, token);
    assert.deepEqual(converted.oracle.armsType, {before:1, after:5});
    if (converted.returned.report) {
        assert.equal(converted.returned.report.text, '城中无道具');
        await controls.acknowledge(converted.returned.report);
    } else {
        await click('#hd-city-menu [data-hd-menu-back]');
    }
    await waitPlayerMap('Original map after the mystic troop conversion');
    run.accepted = true;
    await checkpoint('mystic-preparation-complete');
}

export async function runMysticDefenderPreparation(ctx, from, target, personId, restoredOccupation) {
    const {world, report, checkpoint, evaluate, save} = ctx;
    const controls = rewardControls(ctx);
    const run = report.mysticDefender = {from, target, personId, months:[], defenses:[], accepted:false};
    let stock = await world();
    const playerBelong = stock.king + 1;
    assert.equal(stock.cities[from].Belong, playerBelong);
    const preparation = {...ctx, onDefense:async menu => {
        const defense = await leaveOutpostUndefended(ctx, controls, menu, from);
        run.defenses.push(defense);
        return defense;
    }};
    if (restoredOccupation) {
        run.occupation = restoredOccupation;
    } else {
        assert.equal(stock.cities[target].Belong, playerBelong);
        const movers = cityResidents(stock, target).filter(id => id !== personId && stock.people[id].Belong === playerBelong);
        assert.ok(movers.includes(stock.king) && cityResidents(stock, target).includes(personId));
        await moveOriginalOfficers(preparation, controls, target, from, movers, run, 'mystic-defender');
        stock = await world();
    }

    // Unselected residents become unaffiliated after occupation. The original
    // opponent's Search can then recruit 诸葛亮, whose native bole entry is zero.
    const monthLimit = 60;
    let occupiedAt = restoredOccupation ? 0 : null;
    for (let month = 0; ; month++) {
        const city = stock.cities[target], officer = stock.people[personId];
        const sample = {year:stock.year, month:stock.month, cityBelong:city.Belong,
            personBelong:officer.Belong, arm:officer.ArmsType, arms:officer.Arms};
        run.months.push(sample);
        assert.equal(stock.cities[from].Belong, playerBelong);
        assert.ok(stock.cities.some(city => city.Belong === playerBelong && cityResidents(stock, city.index).includes(stock.king)),
            'The original ruler remains in an owned city');
        assert.ok(cityResidents(stock, target).includes(personId), 'The actual officer is still in the target city');
        assert.equal(officer.ArmsType, 5);
        if (city.Belong !== playerBelong && !run.occupation) {
            assert.equal(officer.Belong, 0);
            assert.equal(officer.Arms, 0);
            assert.ok(run.defenses.some(defense => defense.cityIndex === target && defense.afterBelong === city.Belong));
            run.occupation = sample;
            occupiedAt = month;
            await checkpoint('mystic-defender-occupied');
            run.occupationSave = await save('mystic-defender-occupied', 0);
        }
        if (run.occupation && city.Belong && city.Belong !== playerBelong && officer.Belong === city.Belong) {
            if (!run.recruitment) {
                run.recruitment = sample;
                await checkpoint('mystic-defender-recruited');
            }
            if (officer.Arms > 0) {
                assert.equal(await evaluate(`baye.hd.personArmType(${personId})`), 5);
                run.readySave = await save('mystic-defender-equipped', 1);
                run.accepted = true;
                await checkpoint('mystic-defender-equipped');
                return;
            }
        }
        if (month - (occupiedAt ?? 0) >= monthLimit) break;
        stock = (await settleOriginalMonth(preparation, controls, stock)).after;
    }
    assert.fail(occupiedAt === null ? 'No original occupation within 60 preparation months' :
        'The opponent did not finish recruiting and arming the mystic defender within 60 months after occupation');
}
