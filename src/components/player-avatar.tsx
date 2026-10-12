"use client";
import Image from "next/image";
import { X } from "lucide-react";
import { useRef, useState } from "react";
import { initials } from "@/lib/format";
export function PlayerAvatar({name,photoUrl,small=false,zoomable=false}:{name:string;photoUrl?:string|null;small?:boolean;zoomable?:boolean}) {
  const [failed,setFailed]=useState(false);
  const dialog=useRef<HTMLDialogElement>(null);
  const className=`avatar ${small?"small-avatar":""} player-avatar`;
  const photo=photoUrl&&!failed?<Image src={photoUrl} alt={`Foto de ${name}`} width={64} height={64} unoptimized onError={()=>setFailed(true)}/>:null;
  if (!photo) return <span className={className}>{initials(name)}</span>;
  if (!zoomable) return <span className={className}>{photo}</span>;
  // Clicking the backdrop (the dialog itself, outside the photo) closes it too.
  return <>
    <button type="button" className={`${className} avatar-zoom`} aria-haspopup="dialog" aria-label={`Ver la foto de ${name} ampliada`} onClick={()=>dialog.current?.showModal()}>{photo}</button>
    <dialog ref={dialog} className="photo-dialog" aria-label={`Foto de ${name}`} onClick={e=>{if(e.target===e.currentTarget)e.currentTarget.close();}}>
      <Image src={photoUrl!} alt={`Foto de ${name}`} width={600} height={1200} unoptimized/>
      <button type="button" className="photo-dialog-close" aria-label="Cerrar" onClick={()=>dialog.current?.close()}><X size={20}/></button>
    </dialog>
  </>;
}
