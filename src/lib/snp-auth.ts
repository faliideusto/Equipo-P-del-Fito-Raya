import makeFetchCookie from "fetch-cookie";
import { CookieJar } from "tough-cookie";
import { load } from "cheerio";
export const isSnpHost = (host:string) => host === "snpgalaxy.com" || host === "seriesnacionalesdepadel.snpgalaxy.com";
export function createSnpHttp(jar:CookieJar) {
  const cookieFetch=makeFetchCookie(fetch,jar);
  return async (input:string|URL,init:RequestInit={}) => {
    let url=new URL(input);let request={...init};
    for(let hop=0;hop<8;hop++){
      if(url.protocol!=="https:"||!isSnpHost(url.hostname))throw new Error("SNP solicita una entrada que debe completarse manualmente.");
      const response=await cookieFetch(url,{...request,cache:"no-store",redirect:"manual",signal:AbortSignal.timeout(20000)});
      if(![301,302,303,307,308].includes(response.status))return response;
      const target=response.headers.get("location");if(!target)return response;
      url=new URL(target,url);
      if(response.status===303||([301,302].includes(response.status)&&request.method==="POST"))request={method:"GET"};
    }
    throw new Error("SNP no pudo completar el acceso.");
  };
}
export async function authenticateSnp(email:string,password:string) {
  const jar=new CookieJar();const http=createSnpHttp(jar);
  try {
    const login=await http("https://snpgalaxy.com/usuario/login");
    const q=load(await login.text());
    const form=q("form").filter((_,e)=>q(e).find("input[name=password]").length>0).first();
    if(!form.length||q("iframe[src*=recaptcha],.g-recaptcha").length)throw new Error("manual");
    const action=new URL(form.attr("action")||login.url,login.url);
    if(action.hostname!=="snpgalaxy.com"||action.protocol!=="https:")throw new Error("manual");
    const body=new URLSearchParams();
    form.find("input[type=hidden]").each((_,e)=>{const name=q(e).attr("name");if(name)body.set(name,q(e).attr("value")||"");});
    body.set("email",email);body.set("password",password);
    const signed=await http(action,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body});
    const page=load(await signed.text());
    if(page("input[name=password],iframe[src*=recaptcha],.g-recaptcha").length)throw new Error("manual");
    const entry=page("a[href]").toArray().find(e=>/España\s*-\s*SNP/i.test(page(e).text()));
    if(!entry)throw new Error("manual");
    const target=new URL(page(entry).attr("href")!,signed.url);
    const wrapper=await http(target);const wrapperPage=load(await wrapper.text());
    const src=wrapperPage("#iframep").attr("src");if(!src)throw new Error("manual");
    const frameUrl=new URL(src,wrapper.url);
    if(frameUrl.hostname!=="seriesnacionalesdepadel.snpgalaxy.com"||frameUrl.protocol!=="https:")throw new Error("manual");
    // Only SNP cookies in memory. No password, Google state, or token logging.
    return {jar,http,frameUrl:frameUrl.toString()};
  } catch {
    throw new Error("No se pudo iniciar sesión en SNP. Comprueba el acceso propio de SNP en el archivo privado. Si SNP solicita una verificación, complétala en su web.");
  }
}
