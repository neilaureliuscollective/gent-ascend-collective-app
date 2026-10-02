import { describe,it,expect } from 'vitest';
import { baselineAnswer, confirmedFact, baselineStages } from '../src/domains/ascend-profile/schema';
describe('reviewed baseline input',()=>{
  it('requires a bounded answer and never accepts a caller-chosen owner',()=>{
    const answer={stage:0,answer:' Build a steadier company ',requestId:'84000000-0000-4000-8000-000000000001'};
    expect(baselineAnswer.parse(answer).answer).toBe('Build a steadier company');
    expect(baselineAnswer.safeParse({...answer,personId:'someone-else'}).success).toBe(false);
    expect(baselineStages).toHaveLength(6);
  });
  it('requires explicit version for correction or removal',()=>{
    const value={requestId:'84000000-0000-4000-8000-000000000001',key:'boundary',value:null,expectedVersion:2,sourceKind:'user',sourceExcerpt:null};
    expect(confirmedFact.safeParse(value).success).toBe(true);
    expect(confirmedFact.safeParse({...value,expectedVersion:-1}).success).toBe(false);
    expect(confirmedFact.safeParse({...value,key:'clinical_diagnosis'}).success).toBe(false);
  });
});
