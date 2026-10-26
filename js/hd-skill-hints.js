/* Read-only original SKILL-menu rules. These hints never authorize a target or dispatch input. */
(function (global) {
    'use strict';
    var SHA = '3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e';
    var busy = false, epoch = 0;
    function uint(value,max) { return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= max; }
    function identityKey(v) { return v && JSON.stringify([v.status,v.sha256,v.byteLength,v.generation]); }
    function terrainOf(tile) {
        if (!uint(tile,255) || !tile) { return null; }
        return tile > 15 ? tile === 41 ? 6 : 7 : tile > 5 ? 2 : tile > 4 ? 3 : tile > 3 ? 4 : tile > 2 ? 5 : tile > 1 ? 0 : 1;
    }
    function coefficients(value,length) {
        if (!value || value.length !== length) { return null; }
        var result = [];
        for (var i=0;i<length;i++) { var coefficient=value[i]; if (!uint(coefficient,255)) { return null; } result.push(coefficient); }
        return result;
    }
    function read() {
        if (busy) { epoch++; return null; }
        busy = true;
        var token = ++epoch;
        try {
            var b=global.baye,hd=b&&b.hd,data=b&&b.data,api=global.BayeHdLibIdentity;
            if (document.hidden || !hd || !data || !api || typeof hd.fight!=='function' || typeof hd.menuItems!=='function' ||
                typeof hd.skills!=='function' || typeof hd.ready!=='function' || typeof api.read!=='function' || typeof api.isCurrent!=='function') { return null; }
            var getFight=hd.fight,getMenu=hd.menuItems,getSkills=hd.skills,getReady=hd.ready,getLibrary=api.read,isCurrent=api.isCurrent,
                getTerrain=b.getTerrainByGeneralIndex,hooks=b.hooks,param=data.g_FgtParam,positions=data.g_GenPos,rules=data.g_Skills,
                ids=data.g_hdSkillIds,nameBytes=data.g_hdSkillNameBytes,menuBytes=data.g_hdMenuBytes,map=data.g_FightMapData;
            var generals=param&&param.GenArray,identity=getLibrary.call(api),library=identityKey(identity);
            if (!identity || identity.status!=='ready' || identity.sha256!==SHA || identity.byteLength!==207195 ||
                !uint(identity.generation,0xffffffff) || !identity.generation || !param || !generals || generals.length!==20 ||
                !positions || positions.length!==20 || !rules || rules.length!==2000 || !ids || ids.length!==10 ||
                !nameBytes || nameBytes.length!==80 || !menuBytes) { return null; }
            function capture() {
                var f=getFight.call(hd),m=getMenu.call(hd),s=getSkills.call(hd),current=getLibrary.call(api),valid=isCurrent.call(api,identity),ready=getReady.call(hd);
                if (!f || !m || !s || ready!==true || valid!==true || identityKey(current)!==library || identityKey(identity)!==library ||
                    hooks && ['getSkillIds','getSkillName'].some(function (key) { return typeof hooks[key]==='function'; })) { return null; }
                var actor=f.actorIndex,count=s.count,seq=f.inputSeq,menuSeq=m.seq,index=m.index,generation=m.generation;
                if (f.active!==1 || f.over!==0 || f.inputKind!==4 || f.wait!==0 || !uint(seq,0xffffffff) || !seq || !uint(actor,19) ||
                    m.active!==1 || m.context!==3 || m.kind!==4 || !uint(menuSeq,0xffffffff) || !menuSeq ||
                    !uint(generation,0xffffffff) || !generation || m.detailGeneration!==generation ||
                    s.active!==1 || !uint(count,10) || !count || m.count!==count || !uint(index,count-1) ||
                    !Array.isArray(m.names) || m.names.length!==count || !Array.isArray(s.names) || s.names.length!==count ||
                    !Array.isArray(s.ids) || s.ids.length!==count || !positions[actor] || !uint(generals[actor],200) || !generals[actor]) { return null; }
                var position=positions[actor],width=data.g_MapWid,height=data.g_MapHgt;
                if (!uint(width,255) || !width || !uint(height,255) || !height || !uint(position.x,width-1) ||
                    !uint(position.y,height-1) || !uint(position.mp,65535) || !uint(position.state,8) || position.state===8) { return null; }
                // Only call the native U8 terrain getter after its actor and coordinates are bounded.
                var nativeTerrain=null,mapComplete=!!map&&map.length>=width*height;
                if (mapComplete && typeof getTerrain==='function') { nativeTerrain=getTerrain.call(b,actor); }
                current=getLibrary.call(api);valid=isCurrent.call(api,identity);ready=getReady.call(hd);
                if (ready!==true || valid!==true || identityKey(current)!==library || identityKey(identity)!==library ||
                    data.g_hdEngineReady!==1 || data.g_FgtOver!==0 || data.g_hdFightActive!==1 || data.g_hdFightOver!==0 ||
                    data.g_hdFightInputKind!==4 || data.g_hdFightInputSeq!==seq || data.g_hdFightActor!==actor ||
                    data.g_hdDetailGeneration!==generation || !uint(data.g_PIdx,4) || !data.g_PIdx ||
                    data.g_hdMenuActive!==1 || data.g_hdMenuContext!==3 || data.g_hdMenuKind!==4 || data.g_hdMenuSeq!==menuSeq ||
                    data.g_hdMenuCount!==count || data.g_hdMenuIndex!==index || data.g_hdMenuItemLen!==4 ||
                    data.g_hdSkillActive!==1 || data.g_hdSkillCount!==count || data.g_hdSkillNameLen!==4 ||
                    data.g_hdReportActive!==0 || data.g_hdHelpActive!==0 || data.g_hdViewActive!==0 ||
                    (param.Mode!==0&&param.Mode!==1) || !uint(param.CityIndex,37) || f.cityIndex!==param.CityIndex ||
                    data.g_MapWid!==width || data.g_MapHgt!==height || !uint(position.x,width-1) || !uint(position.y,height-1) ||
                    !uint(position.mp,65535) || !uint(position.state,8) || position.state===8 || menuBytes.length<count*4) { return null; }
                var terrain=mapComplete?terrainOf(map[position.y*width+position.x]):null;
                if (!uint(nativeTerrain,7) || terrain!==nativeTerrain) { terrain=null; }
                var weather=uint(data.g_FgtWeather,5)&&data.g_FgtWeather>0?data.g_FgtWeather:null,
                    mp=position.mp,rows=[],packed=[],refs=[position];
                for (var i=0;i<count;i++) {
                    var id=ids[i],name=m.names[i];
                    if (!uint(id,30) || !id || s.ids[i]!==id || typeof name!=='string' || !name.trim() || s.names[i]!==name) { return null; }
                    var bytes=[];
                    for (var n=0;n<8;n++) {
                        var byte=nameBytes[i*8+n];
                        if (!uint(byte,255) || n<4 && (menuBytes[i*4+n]!==byte || !uint(menuBytes[i*4+n],255)) || n>=4 && byte!==0) { return null; }
                        bytes.push(byte);
                    }
                    packed.push([id,name,bytes]);
                    var rule=rules[id-1];if(!rule){return null;}
                    var costValue=rule.useMp,landRef=rule.oland,skyRef=rule.weather,
                        cost=uint(costValue,255)?costValue:null,land=coefficients(landRef,8),sky=coefficients(skyRef,5),reason='unknown';
                    refs.push(rule,landRef,skyRef);
                    if(cost!==null){
                        if(cost>mp){reason='mp';}
                        else if(terrain!==null&&land){
                            if(land[terrain]===0){reason='terrain';}
                            else if(weather!==null&&sky){reason=sky[weather-1]===0?'weather':'ready';}
                        }
                    }
                    rows.push({id:id,cost:cost,reason:reason,land:land,sky:sky});
                }
                var owner=[seq,actor,menuSeq,index,count,generation,data.g_hdDetailGeneration,data.g_PIdx,param.CityIndex,param.Mode,
                    width,height,generals[actor],position.x,position.y,position.state,mp,terrain,weather];
                if(global.baye!==b || b.hd!==hd || b.data!==data || data.g_FgtParam!==param || param.GenArray!==generals ||
                    data.g_GenPos!==positions || data.g_Skills!==rules || data.g_hdSkillIds!==ids || data.g_hdSkillNameBytes!==nameBytes ||
                    data.g_hdMenuBytes!==menuBytes || data.g_FightMapData!==map || positions.length!==20 || generals.length!==20 ||
                    rules.length!==2000 || ids.length!==10 || nameBytes.length!==80 || positions[actor]!==position || b.hooks!==hooks ||
                    hd.fight!==getFight || hd.menuItems!==getMenu || hd.skills!==getSkills || hd.ready!==getReady ||
                    b.getTerrainByGeneralIndex!==getTerrain || global.BayeHdLibIdentity!==api || api.read!==getLibrary || api.isCurrent!==isCurrent ||
                    document.hidden || token!==epoch) { return null; }
                return {refs:refs,key:JSON.stringify([library,owner,packed,rows]),
                    value:{actor:actor,mp:mp,menuSeq:menuSeq,inputSeq:seq,index:index,names:m.names.slice(),
                        rows:rows.map(function (r) {return{id:r.id,cost:r.cost,reason:r.reason};})}};
            }
            var first=capture(),second=capture(),final=capture();
            function same(a,b){return a&&b&&a.key===b.key&&a.refs.length===b.refs.length&&a.refs.every(function(v,i){return v===b.refs[i];});}
            return same(first,second)&&same(second,final)&&token===epoch?final.value:null;
        }catch(e){return null;}
        finally{busy=false;}
    }
    global.BayeHdSkillHints={read:read};
})(window);
