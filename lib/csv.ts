export function parseCsv(text:string):string[][]{
  const rows:string[][]=[];let row:string[]=[];let field='';let quoted=false
  for(let i=0;i<text.length;i++){
    const ch=text[i]
    if(quoted){
      if(ch==='"'&&text[i+1]==='"'){field+='"';i++;continue}
      if(ch==='"'){quoted=false;continue}
      field+=ch;continue
    }
    if(ch==='"'){quoted=true;continue}
    if(ch===','){row.push(field.trim());field='';continue}
    if(ch==='\n'){row.push(field.trim());field='';if(row.some(cell=>cell!==''))rows.push(row);row=[];continue}
    if(ch!=='\r')field+=ch
  }
  row.push(field.trim());if(row.some(cell=>cell!==''))rows.push(row)
  return rows
}

export function csvRecords(text:string):Record<string,string>[] {
  const rows=parseCsv(text.replace(/^\uFEFF/,''));if(rows.length<2)return []
  const headers=rows[0].map(h=>h.trim().toLowerCase().replace(/\s+/g,'_'))
  return rows.slice(1).map(row=>Object.fromEntries(headers.map((header,index)=>[header,row[index]??''])))
}
