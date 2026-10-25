#!/usr/bin/env node
// Synthetic readonly bridge observations exercise the public boundary. Native
// mutation timing, palette capture and LCD drawing belong to the actual C suite.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import test from 'node:test';
import vm from 'node:vm';

const root=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
const source=readFileSync(new URL('../js/bridge.js',import.meta.url),'utf8');
const native=readFileSync(new URL('../vendor/iBaye/src/hd-bridge.c',import.meta.url),'utf8');
const header=readFileSync(new URL('../vendor/iBaye/src/hd-bridge.h',import.meta.url),'utf8');
const lib=readFileSync(new URL('../libs/dat-mod.lib',import.meta.url));
const resourceAt=lib.readUInt32LE(26*4);
assert.equal(lib.readUInt16LE(resourceAt+4),27);
const resource=lib.subarray(resourceAt+14,resourceAt+14+lib.readUInt32LE(resourceAt+8));
const plain=value=>JSON.parse(JSON.stringify(value));
function fnv(bytes){let value=2166136261;for(const byte of bytes)value=Math.imul(value^byte,16777619)>>>0;return value;}
function bits(...positions){const result=Array(32).fill(0);for(const bit of positions)result[bit>>3]|=1<<(bit&7);return result;}
const statusFields={Valid:1,Reason:1,Phase:1,SubjectIndex:3,SubjectPerson:699,SubjectX:7,SubjectY:6,
    BeforeLevel:9,AfterLevel:10,BeforeExperience:137,AfterExperience:37,BeforeState:0,AfterState:0,
    BeforeHp:84,AfterHp:84,BeforeArms:1200,AfterArms:1200,LevelMax:99,
    MapSX:3,MapSY:2,MapWidth:32,MapHeight:32,ScreenWidth:160,ScreenHeight:96,
    RegionX:64,RegionY:64,RegionWidth:16,RegionHeight:16,PaletteZero:0x00ffffff,PaletteInk:0xff000000};

function fixture(){
    const raw={},writes=[],keys=[],calls=[];let onRead=null;
    const context=vm.createContext({TextDecoder,TextEncoder,Module:{HEAPU8:new Uint8Array(8192)},
        console:{log(){},warn(){}},addEventListener(){},alert(){},lcdBlur(){}});
    context.window=context;
    for(const name of new Set(source.match(/\b_baye\w+/g)))context[name]=()=>0;
    context._bayeHdReady=()=>1;context._bayeSendKey=key=>keys.push(key);
    vm.runInContext(source,context);context.baye_bridge_init();
    function readonly(value,name=''){
        if(!value||typeof value!=='object')return value;
        return new Proxy(value,{get(object,key){if(onRead)onRead(name,key);return readonly(object[key],name+'.'+String(key));},
            set(){writes.push(name);throw Error('native write');}});
    }
    const baye=context.baye;baye.data=readonly(raw);baye.ensureData=()=>baye.data;
    for(const name of ['getPersonName','getCityName','getToolName','getArmType','callHook'])
        baye[name]=(...args)=>{calls.push([name,...args]);throw Error('uncaptured getter/hook');};
    function main(start=0){
        Object.assign(raw,{g_hdSpeProtocolVersion:2,g_hdSpeActive:1,g_hdSpeId:27,g_hdSpeKind:4,g_hdSpeSeq:8,
            g_hdSpeGeneration:7,g_hdSpeEventId:31,g_hdSpeParentEventId:0,g_hdSpeDepth:1,
            g_hdSpeResourceIndex:0,g_hdSpeCount:resource[2],g_hdSpePicmax:resource[3],
            g_hdSpeStartFrm:start,g_hdSpeEndFrm:start+5,g_hdSpeOriginX:64,g_hdSpeOriginY:64,
            g_hdSpeResourceFingerprint:fnv(resource),g_hdSpeResourceLength:resource.length,
            g_hdSpeProtocolValid:1,g_hdSpeFrameValid:1,g_hdSpeCommitSeq:5,g_hdSpeFrameIndex:start+4,
            g_hdSpeKeyflag:0,g_hdSpeSkipEligible:0,g_hdSpeContextKnown:1,g_hdSpeSkillId:0,
            g_hdSpeActorIndex:3,g_hdSpeTargetIndex:3,g_hdSpeVisibleFrames:bits(start+4),
            g_hdSpeDisplayGeneration:7,g_hdSpeDisplayEventId:31,g_hdSpeDisplayCommitSeq:3,
            g_hdSpeDisplayFrameIndex:start+2,g_hdSpeDisplayFrameValid:1,g_hdSpeDisplayVisibleFrames:bits(start+2),
            g_hdSpeCompositionVersion:0,g_hdSpeAiProtocolVersion:2,g_hdSpeAiValid:0,
            g_hdFightActive:1,g_FgtOver:0,g_hdReportActive:0,g_hdHelpActive:0,g_hdQtyActive:0});
    }
    function effect(reason=1,phase=1){
        const start=reason===1?0:6;main(start);raw.g_hdSpeStatusProtocolVersion=1;
        raw.g_hdFightActive=phase===1?1:0;
        for(const prefix of ['g_hdSpeStatus','g_hdSpeDisplayStatus']){
            for(const [name,value] of Object.entries(statusFields))raw[prefix+name]=value;
            raw[prefix+'Reason']=reason;raw[prefix+'Phase']=phase;
            if(reason===2){raw[prefix+'BeforeLevel']=raw[prefix+'AfterLevel']=10;
                raw[prefix+'BeforeExperience']=raw[prefix+'AfterExperience']=37;
                raw[prefix+'BeforeState']=0;raw[prefix+'AfterState']=8;
                raw[prefix+'BeforeHp']=raw[prefix+'AfterHp']=0;}
            raw[prefix+'BasePixels']=Array.from({length:256},(_,i)=>i%3===0?255:i%3===1?0:207);
            raw[prefix+'BaseRgba']=raw[prefix+'BasePixels'].flatMap(pixel=>pixel===255?[0,0,0,255]:pixel===0?[255,255,255,0]:[48,48,48,207]);
            raw[prefix+'ClearFrames']=prefix==='g_hdSpeStatus'?bits(start,start+1,start+2,start+3):bits(start,start+1);
        }
    }
    function untouched(){assert.deepEqual(writes,[]);assert.deepEqual(keys,[]);assert.deepEqual(calls,[]);}
    return{raw,baye,context,main,effect,untouched,onRead:fn=>{onRead=fn;}};
}
function change(h,field,value){for(const prefix of ['g_hdSpeStatus','g_hdSpeDisplayStatus'])h.raw[prefix+field]=value;}
function neutral(value){assert.equal(value.valid,false);assert.deepEqual(plain(value.basePixels),[]);
    assert.deepEqual(plain(value.baseRgba),[]);assert.deepEqual(plain(value.clearFrames),[]);
    for(const field of ['reason','phase','subjectPerson','beforeState','afterState','regionX','paletteInk'])assert.equal(value[field],undefined,field);}
function rejected(h){const value=h.baye.hd.spe();neutral(value.statusEffect);neutral(value.display.statusEffect);h.untouched();return value;}

test('the actual status payload includes the two native six-unit caller ranges despite header start12',()=>{
    assert.deepEqual([...resource.subarray(0,6)],[0,9,18,9,12,17]);assert.equal(resource.length,735);assert.equal(fnv(resource),0xba494eea);
    for(const [start,slots] of [[0,[2,3,4,1,0,1]],[6,[2,3,4,6,5,6]]]){
        assert.deepEqual(Array.from({length:6},(_,i)=>resource[6+(start+i)*5+4]),slots);
        for(let i=start;i<start+6;i++)assert.deepEqual([...resource.subarray(6+i*5,8+i*5)],[0,0]);
    }
    let at=6+resource[2]*5;
    for(let i=0;i<resource[3];i++){
        assert.deepEqual([resource.readUInt16LE(at),resource.readUInt16LE(at+2),resource.readUInt16LE(at+4),resource[at+6]],[16,16,1,1]);at+=7+64;
    }
    assert.equal(at,resource.length);
});

test('upgrade and departure expose independent actual copied tickets and never borrow AI or background composition',()=>{
    for(const reason of [1,2]){
        const h=fixture();h.effect(reason);const value=plain(h.baye.hd.spe()),start=reason===1?0:6;
        assert.equal(value.statusEffect.valid,true);assert.equal(value.display.statusEffect.valid,true);
        assert.deepEqual([value.id,value.kind,value.startFrm,value.endFrm,value.keyflag,value.skipEligible],[27,4,start,start+5,0,false]);
        assert.equal(value.resourceFingerprint,'fnv1a32:ba494eea:735');
        assert.deepEqual([value.commitSeq,value.frameIndex,value.display.commitSeq,value.display.frameIndex],[5,start+4,3,start+2]);
        assert.deepEqual(value.statusEffect.clearFrames,bits(start,start+1,start+2,start+3));
        assert.deepEqual(value.display.statusEffect.clearFrames,bits(start,start+1));
        assert.equal(value.statusEffect.reason,reason);assert.equal(value.statusEffect.subjectPerson,699);
        assert.deepEqual(value.statusEffect.baseRgba.slice(8,12),[48,48,48,207]);
        assert.equal(value.composition.valid,false);assert.equal(value.aiTarget.valid,false);
        assert.equal(value.display.aiTarget.valid,false);h.untouched();
    }
});
test('real upgrade mutations include zero HP/arms, cap equality and U8 level wrap without a living-unit shortcut',()=>{
    for(const [before,maximum,after] of [[99,99,99],[255,99,0],[254,255,255],[0,0,0],[9,99,10]]){
        const h=fixture();h.effect();change(h,'BeforeLevel',before);change(h,'LevelMax',maximum);change(h,'AfterLevel',after);
        change(h,'BeforeHp',0);change(h,'AfterHp',0);change(h,'BeforeArms',0);change(h,'AfterArms',0);
        const value=h.baye.hd.spe();assert.equal(value.display.statusEffect.valid,true);
        assert.equal(value.statusEffect.afterLevel,after);h.untouched();
    }
    for(const [field,value] of [['BeforeExperience',99],['AfterExperience',38],['AfterLevel',11],['AfterState',8],
        ['BeforeState',8],['AfterHp',83],['AfterArms',1199],['LevelMax',256]]){
        const h=fixture();h.effect();change(h,field,value);rejected(h);
    }
});
test('actual death accepts STATE_SW8 on either side but requires the exact prior mutation and zero HP or arms',()=>{
    for(const [index,person,hp,arms] of [[0,0,0,1200],[19,1999,84,0],[3,699,0,0]]){
        const h=fixture();h.effect(2);change(h,'SubjectIndex',index);change(h,'SubjectPerson',person);
        h.raw.g_hdSpeActorIndex=h.raw.g_hdSpeTargetIndex=index;
        change(h,'BeforeHp',hp);change(h,'AfterHp',hp);change(h,'BeforeArms',arms);change(h,'AfterArms',arms);
        const value=h.baye.hd.spe();assert.equal(value.display.statusEffect.valid,true);assert.equal(value.statusEffect.afterState,8);h.untouched();
    }
    for(const [field,value] of [['BeforeState',8],['AfterState',0],['AfterLevel',11],['AfterExperience',38],
        ['AfterHp',1],['AfterArms',1199]]){const h=fixture();h.effect(2);change(h,field,value);rejected(h);}
    const h=fixture();h.effect(2);change(h,'BeforeHp',84);change(h,'AfterHp',84);rejected(h);
});
test('initialization is the separate native phase with inactive fight, not a broad inactive or invented command authorization',()=>{
    for(const reason of [1,2]){const h=fixture();h.effect(reason,2);const v=h.baye.hd.spe();assert.equal(v.display.statusEffect.valid,true);
        assert.equal(v.statusEffect.phase,2);assert.equal(v.statusEffect.commandType,undefined);h.untouched();}
    for(const [phase,fight] of [[1,0],[2,1],[0,0],[3,1]]){const h=fixture();h.effect();change(h,'Phase',phase);h.raw.g_hdFightActive=fight;rejected(h);}
    const h=fixture();h.effect(1,2);h.raw.g_hdSpeStatusValid=0;rejected(h);
});
test('protocol missing or ill-typed stays neutral while all existing SPE observations remain present',()=>{
    for(const version of [undefined,null,0,2,'1',true,0.5,NaN,Infinity]){
        const h=fixture();h.effect();h.raw.g_hdSpeStatusProtocolVersion=version;const v=rejected(h);
        assert.equal(v.id,27);assert.equal(v.display.frameIndex,2);assert.equal(v.skipEligible,false);
    }
});
test('inactive and unrelated ranges do not read retained large arrays while a valid candidate rechecks all final bytes',()=>{
    for(const [field,value] of [['g_hdSpeActive',0],['g_hdSpeId',35],['g_hdSpeKind',2],['g_hdSpeStartFrm',12],
        ['g_hdSpeEndFrm',4],['g_hdSpeResourceIndex',1],['g_hdSpeStatusValid',0]]){
        const h=fixture();h.effect();h.raw[field]=value;let reads=0;
        h.onRead((name,key)=>{if(name===''&&/g_hdSpe(?:Display)?StatusBase(?:Pixels|Rgba)/.test(key)){reads++;throw Error('neutral must not touch retained base');}});
        rejected(h);assert.equal(reads,0,field);
    }
    const h=fixture();h.effect();let current=0,display=0;h.onRead((name,key)=>{
        if(key==='1023'&&name==='.g_hdSpeStatusBaseRgba')current++;
        if(key==='1023'&&name==='.g_hdSpeDisplayStatusBaseRgba')display++;
    });assert.equal(h.baye.hd.spe().display.statusEffect.valid,true);assert.ok(current>=3&&display>=3);h.untouched();
});
test('every scalar including mutation zeros must be present and narrowly typed',()=>{
    const seed=fixture();seed.effect();const fields=Object.keys(seed.raw).filter(name=>typeof seed.raw[name]==='number'&&!/Composition|Ai/.test(name));
    for(const field of fields)for(const missing of [undefined,null]){const h=fixture();h.effect();h.raw[field]=missing;rejected(h);}
    for(const field of ['g_hdSpeStatusSubjectIndex','g_hdSpeStatusBeforeHp','g_hdSpeDisplayStatusPaletteInk','g_hdSpeGeneration'])
        for(const value of ['0',true,-1,0.5,0x100000000,NaN,Infinity]){const h=fixture();h.effect();h.raw[field]=value;rejected(h);}
    const h=fixture();h.effect();for(const field of Object.keys(h.raw))if(typeof h.raw[field]==='number')h.raw[field]={value:h.raw[field]};
    assert.equal(h.baye.hd.spe().display.statusEffect.valid,true);h.untouched();
});
test('full native arrays reject strings, truncation, extra bytes, holes and malformed final elements',()=>{
    for(const field of ['g_hdSpeVisibleFrames','g_hdSpeDisplayVisibleFrames',...['g_hdSpeStatus','g_hdSpeDisplayStatus'].flatMap(p=>['BasePixels','BaseRgba','ClearFrames'].map(s=>p+s))]){
        const seed=fixture();seed.effect();const length=seed.raw[field].length;
        for(const value of [undefined,null,'0'.repeat(length),Array(length-1).fill(0),Array(length+1).fill(0),Array(length)]){
            const h=fixture();h.effect();h.raw[field]=value;rejected(h);
        }
        for(const value of [undefined,null,'0',true,-1,256,0.5,NaN,Infinity]){
            const h=fixture();h.effect();h.raw[field][length-1]=value;rejected(h);
        }
    }
});
test('range/reason and full native subject projection cannot be inferred from resource kind or a matching name',()=>{
    for(const [field,value] of [['Reason',0],['Reason',2],['SubjectIndex',20],['SubjectPerson',2000],['SubjectPerson',65535],
        ['SubjectX',32],['SubjectY',32],['MapSX',32],['MapSY',32],['MapWidth',0],['MapHeight',0],
        ['ScreenWidth',208],['ScreenHeight',128],['RegionX',65535],['RegionY',32768],['RegionX',145],['RegionY',81],
        ['RegionWidth',15],['RegionHeight',17],['PaletteZero',0],['PaletteInk',-16777216]]){
        const h=fixture();h.effect();change(h,field,value);rejected(h);
    }
    const h=fixture();h.effect();change(h,'SubjectX',12);change(h,'SubjectY',7);change(h,'RegionX',144);change(h,'RegionY',80);
    h.raw.g_hdSpeOriginX=144;h.raw.g_hdSpeOriginY=80;assert.equal(h.baye.hd.spe().display.statusEffect.valid,true);h.untouched();
});
test('the complete main SPE ticket and exact subject context are mandatory, including unskippable playback',()=>{
    for(const [field,value] of [['ProtocolVersion',1],['Active',0],['Id',35],['Kind',2],['Seq',0],['Generation',0],['EventId',0],
        ['ParentEventId',9],['Depth',2],['ResourceIndex',1],['Count',5],['Count',256],['Picmax',0],['Picmax',256],
        ['StartFrm',1],['EndFrm',4],['OriginX',63],['OriginY',65],['ResourceLength',0],['FrameValid',0],['ProtocolValid',0],
        ['FrameIndex',6],['FrameIndex',65535],['CommitSeq',0],['Keyflag',1],['SkipEligible',1],['ContextKnown',0],
        ['SkillId',20],['ActorIndex',4],['TargetIndex',4]]){
        const h=fixture();h.effect();h.raw['g_hdSpe'+field]=value;rejected(h);
    }
});
test('all native U8 baseline indices retain actual RGBA; same-index colors and palette endpoints cannot drift',()=>{
    const h=fixture();h.effect();for(const prefix of ['g_hdSpeStatus','g_hdSpeDisplayStatus']){
        h.raw[prefix+'BasePixels']=Array.from({length:256},(_,i)=>i);
        h.raw[prefix+'BaseRgba']=h.raw[prefix+'BasePixels'].flatMap(i=>i===0?[255,255,255,0]:i===255?[0,0,0,255]:[i,i,i,i]);
    }assert.equal(h.baye.hd.spe().display.statusEffect.valid,true);h.untouched();
    for(const component of [0,1,2,3]){const f=fixture();f.effect();f.raw.g_hdSpeStatusBaseRgba[5*4+component]^=1;rejected(f);}
    for(const [at,rgba] of [[0,[0,0,0,0]],[1,[255,255,255,255]]]){const f=fixture();f.effect();for(const prefix of ['g_hdSpeStatus','g_hdSpeDisplayStatus'])
        f.raw[prefix+'BaseRgba'].splice(at*4,4,...rgba);rejected(f);}
});
test('a self-consistent future display palette or subject cannot replace the original fixed base',()=>{
    const h=fixture();h.effect();for(let i=2;i<256;i+=3)h.raw.g_hdSpeDisplayStatusBaseRgba[i*4]=49;
    const v=h.baye.hd.spe();assert.equal(v.statusEffect.valid,true);neutral(v.display.statusEffect);h.untouched();
    for(const [field,value] of [['SubjectPerson',700],['AfterLevel',11],['BeforeHp',83],['Valid',0]]){
        const f=fixture();f.effect();f.raw['g_hdSpeDisplayStatus'+field]=value;const value2=f.baye.hd.spe();
        assert.equal(value2.statusEffect.valid,true);neutral(value2.display.statusEffect);f.untouched();
    }
});
test('visible and clear bitsets contain only the actual branch range and their own frame frontier',()=>{
    for(const reason of [1,2]){
        const start=reason===1?0:6;
        for(const field of ['g_hdSpeVisibleFrames','g_hdSpeStatusClearFrames'])for(const bit of [...(start?[0,5]:[6]),start+5,18,255]){
            const h=fixture();h.effect(reason);h.raw[field][bit>>3]|=1<<(bit&7);rejected(h);
        }
        for(const field of ['g_hdSpeDisplayVisibleFrames','g_hdSpeDisplayStatusClearFrames'])for(const bit of [start+3,18,255]){
            const h=fixture();h.effect(reason);h.raw[field][bit>>3]|=1<<(bit&7);const v=h.baye.hd.spe();
            assert.equal(v.statusEffect.valid,true);neutral(v.display.statusEffect);h.untouched();
        }
    }
});
test('display can lag but cannot use a foreign or future copy ticket or clear history',()=>{
    for(const [field,value] of [['Generation',8],['EventId',32],['CommitSeq',0],['CommitSeq',6],['FrameIndex',5],['FrameIndex',65535],['FrameValid',0]]){
        const h=fixture();h.effect();h.raw['g_hdSpeDisplay'+field]=value;const v=h.baye.hd.spe();assert.equal(v.statusEffect.valid,true);neutral(v.display.statusEffect);h.untouched();
    }
    const h=fixture();h.effect();h.raw.g_hdSpeStatusClearFrames=bits(0);h.raw.g_hdSpeDisplayStatusClearFrames=bits(1);
    const v=h.baye.hd.spe();assert.equal(v.statusEffect.valid,true);neutral(v.display.statusEffect);h.untouched();
});
test('movie end, invalid source, battle end and native overlays retire even an otherwise matching copied status',()=>{
    for(const [field,value] of [['g_hdSpeActive',0],['g_hdSpeStatusValid',0],['g_FgtOver',1],['g_hdReportActive',1],['g_hdHelpActive',1],['g_hdQtyActive',1]]){
        const h=fixture();h.effect();h.raw[field]=value;rejected(h);
    }
    const h=fixture();h.effect();Object.assign(h.raw,{g_hdAttackActive:1,g_hdAttackPhase:3,g_hdSkillResultActive:1,g_hdSkillResultPhase:3,
        g_hdResultOwnerKind:2,g_hdResultOwnerValid:1,g_hdResultOwnerGeneration:7,g_hdResultOwnerSession:999});
    assert.equal(h.baye.hd.spe().display.statusEffect.valid,true,'foreign numeric owner does not supply status facts');
    h.raw.g_hdSpeActive=0;rejected(h);
});
test('last-byte mutations of identity, range, mutation fields and overlays cannot join two observations',()=>{
    for(const [field,value] of [['g_hdSpeEventId',32],['g_hdSpeId',35],['g_hdSpeCommitSeq',6],['g_hdSpeResourceFingerprint',1],
        ['g_hdSpeDisplayEventId',32],['g_hdSpeStatusSubjectPerson',700],['g_hdSpeStatusAfterLevel',11],['g_hdSpeStatusValid',0],['g_hdReportActive',1]]){
        const h=fixture();h.effect();let changed=false;h.onRead((name,key)=>{
            if(!changed&&name==='.g_hdSpeDisplayStatusBaseRgba'&&key==='1023'){changed=true;h.raw[field]=value;}
        });rejected(h);assert.equal(changed,true,field);
    }
});
test('full stability rereads and the final scalar fence reject late pixel and owner mutations',()=>{
    const h=fixture();h.effect();let visits=0;h.onRead((name,key)=>{
        if(name==='.g_hdSpeDisplayStatusClearFrames'&&key==='31'&&++visits===2)h.raw.g_hdSpeStatusBaseRgba[8]=49;
    });rejected(h);assert.ok(visits>=2);
    const f=fixture();f.effect();visits=0;f.onRead((name,key)=>{
        if(name==='.g_hdSpeDisplayStatusClearFrames'&&key==='31'&&++visits===3)f.raw.g_hdSpeEventId=32;
    });rejected(f);assert.equal(visits,3);
});
test('exceptions stay neutral and detached observations do not write, queue input or revive a retired base',()=>{
    for(const field of ['g_hdSpeStatusProtocolVersion','g_hdSpeStatusBasePixels','g_hdSpeDisplayStatusBaseRgba']){
        const h=fixture();h.effect();h.onRead((name,key)=>{if(name===''&&key===field)throw Error('missing native binding');});rejected(h);
    }
    const h=fixture();h.effect();const old=h.baye.hd.spe();old.statusEffect.basePixels[0]=0;old.statusEffect.baseRgba[3]=0;old.display.statusEffect.clearFrames[0]=0;
    assert.equal(h.raw.g_hdSpeStatusBasePixels[0],255);assert.equal(h.raw.g_hdSpeStatusBaseRgba[3],255);assert.deepEqual(h.raw.g_hdSpeDisplayStatusClearFrames,bits(0,1));
    h.raw.g_hdSpeStatusValid=0;rejected(h);assert.equal(old.statusEffect.valid,true);h.untouched();
});
test('actual native declarations and bindings retain the scalar ABI and all embedded-zero array bytes',()=>{
    assert.match(header,/#define\s+BAYE_HD_STATUS_EFFECT_VERSION\s+1\b/);
    assert.match(header,/#define\s+BAYE_HD_STATUS_EFFECT_PIXELS\s+256\b/);
    assert.match(header,/#define\s+BAYE_HD_STATUS_EFFECT_RGBA_BYTES\s+1024\b/);
    assert.match(native,/\bU8\s+g_hdSpeStatusProtocolVersion\b/);
    const u16=new Set(['SubjectPerson','BeforeHp','AfterHp','BeforeArms','AfterArms','LevelMax','ScreenWidth','ScreenHeight','RegionWidth','RegionHeight']);
    for(const prefix of ['g_hdSpeStatus','g_hdSpeDisplayStatus']){
        for(const field of Object.keys(statusFields)){
            const type=['PaletteZero','PaletteInk'].includes(field)?'U32':['RegionX','RegionY'].includes(field)?'I16':u16.has(field)?'U16':'U8';
            assert.match(native,new RegExp('\\b'+type+'\\s+'+prefix+field+'\\b'),prefix+field);
            assert.match(native,new RegExp('DEFADDF\\(\\s*'+prefix+field+'\\s*,\\s*'+(type==='I16'?'U16':type)+'\\s*\\)'),prefix+field+' actual binding');
        }
        for(const [field,constant] of [['BasePixels','BAYE_HD_STATUS_EFFECT_PIXELS'],['BaseRgba','BAYE_HD_STATUS_EFFECT_RGBA_BYTES'],['ClearFrames','BAYE_HD_SPE_FRAME_BYTES']]){
            assert.ok(new RegExp('\\bU8\\s+'+prefix+field+'\\s*\\[\\s*'+constant+'\\s*\\]').test(native),field+' actual storage');
            assert.ok(new RegExp('DEFADD_U8ARR\\(\\s*'+prefix+field+'\\s*,\\s*'+constant+'\\s*\\)').test(native),field+' complete U8 array binding');
        }
    }
});
test('real unsigned WASM i32 observations preserve status palettes, FNV and high-bit generations',()=>{
    const h=fixture();h.effect();const module=new WebAssembly.Module(Uint8Array.from([0,97,115,109,1,0,0,0,1,6,1,96,1,127,1,127,3,2,1,0,5,3,1,0,1,7,17,2,6,109,101,109,111,114,121,2,0,4,114,101,97,100,0,0,10,9,1,7,0,32,0,40,2,0,11]));
    const actual=new WebAssembly.Instance(module).exports,memory=new DataView(actual.memory.buffer),c=h.context;
    c.Module.HEAPU8=new Uint8Array(actual.memory.buffer);c._ValueDef_get_type=()=>c.ValueTypeU32;c._baye_get_u32_value=actual.read;
    c._baye_set_u32_value=()=>{throw Error('native U32 write');};const bindings=[];
    for(const [i,unsigned] of [0xff000000,0xba494eea,0x80000000].entries()){
        const at=128+i*4;memory.setUint32(at,unsigned,true);assert.equal(actual.read(at),unsigned-0x100000000);
        bindings[i]=c.baye_bridge_valuedef(1,at);assert.equal(bindings[i].value,unsigned);
    }
    h.raw.g_hdSpeStatusPaletteInk=h.raw.g_hdSpeDisplayStatusPaletteInk=bindings[0];h.raw.g_hdSpeResourceFingerprint=bindings[1];
    h.raw.g_hdSpeGeneration=h.raw.g_hdSpeDisplayGeneration=bindings[2];
    const v=h.baye.hd.spe();assert.equal(v.display.statusEffect.valid,true);assert.equal(v.statusEffect.paletteInk,0xff000000);assert.equal(v.generation,0x80000000);h.untouched();
});
test('the actual manifest writer records independent status1 and unchanged SPE2/AI2 metadata without building an engine',()=>{
    const directory=mkdtempSync(path.join(tmpdir(),'baye-status-writer-'));
    try{
        writeFileSync(path.join(directory,'baye.js'),'// writer fixture\r\n');
        writeFileSync(path.join(directory,'baye.wasm'),Uint8Array.from([0,97,115,109,1,0,0,0]));
        writeFileSync(path.join(directory,'baye.wasm.map'),'{}\n');
        const sources=path.join(directory,'sources.txt');writeFileSync(sources,'vendor/iBaye/src/hd-bridge.h\0vendor/iBaye/src/hd-bridge.c\0');
        const result=spawnSync(process.execPath,[path.join(root,'scripts/write-wasm-manifest.mjs'),directory,'writer-fixture',sources,'synthetic-writer-input','0','modified'],
            {cwd:root,encoding:'utf8',env:{...process.env,SOURCE_DATE_EPOCH:'1'}});
        assert.equal(result.status,0,result.stderr);const manifest=JSON.parse(readFileSync(path.join(directory,'baye.build.json'),'utf8'));
        assert.equal(manifest.hdSpeProtocol.version,2);assert.equal(manifest.hdAiTargetProtocol.version,2);
        const status=manifest.hdStatusEffectProtocol;assert.equal(status.version,1);
        assert.deepEqual(status.publicApi,['baye.hd.spe().statusEffect','baye.hd.spe().display.statusEffect']);
        assert.deepEqual(status.reasons,{upgrade:1,death:2});assert.deepEqual(status.phases,{command:1,initialize:2});
        assert.deepEqual(status.base,['g_hdSpeStatusBasePixels','g_hdSpeDisplayStatusBasePixels']);
        assert.deepEqual(status.baseRgba,['g_hdSpeStatusBaseRgba','g_hdSpeDisplayStatusBaseRgba']);
        assert.deepEqual(status.clears,['g_hdSpeStatusClearFrames','g_hdSpeDisplayStatusClearFrames']);
        const bindings=['g_hdSpeStatusProtocolVersion',...['g_hdSpeStatus','g_hdSpeDisplayStatus'].flatMap(prefix=>
            [...Object.keys(statusFields),'BasePixels','BaseRgba','ClearFrames'].map(field=>prefix+field))];
        assert.deepEqual(status.bindings,bindings);
        for(const binding of status.bindings)assert.ok(native.includes(binding),binding+' exists in actual native source');
        assert.match(status.scope,/0\.\.5.*6\.\.11/);assert.match(status.input,/no skip, return or numeric hold owner/);
    }finally{rmSync(directory,{recursive:true,force:true});}
});
