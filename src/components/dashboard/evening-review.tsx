'use client';
import { useState } from 'react';
import type { DayEntry } from '@/domains/daily/model';

type Fields={progress:string;blocker:string;tomorrow:string};
const blank:Fields={progress:'',blocker:'',tomorrow:''};
export function EveningReview({day,onSaved,disabled}:{day:DayEntry;onSaved:(data:unknown)=>void;disabled:boolean}) {
 const [editing,setEditing]=useState(false);
 const [draft,setDraft]=useState<Fields>(blank);
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState('');
 function open(){setDraft(day.review?{progress:day.review.progress,blocker:day.review.blocker,tomorrow:day.review.tomorrow}:blank);setNotice('');setEditing(true);}
 async function request(method:'POST'|'PUT',body:unknown) {
  const response=await fetch('/api/daily/review',{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
  const result=await response.json();
  if(!response.ok) throw new Error(result.error??'The review was not confirmed. Reload your saved day.');
  return result;
 }
 async function propose(){setBusy(true);setNotice('');try {
  const result=await request('POST',{day:day.day,sourceDayVersion:day.version,requestId:crypto.randomUUID()});
  setDraft(result.review);setNotice('Draft prepared. Edit anything Aethelios missed before confirming.');
 }catch(error){setNotice(error instanceof Error?error.message:'No proposal was saved.');}finally{setBusy(false);}}
 async function save(){setBusy(true);setNotice('');try {
  const result=await request('PUT',{day:day.day,sourceDayVersion:day.version,expectedReviewVersion:day.review?.version??0,requestId:crypto.randomUUID(),review:draft});
  onSaved(result);setEditing(false);
 }catch(error){setNotice(error instanceof Error?error.message:'No review was confirmed. Reload your saved day.');}finally{setBusy(false);}}
 return <section className="evening-review" aria-label="Evening review">
  <span className="eyebrow">WHAT TOMORROW SHOULD KNOW</span>
  {day.review&&!editing&&<div className="evening-review-summary">
   {day.review.progress&&<p><strong>Moved forward</strong> {day.review.progress}</p>}
   {day.review.blocker&&<p><strong>Open friction</strong> {day.review.blocker}</p>}
   {day.review.tomorrow&&<p><strong>Carry forward</strong> {day.review.tomorrow}</p>}
  </div>}
  {!editing?<button className="text-button" disabled={disabled} onClick={open}>{day.review?'Refine your review':'Close the loop for today'} →</button>:
   <div className="evening-review-editor">
    <p>Your saved day is the source. Aethelios can suggest a draft; only your confirmation adds it to tomorrow’s context.</p>
    {day.reflection&&<button className="text-button" disabled={busy||disabled} onClick={()=>void propose()}>Prepare from my reflection with Aethelios →</button>}
    <label>What moved forward?<textarea maxLength={240} rows={2} value={draft.progress} onChange={event=>setDraft({...draft,progress:event.target.value})} /></label>
    <label>What stood in the way?<textarea maxLength={240} rows={2} value={draft.blocker} onChange={event=>setDraft({...draft,blocker:event.target.value})} /></label>
    <label>What should tomorrow remember?<textarea maxLength={240} rows={2} value={draft.tomorrow} onChange={event=>setDraft({...draft,tomorrow:event.target.value})} /></label>
    <div><button className="secondary-button" disabled={busy||disabled||!Object.values(draft).some(value=>value.trim())} onClick={()=>void save()}>{busy?'Working…':'Confirm review'}</button><button className="text-button" disabled={busy} onClick={()=>setEditing(false)}>Cancel</button></div>
   </div>}
  {notice&&<p role="status">{notice}</p>}
 </section>;
}
