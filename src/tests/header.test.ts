import { serializeHeader, deserializeHeader, Header } from '../Block/Header';
import { randomBytes } from 'crypto';

function toUint8Array(buffer: Buffer): Uint8Array {
  return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
}

describe('Header Serialization and Deserialization', () => {
  it('should correctly serialize and deserialize a header with all fields', () => {
    const header: Header = {
      parentHash: toUint8Array(randomBytes(32)),
      priorStateRoot: toUint8Array(randomBytes(32)),
      extrinsicHash: toUint8Array(randomBytes(32)),
      timeSlotIndex: 12345,
      epochMarker: {
        nextRandomness1: toUint8Array(randomBytes(32)),
        nextRandomness2: toUint8Array(randomBytes(32)),
        validatorKeys: [toUint8Array(randomBytes(32)), toUint8Array(randomBytes(32))],
      },
      winningTickets: [toUint8Array(randomBytes(32))],
      offenders: [toUint8Array(randomBytes(32))],
      blockAuthorIndex: 0,
      vrfSignature: toUint8Array(randomBytes(64)),
      blockSeal: toUint8Array(randomBytes(64)),
    };

    const serialized = serializeHeader(header);
    const deserialized = deserializeHeader(serialized);

    expect(deserialized).toEqual(header);
  });

  it('should correctly serialize and deserialize a header without optional fields', () => {
    const header: Header = {
      parentHash: toUint8Array(randomBytes(32)),
      priorStateRoot: toUint8Array(randomBytes(32)),
      extrinsicHash: toUint8Array(randomBytes(32)),
      timeSlotIndex: 12345,
      offenders: [toUint8Array(randomBytes(32))],
      blockAuthorIndex: 0,
      vrfSignature: toUint8Array(randomBytes(64)),
      blockSeal: toUint8Array(randomBytes(64)),
    };

    const serialized = serializeHeader(header);
    const deserialized = deserializeHeader(serialized);

    const expectedHeader = {
      ...header,
      epochMarker: undefined,
      winningTickets: undefined,
    };

    expect(deserialized).toEqual(expectedHeader);
  });
});