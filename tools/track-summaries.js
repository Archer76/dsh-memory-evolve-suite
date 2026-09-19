const fs=require('fs');
const p=process.argv[2];
if(!p){console.error('用法: node track-summaries.js <轨文件>');process.exit(2);}
const t=fs.readFileSync(p,'utf8');
const blocks=t.split(/\r?\n[ \t]*§[ \t]*\r?\n/);
let i=0; const out=[];
for(const b of blocks){
  i++;
  const lines=b.split(/\r?\n/).filter(x=>x.trim()!=='');
  const head=lines[0]||''; const second=lines[1]||'';
  const date=(second.match(/\[(\d{4}-\d{2}-\d{2})\]/)||head.match(/\[(\d{4}-\d{2}-\d{2})\]/)||[])[1]||'----';
  const isSum=/^\[summary:/.test(head);
  out.push('### '+i+' | '+date+' | sum='+(isSum?'Y':'N')+' | '+b.length+'B\n'+(isSum?head:second));
}
fs.writeFileSync(process.argv[3],out.join('\n\n'),'utf8');
console.log('lines in KEY.md: '+t.split(/\r?\n/).length);
console.log('wrote summaries -> '+process.argv[3]);
