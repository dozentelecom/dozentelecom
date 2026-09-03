import mongoose from 'mongoose';
let c:any;
export async function db(){
  if(c) return c;
  const uri=process.env.MONGODB_URI||process.env.MONGO_URI;
  if(!uri) throw new Error('MONGODB_URI/MONGO_URI missing');
  c=await mongoose.connect(uri,{serverSelectionTimeoutMS:10000});
  return c;
}
