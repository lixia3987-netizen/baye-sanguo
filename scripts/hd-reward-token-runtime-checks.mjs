import assert from 'node:assert/strict';
import { verifyNativePersonSelection } from './hd-city-person-navigation-checks.mjs';
import { verifyMobileReward, verifyOriginalTroopTokenReward } from './hd-mobile-equipment-runtime-oracle.mjs';

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
    const { world, until, click, key, waitPlayerMap, mobile, onDefense } = ctx;
    const { keyCount, keysSince, acknowledge } = controls;
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

async function discoverOriginalTools(ctx, controls, cityIndex, tools, months) {
    const { world, evaluate, click, chooseCityItem, reopenInterior, checkpoint } = ctx;
    const { picker, chooseRow, waitReport, acknowledge, keysSince } = controls;
    const found = (w, tool) => cityInventory(w, cityIndex).includes(0x8000 | tool.id);
    const allFound = w => tools.every(tool => found(w, tool));
    let stock = await world();
    assert.equal(stock.cities[cityIndex].Belong, stock.king + 1);
    assert.ok(tools.every(tool => cityInventory(stock, cityIndex).includes(tool.id)), 'Required tools start hidden in this original city');
    const height = await evaluate('Number(baye.data.g_screenHeight)');

    for (let month = 1; month <= 16 && !allFound(stock); month++) {
        await reopenInterior('Dispatch original searches', cityIndex);
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
        const { after, reports } = await settleOriginalMonth(ctx, controls, before);
        for (const { actor } of orders) {
            assert.ok(!after.orders.some(o => o.OrderId === 3 && o.City === cityIndex && o.Person === actor));
            assert.ok(cityResidents(after, cityIndex).includes(actor));
        }
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

async function moveOriginalOfficer(ctx, controls, from, to, person, evidence) {
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
    const current = await picker(3, sub.seq, 'Original Move officer list');
    const chosen = await chooseRow(current, person, 'pind');
    await phase(8);
    const departure = await waitReport();
    assert.equal(departure.person, person);
    verifyNativePersonSelection(current, chosen.index, await keysSince(chosen.count), await ctx.evaluate('baye.data.g_screenHeight'));
    await acknowledge(departure);
    await picker(3, current.seq, 'Original Move list after dispatch');
    await click('#hd-city-menu [data-hd-menu-back]');
    await waitPlayerMap('Original map after Move');
    let stock = await world();
    const isMove = o => o.OrderId === 14 && o.City === from && o.Object === to && o.Person === person;
    const order = stock.orders.find(isMove);
    assert.ok(order && !cityResidents(stock, from).includes(person));
    evidence.move = {order, departure, months: []};
    await checkpoint('mystic-move-queued');
    for (let month = 0; month <= order.TimeCount && stock.orders.some(isMove); month++) {
        const {after, reports} = await settleOriginalMonth(ctx, controls, stock);
        stock = after;
        evidence.move.months.push({year:stock.year, month:stock.month, reports});
    }
    assert.ok(!stock.orders.some(isMove) && cityResidents(stock, to).includes(person), 'Original Move arrives in the reward city');
    await checkpoint('mystic-move-arrived');
}

async function awardOriginalTool(ctx, controls, cityIndex, personId, goods, tool) {
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
    const verify = tool.convert ? verifyOriginalTroopTokenReward : verifyMobileReward;
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
    assert.notEqual(defense.cityIndex, preparationCity, 'Keep the original reward city defended');
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
    await moveOriginalOfficer(preparation, controls, from, cityIndex, personId, run);
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
