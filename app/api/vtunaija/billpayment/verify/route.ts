import {NextResponse} from 'next/server';
import {vtunaija,VtunaijaError} from '@/lib/vtunaija';

export async function POST(req:Request){
  try{
    const b=await req.json();
    const discoName=String(b.disco_name??b.disconame??'').trim();
    const meterNumber=String(b.meter_number??b.meternumber??'').trim();
    if(!discoName||!meterNumber) return NextResponse.json({error:'disco_name and meter_number are required'},{status:400});
    return NextResponse.json(await vtunaija.electricityVerify({disco_name:discoName,meter_number:meterNumber}));
  }catch(e:any){
    const status=e instanceof VtunaijaError?e.status:502;
    return NextResponse.json({error:e.message,details:e.details},{status});
  }
}
