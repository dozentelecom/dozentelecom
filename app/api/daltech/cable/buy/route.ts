import {NextResponse} from "next/server";
import {daltech,DaltechError} from "@/lib/daltech";
import {requirePin} from "@/lib/authz";

export async function POST(req:Request){

  try{

    const b=await req.json();

    await requirePin(String(b.pin||""));

    return NextResponse.json(await daltech.cable({
      provider:b.provider,
      iucnumber:b.iucnumber,
      plan:b.plan,
      subtype:b.subtype,
      phone:b.phone,
      ref:`CABLE_${Date.now()}`
    }));

  }catch(e:any){

    return NextResponse.json(
      {error:e.message},
      {status:e instanceof DaltechError?e.status:502}
    );
  }
}