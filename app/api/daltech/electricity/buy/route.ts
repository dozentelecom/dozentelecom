import {NextResponse} from "next/server";
import {daltech,DaltechError} from "@/lib/daltech";
import {requirePin} from "@/lib/authz";

export async function POST(req:Request){

  try{

    const b=await req.json();

    await requirePin(String(b.pin||""));

    return NextResponse.json(await daltech.electricity({
      provider:b.provider,
      meternumber:b.meternumber,
      amount:b.amount,
      metertype:b.metertype,
      phone:b.phone,
      ref:`METER_${Date.now()}`
    }));

  }catch(e:any){

    return NextResponse.json(
      {error:e.message},
      {status:e instanceof DaltechError?e.status:502}
    );
  }
}