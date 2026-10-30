import {it,expect} from 'vitest';
import {WardLedger,withTuning,PHASE10,measure} from './balance-lab';
import {BALANCE} from '../data/balance';
it('attributes the single shared shield pool proportionally without a fake spending order',()=>{
 const ledger=new WardLedger(),absorbed:Record<string,number>={},unused:Record<string,number>={};
 ledger.add('iron',16);ledger.add('carbon',12);
 ledger.absorb(20,(id,n)=>absorbed[id]=n);ledger.clear((id,n)=>unused[id]=n);
 expect(absorbed.iron).toBeCloseTo(20*16/28);expect(absorbed.carbon).toBeCloseTo(20*12/28);
 expect(Object.values(unused).reduce((a,b)=>a+b,0)).toBeCloseTo(8);expect(ledger.amounts).toEqual({});
});
it('restores experimental values even on failure',()=>{
 const before=JSON.stringify(BALANCE);
 expect(()=>withTuning({...PHASE10,shield:8},()=>{expect(BALANCE.graphite.shield).toBe(8);throw Error('stop');})).toThrow('stop');
 expect(JSON.stringify(BALANCE)).toBe(before);
});
it('reports availability, actual blocked damage, surplus shields and acquired tile ages deterministically',()=>{
 const a=measure({boss:'warden',strategy:'mixed',runs:5}),b=measure({boss:'warden',strategy:'mixed',runs:5});
 expect(a).toEqual(b);expect(a.stalled).toBe(0);expect(a.attributedBlocked).toBeCloseTo(a.blocked);
 for(const m of Object.values(a.spells)){expect(m.opportunities).toBeGreaterThanOrEqual(m.casts);expect(m.shieldGenerated).toBeCloseTo(m.shieldAbsorbed+m.shieldUnused);expect(m.castOldestAge).toBeGreaterThanOrEqual(0);}
});
