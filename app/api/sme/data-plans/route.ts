import {NextResponse} from 'next/server';
import {smeapi,ProviderError,arrays} from '@/lib/smeapi';

export async function GET(){
  try{
    const raw=await smeapi.dataPlans();
    const plans=arrays(raw,['data','data_plans','plans','results']);

    return NextResponse.json({
      success:true,
      plans,
      raw
    });
  }catch(e:any){
    const s=e instanceof ProviderError?e.status:502;

    return NextResponse.json(
      {
        error:e.message,
        details:e.details
      },
      {status:s}
    );
  }
}