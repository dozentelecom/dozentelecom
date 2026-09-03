import {NextResponse} from 'next/server';
import {vtunaija,VtunaijaError} from '@/lib/vtunaija';

export async function POST(req:Request){
  try{
    const b=await req.json();
    const cablename=String(b.cablename??b.cable_name??'').trim();
    const smartCardNumber=String(b.smart_card_number??b.iucnumber??'').trim();
    if(!cablename||!smartCardNumber) return NextResponse.json({error:'cablename and smart_card_number are required'},{status:400});
    return NextResponse.json(await vtunaija.cableVerify({cablename,smart_card_number:smartCardNumber}));
  }catch(e:any){
    const status=e instanceof VtunaijaError?e.status:502;
    return NextResponse.json({error:e.message,details:e.details},{status});
  }
}
