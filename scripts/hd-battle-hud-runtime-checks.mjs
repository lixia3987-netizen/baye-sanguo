import assert from 'node:assert/strict';

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
    return {viewport:{width:innerWidth,height:innerHeight},fight:f,menu:m,
        native:{mode:d.g_FgtParam.Mode,day:d.g_FgtBoutCnt,limit:d.g_FgtBoutMax,weather:d.g_FgtWeather,food:d.g_FgtParam.MProvender,
            settings:{movie:d.g_LookMovie,speed:d.g_MoveSpeed,enemy:d.g_LookEnemy}},
        status:{...measure(status),fields:[...status.children].map(n=>({field:n.dataset.hdBattleStat,...measure(n)}))},
        focus:row&&{index:Number(row.dataset.hdBattleMenu),...measure(row)},scrollTop:list.scrollTop,
        settings:measure(element('hd-battle-settings-note')),guidance:measure(element('hd-battle-hud')),
        menuTitle:measure(element('hd-battle-menu-title'))};
})()`;

export function verifyBattleHud(sample, {visible = true, settings = false, mobileFocus = false} = {}) {
    assert.equal(sample.status.visible, visible, 'Battle status visibility follows the current surface');
    if (!visible) return;

    const {native, fight, status} = sample;
    assert.equal(fight.active, 1);
    assert.equal(fight.over, 0);
    assert.equal(native.mode, 1, 'The original player expedition owns these values');
    assert.equal(native.day, fight.bout);
    for (const key of ['day', 'limit', 'food']) assert.ok(Number.isInteger(native[key]) && native[key] >= 0);
    const weather = ['', '晴', '阴', '风', '雨', '冰雹'][native.weather];
    assert.ok(weather, 'Actual original weather code');
    assert.deepEqual(status.fields.map(({field, text}) => [field, text]), [
        ['day', `第${native.day}天 / 上限${native.limit}天`],
        ['weather', `天气 ${weather}`],
        ['food', `我方粮草 ${native.food}`]
    ]);
    assert.ok(status.fields.every(field => field.fits), 'Day, weather and player grain all fit on screen');

    if (settings) {
        assert.ok([6,8].includes(fight.inputKind));
        const {movie, speed, enemy} = native.settings;
        assert.ok([movie, speed, enemy].every(value => value === 0 || value === 1));
        const look = ['不看', '观看'];
        assert.equal(sample.settings.text,
            `当前设置：动画 ${look[movie]} · 移速 ${['快速', '慢速'][speed]} · 敌军移动 ${look[enemy]}`);
        assert.ok(sample.settings.fits, 'The current original settings are readable');
    }
    if (mobileFocus) {
        assert.equal(sample.focus?.index, sample.menu.index);
        assert.ok(sample.focus.fits && sample.focus.width >= 44 && sample.focus.height >= 44,
            'The current original menu row is fully visible and touchable');
        assert.ok(sample.guidance.fits && !sample.menuTitle.visible, 'One visible mobile menu heading keeps its guidance');
    }
}
