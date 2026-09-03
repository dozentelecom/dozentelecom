import bcrypt from 'bcryptjs';export const hash=(s:string)=>bcrypt.hash(s,12);export const verify=(s:string,h:string)=>bcrypt.compare(s,h);export const validPin=(s:string)=>/^\d{4}$/.test(s)
