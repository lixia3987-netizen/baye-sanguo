// Pure generated-expression syntax regression. Calls the actual production
// builder; vm.Script parses browser source without executing generated code.
import test from 'node:test';
import assert from 'node:assert/strict';
import {Script} from 'node:vm';
import {city4HdWoodPointExpression,CITY4_HD_WOOD_CURRENT_EXPRESSION,CITY4_HD_WOOD_CAPTURE_INSTALL_EXPRESSION,CITY4_HD_WOOD_CAPTURE_READ_EXPRESSION,CITY4_HD_WOOD_UI_EXPRESSION} from './hd-wood-city4-hd-action.mjs';

test('All four production fixed browser expressions are syntax-valid without VM execution',()=>{
 for(const [name,expression]of Object.entries({current:CITY4_HD_WOOD_CURRENT_EXPRESSION,install:CITY4_HD_WOOD_CAPTURE_INSTALL_EXPRESSION,capture:CITY4_HD_WOOD_CAPTURE_READ_EXPRESSION,ui:CITY4_HD_WOOD_UI_EXPRESSION})){assert.equal(typeof expression,'string');new Script(expression,{filename:'hd-action-fixed-'+name+'.js'});}
});
test('Actual production point builder syntax covers1024 tiles32 menu rows and system/focus-only branches',()=>{
 let checked=0;const compile=spec=>{const expression=city4HdWoodPointExpression(spec);assert.equal(typeof expression,'string');assert.ok(expression.includes('pointStyle=getComputedStyle(n)'));new Script(expression,{filename:'hd-action-point-'+checked+'.js'});checked++;};
 for(let y=0;y<32;y++)for(let x=0;x<32;x++)compile({type:'tile',x,y});
 for(let index=0;index<32;index++)compile({type:'menu',index,selector:'#hd-battle-menu-list [data-hd-battle-menu="'+index+'"]'});
 compile({type:'system',selector:'#hd-battle [data-hd-battle-sys]'});compile({type:'focus-only'});assert.equal(checked,1058);
});
test('Exact four-token inverse of the actual production point builder reproduces the s collision',()=>{
 const actual=city4HdWoodPointExpression.toString();assert.equal((actual.match(/\bpointStyle\b/g)||[]).length,4);
 const expression=city4HdWoodPointExpression({type:'tile',x:16,y:2});assert.equal((expression.match(/\bpointStyle\b/g)||[]).length,4);
 const regressed=expression.replaceAll('pointStyle','s');assert.equal((regressed.match(/s=getComputedStyle\(n\)/g)||[]).length,1);assert.ok(!regressed.includes('pointStyle'));
 assert.throws(()=>new Script(regressed,{filename:'hd-action-four-token-collision.js'}),/Identifier ['"]s['"] has already been declared/);
});
