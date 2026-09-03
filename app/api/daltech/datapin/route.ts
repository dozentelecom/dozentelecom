import {NextResponse} from "next/server";
import {daltech,DaltechError} from "@/lib/daltech";
import {requirePin} from "@/lib/authz";

export async function POST(req:Request){

  try{

    const b=await req.json();

    await requirePin(String(b.pin||""));

    return NextResponse.json(await daltech.datapin({
      network:b.network,
      quantity:b.quantity,
      data_plan:b.data_plan,
      businessname:b.businessname,
      ref:`DATAPIN_${Date.now()}`
    }));

  }catch(e:any){

    return NextResponse.json(
      {error:e.message},
      {status:e instanceof DaltechError?e.status:502}
    );
  }
}