/** Original mobile SEARCH host. Reads observations and sends only the real opening key. */
(function (global) {
    'use strict';
    var SHA = '3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e';
    var ZERO = ['g_hdBattlePick','g_hdMenuActive','g_hdReportActive','g_hdQtyActive','g_hdFightActive',
        'g_hdHelpActive','g_hdRecordActive','g_hdMovieActive','g_hdSpeActive','g_hdSkillActive','g_hdAttackActive',
        'g_hdSkillResultActive','g_hdMakerActive','g_hdViewActive','g_hdGoodsActive','g_hdPersonPropertiesActive',
        'g_hdResultOwnerKind','g_hdResultOwnerValid'];
    var BASE = ['g_hdEngineReady','g_hdMapPick','g_hdMapCity','g_hdMapInputSeq','g_hdDetailGeneration',
        'g_hdSpeGeneration','g_hdMarchPhase','g_hdMarchSession','g_hdMarchInputSeq','g_hdTransferProtocolVersion','g_hdTransferActive'];
    var MINI = {ProtocolVersion:'protocolVersion',Active:'active',Complete:'complete',Custom:'custom',DefaultDraw:'defaultDraw',
        Seq:'seq',Generation:'generation',InputSeq:'mapInputSeq',ResourceId:'resourceId',ImageIndex:'imageIndex',
        Width:'width',Height:'height',Mask:'mask',CursorX:'cursorX',CursorY:'cursorY',ViewX:'viewX',ViewY:'viewY',
        ViewWidth:'viewWidth',ViewHeight:'viewHeight',City1:'city1'};
    function uint(n,max) { return Number.isInteger(n) && n >= 0 && n <= (max == null ? 0xffffffff : max); }
    function key(value) { return JSON.stringify(value); }
    function createController(environment) {
        var mounted=false,timer=null,arm=null,pending=null,epoch=0,busy=false,pointers={},blocked=false;
        var last=Object.freeze({active:false,openEnabled:false,owner:null,key:null});
        function doc() { return environment.document; }
        function node(id) { return doc() && doc().getElementById(id); }
        function available() {
            return !!(doc() && !doc().hidden && doc().body && doc().body.classList.contains('hd-mobile-page') &&
                (environment.matchMedia ? environment.matchMedia('(orientation: landscape)').matches : environment.innerWidth>environment.innerHeight));
        }
        function identity() {
            var api=environment.BayeHdLibIdentity;if(!api || typeof api.read!=='function' || typeof api.isCurrent!=='function')return null;
            var i=api.read();return i && i.status==='ready' && i.sha256===SHA && i.byteLength===207195 && uint(i.generation) && i.generation>0 && api.isCurrent(i)
                ? {status:i.status,sha256:i.sha256,byteLength:i.byteLength,generation:i.generation} : null;
        }
        function mode() { try{return environment.BayeHdOverworld.getMode()==='hd-map';}catch(e){return false;} }
        function raw(data) { var r={g_hdCityInfoActive:data.g_hdCityInfoActive};ZERO.concat(BASE).forEach(function(f){r[f]=data[f];});Object.keys(MINI).forEach(function(f){r['g_hdMiniMap'+f]=data['g_hdMiniMap'+f];});return r; }
        function neutralNative(data,r,n) {
            return n && (r.g_hdCityInfoActive===undefined || r.g_hdCityInfoActive===0) && ZERO.every(function(f){return r[f]===0;}) && BASE.every(function(f){return uint(r[f]);}) &&
                r.g_hdEngineReady===1 && r.g_hdMapPick===1 && uint(r.g_hdMapCity,38) && r.g_hdMapInputSeq>0 &&
                r.g_hdDetailGeneration>0 && r.g_hdSpeGeneration>0 && [0,7].indexOf(r.g_hdMarchPhase)>=0 &&
                r.g_hdTransferProtocolVersion===1 && r.g_hdTransferActive===0 &&
                Object.keys(MINI).every(function(f){return uint(r['g_hdMiniMap'+f]) && n[MINI[f]]===r['g_hdMiniMap'+f];}) &&
                n.protocolVersion===1 && n.active===1 && n.complete===1 && n.custom===0 && n.defaultDraw===1 && n.seq>0 &&
                n.generation===r.g_hdDetailGeneration && n.detailGeneration===r.g_hdDetailGeneration && n.mapInputSeq===r.g_hdMapInputSeq &&
                n.resourceId===75 && n.imageIndex===0 && n.width===84 && n.height===64 && n.mask===0 &&
                uint(n.cursorX,255) && uint(n.cursorY,255) && uint(n.viewX,255) && uint(n.viewY,255) &&
                uint(n.viewWidth,255) && n.viewWidth>0 && uint(n.viewHeight,255) && n.viewHeight>0 && n.city1===r.g_hdMapCity &&
                data.g_CityPos && data.g_CityPos.setx===n.cursorX && data.g_CityPos.sety===n.cursorY;
        }
        function readNative() {
            if(!available() || !mode())return null;
            try {
                var i=identity(),b=environment.baye,hd=b && b.hd;if(!i || !hd || hd.ready()!==true || typeof hd.miniMap!=='function')return null;
                var data=typeof b.ensureData==='function'?b.ensureData():b.data;if(!data)return null;
                var before=raw(data),n=hd.miniMap();if(!neutralNative(data,before,n))return null;
                var first=key([before,n]),after=raw(data),again=hd.miniMap();
                if(!neutralNative(data,after,again) || first!==key([after,again]) || key(i)!==key(identity()) ||
                    b!==environment.baye || b.data!==data || hd.ready()!==true || !available() || !mode() ||
                    data.g_hdCityInfoActive!==undefined && data.g_hdCityInfoActive!==0)return null;
                var ticket={native:Object.freeze(Object.assign({},again)),key:key([i,after,again]),libraryGeneration:i.generation};
                Object.defineProperty(ticket,'data',{value:data,enumerable:false});return Object.freeze(ticket);
            }catch(e){return null;}
        }
        function entry() {
            if(!available() || !mode())return null;
            try {
                var api=environment.BayeHdMobileMap,shared=environment.BayeHdOverworld;
                if(!api || typeof api.getInputTicket!=='function')return null;
                var t=api.getInputTicket(),s=shared.debugSnapshot();
                if(!t || t.ownerType!=='map' || !t.data || !t.key || s.presentationReady!==true || s.mode!=='hd-map' || s.phase!=='map')return null;
                var again=api.getInputTicket();return again && again.data===t.data && again.key===t.key ? again:null;
            }catch(e){return null;}
        }
        function same(a,b) { return !!a && !!b && a.data===b.data && a.key===b.key; }
        function cancel() { arm=null;epoch++; }
        function sendSearch(expected) {
            var now=entry();if(!same(expected,now) || pending)return false;
            var send=typeof environment.sendKey==='function'?environment.sendKey:environment.baye && environment.baye.sendKey;
            if(typeof send!=='function')return false;
            pending={ticket:now};send.call(environment,0x33);refresh();return true;
        }
        function refresh() {
            if(busy)return last;busy=true;
            try {
                var native=readNative(),map=entry();
                if(native || pending && map && !same(pending.ticket,map))pending=null;
                var shared=environment.BayeHdMiniMap;
                if(shared && typeof shared.poll==='function')shared.poll();
                var s=shared && shared.debugSnapshot(),active=!!(native && s && s.open && s.complete && !s.showLcd);
                last=Object.freeze({active:active,openEnabled:!!map&&!pending,owner:active?s.owner:null,key:active?native.key:map&&map.key||null});
                var open=node('hd-mobile-map-overview');if(open)open.disabled=!last.openEnabled;
                if(doc() && doc().body)doc().body.classList.toggle('hd-mobile-minimap-on',active);
                if(arm && !same(arm.ticket,map))cancel();return last;
            }finally{busy=false;}
        }
        function hit(event,target) {var top=doc().elementFromPoint(event.clientX,event.clientY);return top===target || target.contains(top);}
        function geometry(target) {var r=target.getBoundingClientRect();return key([r.left,r.top,r.width,r.height]);}
        function currentButton(target) {return target===node('hd-mobile-map-overview') && target.isConnected!==false;}
        function boundary() {cancel();pointers={};blocked=false;refresh();}
        function init() {
            if(mounted)return refresh();mounted=true;
            var shared=environment.BayeHdMiniMap;if(shared && typeof shared.attachMobileHost==='function')shared.attachMobileHost({available:available,readNative:readNative});
            if(shared && typeof shared.start==='function')shared.start();
            var button=node('hd-mobile-map-overview');
            if(button){
                button.addEventListener('pointerdown',function(ev){cancel();var t=entry();if(ev.isTrusted===true && !blocked && ev.isPrimary!==false && (ev.button==null || ev.button===0) && t && !pending && currentButton(button) && hit(ev,button))arm={id:ev.pointerId,ticket:t,epoch:epoch,x:ev.clientX,y:ev.clientY,target:button,rect:geometry(button)};});
                button.addEventListener('pointermove',function(ev){if(arm && arm.id===ev.pointerId && Math.hypot(ev.clientX-arm.x,ev.clientY-arm.y)>8)cancel();});
                button.addEventListener('pointerup',function(ev){var a=arm;arm=null;if(ev.isTrusted===true && !blocked && ev.isPrimary!==false && a && a.epoch===epoch && a.id===ev.pointerId && a.target===button && currentButton(button) && a.rect===geometry(button) && Math.hypot(ev.clientX-a.x,ev.clientY-a.y)<=8 && hit(ev,button)){ev.preventDefault();ev.stopPropagation();sendSearch(a.ticket);}});
                ['pointercancel','lostpointercapture'].forEach(function(name){button.addEventListener(name,cancel);});
                button.addEventListener('click',function(ev){ev.preventDefault();ev.stopPropagation();});
                button.addEventListener('keydown',function(ev){if(ev.key!=='Enter'&&ev.key!==' ')return;ev.preventDefault();ev.stopPropagation();cancel();var t=entry();if(ev.isTrusted===true&&!ev.repeat&&doc().activeElement===button&&t&&!pending)arm={ticket:t,epoch:epoch,key:ev.key};});
                button.addEventListener('keyup',function(ev){if(ev.key!=='Enter'&&ev.key!==' ')return;ev.preventDefault();ev.stopPropagation();var a=arm;arm=null;if(ev.isTrusted===true&&doc().activeElement===button&&a&&a.epoch===epoch&&a.key===ev.key)sendSearch(a.ticket);});
                button.addEventListener('blur',cancel);
            }
            if(doc() && doc().addEventListener){
                doc().addEventListener('visibilitychange',boundary);
                doc().addEventListener('scroll',boundary,true);
                doc().addEventListener('pointerdown',function(ev){pointers[ev.pointerId]=true;if(Object.keys(pointers).length>1 || ev.isPrimary===false){blocked=true;cancel();}else if(arm && arm.id!==ev.pointerId)cancel();},true);
                ['pointerup','pointercancel'].forEach(function(name){doc().addEventListener(name,function(ev){delete pointers[ev.pointerId];if(!Object.keys(pointers).length)blocked=false;},true);});
            }
            ['resize','orientationchange','blur','pagehide'].forEach(function(name){if(environment.addEventListener)environment.addEventListener(name,boundary);});
            if(environment.visualViewport && environment.visualViewport.addEventListener)environment.visualViewport.addEventListener('resize',boundary);
            var id=environment.BayeHdLibIdentity;if(id && typeof id.subscribe==='function')id.subscribe(boundary);
            timer=environment.setInterval(refresh,100);return refresh();
        }
        return Object.freeze({init:init,refresh:refresh,snapshot:function(){return last;},readNative:readNative,open:sendSearch});
    }
    var controller=createController(global);global.BayeHdMobileMiniMap=Object.freeze({init:controller.init,refresh:controller.refresh,
        snapshot:controller.snapshot,readNative:controller.readNative,createController:createController});
})(window);
