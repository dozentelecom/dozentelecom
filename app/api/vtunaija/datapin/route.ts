import {NextResponse} from 'next/server';
import {vtunaija,VtunaijaError} from '@/lib/vtunaija';
import {requirePin} from '@/lib/authz';

export async function POST(req:Request){
  try{
    const b=await req.json();
    await requirePin(String(b.pin||''));
    const network=String(b.network??'').trim();
    const dataPlan=String(b.data_plan??'').trim();
    const quantity=Number(b.quantity);
    const businessname=String(b.businessname??'').trim();
    if(!network||!dataPlan||!Number.isInteger(quantity)||quantity<1||!businessname) return NextResponse.json({error:'network, data_plan, quantity and businessname are required'},{status:400});
    return NextResponse.json(await vtunaija.dataPin({network,quantity,data_plan:dataPlan,businessname,ref:String(b.ref||`DATAPIN-${Date.now()}`)}));
  }catch(e:any){
    const status=e instanceof VtunaijaError?e.status:e?.message==='UNAUTHORIZED'?401:400;
    return NextResponse.json({error:e.message,details:e.details},{status});
  }
}
