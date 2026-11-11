import assert from 'node:assert/strict';
import {summarizeFrames} from './hd-performance-metrics.mjs';

export async function measureIdleBattleBoard(evaluate, send, canvasId) {
    await send('Performance.enable');
    try {
        const metrics = async () => Object.fromEntries((await send('Performance.getMetrics')).metrics.map(({name, value}) => [name, value]));
        const before = await metrics();
        const sample = await evaluate(`(() => {
            const NativePromise=(async()=>{})().constructor;
            return new NativePromise(resolve=>{
                const canvas=document.getElementById(${JSON.stringify(canvasId)}),context=canvas.getContext('2d');
                const original=context.clearRect,startedAt=performance.now(),frames=[],paints=[];
                const viewport={width:innerWidth,height:innerHeight,dpr:devicePixelRatio};
                context.clearRect=function(){paints.push(performance.now());return original.apply(this,arguments);};
                function frame(time){
                    if(time>=startedAt)frames.push(time);
                    if(time-startedAt<1500){requestAnimationFrame(frame);return;}
                    context.clearRect=original;
                    resolve({viewport,startedAt,endedAt:performance.now(),frames,paints});
                }
                requestAnimationFrame(frame);
            });
        })()`);
        const after = await metrics();
        assert.ok(sample.frames.length>0, 'The foreground battle receives animation frames');
        return {browser: (await send('Browser.getVersion')).product, sample,
            frames: summarizeFrames(sample.frames, sample.startedAt, sample.endedAt),
            paints: summarizeFrames(sample.paints, sample.startedAt, sample.endedAt),
            scriptMs: (after.ScriptDuration-before.ScriptDuration)*1000,
            taskMs: (after.TaskDuration-before.TaskDuration)*1000};
    } finally {
        await send('Performance.disable');
    }
}

// Compare the actual rendered text and clipping with the original C fields.
export const battleHudObservation = `(() => {
    const d=baye.data,f=baye.hd.fight(),m=baye.hd.menuItems();
    const element=id=>document.getElementById(id);
    const measure=n=>{
        const r=n.getBoundingClientRect(),visible=n.checkVisibility({visibilityProperty:true,opacityProperty:true});
        const clip={left:0,top:0,right:innerWidth,bottom:innerHeight};
        for(let p=n.parentElement;p&&p!==document.body;p=p.parentElement){
            const s=getComputedStyle(p),b=p.getBoundingClientRect();
            if(s.overflowX!=='visible'){clip.left=Math.max(clip.left,b.left);clip.right=Math.min(clip.right,b.right);}
            if(s.overflowY!=='visible'){clip.top=Math.max(clip.top,b.top);clip.bottom=Math.min(clip.bottom,b.bottom);}
        }
        return {text:n.textContent,visible,width:r.width,height:r.height,
            fits:visible&&r.width>0&&r.height>0&&r.left>=clip.left-.5&&r.right<=clip.right+.5&&r.top>=clip.top-.5&&r.bottom<=clip.bottom+.5};
    };
    const status=element('hd-battle-context'),list=element('hd-battle-menu-list'),row=list.querySelector('.is-on');
    const settingRows=Array.from(list.querySelectorAll('[data-hd-battle-setting-value]'),n=>{
        const button=n.parentElement,b=button.getBoundingClientRect(),r=n.getBoundingClientRect();
        return {index:Number(button.dataset.hdBattleMenu),name:n.previousElementSibling.textContent,value:n.textContent,
            fitsRow:r.width>0&&r.height>0&&r.left>=b.left&&r.right<=b.right&&r.top>=b.top&&r.bottom<=b.bottom};
    });
    return {viewport:{width:innerWidth,height:innerHeight},fight:f,menu:m,
        native:{mode:d.g_FgtParam.Mode,cityIndex:d.g_FgtParam.CityIndex,
            cityName:f.active===1&&f.over===0?baye.getCityName(d.g_FgtParam.CityIndex):null,
            day:d.g_FgtBoutCnt,limit:d.g_FgtBoutMax,weather:d.g_FgtWeather,food:d.g_FgtParam.MProvender,
            settings:{movie:d.g_LookMovie,speed:d.g_MoveSpeed,enemy:d.g_LookEnemy}},
        status:{...measure(status),fields:[...status.children].map(n=>({field:n.dataset.hdBattleStat,...measure(n)}))},
        focus:row&&{index:Number(row.dataset.hdBattleMenu),...measure(row)},scrollTop:list.scrollTop,
        settings:measure(element('hd-battle-settings-note')),settingRows,guidance:measure(element('hd-battle-hud')),
        menuTitle:measure(element('hd-battle-menu-title'))};
})()`;

export function verifyBattleHud(sample, {visible = true, settings = false, mobileFocus = false, mode = 1} = {}) {
    assert.equal(sample.status.visible, visible, 'Battle status visibility follows the current surface');
    if (!visible) return;

    const {native, fight, status} = sample;
    assert.equal(fight.active, 1);
    assert.equal(fight.over, 0);
    assert.equal(native.mode, mode, 'The current original player battle owns these values');
    assert.equal(native.cityIndex, fight.cityIndex);
    assert.ok(native.cityName, 'Original name for the current battle city');
    assert.equal(native.day, fight.bout);
    for (const key of ['day', 'limit', 'food']) assert.ok(Number.isInteger(native[key]) && native[key] >= 0);
    const weather = ['', '晴', '阴', '风', '雨', '冰雹'][native.weather];
    assert.ok(weather, 'Actual original weather code');
    assert.deepEqual(status.fields.map(({field, text}) => [field, text]), [
        ['place', `${mode === 0 ? '守城' : '进攻'} · ${native.cityName}`],
        ['day', `第${native.day}天 / 上限${native.limit}天`],
        ['weather', `天气 ${weather}`],
        ['food', `我方粮草 ${native.food}`]
    ]);
    assert.ok(status.fields.every(field => field.fits), 'City, day, weather and player grain all fit on screen');

    if (settings) {
        assert.ok([6,8].includes(fight.inputKind));
        const {movie, speed, enemy} = native.settings;
        assert.ok([movie, speed, enemy].every(value => value === 0 || value === 1));
        const look = ['不看', '观看'];
        const speedLabel = ['快速', '慢速'][speed];
        if (fight.inputKind === 6) {
            assert.equal(sample.settings.visible, false);
            assert.deepEqual(sample.settingRows, [
                {index:2,name:'战斗动画',value:look[movie],fitsRow:true},
                {index:3,name:'移动速度',value:speedLabel,fitsRow:true},
                {index:4,name:'敌军移动',value:look[enemy],fitsRow:true}
            ]);
        } else {
            assert.deepEqual(sample.settingRows, []);
            assert.equal(sample.settings.text, `当前设置：动画 ${look[movie]} · 移速 ${speedLabel} · 敌军移动 ${look[enemy]}`);
            assert.ok(sample.settings.fits, 'The current original settings are readable');
        }
    }
    if (mobileFocus) {
        assert.equal(sample.focus?.index, sample.menu.index);
        assert.ok(sample.focus.fits && sample.focus.width >= 44 && sample.focus.height >= 44,
            'The current original menu row is fully visible and touchable');
        assert.ok(sample.guidance.fits && !sample.menuTitle.visible, 'One visible mobile menu heading keeps its guidance');
    }
}
