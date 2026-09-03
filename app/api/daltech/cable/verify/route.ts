import {NextResponse} from "next/server";
import {daltech,DaltechError} from "@/lib/daltech";

export async function POST(req:Request){

  try{

    const b=await req.json();

    return NextResponse.json(await daltech.cableVerify({
      provider:b.provider,
      iucnumber:b.iucnumber
    }));

  }catch(e:any){

    return NextResponse.json(
      {error:e.message},
      {status:e instanceof DaltechError?e.status:502}
    );
  }
}