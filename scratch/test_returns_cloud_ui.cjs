const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const D=require('../App/company-returns-data.js');
test('old drafts transfer explicitly, save online, and deleting the last report can be saved',async()=>{
 const elements=new Map(),values=new Map();
 function element(){return {value:'',style:{},options:[],events:{},classList:{add(){},remove(){}},addEventListener(e,f){this.events[e]=f;},replaceChildren(...children){this.options=children;},append(){},add(o){this.options.push(o);},focus(){},scrollIntoView(){},querySelectorAll(){return [];}};}
 const document={body:element(),createElement:element,getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);},addEventListener(){}};
 const storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};
 const original=JSON.stringify({version:1,activeId:'old',reports:[{id:'old',company:'Apotex',lines:[],entry:{product:'unfinished'}}]});
 storage.setItem('pharmaops:company-returns:v1:p',original);
 let staged,online,dirty=false;
 const session={load:async()=>({value:{version:1,activeId:null,reports:[]}}),stage(v){staged=JSON.parse(JSON.stringify(v));dirty=true;},isDirty:()=>dirty,async save(v){online=JSON.parse(JSON.stringify(v));dirty=false;return {dirty:false};}};
 const window={CompanyReturnsData:D,CompanyReturnsCloud:{create:()=>session},addEventListener(){}};
 const sandbox={window,document,localStorage:storage,crypto:require('node:crypto').webcrypto,TextEncoder,confirm:()=>true,Option:function(text,value){this.textContent=text;this.value=value;},setTimeout,Blob,URL};
 vm.runInNewContext(fs.readFileSync('App/company-returns.js','utf8'),sandbox);
 await window.CompanyReturns.open({client:{},userId:'u',pharmacyId:'p',pharmacyName:'Test',catalog:()=>[]});
 assert.equal(staged.reports.length,1);assert.equal(staged.reports[0].company,'');
 await elements.get('cr-import').events.click();
 assert.equal(staged.reports.length,2);assert.equal(elements.get('cr-product').value,'unfinished');
 assert.equal(storage.getItem('pharmaops:company-returns:v1:p'),original);
 await elements.get('cr-save').events.click();assert.equal(online.reports.length,2);assert.match(elements.get('cr-sync').textContent,/Saved to your pharmacy/);
 await elements.get('cr-import').events.click();assert.equal(staged.reports.length,2);
 elements.get('cr-delete').events.click();elements.get('cr-delete').events.click();
 assert.equal(staged.reports.length,0);assert.equal(elements.get('cr-save').disabled,false);
 await elements.get('cr-save').events.click();assert.equal(online.reports.length,0);
 elements.get('cr-new').events.click();assert.equal(staged.reports.length,1);
});
