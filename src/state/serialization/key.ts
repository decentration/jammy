import { u32 } from 'scale-ts';

/* 
 * We want to identify one of the 3 constructor forms, and then produce the 
 * corresponding Uint8Array. The constructor forms are:
 *   - C1(i)     - makeStateKey(chapter: number): Uint8Array
 *   - C2(i, s)  - makeStateKey(chapter: number, serviceIndex: number): Uint8Array  
 *   - C3(s, h)  - makeStateKey(serviceIndex: Uint8Array, hashHead: Uint8Array): Uint8Array
*/
export function makeStateKey(
    arg1: number | Uint8Array, 
    arg2?: number | Uint8Array
  ): Uint8Array {
    const out = new Uint8Array(32);
  
    if (typeof arg1 === 'number') {
      out[0] = arg1 & 0xff;
  
      if (typeof arg2 === 'number') {
        // C2(i, s): [i, n0, 0, n1, 0, n2, 0, n3, 0, 0...]
        const n = u32.enc(arg2);
        out.set([n[0], 0, n[1], 0, n[2], 0, n[3]], 1);
      }
  
      // Else, it's C1(i), already set correctly above.
      return out;
    }

      // C3(s, h): [n0, n1, n2, n3, h0, h1, ..., h27]
      if (arg2 instanceof Uint8Array) {
        out.set(arg1.slice(0, 4), 0);        // s as 4 bytes directly

        out.set(arg2.slice(0, 28), 4);  
        
      } else {
        throw new Error('makeStateKey arg2 must be a Uint8Array for C3(s, h)');
      }
    
      return out 
  }