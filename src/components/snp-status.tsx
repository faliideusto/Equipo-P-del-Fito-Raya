"use client";
import { useEffect,useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { announceSnpCheck } from "@/lib/snp-updates";
export function SnpStatus() {
  const [label,setLabel]=useState("SNP · No disponible"); const router=useRouter(); const pathname=usePathname();
  useEffect(()=>{
    let cancelled=false; let busy=false;
    async function update(){if(busy||document.hidden)return;busy=true;try{
      const status=await fetch("/api/snp/status").then(r=>r.json());
      if(cancelled)return;
      if(!status.configured){setLabel("SNP · No disponible");return;}
      const response=await fetch("/api/snp/sync",{method:"POST"}); const result=await response.json();
      if(cancelled)return;
      setLabel(result.ok?"SNP conectado · Auto":"SNP · Datos guardados");
      if(result.changed)router.refresh();
      announceSnpCheck();
    }catch{if(!cancelled)setLabel("SNP · Sin conexión");}finally{busy=false;}}
    void update();const timer=setInterval(()=>void update(),60000);return()=>{cancelled=true;clearInterval(timer);};
    // Check SNP on every section change; the page is only re-rendered when the data changed.
  },[router,pathname]);
  return <span className="snp-status"><span className="status-dot"/>{label}</span>;
}
