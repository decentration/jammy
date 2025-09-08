import { hash } from "../../../../../utils/crypto";
import { readBytes, toLE }               from "../../../instructions/helpers";
import { ExitReasonType }          from "../../../types";
import { NONE, OOB, WHO, FULL }    from "../../consts";
import { finish }                  from "../../helpers";
import { HostCallHandler, ServiceAccount }         from "../../types";
import { getMergedXs, stageAccount } from "../accumulate/helpers";

// ΩW – selector 3
export const writeHandler: HostCallHandler = (s, _id, env) => {
    const kOff = Number(s.registers[7]);      // (kO) key offset
    const kLen = Number(s.registers[8]);      // (kZ) key length
    const vOff = Number(s.registers[9]);   // (vO) value offset
    const vLen= Number(s.registers[10]);     // (vZ) value length (0 -> delete)

    const { bytes: keyBytes, state: s1 } = readBytes(s, kOff, kLen);
    if (!keyBytes) return { state: { ...s, exit: { type: ExitReasonType.Panic } }, ok: true };

    // xs
    const xsId = env.acc?.allocator?.env?.currentServiceId;
    if (xsId === undefined) return finish(s1, WHO);

    const xs: ServiceAccount | undefined = getMergedXs(env);
    if (!xs) return finish(s1, WHO);


    // -- SPEC THRESHOLD GATE CHECK --
    const threshold = xs.threshold ?? (env as any).activationFee ?? 0n; // a_t
    if (threshold > xs.balance) return finish(s1, FULL); // a_t > a_b -> FULL
  
    // derive hashed key with prefix
    const svc32 = BigInt.asUintN(32, xsId);
    const prefix = toLE(svc32, 4);
    const prefixed = new Uint8Array(prefix.length + keyBytes.length);
    prefixed.set(prefix, 0);
    prefixed.set(keyBytes, prefix.length);


    // Hash -> hex key into xs.storage
    const kHash = hash(prefixed);     
    const kHashHex = Buffer.from(kHash).toString("hex");
                
    const prev = xs.storage.get(kHashHex);
    const prevLen = prev ? BigInt(prev.length) : NONE;
    
    // read value bytes or delete
    let s2 = s1;
    const newStorage = new Map(xs.storage);


    // if (vLength !== 0) {
    //     const r = readBytes(s1, fOff, vLength);
    //     if (!r.bytes) return {         
    //       state: { ...r.state, exit:{ type: ExitReasonType.Panic } },
    //       ok   : true,
    //     };
    //     newValue = r.bytes;
    //     s2 = r.state;
    // }  

    // 7. write to storage or delete
    if (vLen === 0) newStorage.delete(kHashHex); // delete
    else {
      const r = readBytes(s1, vOff, vLen);
      if (!r.bytes) {
        // value bytes OOB => Panic (A.8–A.9; ΩW)
        return { state: { ...r.state, exit: { type: ExitReasonType.Panic } }, ok: true };
      }
        s2 = r.state;
        newStorage.set(kHashHex, r.bytes); //stage put
  }
  

    stageAccount(env, xsId, { ...xs, storage: newStorage });

    //8. return the length of the previous value
    return finish(s2, prevLen);
};
