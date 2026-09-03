export type RateKey='data'|'electricity'|'cable'|'education'|'airtimeToCash'|'funding';
export const CAPS={data:5,electricity:4,cable:4,education:15,airtimeToCash:20,funding:3} as const;
export const DEFAULTS={data:5,electricity:4,cable:4,education:15,airtimeToCash:20,funding:1.5,airtimeRoundUnit:10} as const;
export function assertRate(k:RateKey,v:number){if(!Number.isFinite(v)||v<0||v>CAPS[k])throw new Error(`Rate for ${k} must be between 0% and ${CAPS[k]}%`);return v}
export function percentPrice(cost:number,rate:number){return Math.ceil(cost*(1+rate/100)*100)/100}
export function roundAirtime(cost:number,unit=10){return Math.ceil(cost/unit)*unit}
