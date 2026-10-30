import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {SPELLS,SPELL_BY_ID} from '../data/spells';
it('preserves every PHASE 10 recipe, chemical fact, affinity, engine, probability and combat layout',()=>{
 const manifest=JSON.parse(readFileSync('docs/phase11/baseline-manifest.json','utf8'));
 expect(SPELLS.map(({id,formula,recipe,fact,affinity})=>({id,formula,recipe,fact,affinity}))).toEqual(manifest.spells);
 for(const [path,hash] of Object.entries(manifest.sourceHashes))expect(createHash('sha256').update(readFileSync(path,'utf8').replace(/\r\n/g,'\n')).digest('hex'),path).toBe(hash);
 expect(SPELL_BY_ID.methane.effect).toContain('피해 23');expect(SPELL_BY_ID.ferrous.effect).toContain('피해 18');
 expect(SPELL_BY_ID.ferrous.effect).toContain('−3');expect(SPELL_BY_ID.graphite.effect).toContain('보호막 10');
});
