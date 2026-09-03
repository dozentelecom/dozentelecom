import {NextResponse} from "next/server";
import {daltech,DaltechError} from "@/lib/daltech";

export async function POST(req:Request){

  try{

    const b=await req.json();

    return NextResponse.json(await daltech.electricityVerify({
      provider:b.provider,
      meternumber:b.meternumber,
      metertype:b.metertype
    }));

  }catch(e:any){

    return NextResponse.json(
      {error:e.message},
      {status:e instanceof DaltechError?e.status:502}
    );
  }
}