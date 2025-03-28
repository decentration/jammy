import { loadTrustedSetup } from "c-kzg";
import { computeGammaZ } from "../../stf/safrole";
import { ValidatorInfo } from "../../../stf/types"; 
import { convertToReadableFormat } from "../../../utils";

beforeAll(() => {
  loadTrustedSetup(0);
});

describe("Bandersnatch minimal test", () => {
  it("should compute a gammaZ commitment for a small set of ValidatorInfo", () => {
    const dummyValidatorKeys: ValidatorInfo[] = [
      {
        bandersnatch: new Uint8Array([
          0xaa, 0x2b, 0x95, 0xf7, 0x57, 0x28, 0x75, 0xb0,
          0xd0, 0xf1, 0x86, 0x55, 0x2a, 0xe7, 0x45, 0xba,
          0x82, 0x22, 0xfc, 0x0b, 0x5b, 0xd4, 0x56, 0x55,
          0x4b, 0xfe, 0x51, 0xc6, 0x89, 0x38, 0xf8, 0xbc
        ]),
        ed25519: new Uint8Array(32).fill(0xbb),
        bls: new Uint8Array(144).fill(0xcc),
        metadata: new Uint8Array(128).fill(0xdd),
      },
      {
        bandersnatch: new Uint8Array([
          0xf1, 0x6e, 0x53, 0x52, 0x84, 0x0a, 0xfb, 0x47,
          0xe2, 0x06, 0xb5, 0xc8, 0x9f, 0x56, 0x0f, 0x26,
          0x11, 0x83, 0x58, 0x55, 0xcf, 0x2e, 0x6e, 0xba,
          0xd1, 0xac, 0xc9, 0x52, 0x0a, 0x72, 0x59, 0x1d
        ]),
        ed25519: new Uint8Array(32).fill(0xef),
        bls: new Uint8Array(144).fill(0xde),
        metadata: new Uint8Array(128).fill(0xad),
      }
    ];
    console.log("dummyValidatorKeys:", convertToReadableFormat(dummyValidatorKeys[0].bandersnatch), convertToReadableFormat(dummyValidatorKeys[1].bandersnatch));

    // Call computeGammaZ, which should produce a 48-byte c-kzg commitment.
    const gammaZ = computeGammaZ(dummyValidatorKeys);

    // Check that the commitment is the correct type and length.
    expect(gammaZ).toBeInstanceOf(Uint8Array);
    expect(gammaZ.length).toBe(48); // c-kzg commitment size

    // Log the result in hex for debugging
    console.log("gammaZ commitment (hex):", Buffer.from(gammaZ).toString("hex"));
  });
});

