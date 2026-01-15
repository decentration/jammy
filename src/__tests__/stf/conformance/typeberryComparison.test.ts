import * as fs from 'fs';
import * as path from 'path';
import { describe, it, expect } from '@jest/globals';
import { loadModularTrace, getTraceStep, ModularTrace } from './utils/traceLoader';
import { initializeStandardProgram } from '../../../risc-pvm/interpreter/initializer/initStandardProgram';
import { deblob } from '../../../risc-pvm/interpreter/deblob';
import { bitmaskToBoolean } from '../../../risc-pvm/interpreter/utils/bitmask';
import { executeSingleStep } from '../../../risc-pvm/interpreter/executeSingleStep';
import { createPageTable, mapPages, IO_BASE, IO_SIZE } from '../../../risc-pvm/interpreter/memory';
import { ARGS_BASE, ZI } from '../../../risc-pvm/interpreter/host/consts';
import { deepConvertHexToBytes, toBytes } from '../../../codecs';
import { InterpreterState, ExitReasonType } from '../../../risc-pvm/interpreter/types';
import { JAM_TEST_VECTORS, CHAIN_TYPE } from '../../../consts';
import { Gas } from '../../../types';
import { encodeProtocolInt, coerceU64 } from '../../../codecs';
import { buildAccumulateInputSequence } from '../../../codecs/InputSequenceCodec';
import { buildFetchConfigVector } from '../../../risc-pvm/interpreter/host/helpers';



// TypeBerry vs Jammy Trace Comparison Test
//  Loads the TypeBerry reference traces and compares against jammy's PVM
//  step by step to find the exact deviation point.
// Uses jammy's proper SPI initialization to match TypeBerry's resetJAM behavior.


// TypeBerry trace location
const TYPEBERRY_TRACE_DIR = path.resolve(
    __dirname,
    '../../../../external/pvm-debugger/tmp/service-1729-trace'
);


// Build Config vector dynamically (same as STF uses)
const FETCH_CONSTANTS = buildFetchConfigVector();
let FETCH_OPERANDS: Uint8Array = new Uint8Array(0);

describe('TypeBerry vs Jammy Trace Comparison', () => {
    const TEST_VECTOR_FILE = 'process_one_immediate_report-1.json';
    const MAX_STEPS = 10000;

    it('should find first divergence between TypeBerry and Jammy', () => {
        if (!fs.existsSync(TYPEBERRY_TRACE_DIR)) {
            console.log('TypeBerry traces not found, run extractTrace.spec.ts first');
            console.log(`Expected at: ${TYPEBERRY_TRACE_DIR}`);
            return;
        }

        console.log('=== TypeBerry vs Jammy Trace Comparison ===\n');

        // 1. Load traces
        console.log('1. Loading TypeBerry traces...');
        const refTrace = loadModularTrace(TYPEBERRY_TRACE_DIR);
        console.log(`   Loaded ${refTrace.stepCount} reference steps`);

        // 2. Load test vector and service blob
        console.log('\n2. Loading test vector...');
        const filePath = path.join(JAM_TEST_VECTORS, 'stf/accumulate', CHAIN_TYPE, TEST_VECTOR_FILE);
        const rawJson = fs.readFileSync(filePath, 'utf8');
        const testVector = JSON.parse(rawJson);
        const preState = deepConvertHexToBytes(testVector.pre_state);
        const accounts = preState.accounts || [];

        let serviceBlob: Uint8Array | null = null;
        for (const account of accounts) {
            if (account.id === 1729 && account.data?.preimage_blobs?.[0]?.blob) {
                serviceBlob = account.data.preimage_blobs[0].blob;
                break;
            }
        }
        if (!serviceBlob) throw new Error('Could not find service blob');
        console.log(`   Service blob: ${serviceBlob.length} bytes`);

        // Strip metadata prefix if present
        let workingBlob = serviceBlob;
        const firstByte = serviceBlob[0];
        if (firstByte > 10 && firstByte < 200 && serviceBlob.length > firstByte + 1) {
            const possibleMeta = serviceBlob.slice(0, Math.min(firstByte + 1, 50));
            const metaStr = String.fromCharCode(...Array.from(possibleMeta).filter(b => b >= 0x20 && b <= 0x7e));
            if (metaStr.includes('jam') || metaStr.includes('test') || metaStr.includes('service')) {
                console.log(`Stripped metadata prefix: ${firstByte + 1} bytes`);
                workingBlob = serviceBlob.slice(firstByte + 1);
            }
        }
        console.log(`Working blob (after strip): ${workingBlob.length} bytes`);

        // Build authoriserTrace (FETCH_OPERANDS) using the shared InputSequenceCodec
        // This uses the same encoding as production STF (accumulateSingleService.ts)
        const report = testVector.input?.reports?.[0];
        if (report) {
            const inputData = deepConvertHexToBytes(testVector.input);
            const rep = inputData.reports[0];


            // Convert report results to work items format expected by InputSequenceCodec
            const workItems = (rep.results ?? []).map((item: any) => ({
                packageHash: toBytes(rep.package_spec?.hash),
                exportsRoot: toBytes(rep.package_spec?.exports_root),
                authorizerHash: toBytes(rep.authorizer_hash),
                payloadHash: toBytes(item.payload_hash),
                gas: coerceU64(item.accumulate_gas) ?? 100000n,
                result: item.result?.ok instanceof Uint8Array
                    ? item.result.ok
                    : (item.result?.ok ? new Uint8Array(Buffer.from(String(item.result.ok).replace('0x', ''), 'hex')) : undefined),
            }));

            FETCH_OPERANDS = buildAccumulateInputSequence(workItems, []);
            console.log(`   Built authoriserTrace: ${FETCH_OPERANDS.length} bytes (using shared InputSequenceCodec)`);
        }

        // 3. Encode accumulate args: slot=43, service_id=1729, item_count=1
        // TypeBerry uses: slot=43, id=1729, results=1
        const slot = 43;
        const serviceId = 1729;
        const itemCount = 1;
        const argsBytes = new Uint8Array([
            ...encodeProtocolInt(slot),
            ...encodeProtocolInt(serviceId),
            ...encodeProtocolInt(itemCount),
        ]);
        console.log(`   Accumulate args: slot=${slot}, serviceId=${serviceId}, itemCount=${itemCount} (${argsBytes.length} bytes)`);

        // 4. Use jammy's proper SPI initialization
        console.log('\n3. Initializing PVM with jammy SPI...');
        const MEM_SIZE = 1 << 20;
        const initResult = initializeStandardProgram(workingBlob, argsBytes, MEM_SIZE);
        console.log(`Code: ${initResult.code.length} bytes`);
        console.log(`Heap: 0x${initResult.heapStart.toString(16)} - 0x${initResult.heapEnd.toString(16)}`);
        console.log(`Registers: r0=0x${initResult.registers[0].toString(16)}, r1=0x${initResult.registers[1].toString(16)}, r7=0x${initResult.registers[7].toString(16)}, r8=${initResult.registers[8]}`);
        console.log(`SDK args: r4=${initResult.registers[4]} (slot), r5=${initResult.registers[5]} (sid), r6=${initResult.registers[6]} (count)`);

        // 5. Deblob the code
        const { jumpEntries, instructionData, opcodeBitmask, jumpEntryLength } = deblob(initResult.code);
        const opcodeBits = bitmaskToBoolean(opcodeBitmask, instructionData.length);

        const decodedJumpTable = jumpEntries.map((entry: Uint8Array) => {
            let result = 0n;
            for (let i = 0; i < entry.length; i++) {
                result |= BigInt(entry[i] ?? 0) << (8n * BigInt(i));
            }
            return Number(result);
        });

        const basicBlockStarts = new Set<number>();
        for (let i = 0; i < opcodeBits.length; i++) {
            if (opcodeBits[i]) basicBlockStarts.add(i);
        }
        for (const target of decodedJumpTable) basicBlockStarts.add(target);

        // 6. Memory setup
        const pageTable = createPageTable(MEM_SIZE / 4096);
        mapPages(pageTable, 0, (instructionData.length + 4095) >>> 12, { read: true, write: false });
        mapPages(pageTable, 0x10000 >>> 12, MEM_SIZE >>> 12, { read: true, write: true });
        mapPages(pageTable, IO_BASE >>> 12, (IO_BASE + IO_SIZE) >>> 12, { read: true, write: true });
        mapPages(pageTable, ARGS_BASE >>> 12, (ARGS_BASE + ZI) >>> 12, { read: true, write: true });
        const U32_MAX = 0xFFFFFFFF;
        const ZZ_BYTES = 0x10000;
        const ZI_CONST = 0x1000000;
        const stackSizeBytes = 0x10000;
        const actualStackStart = ((U32_MAX - 2 * ZZ_BYTES - ZI_CONST - stackSizeBytes + 1) >>> 0);
        const actualStackTop = ((actualStackStart + stackSizeBytes) >>> 0);
        mapPages(pageTable, actualStackStart >>> 12, (actualStackTop - 1) >>> 12 + 1, { read: true, write: true });

        // 7. Initialize memory with data segments
        const memory = new Uint8Array(MEM_SIZE);
        memory.set(initResult.memInit, 0);

        const initialGas = 100000n as Gas;

        let state: InterpreterState = {
            code: instructionData,
            opcodeMaskBits: opcodeBits,
            pc: 5,  // Accumulate entry point
            gas: initialGas,
            registers: [...initResult.registers],  // Use jammy's initialized registers
            memory,
            exit: { type: ExitReasonType.Continue },
            context: {
                jumpTable: decodedJumpTable,
                jumpEntryLength,
                jumpEntries: decodedJumpTable,
                basicBlockStarts,
                heapStart: initResult.heapStart,
                // trace expects heapPointer to start at heapStart + 0x1000 (one page)
                // this is the initial sbrk allocation point per Graypaper A.42
                heapPointer: initResult.heapStart + 0x1000,  // 0x33000 for this test
                heapEnd: MEM_SIZE,  // allow heap to grow to full memory limit
                pageTable,
                argsBase: ARGS_BASE,
                // Accumulate arguments per GP B.4
                argsBand: (() => {
                    const band = new Uint8Array(ZI);
                    const slotEnc = encodeProtocolInt(43);      // slot from test vector
                    const serviceEnc = encodeProtocolInt(1729); // service ID
                    const itemCountEnc = encodeProtocolInt(1);  // 1 item per TypeBerry step 745
                    // Args band offset: args appear at 0x10000 offset from ARGS_BASE (per trace observation)
                    let offset = 0x10000;
                    band.set(slotEnc, offset); offset += slotEnc.length;
                    band.set(serviceEnc, offset); offset += serviceEnc.length;
                    band.set(itemCountEnc, offset);
                    console.log(`Accumulate args: slot(43)=[${Array.from(slotEnc).map(b => '0x' + b.toString(16)).join(', ')}] service(1729)=[${Array.from(serviceEnc).map(b => '0x' + b.toString(16)).join(', ')}] count(1)=[${Array.from(itemCountEnc).map(b => '0x' + b.toString(16)).join(', ')}]`);
                    return band;
                })(),
                stackStart: actualStackStart,
                stackBand: new Uint8Array(stackSizeBytes),
                stackTop: actualStackTop,
                ioBuffer: new Uint8Array(IO_SIZE),
            },
        };

        // Debug: initial memory at 0x32788
        const initMem = Array.from(state.memory.slice(0x32788, 0x32790)).map(b => '0x' + b.toString(16).padStart(2, '0'));
        console.log(`Initial memory at 0x32788: [${initMem.join(', ')}]`);
        console.log(`heapStart=0x${initResult.heapStart.toString(16)}, heapEnd=0x${initResult.heapEnd.toString(16)}`);

        console.log(`\n Initial PC: ${state.pc}, Gas: ${state.gas}`);
        console.log(`Jammy registers: r0=0x${state.registers[0].toString(16)}, r1=0x${state.registers[1].toString(16)}, r7=0x${state.registers[7].toString(16)}, r8=${state.registers[8]}`);

        // Show comp initial state for comparison
        const step0 = getTraceStep(refTrace, 0);
        console.log(`TypeBerry step 0: PC=${step0.pc}, Gas=${step0.gas}`);
        console.log(`TypeBerry regs: r0=0x${step0.registers[0].toString(16)}, r1=0x${step0.registers[1].toString(16)}, r7=0x${step0.registers[7].toString(16)}, r8=${step0.registers[8]}`);

        // Debug: Check bitmask at ecalli location (step 37, PC=17451)
        const byteIdx = Math.floor(17451 / 8);
        const rawBytes = opcodeBitmask.slice(byteIdx - 1, byteIdx + 3);
        console.log(`Bitmask raw bytes at 17451 (byteIdx ${byteIdx}): [${Array.from(rawBytes).map(b => '0x' + b.toString(16).padStart(2, '0')).join(', ')}]`);
        console.log(`Bitmask at ecalli: [17451]=${opcodeBits[17451]}, [17452]=${opcodeBits[17452]}, [17453]=${opcodeBits[17453]}, [17454]=${opcodeBits[17454]}`);
        console.log(`Instruction bytes at 17451: [${Array.from(instructionData.slice(17451, 17457)).map(b => '0x' + b.toString(16).padStart(2, '0')).join(', ')}]`);

        // 8. Execute and compare
        console.log('\n4. Comparing step-by-step...\n');

        let step = 0;
        let hostCallCount = 0;
        let firstDivergence: { step: number; field: string; ref: string; jammy: string } | null = null;

        while (step < MAX_STEPS && step < refTrace.stepCount && !firstDivergence) {
            // TypeBerry trace format: PC is PRE-execution, registers are POST-execution
            const refStep = getTraceStep(refTrace, step);
            const jammyPc = BigInt(state.pc);
            const jammyGas = state.gas;
            const refGas = refStep.gas;
            const gasDelta = Number(jammyGas) - Number(refGas);

            // Debug logging for first 20 steps with GAS comparison
            if (step <= 20) {
                const gasMatch = jammyGas === refGas ? '✅' : `❌ (Δ${gasDelta})`; // if gas match its a match
                console.log(`[Step ${step}] PRE: Jammy PC=${state.pc} Gas=${jammyGas} | TypeB PC=${refStep.pc} Gas=${refGas} ${gasMatch}`);
            }

            // Log GAS divergence at any step (first time and every 500 steps)
            if (gasDelta !== 0 && (step === 0 || step % 500 === 0)) {
                console.log(`   [Step ${step}] GAS DELTA: Jammy=${jammyGas} TypeBerry=${refGas} Δ=${gasDelta}`);
            }
            // Debug r4 for steps around divergence
            if (step >= 1776 && step <= 1782) {
                const opcode = state.code[state.pc] ?? 0;
                const MASK_64 = 0xffffffffffffffffn;
                const j_r4 = state.registers[4] & MASK_64;
                const t_r4 = refStep.registers[4] & MASK_64;
                const bytes = Array.from(state.code.slice(state.pc, state.pc + 6)).map(b => '0x' + b.toString(16).padStart(2, '0'));
                const pcMatch = state.pc === Number(refStep.pc) ? '✓' : '❌';
                console.log(`   [Step ${step}] ${pcMatch} PC=${state.pc} op=0x${opcode.toString(16)} J_r4(PRE)=0x${j_r4.toString(16)} T_r4(POST)=0x${t_r4.toString(16)} bytes=[${bytes.join(', ')}]`);
            }
            // Debug r7 around host call
            if (step >= 20 && step <= 40) {
                const MASK_64 = 0xffffffffffffffffn;
                const opcode = state.code[state.pc] ?? 0;
                const j_r7 = state.registers[7] & MASK_64;
                const t_r7 = refStep.registers[7] & MASK_64;
                const j_r10 = state.registers[10] & MASK_64;
                const t_r10 = refStep.registers[10] & MASK_64;
                console.log(`   [Step ${step}] r7: J=0x${j_r7.toString(16)} T=0x${t_r7.toString(16)} | r10: J=0x${j_r10.toString(16)} T=0x${t_r10.toString(16)} | PC=${state.pc}`);
            }

            // Debug steps around the store to 0x32788
            if (step >= 100 && step <= 103) {
                const opcode = state.code[state.pc] ?? 0;
                const bytes = Array.from(state.code.slice(state.pc, state.pc + 6)).map(b => '0x' + b.toString(16).padStart(2, '0'));
                const memBefore = state.memory[0x32788];
                console.log(`   [Step ${step}] PRE: PC=${state.pc} op=0x${opcode.toString(16)} mem@32788=0x${memBefore.toString(16)} bytes=[${bytes.join(', ')}]`);
            }

            // 1. Compare PC (both PRE-execution)
            if (jammyPc !== refStep.pc) {
                firstDivergence = {
                    step,
                    field: 'PC',
                    ref: `${refStep.pc}`,
                    jammy: `${jammyPc}`,
                };
                break;
            }

            // 2. Execute one step
            state = executeSingleStep(state);

            // 3. Handle host calls (ecalli)
            if (state.exit?.type === ExitReasonType.HostCall) {
                const selector = Number(state.exit?.id ?? 0);
                hostCallCount++;

                if (selector === 1) { // FETCH
                    const r10 = state.registers[10];
                    const r7 = state.registers[7];
                    let dataLen = 0n;
                    console.log(`FETCH: r10=${r10} r7=0x${r7.toString(16)}`);
                    if (r10 === 0n) {
                        console.log(`FETCH: r7 raw=0x${state.registers[7].toString(16)}`);
                        const dest = Number(state.registers[7] & 0xffffffffn);
                        console.log(`FETCH: r10=0 dest=0x${dest.toString(16)} len=${FETCH_CONSTANTS.length}`);
                        console.log(`FETCH: r10=0 dest=0x${dest.toString(16)} len=${FETCH_CONSTANTS.length}`);
                        state.memory.set(FETCH_CONSTANTS, dest);
                        dataLen = BigInt(FETCH_CONSTANTS.length);
                    } else if (r10 === 14n) {
                        const dest = Number(state.registers[7] & 0xffffffffn);
                        state.memory.set(FETCH_OPERANDS, dest);
                        dataLen = BigInt(FETCH_OPERANDS.length);
                    } else {
                        dataLen = 0xffffffffffffffffn; // NONE
                    }
                    // GP B.5: set r5=length, r7=length after FETCH
                    state.registers[5] = dataLen;
                    state.registers[7] = dataLen;
                } else if (selector === 100) { // LOG
                    state.registers[6] = 0n;
                    state.registers[7] = 0n;
                } else if (selector === 4) { // WRITE
                    state.registers[7] = 0xffffffffffffffffn;
                }

                state.exit = { type: ExitReasonType.Continue };
                const gasAfterHostCall = state.gas;
                const refStepAfterHC = getTraceStep(refTrace, step + 1);
                const hcGasDelta = Number(gasAfterHostCall) - Number(refStepAfterHC.gas);
                console.log(`   Step ${step}: Host call #${hostCallCount} selector=${selector} | Gas: Jammy=${gasAfterHostCall} TypeBerry=${refStepAfterHC.gas} Δ=${hcGasDelta}`);

                // increment step twice total before next comparison
                step += 2;  // skip ecalli step + HOST step in TypeBerry trace
                continue;  // skip register comparison for host call steps
            }

            // 4. Compare registers POST-execution (reference trace records POST-execution state)
            // Debug logging around divergence
            if (step >= 160 && step <= 170) {
                const MASK_64 = 0xffffffffffffffffn;
                const j_r8 = state.registers[8] & MASK_64;
                const t_r8 = refStep.registers[8] & MASK_64;
                const opcode = state.code[state.pc] ?? 0;
                if (step === 165 || step === 166) {
                    const prevPc = step === 165 ? 21982 : 21985;  // PC of instruction that was just executed
                    const bytes = Array.from(state.code.slice(prevPc, prevPc + 10)).map(b => '0x' + b.toString(16).padStart(2, '0'));
                    console.log(`[Step ${step}] Executed instruction at PC=${prevPc} bytes=[${bytes.join(', ')}]`);
                    console.log(`[Step ${step}] POST regs: r0=0x${(state.registers[0] & MASK_64).toString(16)}, r7=0x${(state.registers[7] & MASK_64).toString(16)}, r8=0x${j_r8.toString(16)}, r10=0x${(state.registers[10] & MASK_64).toString(16)}`);
                }
                console.log(`[Step ${step}] r8: J=0x${j_r8.toString(16)} T=0x${t_r8.toString(16)} | PC=${state.pc} op=0x${opcode.toString(16)}`);
            }

            // Compare first diverging register (mask to 64-bit unsigned for proper comparison)
            const MASK_64 = 0xffffffffffffffffn;
            for (let r = 0; r < 13; r++) {
                const jammyReg = state.registers[r] & MASK_64;
                const refReg = refStep.registers[r] & MASK_64;
                if (jammyReg !== refReg) {
                    firstDivergence = {
                        step,
                        field: `r${r}`,
                        ref: `0x${refReg.toString(16)}`,
                        jammy: `0x${jammyReg.toString(16)}`,
                    };
                    break;
                }
            }
            if (firstDivergence) break;

            step++;

            // WATCHPOINT: Detect when 0x32788 first becomes non-zero  
            const memAt32788 = state.memory[0x32788];
            if (memAt32788 !== 0 && step <= 170) {
                console.log(`   *** WATCHPOINT: Memory at 0x32788 = 0x${memAt32788.toString(16)} at step ${step}, PC=${state.pc}`);
            }

            // Check terminal states
            if (state.exit?.type === ExitReasonType.Halt) {
                console.log(`   HALT at step ${step}`);
                break;
            }
            if (state.exit?.type === ExitReasonType.Panic || state.exit?.type === ExitReasonType.PageFault) {
                console.log(`   ${state.exit?.type} at step ${step}, PC=${state.pc}`);
                break;
            }

            // Progress
            if (step % 1000 === 0) {
                console.log(`   Step ${step}: PC=${state.pc}, Gas=${state.gas}`);
            }
        }

        // Report results
        console.log('\n=== Results ===');
        console.log(`Steps compared: ${step}`);
        console.log(`Host calls: ${hostCallCount}`);
        console.log(`Final PC: ${state.pc}`);
        console.log(`Final Gas: ${state.gas}`);
        console.log(`Exit type: ${state.exit?.type}`);

        if (firstDivergence) {
            console.log('\n❌ DIVERGENCE FOUND:');
            console.log(`   Step ${firstDivergence.step}`);
            console.log(`   Field: ${firstDivergence.field}`);
            console.log(`   TypeBerry: ${firstDivergence.ref}`);
            console.log(`   Jammy:     ${firstDivergence.jammy}`);
        } else {
            console.log('\n✓ No divergence found in compared steps');
        }

        expect(step).toBeGreaterThan(0);
    });
});
