import { loadTrustedSetup } from "c-kzg";
import { computeGammaZ } from "../../safrole/computeGammaZ";
import { ValidatorInfo } from "../../stf/types"; 

describe("Individual key testing", () => {

  const realValidatorKeys: ValidatorInfo[] = [
    {
      bandersnatch: new Uint8Array([
        94,  70,  91, 235,  1, 219, 175, 225,
        96, 206, 130,  22,  4, 127,  33,  85,
       221,   5, 105, 240, 88, 175, 213,  45,
       206, 166,   1,   2, 90, 141,  22,  29
      ]),
      ed25519: new Uint8Array(32),
      bls: new Uint8Array(144),
      metadata: new Uint8Array(128),
    },
    {
      bandersnatch: new Uint8Array([
        61,  94,  90,  81, 170, 178, 176,  72,
        248, 104, 110, 205, 121, 113,  42, 128,
        227,  38,  90,  17,  76, 199,  63,  20,
        189, 178, 165, 146,  51, 251, 102, 208
      ]),
      ed25519: new Uint8Array(32),
      bls: new Uint8Array(144),
      metadata: new Uint8Array(128),
    },
    {
        bandersnatch: new Uint8Array([
            170,  43, 149, 247,  87,  40, 117, 176,
            208, 241, 134,  85,  42, 231,  69, 186,
            130,  34, 252,  11,  91, 212,  86,  85,
             75, 254,  81, 198, 137,  56, 248, 188
        ]),
        ed25519: new Uint8Array(32),
        bls: new Uint8Array(144),
        metadata: new Uint8Array(128),
      },
      {
        bandersnatch: new Uint8Array([
            127,  97, 144,  17, 109,  17, 141, 100,
            58, 152, 135, 142,  41,  76, 207,  98,
           181,   9, 226,  20,  41, 153,  49, 170,
           216, 255, 151, 100,  24,  26,  78,  51
        ]),
        ed25519: new Uint8Array(32),
        bls: new Uint8Array(144),
        metadata: new Uint8Array(128),
      },
      {
        bandersnatch: new Uint8Array([
            72, 229, 252, 220, 225,  14,  11,
            100, 236,  78, 235, 208, 217,  33,
             28, 123, 172,  47,  39, 206,  84,
            188, 166, 247, 119, 111, 246, 254,
            232, 106, 179, 227
        ]),
        ed25519: new Uint8Array(32),
        bls: new Uint8Array(144),
        metadata: new Uint8Array(128),
      },
      {
        bandersnatch: new Uint8Array([
            170,  43, 149, 247,  87,  40, 117, 176,
            208, 241, 134,  85,  42, 231,  69, 186,
            130,  34, 252,  11,  91, 212,  86,  85,
             75, 254,  81, 198, 137,  56, 248, 188
        ]),
        ed25519: new Uint8Array(32),
        bls: new Uint8Array(144),
        metadata: new Uint8Array(128),
      },
  ];

  beforeAll(() => {
    loadTrustedSetup(0);
  });

  // 1) Test each key individually
  realValidatorKeys.forEach((v, idx) => {
    it(`Key #${idx} alone => computeGammaZ`, () => {
      const gammaZ = computeGammaZ([v]);
      expect(gammaZ).toBeInstanceOf(Uint8Array);
      expect(gammaZ.length).toBe(48);
    });
  });

//   // 2) Test all 6 together
  it("All 6 keys => computeGammaZ", () => {
    const gammaZ = computeGammaZ(realValidatorKeys);
    console.log("gammaZ:", gammaZ);
    expect(gammaZ).toBeInstanceOf(Uint8Array);
    expect(gammaZ.length).toBe(48);
  });
});
