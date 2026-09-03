import {NextResponse} from 'next/server';
import {vtunaija,VtunaijaError} from '@/lib/vtunaija';
import {requirePin} from '@/lib/authz';

export async function POST(req:Request){
  try{
    const b=await req.json();
    await requirePin(String(b.pin||''));
    const examName=String(b.exam_name??b['exam-name']??b.examName??'').trim();
    const quantity=Number(b.quantity);
    if(!examName||!Number.isInteger(quantity)||quantity<1) return NextResponse.json({error:'exam-name and a valid quantity are required'},{status:400});
    return NextResponse.json(await vtunaija.exam({exam_name:examName,quantity}));
  }catch(e:any){
    const status=e instanceof VtunaijaError?e.status:e?.message==='UNAUTHORIZED'?401:400;
    return NextResponse.json({error:e.message,details:e.details},{status});
  }
}
