// Literal admission is pure; the actual sink is injected and must use exclusive-create.
import assert from'node:assert/strict';import{createHash}from'node:crypto';
export function validateCity4ArtifactName(name){
 assert.equal(typeof name,'string');assert.ok(name.length>0&&name.length<=180);
 assert.match(name,/^[a-z0-9][a-z0-9.-]*$/,'Only admitted lowercase artifact basenames');
 assert.ok(!/^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(name),'No reserved Windows artifact basename');return name;
}

const sha=b=>createHash('sha256').update(b).digest('hex');
export const CITY4_END_COMPACT_ARTIFACTS=Object.freeze(["end-anchor-input-provenance.json","end-anchor-report.json","end-anchor-failure-report.json","city4-end-resume-ledger-candidate.json","end-anchor-zero-native-mode-preflight.json","end-anchor-presentation-preflight-classic.json","end-anchor-presentation-preflight-hd-map.json"]);
export function city4EndAnchorArtifactAdmission(saveTags){
 assert.deepEqual(Object.keys(saveTags).sort(),['failed','resume']);const names=[...CITY4_END_COMPACT_ARTIFACTS];
 for(const label of['loaded-p57-dispatch-before-end-anchor-save','city4-end-anchor-saved-map'])names.push(label+'.json',label+'.png');
 for(const label of['end-anchor-presentation-preflight-classic','end-anchor-presentation-preflight-hd-map'])for(const stage of['initial','fresh','after'])names.push(label+'-focus-'+stage+'.json');
 for(const tag of Object.values(saveTags)){names.push(tag+'-public-save.json');for(let i=0;i<2;i++)names.push('native-'+tag+'-sango'+i+'.sav');}
 for(const name of names)validateCity4ArtifactName(name);return Object.freeze(names.sort());
}
export function createCity4AnchorArtifactSink(persistExclusive,saveTags){
 assert.equal(typeof persistExclusive,'function');const allowed=new Set(city4EndAnchorArtifactAdmission(saveTags)),seen=new Set(),compact=new Set(CITY4_END_COMPACT_ARTIFACTS);
 return async(name,value)=>{validateCity4ArtifactName(name);assert.ok(allowed.has(name)||/^native-ticket-[0-9a-f]{64}\.json$/.test(name)||/^stable-ticket-[0-9]{3}\.json$/.test(name),'Every runtime write is an admitted actual artifact');assert.equal(seen.has(name),false,'No artifact overwrite');
  const bytes=Buffer.isBuffer(value)?value:Buffer.from(JSON.stringify(value,null,compact.has(name)?0:2)+'\n');assert.ok(bytes.length>0&&bytes.length<=32*1024*1024,'One complete original artifact must fit codec bounds');seen.add(name);
  const actual=await persistExclusive(name,bytes),expected={file:name,bytes:bytes.length,sha256:sha(bytes)};assert.deepEqual(actual,expected,'Exclusive sink returns the pin of the exact provided bytes');return expected;
 };
}
