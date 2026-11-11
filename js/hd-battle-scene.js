/** Read-only, event-owned STACHG27 scene. Rendering never authorizes input. */
(function (global) {
    'use strict';
    var SHA = '3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e';
    var PEOPLE = { OldBelong:65535, Belong:65535, Level:255, Force:255, IQ:255, Devotion:255,
        Character:255, Experience:255, Thew:255, ArmsType:255, Arms:65535, Tool1:65535, Tool2:65535, Age:255 };
    var POS = { x:255, y:255, hp:65535, mp:65535, move:255, active:255, state:8 };
    var ARMS = ['骑','步','弓','水','极','玄'];
    function uint(v, max) { return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= max; }
    function require(ok, reason) { if (!ok) throw Error(reason); }
    function fields(obj, schema) {
        var out = {}; require(obj && typeof obj === 'object', 'missing-native-object');
        Object.keys(schema).forEach(function (k) { var v=obj[k]; require(uint(v,schema[k]),'invalid-native-'+k); out[k]=v; });
        return out;
    }
    function numbers(list, length, max) {
        require(list && list.length === length,'invalid-array-length');
        var out=[]; for(var i=0;i<length;i++){var v=list[i];require(uint(v,max),'invalid-array-byte');out.push(v);} return out;
    }
    function same(a,b) { return JSON.stringify(a) === JSON.stringify(b); }
    function samePlan(a,b) {
        return a.imageRefs.length===b.imageRefs.length && a.imageRefs.every(function(image,i){return image===b.imageRefs[i];}) &&
            same(Object.assign({},a,{imageRefs:null}),Object.assign({},b,{imageRefs:null}));
    }
    function createController(environment) {
        var env=environment || global, diagnostic={source:null,reason:'not-painted'}, busy=false;
        function identity() {
            var api=env.BayeHdLibIdentity, id=api && api.read();
            require(id && id.status==='ready' && id.sha256===SHA && id.byteLength===207195 &&
                uint(id.generation,0xffffffff) && id.generation>0 && api.isCurrent(id)===true,'unverified-original-lib');
            return {generation:id.generation,sha256:id.sha256,byteLength:id.byteLength};
        }
        function guard(options, id) {
            var b=env.baye, data=options.data;
            require(!env.document || env.document.hidden!==true,'hidden');
            require(b && data && b.data===data && b.hd && b.hd.ready()===true,'native-data-retired');
            require(typeof options.validateCurrent==='function' && options.validateCurrent()===true,'event-retired');
            require(b.data===data && same(identity(),id),'lib-or-data-retired');
            require(data.g_hdCityInfoActive===undefined || data.g_hdCityInfoActive===0,'city-info-owner');
        }
        function plan(options) {
            var e=options.event, s=options.source, entry=options.entry, assets=options.assets;
            require(e && s && entry && assets && assets.status==='ready','missing-effect');
            require(e.active===1 && e.protocolVersion===2 && e.id===27 && e.kind===4 && e.resourceIndex===0 &&
                e.protocolValid===true && e.frameValid===true && e.keyflag===0 && e.skipEligible===false &&
                uint(e.generation,0xffffffff) && e.generation>0 && uint(e.eventId,0xffffffff) && e.eventId>0 &&
                e.count===18 && e.picmax===9 && e.contextKnown===true && e.parentEventId===0 && e.depth===1 &&
                uint(e.frameIndex,17) && e.frameIndex>=e.startFrm && uint(e.commitSeq,0xffffffff) && e.commitSeq>0 && e.resourceLength===735 && e.resourceFingerprint==='fnv1a32:ba494eea:735','invalid-27-event');
            var ai=e.startFrm===12 && e.endFrm===17, reason=e.startFrm===0 && e.endFrm===5 ? 1 : e.startFrm===6 && e.endFrm===11 ? 2 : 0;
            require(ai || reason,'invalid-27-range');
            require(s.valid===true && s.protocolVersion===(ai?2:1),'invalid-source');
            require(ai ? entry.aiTargetVersion===2 && entry.statusVersion==null : entry.statusVersion===1 && entry.statusReason===reason && entry.aiTargetVersion==null,'wrong-entry-family');
            ['speId','kind','resourceIndex','startFrm','endFrm','count','picmax','resourceLength','resourceFingerprint'].forEach(function(k){
                require(entry[k]===e[k==='speId'?'id':k],'entry-event-mismatch');
            });
            require(entry.maskSemantics==='native-and-or-v1','wrong-mask-semantics');
            var d=e.display;
            require(d && d.generation===e.generation && d.eventId===e.eventId && d.frameValid===true &&
                uint(d.commitSeq,0xffffffff) && d.commitSeq>0 && d.commitSeq<=e.commitSeq &&
                uint(d.frameIndex,17) && d.frameIndex>=e.startFrm && d.frameIndex<=e.frameIndex && d.frameIndex<=e.endFrm,'invalid-display-ticket');
            require(s.screenWidth===160 && s.screenHeight===96 && s.regionWidth===16 && s.regionHeight===16 &&
                s.regionX===e.x && s.regionY===e.y,'invalid-source-region');
            var sourceFields=ai ? ['commandType','commandParam','actorIndex','targetIndex','actorPerson','targetPerson','actorX','actorY','targetX','targetY'] :
                ['reason','phase','subjectIndex','subjectPerson','subjectX','subjectY','beforeLevel','afterLevel','beforeExperience','afterExperience',
                 'beforeState','afterState','beforeHp','afterHp','beforeArms','afterArms','levelMax'];
            sourceFields=sourceFields.concat(['mapSX','mapSY','mapWidth','mapHeight','screenWidth','screenHeight','regionX','regionY','regionWidth','regionHeight']);
            var small={},published=ai?d.aiTarget:d.statusEffect,current=ai?e.aiTarget:e.statusEffect;
            require(published && current,'missing-published-source');
            sourceFields.forEach(function(k){require(uint(s[k],65535) && s[k]===published[k] && s[k]===current[k],'invalid-source-field');small[k]=s[k];});
            require(e.actorIndex===(ai?s.actorIndex:s.subjectIndex) && e.targetIndex===(ai?s.targetIndex:s.subjectIndex),'event-subject-mismatch');
            if(ai) require((s.commandType===0 && s.commandParam===0 || s.commandType===1 && s.commandParam>0) && s.actorIndex>=10 && s.actorIndex<20 && s.targetIndex<20,'invalid-ai-command');
            else require(s.reason===reason && (s.phase===1 || s.phase===2) && s.subjectIndex<20 && s.beforeState<8 &&
                s.beforeHp===s.afterHp && s.beforeArms===s.afterArms && (reason===1 ?
                    s.beforeExperience>=100 && s.afterExperience===s.beforeExperience-100 && s.afterLevel===Math.min((s.beforeLevel+1)&255,s.levelMax) && s.afterState===s.beforeState :
                    s.afterState===8 && (s.afterHp===0 || s.afterArms===0) && s.beforeLevel===s.afterLevel && s.beforeExperience===s.afterExperience),'invalid-status-transition');
            var x=ai?s.targetX:s.subjectX,y=ai?s.targetY:s.subjectY;
            require(s.mapWidth>=10 && s.mapWidth<=255 && s.mapHeight>=6 && s.mapHeight<=255 && s.mapSX+10<=s.mapWidth && s.mapSY+6<=s.mapHeight &&
                x>=s.mapSX && x<s.mapSX+10 && y>=s.mapSY && y<s.mapSY+6 && s.regionX===(x-s.mapSX)*16 && s.regionY===(y-s.mapSY)*16,'projection-outside-view');
            var bits=numbers(d.visibleFrames,32,255), clearBits=numbers(s.clearFrames,32,255), visible=[],clears=[];
            for(var f=0;f<256;f++){
                if(bits[f>>3]&(1<<(f&7)))visible.push(f);
                if(clearBits[f>>3]&(1<<(f&7)))clears.push(f);
            }
            [visible,clears].forEach(function(a){require(a.every(function(f){return f>=e.startFrm && f<=d.frameIndex;}),'invalid-frame-range');});
            require(same(visible,options.frames) && same(clears,options.clears) && visible.every(function(f){return clears.indexOf(f)<0;}),'frame-clear-mismatch');
            var pictures=[], imageRefs=[];
            visible.forEach(function(f){
                var u=entry.units && entry.units[f], expected=ai?(f%2?8:7):(reason===1?[2,3,4,1,0,1]:[2,3,4,6,5,6])[f-e.startFrm];
                require(u && u.frame===f && u.x===0 && u.y===0 && u.picIndex===expected,'invalid-frame-unit');
                var pic=entry.pictures && entry.pictures.filter(function(p){return p.picIndex===u.picIndex;});
                require(pic && pic.length===1,'missing-frame-picture');pic=pic[0];
                var image=assets.images && assets.images[u.picIndex];
                require(pic.mask===1 && pic.logicalWidth===16 && pic.logicalHeight===16 && typeof pic.src==='string' &&
                    uint(pic.width,16384) && pic.width>0 && uint(pic.height,16384) && pic.height>0 && image && image.complete!==false &&
                    (typeof image.naturalWidth==='number'?image.naturalWidth:image.width)===pic.width &&
                    (typeof image.naturalHeight==='number'?image.naturalHeight:image.height)===pic.height,'missing-effect-image');
                pictures.push({frame:f,picIndex:u.picIndex,white:numbers(pic.nativeWhitePixels,32,255),width:pic.width,height:pic.height,src:pic.src});imageRefs.push(image);
            });
            return {ai:ai,reason:reason,source:small,frames:visible,clears:clears,pictures:pictures,imageRefs:imageRefs,
                subject:{index:ai?s.targetIndex:s.subjectIndex,person:ai?s.targetPerson:s.subjectPerson,x:x,y:y}};
        }
        function observation(options,p,id) {
            guard(options,id);
            var b=env.baye,d=options.data,s=p.source,raw=fields(d,{g_hdEngineReady:1,g_hdDetailGeneration:0xffffffff,g_hdFightActive:1,
                g_hdFightOver:255,g_FgtOver:255,g_hdReportActive:1,g_hdMenuActive:1,g_hdHelpActive:1,g_hdViewActive:1,g_hdQtyActive:1,
                g_MapWid:255,g_MapHgt:255,g_MapSX:255,g_MapSY:255,g_PIdx:4});
            // Native INITIALIZE=2 runs inside FgtInit, before set_fight(1,0).
            require(raw.g_hdEngineReady===1 && raw.g_hdDetailGeneration===options.event.generation && raw.g_hdFightOver===0 && raw.g_FgtOver===0 &&
                raw.g_hdFightActive===(p.ai || s.phase===1?1:0) && raw.g_hdReportActive===0 && raw.g_hdMenuActive===0 &&
                raw.g_hdHelpActive===0 && raw.g_hdViewActive===0 && raw.g_hdQtyActive===0 && raw.g_PIdx>=1 &&
                raw.g_MapWid===s.mapWidth && raw.g_MapHgt===s.mapHeight && raw.g_MapSX===s.mapSX && raw.g_MapSY===s.mapSY,'wrong-native-owner');
            require(typeof b.getPersonCount==='function' && b.getPersonCount()===200,'non-original-person-count');
            require(d.g_Persons && uint(d.g_Persons.length,2000) && d.g_Persons.length>=200,'missing-person-array');
            var allMap=d.g_FightMapData;require(allMap && allMap.length===65536,'missing-full-map');
            var tiles=[];for(var t=0;t<s.mapWidth*s.mapHeight;t++){var tile=allMap[t];require(uint(tile,255) && tile>0,'unknown-map-tile');tiles.push(tile);}
            var ids=numbers(d.g_FgtParam && d.g_FgtParam.GenArray,20,65535),positions=d.g_GenPos,units=[],seen={};
            require(positions && positions.length===20,'missing-native-positions');
            for(var i=0;i<20;i++){
                var pos=fields(positions[i],POS), token=ids[i], unit={index:i,token:token,pos:pos};
                require(token===0 || token===65534 || token===65535 || token<=200,'out-of-range-person-token');
                if(token && token<=200){
                    require(!seen[token],'duplicate-person-token');seen[token]=true;
                    require(pos.x<s.mapWidth && pos.y<s.mapHeight,'unit-outside-map');
                    var person=fields(d.g_Persons[token-1],PEOPLE), equip=numbers(d.g_Persons[token-1].Equip,2,65535);
                    require(equip[0]===person.Tool1 && equip[1]===person.Tool2,'equipment-alias-mismatch');
                    var name=b.getPersonName(token-1),arm=b.hd.personArmType ? b.hd.personArmType(token-1) : b.getArmType(token-1);
                    require(typeof name==='string' && name.trim().length>0 && uint(arm,5),'missing-native-unit-label');
                    unit.person=person;unit.equip=equip;unit.name=name;unit.armType=arm;
                    guard(options,id);
                }
                units.push(unit);
            }
            function matchesUnit(index,person,x,y){var u=units[index];return u && u.token===person+1 && u.pos.x===x && u.pos.y===y;}
            if(p.ai) require(matchesUnit(s.actorIndex,s.actorPerson,s.actorX,s.actorY) && matchesUnit(s.targetIndex,s.targetPerson,s.targetX,s.targetY) &&
                units[s.actorIndex].pos.state<8 && units[s.targetIndex].pos.state<8,'ai-subject-mismatch');
            else {
                require(matchesUnit(s.subjectIndex,s.subjectPerson,s.subjectX,s.subjectY),'status-subject-mismatch');
                var sub=units[s.subjectIndex];require(sub.pos.state===s.afterState && sub.pos.hp===s.afterHp && sub.person.Arms===s.afterArms &&
                    sub.person.Level===s.afterLevel && sub.person.Experience===s.afterExperience,'status-world-mismatch');
            }
            var terrain=env.BayeHdBattleTerrain;require(terrain && typeof terrain.verifyLib==='function' && typeof terrain.paint==='function','missing-terrain-module');
            var trust=terrain.verifyLib(env.dynLib,b.hooks);
            require(trust && trust.verified===true && trust.libPath==='libs/dat-mod.lib' && trust.sha256===SHA && trust.generation===id.generation,'unverified-full-terrain');
            guard(options,id);
            return {raw:raw,personCapacity:d.g_Persons.length,ids:ids,units:units,tiles:tiles};
        }
        function paint(options) {
            if(busy){diagnostic={source:null,reason:'reentrant-paint'};return null;} busy=true;
            try {
                require(options && options.canvas && options.context,'missing-canvas');
                var canvas=options.canvas,ctx=options.context,w=canvas.width,h=canvas.height;
                require(uint(w,16384) && w>0 && uint(h,16384) && h>0 && Number.isInteger(w/160) && w/160===h/96,'unsupported-canvas-geometry');
                var id=identity(),p=plan(options),first=observation(options,p,id),second=observation(options,p,id);
                require(same(first,second),'torn-native-scene');
                var s=p.source,cw=w/10,ch=h/6,make=env.document && env.document.createElement;
                require(typeof make==='function','missing-offscreen-canvas');
                var stage=env.document.createElement('canvas'),effect=env.document.createElement('canvas');
                stage.width=w;stage.height=h;effect.width=cw;effect.height=ch;
                var out=stage.getContext('2d'),fx=effect.getContext('2d');require(out && fx,'missing-drawing-context');
                var terrainSnapshot={source:'full',width:s.mapWidth,height:s.mapHeight,stride:s.mapWidth,tiles:first.tiles,
                    libPath:'libs/dat-mod.lib',sha256:SHA,libGeneration:id.generation,session:options.event.eventId,mode:'hd',verified:true};
                require(env.BayeHdBattleTerrain.paint(out,{ox:0,oy:0,cw:cw,ch:ch,cols:10,rows:6,viewOx:s.mapSX,viewOy:s.mapSY,dpr:1},terrainSnapshot)===true,'terrain-draw-failed');
                var rendered=[];
                first.units.forEach(function(u){
                    if(!u.person || u.pos.state===8 || u.pos.x<s.mapSX || u.pos.x>=s.mapSX+10 || u.pos.y<s.mapSY || u.pos.y>=s.mapSY+6)return;
                    var x=(u.pos.x-s.mapSX)*cw,y=(u.pos.y-s.mapSY)*ch,pad=Math.max(1,cw*.05);
                    out.save();out.beginPath();out.rect(x,y,cw,ch);out.clip();
                    out.fillStyle=u.index<10?'#245b83':'#8b3e36';out.fillRect(x+pad,y+pad,cw-pad*2,ch-pad*2);
                    out.strokeStyle=u.index<10?'#8cc9ed':'#f1a397';out.lineWidth=Math.max(1,cw*.025);out.strokeRect(x+pad,y+pad,cw-pad*2,ch-pad*2);
                    out.fillStyle='#fff5db';out.textAlign='center';out.textBaseline='middle';
                    out.font='bold '+Math.max(8,Math.floor(ch*.24))+'px sans-serif';out.fillText(u.name,x+cw/2,y+ch*.27,cw-pad*3);
                    out.font=Math.max(7,Math.floor(ch*.19))+'px sans-serif';out.fillText(ARMS[u.armType]+' '+u.person.Arms,x+cw/2,y+ch*.65,cw-pad*3);
                    out.restore();rendered.push(u.index);
                });
                fx.clearRect(0,0,cw,ch);fx.imageSmoothingEnabled=true;
                p.pictures.forEach(function(pic,i){
                    for(var bit=0;bit<256;bit++)if(pic.white[bit>>3]&(1<<(bit&7)))fx.clearRect(bit%16*cw/16,Math.floor(bit/16)*ch/16,cw/16,ch/16);
                    fx.drawImage(p.imageRefs[i],0,0,cw,ch);
                });
                var region={x:(p.subject.x-s.mapSX)*cw,y:(p.subject.y-s.mapSY)*ch,width:cw,height:ch};
                out.drawImage(effect,region.x,region.y,cw,ch);
                require(same(first,observation(options,p,id)) && samePlan(plan(options),p),'scene-changed-during-draw');
                require(canvas.width===w && canvas.height===h,'canvas-resized-during-draw');guard(options,id);
                ctx.save();try {ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';ctx.clearRect(0,0,w,h);ctx.drawImage(stage,0,0,w,h);}finally{ctx.restore();}
                require(same(first,observation(options,p,id)) && samePlan(plan(options),p),'scene-retired-after-draw');
                guard(options,id);
                var result={source:'hd-battle-scene',view:{x:s.mapSX,y:s.mapSY,cols:10,rows:6},region:region,subject:p.subject,
                    family:p.ai?'ai-target':p.reason===1?'upgrade':'departure',phase:p.ai?null:s.phase,
                    generation:options.event.generation,eventId:options.event.eventId,commitSeq:options.event.display.commitSeq,
                    frames:p.frames.slice(),clears:p.clears.slice(),renderedUnits:rendered,libraryGeneration:id.generation};
                diagnostic=JSON.parse(JSON.stringify(result));return result;
            } catch(error) {diagnostic={source:null,reason:String(error && error.message || error)};return null;}
            finally {busy=false;}
        }
        return Object.freeze({paint:paint,debugSnapshot:function(){return JSON.parse(JSON.stringify(diagnostic));}});
    }
    var controller=createController(global);
    global.BayeHdBattleScene=Object.freeze({createController:createController,paint:controller.paint,debugSnapshot:controller.debugSnapshot});
})(window);
