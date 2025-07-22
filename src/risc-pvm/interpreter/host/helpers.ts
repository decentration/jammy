import { FetchVector } from "./types";


// ΩY fetch vector selector map 
// This is a lookup table thats turns the value in register[10] into which blob the fetch function should return 
export const fetchVecSelectorMap: Record<number, FetchVector | undefined> = {
    0: "codeBlob",        // c
    1: "paramBlob",       // n
    2: "returnBlob",      // r
    // 3‑6: imports / work‑items variants (x / i)
    3: "imports", 4: "workItems", 5: "imports", 6: "imports",
    // 7‑13: program‑blob sub‑vectors (p...)
    7: "paramBlob", 8: "paramBlob", 9: "paramBlob",
    10: "paramBlob", 11: "paramBlob", 12: "paramBlob", 13: "paramBlob",
    // 14‑15: authoriser trace (o)
    14: "authoriserTrace", 15: "authoriserTrace",
    // 16‑17: transfer list (t)
    16: "transferList", 17: "transferList"
};