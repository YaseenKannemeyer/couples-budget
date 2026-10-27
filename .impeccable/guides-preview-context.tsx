/** Synthetic, memory-only guide state for visual checks. No auth or remote writes. */
import { useState, type ReactNode } from 'react';
import { GuideContext } from '../src/features/guides/context';
import { findGuide } from '../src/features/guides/registry';
import type { ProgressMap } from '../src/features/guides/progress';
const request = '00000000-0000-4000-8000-000000000001';
export function GuidePreviewContext({ screen, setScreen, children }: {screen:string;setScreen:(s:string)=>void;children:ReactNode}) {
 const params=new URLSearchParams(window.location.search);
 const [active,setActive]=useState<string|null>(params.get('guide'));
 const [index,setIndex]=useState(Number(params.get('step')??0));
 const guide=active?findGuide(active):undefined;
 const rows:ProgressMap=guide?{[guide.id]:{guide_id:guide.id,guide_version:1,step_id:guide.steps[index].id,status:'in_progress',revision:1,request_id:request,pending:false}}:{};
 const paths:Record<string,string>={'budget-empty':'/budget-categories',home:'/',shared:'/shared-budget',private:'/private-space',cashflow:'/cash-flow','quick-log-choice':'/quick-log','quick-log':'/quick-log',payments:'/payments',payment:'/payment',categories:'/categories',category:'/category','budget-link':'/budget-categories'};
 const navigate=(path:string)=>{const next=Object.keys(paths).find(k=>paths[k]===path);if(next)setScreen(next);};
 return <GuideContext value={{rows,ready:true,active,path:paths[screen]??'/guides',localError:false,syncError:false,
 start:(id)=>{const g=findGuide(id);setActive(id);setIndex(0);if(g)navigate(String(g.steps[0].route));},
 close:()=>setActive(null),dismiss:()=>setActive(null),move:direction=>{
  if(!guide)return;const next=index+direction;if(next>=guide.steps.length){setActive(null);return;}
  setIndex(Math.max(0,next));navigate(String(guide.steps[Math.max(0,next)].route));
 },signal:()=>{},register:()=>()=>{},retry:()=>{}}}>{children}</GuideContext>;
}
