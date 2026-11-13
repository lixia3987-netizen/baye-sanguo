// Caller-only display fence. No native/game/UI writes; all actual credit stays false.
import assert from'node:assert/strict';
export function verifyWoodClassicPresentation({before,after,mode,phase,proof=null}){
 assert.ok(before&&after&&before.world&&before.state&&before.meta);assert.ok(['classic','hd'].includes(mode));assert.ok(['before-native-AIM-confirmation','after-native-retirement','failure-retirement'].includes(phase));assert.equal(before.meta.battleMode,mode==='classic'?'hd':'classic');const expected=structuredClone(before);expected.meta.battleMode=mode;assert.deepEqual(after,expected,'Only the explicit public battle display mode may change; full world, keys, native owners and unknown metadata are preserved');
 const s=before.state.snapshot,f=s.fight;assert.deepEqual([s.spe.active,s.result.active,s.top.active,s.report.active],[0,false,false,0],'Display switches cannot skip or replace any live native effect/result/report');assert.ok(Number.isInteger(s.spe.generation)&&s.spe.generation>0);
 if(mode==='classic'){assert.equal(phase,'before-native-AIM-confirmation');assert.ok(proof);assert.deepEqual([f.active,f.over,f.wait,f.inputKind],[1,0,1,5]);assert.deepEqual(f,proof.fight,'Classic switch belongs to the actual complete native AIM proof');}
 else{assert.ok(phase==='after-native-retirement'||phase==='failure-retirement');assert.ok(!f.active||f.over||f.inputKind===1,'HD controls resume only after actual original action retirement');if(phase==='after-native-retirement')assert.ok(proof);}
 if(proof){assert.ok(Number.isInteger(proof.generation)&&proof.generation>0);assert.equal(s.spe.generation,proof.generation);assert.equal(after.state.snapshot.spe.generation,proof.generation);}
 return{accepted:true,phase,mode,fullTicketPreservedExceptBattleMode:true,worldPreserved:true,nativeKeysPreserved:true,sourceOnly:true,nativeInputSent:false,actualClassicAccepted:false,actualCastAccepted:false,hdAccepted:false,globalHdComplete:false};
}
