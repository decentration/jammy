import { hash } from "../../../../utils/crypto";
import { readBytes, toLE }               from "../../instructions/helpers";
import { ExitReasonType }          from "../../types";
import { NONE, OOB, WHO, FULL }    from "../consts";
import { finish }                  from "../helpers";
import { HostCallHandler, ServiceAccount }         from "../types";
import { getMergedXs, stageAccount } from "./accumulate/helpers";

// ΩW – selector 3
export const writeHandler: HostCallHandler = (s, _id, env) => {
    const srvIdxRaw = s.registers[7]; 
    const ko = Number(s.registers[8]);      // key offset
    const kz = Number(s.registers[9]);      // key length
    const fOff = Number(s.registers[10]);   // value offset
    const vLength = Number(s.registers[11]);     // value length (0 -> delete)

    const setR7 = (state: typeof s, v: bigint) => ({
        state: { ...state, registers: Object.assign([], state.registers, { 7: v }) },
        ok   : true,
      });


    const sel = BigInt.asUintN(64, srvIdxRaw);

    console.log("writeHandler 1", {sel, ko, kz, fOff, vLength,registers: s.registers.slice(),});

    //1. Service index check (WHO) !TODO, when support more than one service - change this. 
    if (sel !== NONE) return setR7(s, WHO);

    console.log("writeHandler 2", {sel, ko, kz, fOff, vLength,registers: s.registers.slice(),});

    // 2. read key bytes from memory - OOB if unmapped
    const { bytes: keyBytes, state: s1 } = readBytes(s, ko, kz);
    if (!keyBytes) return { state: { ...s, exit: { type: ExitReasonType.Panic } }, ok: true };

    // 3. xs
    const xsId = env.acc?.allocator?.env?.currentServiceId;
    if (xsId === undefined) return finish(s1, WHO);

    const xs: ServiceAccount | undefined = getMergedXs(env);
    if (!xs) return finish(s1, WHO);

    // -- SPEC THRESHOLD GATE CHECK --
    const threshold = xs.threshold ?? (env as any).activationFee ?? 0n; // a_t
    if (threshold > xs.balance) return finish(s1, FULL);
  
    // 4. derive hashed key with prefix
    const svc32 = BigInt.asUintN(32, xsId);
    const prefix = toLE(svc32, 4);
    const prefixed = new Uint8Array(prefix.length + keyBytes.length);
    prefixed.set(prefix, 0);
    prefixed.set(keyBytes, prefix.length);


    // 5. Hash -> hex key into xs.storage
    const kHash = hash(prefixed);     
    const kHashHex = Buffer.from(kHash).toString("hex");
                
    const prev = xs.storage.get(kHashHex);
    const prevLen = prev ? BigInt(prev.length) : NONE;
    
    // 6. read value bytes or delete
    let s2 = s1;
    let newValue: Uint8Array | undefined;

    // 
    if (vLength !== 0) {
        const r = readBytes(s1, fOff, vLength);
        if (!r.bytes) return {         
          state: { ...r.state, exit:{ type: ExitReasonType.Panic } },
          ok   : true,
        };
        newValue = r.bytes;
        s2 = r.state;
    }

    const newStorage = new Map(xs.storage);
    // 7. write to storage or delete
    if (vLength === 0) newStorage.delete(kHashHex); // delete
    else newStorage.set(kHashHex, newValue!); //stage put
  

    stageAccount(env, xsId, { ...xs, storage: newStorage });

    //8. return the length of the previous value
    return finish(s2, prevLen);
};
