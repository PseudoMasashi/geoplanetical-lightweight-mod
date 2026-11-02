'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {inspect,main}=require('../scripts/inspect-economy.cjs');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'geo-inspection-'));
function archive(name,entries,contents){
  const json=Buffer.from(JSON.stringify({files:entries})),size=8+Math.ceil(json.length/4)*4;
  const header=Buffer.alloc(8+size);header.writeUInt32LE(4,0);header.writeUInt32LE(size,4);
  header.writeUInt32LE(size-4,8);header.writeUInt32LE(json.length,12);json.copy(header,16);
  const file=path.join(root,name);fs.writeFileSync(file,Buffer.concat([header,...contents]));return file;
}
try{
  const source=Buffer.from('throw new Error("MUST NOT EXECUTE"); function monthly(){return inflation + unemployment + gdpGrowth;}');
  const game=archive('fixture.asar',{
    'worker.js':{size:source.length,offset:'0'},
    'private-save.json':{size:999999,offset:'999999'},
    'external.js':{size:3,unpacked:true},'link.js':{link:'../../secret.js'}
  },[source]);
  const before=fs.readFileSync(game),report=inspect(game);
  assert.equal(report.files.length,1);assert.equal(report.skipped.length,2);
  assert.equal(report.candidates[0].counts.inflation,1);
  assert.equal(report.candidates[0].counts.unemployment,1);
  assert.ok(report.candidates[0].snippets.some(s=>s.group==='monthEnd'));
  assert.deepEqual(fs.readFileSync(game),before,'Inspector must not write the game archive');
  const output=path.join(root,'output.json');assert.equal(main([game,output]),0);
  assert.throws(()=>main([game,output]),/already exists/,'Existing reports must not be overwritten');
  const invalid=archive('bad-offset.asar',{'worker.js':{size:20,offset:'900000'}},[]);
  assert.throws(()=>inspect(invalid),/truncated/);
  const truncated=path.join(root,'truncated.asar');fs.writeFileSync(truncated,Buffer.alloc(3));
  assert.throws(()=>inspect(truncated),/truncated/);
  const malformed=archive('bad-header.asar',{},[]);const bytes=fs.readFileSync(malformed);bytes.writeUInt32LE(0xffffffff,12);fs.writeFileSync(malformed,bytes);
  assert.throws(()=>inspect(malformed),/header/);
  console.log('Read-only economy inspection passed: source discovery, no execution, no save reads, no overwrite, no link traversal, malformed archive rejection.');
}finally{fs.rmSync(root,{recursive:true,force:true});}
