"use client";
import Image from "next/image";
import { useState } from "react";
import { initials } from "@/lib/format";
export function PlayerAvatar({name,photoUrl,small=false}:{name:string;photoUrl?:string|null;small?:boolean}) {
  const [failed,setFailed]=useState(false);
  return <span className={`avatar ${small?"small-avatar":""} player-avatar`}>{photoUrl&&!failed?<Image src={photoUrl} alt={`Foto de ${name}`} width={64} height={64} unoptimized onError={()=>setFailed(true)}/>:initials(name)}</span>;
}
