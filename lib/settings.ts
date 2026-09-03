import {db} from "./db";
import {Settings} from "./models";
import {DEFAULTS,assertRate,RateKey} from "./pricing";
export async function getRates(){
  await db();
  const row:any=await Settings.findOne({key:"pricing"}).lean();
  return {...DEFAULTS,...(row?.rates||{})};
}
export async function saveRates(input:any){
  const rates:any={...DEFAULTS};
  for(const k of Object.keys(DEFAULTS) as string[]){
    if(input[k]===undefined) continue;
    const n=Number(input[k]);
    if(k in DEFAULTS && k!=='airtimeRoundUnit') assertRate(k as RateKey,n);
    if(k==='airtimeRoundUnit' && (!Number.isFinite(n)||n<1)) throw new Error('Round unit must be at least 1');
    rates[k]=n;
  }
  await db();
  await Settings.findOneAndUpdate({key:"pricing"},{key:"pricing",rates},{upsert:true,new:true});
  return rates;
}
