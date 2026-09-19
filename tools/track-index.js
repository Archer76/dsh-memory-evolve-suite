const fs=require('fs');
const p=process.argv[2];
if(!p){console.error('用法: node track-index.js <轨文件>');process.exit(2);}
const t=fs.readFileSync(p,'utf8');
const blocks=t.split(/\r?\n[ \t]*§[ \t]*\r?\n/);
let i=0;
for(const b of blocks){
  i++;
  const lines=b.split(/\r?\n/).filter(x=>x.trim()!=='');
  const head=lines[0]||'';
  const second=lines[1]||'';
  const date=(second.match(/\[(\d{4}-\d{2}-\d{2})\]/)||head.match(/\[(\d{4}-\d{2}-\d{2})\]/)||[])[1]||'----';
  const title=second.replace(/^\[\d{4}-\d{2}-\d{2}\]\s*/,'')||head;
  console.log(String(i).padStart(3)+' | '+date+' | '+b.length.toString().padStart(6)+' | '+title.slice(0,90));
}
console.log('TOTAL BLOCKS: '+blocks.length+'  chars: '+t.length);
