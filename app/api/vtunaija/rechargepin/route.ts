import {NextResponse} from 'next/server';
import {vtunaija,VtunaijaError} from '@/lib/vtunaija';
import {requirePin} from '@/lib/authz';

export async function POST(req:Request){
  try{
    const b=await req.json();
    await requirePin(String(b.pin||''));
    const network=String(b.network??'').trim();
    const networkAmount=Number(b.network_amount??b.amount);
    const quantity=Number(b.quantity);
    const nameOnCard=String(b.name_on_card??b.businessname??'').trim();
    if(!network||!Number.isFinite(networkAmount)||!Number.isInteger(quantity)||quantity<10||!nameOnCard) return NextResponse.json({error:'network, network_amount, quantity (minimum 10) and name_on_card are required'},{status:400});
    return NextResponse.json(await vtunaija.rechargePin({network,network_amount:networkAmount,quantity,name_on_card:nameOnCard,ref:String(b.ref||`RECHARGE-${Date.now()}`)}));
  }catch(e:any){
    const status=e instanceof VtunaijaError?e.status:e?.message==='UNAUTHORIZED'?401:400;
    return NextResponse.json({error:e.message,details:e.details},{status});
  }
}
