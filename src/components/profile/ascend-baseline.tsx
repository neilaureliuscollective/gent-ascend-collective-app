'use client';
import { useState } from 'react';
import { baselineStages, factKeys, type FactKey } from '@/domains/ascend-profile/schema';

type Fact = {fact_key:FactKey;value:string|null;version:number;source_kind:'user'|'ai_proposal';confirmed_at:string};
type Proposal = {key:FactKey;value:string;certainty:'clear'|'needs_review';reason:string};
const labels:Record<FactKey,string>={direction:'Current direction',body:'Body & performance',presence:'Grooming & presence',recovery:'Recovery',work:'Work & responsibility',character:'Character',connection:'Relationships & community',coaching:'How Aethelios should support you',boundary:'Your boundaries'};
export function AscendBaseline({initial}:{initial:Fact[]}) {
  const [facts,setFacts]=useState(initial);
  const [stage,setStage]=useState(0);
  const [answer,setAnswer]=useState('');
  const [proposals,setProposals]=useState<Proposal[]|null>(null);
  const [editing,setEditing]=useState<FactKey|null>(null);
  const [editValue,setEditValue]=useState('');
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const [failed,setFailed]=useState(false);
  async function propose() {
    if(!answer.trim()||busy) return;
    setBusy(true);setMessage('');setFailed(false);
    try {
      const response=await fetch('/api/ascend-profile/propose',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({stage,answer:answer.trim(),requestId:crypto.randomUUID()}),signal:AbortSignal.timeout(21000)});
      const data=await response.json();
      if(!response.ok) throw new Error(data.error??'Aethelios could not review this answer.');
      setProposals(data.facts);
      setMessage(data.facts.length?'Review each detail before it becomes part of your profile.':'I did not find a durable detail in that answer. You can rephrase or continue.');
    } catch(error) {setFailed(true);setMessage(error instanceof Error?error.message:'Your answer remains here. Nothing was saved.');}
    finally {setBusy(false);}
  }
  async function confirm(key:FactKey,value:string|null,sourceKind:'user'|'ai_proposal',sourceExcerpt:string|null) {
    if(busy) return;
    setBusy(true);setMessage('');setFailed(false);
    try {
      const response=await fetch('/api/ascend-profile',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId:crypto.randomUUID(),key,value,expectedVersion:facts.find(f=>f.fact_key===key)?.version??0,sourceKind,sourceExcerpt}),signal:AbortSignal.timeout(15000)});
      const data=await response.json();
      if(!response.ok) throw new Error(data.error??'The detail could not be confirmed.');
      setFacts(current=>[...current.filter(f=>f.fact_key!==key),{fact_key:key,value:data.value,version:data.version,source_kind:sourceKind,confirmed_at:new Date().toISOString()}]);
      setProposals(current=>current?.filter(f=>f.key!==key)??null);
      setEditing(null);setMessage(value?'Confirmed in your Ascend Profile.':'That detail is no longer active.');
    } catch(error) {setFailed(true);setMessage(error instanceof Error?error.message:'Save not confirmed. Reload before retrying.');}
    finally {setBusy(false);}
  }
  const next=()=>{setStage(n=>Math.min(5,n+1));setAnswer('');setProposals(null);setMessage('');setFailed(false);};
  return <div className="ascend-baseline">
    <header><p className="eyebrow">ASCEND PROFILE / {stage+1} OF 6</p><h1>Begin where you are.</h1><p>Aethelios will ask a few direct questions. You decide what he keeps.</p></header>
    <div className="baseline-conversation">
      <div className="baseline-voice"><span className="eyebrow">AETHELIOS</span><p>{baselineStages[stage]?.prompt}</p></div>
      <label htmlFor="baseline-answer">Your answer</label>
      <textarea id="baseline-answer" rows={5} maxLength={1500} value={answer} onChange={e=>{setAnswer(e.target.value);setProposals(null);}} placeholder="Speak plainly. You can change these details later." />
      <div className="baseline-controls"><button className="button" disabled={busy||!answer.trim()} onClick={()=>void propose()}>{busy?'Working…':'Let Aethelios reflect it back'}</button>{stage===0&&<button className="secondary-button" disabled={busy||!answer.trim()||answer.trim().length>500} onClick={()=>void confirm('direction',answer.trim(),'user',null)}>Save my direction in my words</button>}<button className="text-button" disabled={busy} onClick={next}>{stage===5?'Return to first question':'Skip for now →'}</button></div>
      {stage===0&&answer.trim().length>500&&<p>For a direct save, keep your direction under 500 characters. Aethelios can still help distill the longer answer.</p>}
      {message&&<p role={failed?'alert':'status'}>{message}</p>}
      {proposals&&proposals.length>0&&<div className="baseline-proposals"><p className="eyebrow">PROPOSED FOR YOUR REVIEW</p>{proposals.map(proposal=><div className="baseline-proposal" key={proposal.key}><strong>{labels[proposal.key]}{proposal.certainty==='needs_review'?' · check wording':''}</strong><textarea rows={2} maxLength={500} value={proposal.value} onChange={e=>setProposals(list=>list?.map(item=>item.key===proposal.key?{...item,value:e.target.value}:item)??null)} /><p>{proposal.reason}</p><button className="secondary-button" disabled={busy||!proposal.value.trim()} onClick={()=>void confirm(proposal.key,proposal.value.trim(),'ai_proposal',answer.slice(0,500))}>Confirm this detail</button><button className="text-button" onClick={()=>setProposals(list=>list?.filter(item=>item.key!==proposal.key)??null)}>Discard suggestion</button></div>)}<button className="text-button" onClick={next}>{stage===5?'Review your profile':'Continue →'}</button></div>}
    </div>
    <section className="baseline-current"><p className="eyebrow">WHAT YOU HAVE CONFIRMED</p><h2>Your current state.</h2><p>These are user-confirmed details. Corrections replace the active value and keep a private revision record.</p><div className="baseline-facts">{factKeys.filter(key=>facts.some(f=>f.fact_key===key&&f.value)).map(key=>{const fact=facts.find(f=>f.fact_key===key)!;return <div className="baseline-fact" key={key}><span className="eyebrow">{labels[key]}</span>{editing===key?<><textarea rows={2} maxLength={500} value={editValue} onChange={e=>setEditValue(e.target.value)} /><button disabled={busy||!editValue.trim()} onClick={()=>void confirm(key,editValue.trim(),'user',null)}>Save correction</button><button disabled={busy} onClick={()=>setEditing(null)}>Cancel</button></>:<><p>{fact.value}</p><button className="text-button" onClick={()=>{setEditing(key);setEditValue(fact.value??'');}}>Correct</button><button className="text-button" disabled={busy} onClick={()=>void confirm(key,null,'user',null)}>Remove</button></>}</div>})}</div></section>
  </div>;
}
