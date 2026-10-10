/** Original mobile battle presentation and trusted gestures; rules and ACKs stay in the engine/shared adapter. */
(function (global) {
    'use strict';
    var SHA = '3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e';
    var FIELDS = {active:'g_hdFightActive', over:'g_hdFightOver', wait:'g_hdFightWait', phase:'g_hdFightPhase',
        aimType:'g_hdFightAimType', inputKind:'g_hdFightInputKind', inputSeq:'g_hdFightInputSeq',
        actorIndex:'g_hdFightActor', skip:'g_hdFightSkip', mapW:'g_MapWid', mapH:'g_MapHgt',
        bout:'g_FgtBoutCnt', boutMax:'g_FgtBoutMax', focusX:'g_FoucsX', focusY:'g_FoucsY'};
    var BLOCKERS = ['g_hdReportActive','g_hdHelpActive','g_hdViewActive','g_hdMiniMapActive',
        'g_hdMovieActive','g_hdSpeActive','g_hdAttackActive','g_hdSkillResultActive',
        'g_hdMakerActive','g_hdRecordActive','g_hdQtyActive','g_hdResultOwnerKind','g_hdResultOwnerValid'];
    var ARMS = ['骑','步','弓','水','极','玄'];
    var STATES = ['正常','混乱','禁咒','定身','奇门','遁甲','石阵','潜踪','死亡'];
    function uint(n, max) { return typeof n === 'number' && isFinite(n) && Math.floor(n) === n && n >= 0 && n <= (max === undefined ? 0xffffffff : max); }
    function key(value) { return JSON.stringify(value); }
    function createController(environment) {
        var mounted=false, focused=true, pageActive=true, timer=null, refreshing=false, drawing=false;
        var arm=null, pointers=Object.create(null), blocked=false, camera=null, cameraData=null, lastFocus='', lastData=null, lastStable='', lastRender=null;
        var last={active:false,presentation:'off',reason:'not-initialized',camera:null}, renderBindings=new WeakMap();
        function doc() { return environment.document; }
        function node(id) { return doc() && doc().getElementById(id); }
        function battle() { return environment.BayeHdBattle; }
        function available() {
            return !!(doc() && doc().body && doc().body.classList.contains('hd-mobile-page') &&
                !doc().hidden && focused && pageActive && environment.innerWidth > environment.innerHeight);
        }
        function identity() {
            var api=environment.BayeHdLibIdentity, i=api && api.read();
            return i && i.status==='ready' && i.sha256===SHA && i.byteLength===207195 && uint(i.generation) && i.generation>0 && api.isCurrent(i)
                ? {generation:i.generation,sha256:i.sha256,byteLength:i.byteLength} : null;
        }
        function bytes(value, count) {
            if (!value || !uint(value.length) || value.length<count) { throw Error('short native array'); }
            var out=[];for(var i=0;i<count;i++){if(!uint(value[i],255)){throw Error('invalid native byte');}out.push(value[i]);}return out;
        }
        function observation(data, hd, id) {
            var fight=hd.fight(), menu=hd.menuItems(), f={}, raw={}, blockers={};
            if (!fight || !menu) { return null; }
            Object.keys(FIELDS).forEach(function (name) {
                var value=data[FIELDS[name]];
                if(!uint(value)||fight[name]!==value){throw Error('fight ABI mismatch');}
                f[name]=value;
            });
            if(f.active!==1 || f.over!==0 || f.mapW<1 || f.mapW>255 || f.mapH<1 || f.mapH>255 ||
                f.focusX>=f.mapW || f.focusY>=f.mapH || f.inputKind>10 || !uint(data.g_hdEngineReady,1) || data.g_hdEngineReady!==1 ||
                !uint(data.g_hdDetailGeneration) || !data.g_hdDetailGeneration || !uint(data.g_PIdx,4) || data.g_PIdx<1) { return null; }
            ['g_hdMenuActive','g_hdMenuContext','g_hdMenuKind','g_hdMenuSeq','g_hdMenuCount','g_hdMenuIndex'].forEach(function(name){
                if(!uint(data[name])){throw Error('missing menu ABI');}raw[name]=data[name];
            });
            BLOCKERS.forEach(function(name){if(!uint(data[name])){throw Error('missing owner ABI');}blockers[name]=data[name];});
            if (Number(menu.active)!==raw.g_hdMenuActive) { return null; }
            var m={active:raw.g_hdMenuActive};
            if(m.active){
                ['context','kind','seq','count','index'].forEach(function(name){
                    var field='g_hdMenu'+name.charAt(0).toUpperCase()+name.slice(1);
                    if(!uint(menu[name]) || menu[name]!==raw[field]){throw Error('menu ABI mismatch');}m[name]=menu[name];
                });
                if(!m.seq || !m.count || m.count>2000 || m.index>=m.count || !Array.isArray(menu.names) || menu.names.length!==m.count ||
                    !menu.names.every(function(name){return typeof name==='string' && name.length>0;})) { return null; }
                m.names=menu.names.slice();m.detailGeneration=menu.detailGeneration;
                if(m.detailGeneration!==data.g_hdDetailGeneration) { return null; }
            }
            var param=data.g_FgtParam, ids=param && param.GenArray, positions=data.g_GenPos, units=[];
            if(!param || !uint(param.CityIndex,37) || fight.cityIndex!==param.CityIndex || !ids || ids.length<20 || !positions || positions.length<20) { return null; }
            for(var n=0;n<20;n++){
                var person=ids[n], p=positions[n], u={i:n,id:person};
                if(!uint(person,65535) || person>200 && person<65534 || !p) { return null; }
                ['x','y','move','active','state','hp','mp'].forEach(function(name){if(!uint(p[name],name==='hp'||name==='mp'?65535:255)){throw Error('invalid native unit');}u[name]=p[name];});
                if(person && person<65534){
                    if(!data.g_Persons || !data.g_Persons[person-1] || !uint(data.g_Persons[person-1].Arms,65535)) { return null; }
                    u.arms=data.g_Persons[person-1].Arms;
                    if(u.state!==8 && (u.x>=f.mapW || u.y>=f.mapH)) { return null; }
                }
                units.push(u);
            }
            f.cityIndex=param.CityIndex;
            var kind=f.inputKind, mask=null, invalidMask=false;
            if(kind===2){
                try {mask={values:bytes(data.g_FightPath,225)};['g_PathSX','g_PathSY','g_PUseSX','g_PUseSY'].forEach(function(name){if(!uint(data[name],255)){throw Error('invalid MOVE origin');}mask[name]=data[name];});}
                catch(e){invalidMask=true;}
            }else if(kind===5){
                try {var head=bytes(data.g_FgtAtkRng,3);if(head[0]<1||head[0]>15){throw Error('invalid AIM extent');}mask={values:bytes(data.g_FgtAtkRng,3+head[0]*head[0])};}
                catch(e){invalidMask=true;}
            }
            var menuKind=[3,4,6,7,8].indexOf(kind)>=0, actorValid=[2,3,4,5].indexOf(kind)<0 ||
                f.actorIndex<20 && units[f.actorIndex].id>0 && units[f.actorIndex].id<=200 && units[f.actorIndex].state!==8;
            var skillActive=data.g_hdSkillActive, skills=null, skillReady=skillActive===0;
            if(!uint(skillActive,1)){return null;}
            // FgtGetJNIdx publishes the current SKILL list before ShowMenu;
            // this flag owns that exact list, rather than an animation.
            if(kind===4){
                skillReady=false;
                if(skillActive===1 && m.active===1 && m.context===3 && m.kind===4 && typeof hd.skills==='function'){
                    var published=hd.skills(), count=data.g_hdSkillCount, nameLen=data.g_hdSkillNameLen, nativeIds=data.g_hdSkillIds;
                    if(published && published.active===1 && uint(count,10) && count>0 && count===m.count &&
                        published.count===count && nameLen===4 && nativeIds && nativeIds.length>=count &&
                        Array.isArray(published.ids) && published.ids.length===count &&
                        Array.isArray(published.names) && published.names.length===count){
                        var ids=[], names=published.names.slice(), nameBytes=bytes(data.g_hdSkillNameBytes,count*8);
                        skillReady=names.every(function(name,i){
                            var id=nativeIds[i];ids.push(id);
                            return uint(id,65533) && id>0 && published.ids[i]===id && typeof name==='string' && name.length>0 && name===m.names[i];
                        });
                        if(skillReady){skills={active:1,count:count,nameLen:nameLen,ids:ids,names:names,nameBytes:nameBytes};}
                    }
                }
            }
            var ready=f.inputSeq>0 && actorValid && !invalidMask && skillReady && !BLOCKERS.some(function(name){return blockers[name]!==0;}) &&
                ([1,2,5].indexOf(kind)>=0 ? f.wait===1 && !m.active :
                    menuKind && f.wait===0 && m.active===1 && m.context===3 && m.kind===kind);
            return {identity:id,period:data.g_PIdx,detailGeneration:data.g_hdDetailGeneration,fight:f,menu:m,units:units,mask:mask,
                invalidMask:invalidMask,blockers:blockers,skillActive:skillActive,skills:skills,presentation:ready?'hd':'lcd'};
        }
        function readNativeTicket() {
            if(!available()) { return null; }
            try {
                var id=identity(), b=environment.baye, hd=b && b.hd;
                if(!id || !hd || typeof hd.ready!=='function' || hd.ready()!==true || typeof hd.fight!=='function' || typeof hd.menuItems!=='function') { return null; }
                var data=typeof b.ensureData==='function'?b.ensureData():b.data;
                if(!data) { return null; }
                var a=observation(data,hd,id), z=observation(data,hd,id), latest=identity();
                if(!a || !z || key(a)!==key(z) || key(id)!==key(latest) || b.data!==data || hd.ready()!==true || !available()) { return null; }
                var stable=key(z), full=stable;
                // Only the shared command's expected cursor/menu-index ACK may vary.
                var sf=Object.assign({},z.fight), sm=Object.assign({},z.menu);delete sf.focusX;delete sf.focusY;delete sm.index;
                stable=key(Object.assign({},z,{fight:sf,menu:sm}));
                var t={key:full,stableKey:stable,libraryGeneration:id.generation,kind:z.fight.inputKind,seq:z.fight.inputSeq,
                    actor:z.fight.actorIndex,presentation:z.presentation,native:z};
                Object.defineProperty(t,'data',{value:data,enumerable:false});return Object.freeze(t);
            }catch(e){return null;}
        }
        function same(a,b) { return !!a && !!b && a.data===b.data && a.key===b.key; }
        function retire(reason) { arm=null;var b=battle();if(b && typeof b.retireInteraction==='function'){b.retireInteraction(reason);} }
        function rect(n) {var r=n && n.getBoundingClientRect();return r && [r.left,r.top,r.width,r.height];}
        function sameRect(a,n) {var b=rect(n);return !!b && a.every(function(v,i){return isFinite(v) && Math.abs(v-b[i])<0.5;});}
        function visible(n,e) {
            if(!n || n.disabled || n.isConnected===false || !e || !isFinite(e.clientX) || !isFinite(e.clientY)){return false;}
            var r=rect(n);if(!r || r[2]<=0 || r[3]<=0 || e.clientX<r[0] || e.clientX>=r[0]+r[2] || e.clientY<r[1] || e.clientY>=r[1]+r[3]){return false;}
            for(var p=n;p && p.nodeType===1;p=p.parentElement){var s=environment.getComputedStyle && environment.getComputedStyle(p);if(p.hidden || s && (s.display==='none' || s.visibility==='hidden' || Number(s.opacity)===0)){return false;}}
            var top=doc().elementFromPoint && doc().elementFromPoint(e.clientX,e.clientY);return !doc().elementFromPoint || top===n || n.contains && n.contains(top);
        }
        function action(target) {
            var toggle=node('hd-mobile-battle-toggle');
            if(toggle && (target===toggle || toggle.contains(target))){return {type:'mode',target:toggle};}
            var root=node('hd-battle');if(!root || !root.contains(target)){return null;}
            for(var p=target;p && p!==root;p=p.parentElement){
                if(p.id==='hd-mobile-battle-canvas'){return {type:'board',target:p};}
                if(p.tagName==='BUTTON'){
                    if(p.id==='hd-mobile-battle-mode'){return {type:'mode',target:p};}
                    if(p.id==='hd-mobile-battle-focus'){return {type:'focus',target:p};}
                    for(var name of ['menu','sys','cancel','menu-exit']){if(p.getAttribute('data-hd-battle-'+name)!==null){return {type:name,target:p};}}
                }
            }return null;
        }
        function stop(e) {if(e.cancelable!==false){e.preventDefault();}if(e.stopImmediatePropagation){e.stopImmediatePropagation();}else if(e.stopPropagation){e.stopPropagation();}}
        function inputTicket(hit) {var t=readNativeTicket();if(!t){return null;}return hit.type==='mode'?t:t.presentation==='hd' && sharedShowsHd() && renderMatches(lastRender,t) && battle() && battle().getInputTicket?battle().getInputTicket():null;}
        function clampCamera(t) {if(!camera){return;}camera.x=Math.max(0,Math.min(camera.x,Math.max(0,t.native.fight.mapW-camera.cols)));camera.y=Math.max(0,Math.min(camera.y,Math.max(0,t.native.fight.mapH-camera.rows)));}
        function tile(x,y) {if(!camera){return null;}var c=Math.floor((x-camera.left)/camera.cell),r=Math.floor((y-camera.top)/camera.cell);return c>=0&&r>=0&&c<camera.cols&&r<camera.rows?{x:c+camera.x,y:r+camera.y}:null;}
        function down(e) {
            if(e.isTrusted!==true){if(action(e.target)){stop(e);}return;}
            pointers[e.pointerId]=true;
            if(Object.keys(pointers).length>1 || e.isPrimary===false){blocked=true;retire('multiple-pointers');return;}
            var hit=action(e.target);if(!hit){return;}
            var t=inputTicket(hit);
            if(blocked || e.isPrimary!==true || !uint(e.pointerId) || e.button!=null && e.button!==0 || !visible(hit.target,e) || !t || !same(t,inputTicket(hit))){stop(e);return;}
            var nativeTicket=readNativeTicket();if(!same(t,nativeTicket)){stop(e);return;}
            arm={hit:hit,ticket:t,nativeTicket:nativeTicket,id:e.pointerId,x:e.clientX,y:e.clientY,geometry:rect(hit.target),camera:camera && Object.assign({},camera),dragged:false};
            if(hit.type==='board'){stop(e);}
        }
        function move(e) {
            if(!arm || arm.id!==e.pointerId){return;}
            var a=arm;if(!same(a.ticket,inputTicket(a.hit)) || !sameRect(a.geometry,a.hit.target)){retire('pointer-owner-changed');return;}
            var dx=e.clientX-a.x,dy=e.clientY-a.y;
            if(Math.hypot(dx,dy)>10){a.dragged=true;}
            if(a.dragged && a.hit.type==='board' && a.camera){
                camera.x=a.camera.x-Math.round(dx/a.camera.cell);camera.y=a.camera.y-Math.round(dy/a.camera.cell);clampCamera(a.nativeTicket);stop(e);render(lastRender);
            }
        }
        function dispatch(hit) {
            var b=battle();if(!b){return;}
            if(hit.type==='mode'){retire('mode');b.setMode(b.getMode()==='classic'?'hd':'classic');refresh();return;}
            if(hit.type==='focus'){lastFocus='';render(lastRender);return;}
            if(hit.type==='sys'){b.openSystemMenu();}
            if(hit.type==='cancel' || hit.type==='menu-exit'){b.cancel();}
            if(hit.type==='menu'){b.pickMenu(Number(hit.target.getAttribute('data-hd-battle-menu')));}
        }
        function up(e) {
            var a=arm,hit=action(e.target);arm=null;delete pointers[e.pointerId];
            if(a && a.id===e.pointerId && e.isTrusted===true && e.isPrimary===true && !blocked && !a.dragged &&
                hit && hit.target===a.hit.target && hit.type===a.hit.type && Math.hypot(e.clientX-a.x,e.clientY-a.y)<=10 &&
                sameRect(a.geometry,hit.target) && visible(hit.target,e) && same(a.ticket,inputTicket(hit))){
                stop(e);
                if(hit.type==='board'){var p=tile(e.clientX,e.clientY);if(p){battle().clickTile(p.x,p.y);}}
                else{dispatch(hit);}
            }
            if(Object.keys(pointers).length===0){blocked=false;}
        }
        function boundary(reason) {blocked=Object.keys(pointers).length>0;retire(reason);lastFocus='';refresh();}
        function paint(presentation) {
            var body=doc() && doc().body;if(body){body.setAttribute('data-hd-mobile-battle',presentation);}
            var active=presentation!=='off';
            var root=node('hd-battle');if(root){root.setAttribute('aria-hidden',presentation==='hd'?'false':'true');}
            ['hd-mobile-map-mode','hd-mobile-menu-mode','hd-mobile-map-focus','hd-mobile-exit'].forEach(function(id){var n=node(id);if(n && active){n.disabled=true;}});
            var mode=node('hd-mobile-battle-mode');if(mode){mode.textContent=battle() && battle().getMode()==='classic'?'HD战场':'经典战场';}
            var toggle=node('hd-mobile-battle-toggle');if(toggle){toggle.hidden=!active;toggle.textContent=mode?mode.textContent:'HD战场';toggle.setAttribute('aria-pressed',presentation==='hd'?'true':'false');}
        }
        function sharedShowsHd() {
            var b=battle();return !!(b && typeof b.getLcdPresentation==='function' && b.getLcdPresentation()==='off');
        }
        function renderMatches(snapshot,t) {
            var owner=snapshot && snapshot.renderOwner, b=battle();
            if(!t || t.presentation!=='hd' || !owner || !b || typeof b.getInputTicket!=='function'){return false;}
            if(renderBindings.has(snapshot) && renderBindings.get(snapshot)!==t.data){return false;}
            var names=['key','stableKey','libraryGeneration','kind','seq','actor'];
            if(!names.every(function(name){return owner[name]===t[name];})){return false;}
            return same(t,b.getInputTicket()) && same(t,readNativeTicket());
        }
        function refresh() {
            if(refreshing || !mounted){return last;}refreshing=true;
            try{
                var t=readNativeTicket(), b=battle(), changed=lastData && (!t || t.data!==lastData || t.stableKey!==lastStable);
                if(changed){retire('native-owner-changed');}
                lastData=t && t.data;lastStable=t?t.stableKey:'';
                var presentation=t?(t.presentation==='hd' && sharedShowsHd() && renderMatches(lastRender,t)?'hd':'lcd'):'off';
                if(presentation!=='hd' && arm){retire('LCD-handoff');}
                if(presentation!=='hd'){lastRender=null;}
                paint(presentation);
                last={active:!!t,presentation:presentation,reason:!t?'unavailable':t.presentation==='lcd'?'native-LCD':'',
                    personContext:null,inputKind:t && t.kind,inputSeq:t && t.seq,libraryGeneration:t && t.libraryGeneration,
                    camera:camera && Object.assign({},camera),blocked:blocked,armed:!!arm};
                return last;
            }finally{refreshing=false;}
        }
        function render(snapshot) {
            if(drawing || !snapshot){return;}drawing=true;
            try{
                var t=readNativeTicket(), canvas=node('hd-mobile-battle-canvas'), board=node('hd-mobile-battle-board');
                if(!t || t.presentation!=='hd' || !canvas || !board || !sharedShowsHd() || !renderMatches(snapshot,t)){
                    lastRender=null;if(t){paint('lcd');}if(arm){retire('render-owner-changed');}return;
                }
                renderBindings.set(snapshot,t.data);lastRender=snapshot;
                paint('hd');var r=board.getBoundingClientRect();if(r.width<44 || r.height<44){return;}
                var cols=Math.min(t.native.fight.mapW,Math.floor(r.width/44)),rows=Math.min(t.native.fight.mapH,Math.floor(r.height/44));
                var cell=Math.floor(Math.min(r.width/cols,r.height/rows)), ox=Math.floor((r.width-cols*cell)/2),oy=Math.floor((r.height-rows*cell)/2);
                if(cameraData!==t.data){cameraData=t.data;lastFocus='';}
                var focus=key([t.libraryGeneration,t.native.fight.cityIndex,t.native.fight.bout,t.seq,t.native.fight.focusX,t.native.fight.focusY]);
                var previous=camera;
                camera={x:previous?previous.x:0,y:previous?previous.y:0,cols:cols,rows:rows,cell:cell,left:r.left+ox,top:r.top+oy,ox:ox,oy:oy};
                if(lastFocus!==focus){camera.x=t.native.fight.focusX-Math.floor(cols/2);camera.y=t.native.fight.focusY-Math.floor(rows/2);lastFocus=focus;}
                clampCamera(t);
                var dpr=Math.min(2,environment.devicePixelRatio||1),w=Math.round(r.width*dpr),h=Math.round(r.height*dpr);
                if(canvas.width!==w){canvas.width=w;}if(canvas.height!==h){canvas.height=h;}
                var ctx=canvas.getContext('2d');if(!ctx){return;}ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,r.width,r.height);ctx.fillStyle='#101722';ctx.fillRect(0,0,r.width,r.height);
                var geometry={ox:ox,oy:oy,cw:cell,ch:cell,cols:cols,rows:rows,viewOx:camera.x,viewOy:camera.y,dpr:dpr};
                var terrain=environment.BayeHdBattleTerrain;
                if(!terrain || !snapshot.terrainSnapshot || !terrain.paint(ctx,geometry,snapshot.terrainSnapshot)){
                    for(var y=0;y<rows;y++){for(var x=0;x<cols;x++){ctx.fillStyle=(x+y)%2?'#1b2832':'#1e3035';ctx.fillRect(ox+x*cell,oy+y*cell,cell,cell);}}
                }
                var feedback=environment.BayeHdBattleFeedback;if(feedback && snapshot.feedback){feedback.paint(ctx,geometry,snapshot.feedback);}
                ctx.strokeStyle='#60707855';ctx.lineWidth=1;
                for(y=0;y<=rows;y++){ctx.beginPath();ctx.moveTo(ox,oy+y*cell);ctx.lineTo(ox+cols*cell,oy+y*cell);ctx.stroke();}
                for(x=0;x<=cols;x++){ctx.beginPath();ctx.moveTo(ox+x*cell,oy);ctx.lineTo(ox+x*cell,oy+rows*cell);ctx.stroke();}
                (snapshot.unitList||[]).forEach(function(u){
                    if(u.state===8 || u.x<camera.x || u.x>=camera.x+cols || u.y<camera.y || u.y>=camera.y+rows){return;}
                    var px=ox+(u.x-camera.x)*cell,py=oy+(u.y-camera.y)*cell;
                    ctx.fillStyle=u.side==='player'?'#275f9d':'#983d40';ctx.fillRect(px+3,py+3,cell-6,cell-6);
                    ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#fff4d8';ctx.font='600 12px sans-serif';ctx.fillText(u.name||'#'+u.id,px+cell/2,py+cell*.28,cell-8);
                    ctx.font='12px sans-serif';ctx.fillText((ARMS[u.armType]||'兵')+' '+(u.arms==null?'?':u.arms),px+cell/2,py+cell*.58,cell-8);
                    ctx.font='10px sans-serif';ctx.fillText(u.active===1?'已行动':u.i===t.actor?'当前':STATES[u.state]||'待行动',px+cell/2,py+cell*.83,cell-8);
                });
                var f=t.native.fight;ctx.strokeStyle='#f0c75a';ctx.lineWidth=2;ctx.strokeRect(ox+(f.focusX-camera.x)*cell+1,oy+(f.focusY-camera.y)*cell+1,cell-2,cell-2);
                var u=(snapshot.unitList||[]).find(function(v){return v.x===f.focusX && v.y===f.focusY && v.state!==8;}),details=node('hd-mobile-battle-details');
                if(details){details.textContent=u?(u.name+' · '+(ARMS[u.armType]||'兵')+'兵\n兵力 '+u.arms+' · HP '+u.hp+' · MP '+u.mp+'\n'+(STATES[u.state]||'未知')+' · '+(u.active===1?'已行动':'待行动')):'位置 '+f.focusX+','+f.focusY+'\n拖动查看战场 · 轻点选择';}
                if(last){last.camera=Object.assign({},camera);last.presentation='hd';}
            }finally{drawing=false;}
        }
        function init() {
            if(mounted){return refresh();}mounted=true;
            var d=doc();d.addEventListener('pointerdown',down,true);d.addEventListener('pointermove',move,true);d.addEventListener('pointerup',up,true);
            d.addEventListener('pointercancel',function(e){delete pointers[e.pointerId];blocked=Object.keys(pointers).length>0;retire('pointercancel');},true);
            d.addEventListener('lostpointercapture',function(e){if(arm && arm.id===e.pointerId){retire('lost-capture');}},true);
            d.addEventListener('click',function(e){if(action(e.target)){stop(e);}},true);
            d.addEventListener('keydown',function(e){
                if(last.presentation!=='hd'){return;}
                var recognized=/^(ArrowUp|ArrowDown|ArrowLeft|ArrowRight|Enter|Escape| |Spacebar|[hHfFsS0-9])$/.test(e.key||'') ||
                    [13,27,32,37,38,39,40,72,70,83].indexOf(e.keyCode)>=0 || e.keyCode>=48 && e.keyCode<=57;
                if(!recognized || e.isComposing){return;}
                var t=readNativeTicket(), b=battle();
                if(t && t.presentation==='lcd' || !sharedShowsHd()){refresh();return;}
                if(e.isTrusted!==true || e.repeat){stop(e);return;}
                if(!renderMatches(lastRender,t)){stop(e);refresh();return;}
                if(b && typeof b.handleKey==='function'){b.handleKey(e);}
                stop(e);
            },true);
            d.addEventListener('scroll',function(){if(arm){retire('scroll');}},true);
            d.addEventListener('visibilitychange',function(){boundary('visibility');});
            ['resize','orientationchange'].forEach(function(name){environment.addEventListener(name,function(){boundary(name);});});
            environment.addEventListener('blur',function(){focused=false;boundary('blur');});environment.addEventListener('focus',function(){focused=true;boundary('focus');});
            environment.addEventListener('pagehide',function(){pageActive=false;boundary('pagehide');});environment.addEventListener('pageshow',function(){pageActive=true;boundary('pageshow');});
            if(environment.visualViewport){environment.visualViewport.addEventListener('resize',function(){boundary('visual-viewport');});}
            var api=environment.BayeHdLibIdentity;if(api && api.subscribe){api.subscribe(function(){boundary('library');});}
            var b=battle();if(b && b.applyMobilePage){b.applyMobilePage({isAvailable:available,readTicket:readNativeTicket,render:render});}
            timer=environment.setInterval(refresh,80);return refresh();
        }
        return {init:init,refresh:refresh,readNativeTicket:readNativeTicket,debugSnapshot:function(){return Object.assign({},last,{camera:camera && Object.assign({},camera),armed:!!arm,blocked:blocked});}};
    }
    var controller=createController(global);
    global.BayeHdMobileBattle={createController:createController,init:controller.init,refresh:controller.refresh,
        readNativeTicket:controller.readNativeTicket,debugSnapshot:controller.debugSnapshot};
})(window);
