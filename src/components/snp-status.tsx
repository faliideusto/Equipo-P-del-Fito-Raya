"use client";
import { useEffect,useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
export function SnpStatus() {
  const [label,setLabel]=useState("Conectar SNP"); const router=useRouter();
  useEffect(()=>{
    let cancelled=false; let busy=false;
    async function update(){if(busy||document.hidden)return;busy=true;try{
      const status=await fetch("/api/snp/status").then(r=>r.json());
      if(cancelled)return;
      if(!status.configured){setLabel("Conectar SNP");return;}
      const response=await fetch("/api/snp/sync",{method:"POST"}); const result=await response.json();
      if(cancelled)return;
      setLabel(result.ok?"SNP conectado · Auto":"SNP · Revisar conexión");
      if(result.ok)router.refresh();
    }catch{if(!cancelled)setLabel("SNP · Sin conexión");}finally{busy=false;}}
    void update();const timer=setInterval(()=>void update(),60000);return()=>{cancelled=true;clearInterval(timer);};
  },[router]);
  return <Link href="/conexion" className="snp-status"><span className="status-dot"/>{label}</Link>;
}
