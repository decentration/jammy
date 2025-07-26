import { hash } from "../../../../utils/crypto";
import { readBytes }               from "../../instructions/helpers";
import { ExitReasonType }          from "../../types";
import { NONE, OOB, WHO, FULL }    from "../consts";
import { HostCallHandler }         from "../types";

// ΩW – selector 3
export const writeHandler: HostCallHandler = (s, _id, env) => {
    const srvIdxRaw = s.registers[7]; 
    const ko = Number(s.registers[8]);      // key offset
    const kz = Number(s.registers[9]);      // key length
    const fOff = Number(s.registers[10]);   // value offset
    const vz = Number(s.registers[11]);     // value length (0 -> delete)

    const done = (state: typeof s, constant: bigint) => ({
        state : { ...state, registers: Object.assign([], state.registers, { 7: constant }) },
        ok: true,
    });

    const setR7 = (state: typeof s, v: bigint) => ({
        state: { ...state, registers: Object.assign([], state.registers, { 7: v }) },
        ok   : true,
      });


    const srvIdx    = BigInt.asUintN(64, srvIdxRaw);

    console.log("writeHandler 1", {srvIdx, ko, kz, fOff, vz,registers: s.registers.slice(),});

    //1. Service index check (WHO) !TODO, when support more than one service - change this. 
    if (srvIdx !== NONE) return setR7(s, WHO);

    console.log("writeHandler 2", {srvIdx, ko, kz, fOff, vz,registers: s.registers.slice(),});

    // 2. read key bytes from memory - OOB if unmapped
    const { bytes: keyBytes, state: s1 } = readBytes(s, ko, kz);
    if (!keyBytes) return { state: { ...s, exit: { type: ExitReasonType.Panic } }, ok: true };

    //3. derive hashed key with prefix
    const prefix   = new Uint8Array(4);
    new DataView(prefix.buffer).setUint32(0, Number(srvIdx & 0xffff_ffffn), true);
    const prefixed = new Uint8Array(prefix.length + keyBytes.length);
    prefixed.set(prefix);
    prefixed.set(keyBytes, prefix.length);
    const kHash = hash(prefixed);                     

    
    // 4. read value bytes or delete
    let newValue: Uint8Array | undefined;
    let s2 = s1;

    // 
    if (vz !== 0) {
        const r = readBytes(s1, fOff, vz);
        if (!r.bytes) return {         
            state: { ...r.state, exit:{ type: ExitReasonType.Panic } },
            ok   : true,
        };
        newValue = r.bytes;
        s2 = r.state;
    }

    const prev = env.getStorage?.(kHash);
    const prevLen = prev ? BigInt(prev.length) : NONE;

    // 5. write to storage or delete
    if (vz === 0) { 
         // delete request
         env.deleteStorage?.(kHash);
    } else {
        env.putStorage?.(kHash, newValue!);
        if (env.isFull?.()) {
            // roll back
            if (prev) env.putStorage?.(kHash, prev);
            else env.deleteStorage?.(kHash);
            return done(s2, FULL);
        }
    }

    //6. return the length of the previous value
    return done(s2, prevLen);
};
