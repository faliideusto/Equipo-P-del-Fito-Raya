// SNP publishes Spanish local wall-clock dates. Do not let the server's timezone shift them.
export function snpDate(value:unknown):string|null {
  const text=String(value||"").trim().replace(" ","T");
  if(!text)return null;
  if(/^\d{4}-\d{2}-\d{2}$/.test(text))return Number.isNaN(Date.parse(text))?null:text;
  if(/[zZ]$|[+-]\d{2}:?\d{2}$/.test(text))return Number.isNaN(Date.parse(text))?null:new Date(text).toISOString();
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(text))return null;
  const wallTime=Date.parse(text+"Z");if(Number.isNaN(wallTime))return null;
  const formatter=new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Madrid",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"});
  let utc=wallTime;
  for(let i=0;i<2;i++){
    const parts=Object.fromEntries(formatter.formatToParts(new Date(utc)).map(p=>[p.type,p.value]));
    const rendered=Date.parse(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}Z`);
    utc+=wallTime-rendered;
  }
  return new Date(utc).toISOString();
}
