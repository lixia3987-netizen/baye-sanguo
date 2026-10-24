// JSON.stringify value normalization before strict V23 transport. No imports, I/O or gameplay credit.
// Supported: plain objects/default arrays, no accessors or toJSON hooks. Shared object identities are memoized.
export function normalizeV23JsonValue(value,{maxDepth=256,maxNodes=10000000}={}){
 if(!Number.isSafeInteger(maxDepth)||maxDepth<1||!Number.isSafeInteger(maxNodes)||maxNodes<1)throw new TypeError('V23 JSON normalize: invalid limits');
 const memo=new WeakMap(),active=new WeakSet();let nodes=0;const omit=undefined;
 const fail=m=>{throw new TypeError('V23 JSON normalize: '+m);};
 function put(o,k,v){Object.defineProperty(o,k,{value:v,writable:true,enumerable:true,configurable:true});}
 function walk(v,depth){if(depth>maxDepth)fail('depth limit');if(++nodes>maxNodes)fail('node limit');
  if(v===null||typeof v==='string'||typeof v==='boolean')return v;
  if(typeof v==='number')return Number.isFinite(v)?(v===0?0:v):null;
  if(v===undefined||typeof v==='function'||typeof v==='symbol')return omit;
  if(typeof v==='bigint')fail('BigInt is not JSON.stringify serializable');
  if(!v||typeof v!=='object')fail('unsupported value');
  if(active.has(v))fail('cyclic JSON');if(memo.has(v))return memo.get(v);
  const array=Array.isArray(v),proto=Object.getPrototypeOf(v);if(array?proto!==Array.prototype&&proto!==null:proto!==Object.prototype&&proto!==null)fail('non-plain object');
  const d=Object.getOwnPropertyDescriptors(v);for(const q of Object.values(d))if(!Object.prototype.hasOwnProperty.call(q,'value'))fail('accessors are not supported');
  if(d.toJSON&&typeof d.toJSON.value==='function')fail('custom toJSON is not supported');
  active.add(v);const out=array?[]:{};memo.set(v,out);
  if(array){if(v.length>maxNodes)fail('array length limit');for(let i=0;i<v.length;i++){const q=d[String(i)],x=walk(q?q.value:undefined,depth+1);put(out,String(i),x===omit?null:x);}}
  else for(const k of Object.keys(v)){const x=walk(d[k].value,depth+1);if(x!==omit)put(out,k,x);}
  active.delete(v);return out;
 }
 return walk(value,0);
}
