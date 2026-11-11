import assert from 'node:assert/strict';
import {campaignGeometrySource} from './hd-mobile-campaign-runtime-checks.mjs';

const nativeOwner = `({keys:__runtimeEngineInputs.length, touches:__campaignLcdTouches.length,
    fight:baye.hd.fight(), march:baye.hd.march(), menu:baye.hd.menuItems(), qty:baye.hd.qty()})`;

export function createMobileCampaignInputs({evaluate,until,touch,tap,report}) {
    async function pan(x,y,dx,dy) {
        const before=await evaluate(nativeOwner);
        await touch('touchStart',[{x,y}]);
        for(let i=1;i<=5;i++)await touch('touchMove',[{x:x+dx*i/5,y:y+dy*i/5}]);
        await touch('touchEnd');
        assert.deepEqual(await evaluate(nativeOwner),before,'Scrolling preserves the native owner and sends no input');
    }

    async function reveal(selector,{retired='false'}={}) {
        const probe=`(() => {
            if(${retired})return {retired:true};
            const g=${campaignGeometrySource(selector)};
            return g&&g.shown&&!g.disabled?g:null;
        })()`;
        for(let attempt=0;attempt<20;attempt++) {
            const g=await until('current mobile campaign element '+selector,probe);
            report.lastMobileControl=g;
            if(g.retired)return null;
            if(g.visible&&g.hit)return g;
            assert.ok(g.scroller,'Clipped campaign control has a real scroll container '+selector);
            const top=Math.max(g.scroller.top,g.clip.top),bottom=Math.min(g.scroller.bottom,g.clip.bottom);
            const right=Math.min(g.scroller.right,g.clip.right),left=Math.max(g.scroller.left,g.clip.left);
            const down=g.rect.bottom>g.clip.bottom;
            assert.ok(right-left>=44&&bottom-top>=44&&(down||g.rect.top<g.clip.top),'Control can be reached through its current scroll pane '+selector);
            const x=right-12,y=top+(bottom-top)*(down?.8:.2);
            await pan(x,y,0,(bottom-top)*.6*(down?-1:1));
        }
        throw Error('Current mobile campaign action never became visible '+selector);
    }

    async function click(selector,options) {
        const g=await reveal(selector,options);
        if(!g)return false;
        assert.ok(g.width>=44&&g.height>=44,'A visible mobile campaign action has a 44px touch target');
        await tap({x:g.x,y:g.y});
        return true;
    }

    async function city(index,ownerType='map') {
        const owner=`(() => {const h=BayeHdMobileMap.snapshot();return h.active&&h.ownerType===${JSON.stringify(ownerType)};})()`;
        await until('mobile '+ownerType+' owns the city touch',owner);
        const before=await evaluate(nativeOwner);
        assert.notEqual(await evaluate(`BayeHdOverworld.centerOnCity(${index})`),false);
        const point=await until('city '+index+' on the current mobile map',`(() => {
            if(!(${owner}))return null;
            const p=BayeHdOverworld.cityScreenPos(${index});
            return p&&document.elementFromPoint(p.clientX,p.clientY)===document.getElementById('hd-overworld-canvas')&&{x:p.clientX,y:p.clientY};
        })()`);
        assert.deepEqual(await evaluate(nativeOwner),before,'Centering the mobile map is presentation only');
        await tap(point);
    }

    async function tile(x,y) {
        for(let attempt=0;attempt<24;attempt++) {
            const board=await until('current interactive HD mobile board',`(() => {
                const h=BayeHdMobileBattle.debugSnapshot(),f=baye.hd.fight(),c=document.getElementById('hd-mobile-battle-canvas');
                if(h.presentation!=='hd'||!h.camera||h.inputKind!==f.inputKind||h.inputSeq!==f.inputSeq||
                    !BayeHdBattle.getInputTicket())return null;
                const r=c.getBoundingClientRect();return {camera:h.camera,center:{x:r.left+r.width/2,y:r.top+r.height/2}};
            })()`);
            const v=board.camera;
            assert.ok(v.cell>=44,'Current native battle cells fit a 44px touch target');
            if(x>=v.x&&x<v.x+v.cols&&y>=v.y&&y<v.y+v.rows) {
                const p={x:v.left+(x-v.x+.5)*v.cell,y:v.top+(y-v.y+.5)*v.cell};
                assert.equal(await evaluate(`document.elementFromPoint(${p.x},${p.y})===document.getElementById('hd-mobile-battle-canvas')`),true);
                await tap(p);
                return;
            }
            await pan(board.center.x,board.center.y,x<v.x?120:x>=v.x+v.cols?-120:0,y<v.y?90:y>=v.y+v.rows?-90:0);
        }
        throw Error('Native battle tile never became visible '+x+','+y);
    }

    return {click,reveal,city,tile};
}
