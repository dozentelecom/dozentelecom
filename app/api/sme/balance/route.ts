import {NextResponse} from 'next/server';import {smeapi,ProviderError} from '@/lib/smeapi';
export async function GET(){try{return NextResponse.json(await smeapi.user())}catch(e:any){const s=e instanceof ProviderError?e.status:502;return NextResponse.json({error:e.message,details:e.details},{status:s})}}
