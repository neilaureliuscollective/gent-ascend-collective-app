'use client';
import { useState } from 'react';
import Link from 'next/link';
import type { ActionProposal } from '@/domains/intelligence/types';
import { jsonRequest } from './memory-editor';

export function ActionReview({turnId,proposal,onChanged,disabled}:{turnId:string;proposal?:ActionProposal;onChanged:()=>Promise<void>;disabled:boolean}) {
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState('');
  async function propose() {
    setBusy(true);setNotice('');
    try {
      const result=await jsonRequest('/api/aurelius/actions','POST',{turnId,requestId:crypto.randomUUID(),proposalId:crypto.randomUUID()});
      await onChanged();
      setNotice(result.proposal?'Aethelios prepared one action. Review it below.':result.reason);
    } catch(error) {setNotice(error instanceof Error?error.message:'No proposal was saved.');}
    finally {setBusy(false);}
  }
  async function decide(approve:boolean) {
    if(!proposal) return;
    setBusy(true);setNotice('');
    try {
      const result=await jsonRequest('/api/aurelius/actions','PUT',{proposalId:proposal.id,approve});
      await onChanged();
      setNotice(approve?`Confirmed on your day for ${result.day}.`:'Proposal dismissed. No action was created.');
    } catch(error) {setNotice(error instanceof Error?error.message:'No action was confirmed. Reload the saved state.');}
    finally {setBusy(false);}
  }
  return <section className="aethelios-action-review" aria-label="Aethelios action review">
    {proposal?.status==='pending'?<><span className="eyebrow">PROPOSED · NOT SAVED TO YOUR DAY</span><p>{proposal.title}</p><button className="secondary-button" disabled={busy||disabled} onClick={()=>void decide(true)}>Approve for today</button><button className="text-button" disabled={busy||disabled} onClick={()=>void decide(false)}>Dismiss</button></>:
      proposal?.status==='executed'?<p>✓ Action confirmed for {proposal.executed_day}. <Link href="/">View Command →</Link></p>:
      proposal?.status==='rejected'?<p>Proposal dismissed. No action was created.</p>:
      <button className="text-button" disabled={busy||disabled} onClick={()=>void propose()}>Ask Aethelios for one actionable next step →</button>}
    {notice&&<p role="status">{notice}</p>}
  </section>;
}
