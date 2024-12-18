import { Header, serializeHeader, deserializeHeader } from '../Block/Header';
import { hexToU8a, u8aToHex } from '@polkadot/util';

// Helper function to convert hex strings to Uint8Array
function hexStringToUint8Array(hexString: string): Uint8Array {
  return hexToU8a(hexString);
}

// TEST 1 check serialization and deserialization of Header object with null epoch_mark and tickets_mark
test('Header serialization and deserialization with null epoch_mark and populated tickets_mark', () => {
  // Construct Header object using conformance test data where epoch_mark is null
  const header: Header = {
    parent: hexStringToUint8Array('0x5c743dbc514284b2ea57798787c5a155ef9d7ac1e9499ec65910a7a3d65897b7'),
    parent_state_root: hexStringToUint8Array('0x2591ebd047489f1006361a4254731466a946174af02fe1d86681d254cfd4a00b'),
    extrinsic_hash: hexStringToUint8Array('0x74a9e79d2618e0ce8720ff61811b10e045c02224a09299f04e404a9656e85c81'),
    slot: 42,
    epoch_mark: null,  // Epoch marker is null
    tickets_mark: [
      hexStringToUint8Array('0x8c25c063c631c0d4cd0206159b3495deb761cc057e06192fe5497dc9b3744c7b'),
      hexStringToUint8Array('0x2f24ea5c5cfc5631ea3b7799222ca555250b8591751fd1d59df4abeb690d66e6'),
      hexStringToUint8Array('0x036479afe8e29f97741a1e3c2b59c217dc67d8a25f7ce12bf1febf6b4a5b2646'),
      hexStringToUint8Array('0xa8a439a4aa6e18682c6a524feb2da2ebcead6f0fb0826707aef7b1d57e790e6e'),
      hexStringToUint8Array('0x4fc10511323e4b3b82cf10ece1a1f6b8497dbdd9de032e6c6986d57303c31364'),
      hexStringToUint8Array('0xd5ca7a57adaffc68011b46ec02ff8baad3f1539068f642b6af2cfcaca639d96e'),
      hexStringToUint8Array('0x3ec31eb46e471951d21febf6a2842b8482b2ea40a61b37c4cbd4f136ef31d24f'),
      hexStringToUint8Array('0xb5a35c5c1473de918f517142bacb78a968fcdd65fb5e935b2cfaf52c840cc3ad'),
      hexStringToUint8Array('0x3559f53a0ad2e4462b2d1805ac28a665e2181fdc27e5acc6561fd6e713e7d498'),
      hexStringToUint8Array('0x5ed4423732dbeb794c7a05fc899718a093ad9c832a1d3a89f34f525e55b87f53'),
      hexStringToUint8Array('0xfdee093e7fd5cace92b7eb9f41d3ee7154aabcf84b797a6eb2e951ae11ed921c'),
      hexStringToUint8Array('0xabf4869d2585e777feb713a7fd79ea49dbea2ca3eeb5e081c63ece4d6208c68c'),
    ],
    offenders_mark: [],  // offenders_mark is an empty array
    author_index: 3,
    entropy_source: hexStringToUint8Array(
      '0xae85d6635e9ae539d0846b911ec86a27fe000f619b78bcac8a74b77e36f6dbcf49a52360f74a0233cea0775356ab0512fafff0683df08fae3cb848122e296cbc50fed22418ea55f19e55b3c75eb8b0ec71dcae0d79823d39920bf8d6a2256c5f'
    ),
    seal: hexStringToUint8Array(
      '0x31dc5b1e9423eccff9bccd6549eae8034162158000d5be9339919cc03d14046e6431c14cbb172b3aed702b9e9869904b1f39a6fe1f3e904b0fd536f13e8cac496682e1c81898e88e604904fa7c3e496f9a8771ef1102cc29d567c4aad283f7b0'
    ),
  };

  // serialize Header
  const serializedHeader = serializeHeader(header);

  // log the serialized data
  console.log('Serialized Header with null epoch_mark:', u8aToHex(serializedHeader));

  // Deserialize the serialized data
  const deserializedHeader = deserializeHeader(serializedHeader);

  // Check deserialized object matches original
  expect(deserializedHeader).toEqual(header);
});

// TEST 2 check serialization and deserialization of Header object with null tickets_mark and populated epoch_mark  
test('Header serialization and deserialization with null tickets_mark and populated epoch_mark', () => {
  // Construct Header object where tickets_mark is null and epoch_mark has value
  const header: Header = {
    parent: hexStringToUint8Array('0x5c743dbc514284b2ea57798787c5a155ef9d7ac1e9499ec65910a7a3d65897b7'),
    parent_state_root: hexStringToUint8Array('0x2591ebd047489f1006361a4254731466a946174af02fe1d86681d254cfd4a00b'),
    extrinsic_hash: hexStringToUint8Array('0x74a9e79d2618e0ce8720ff61811b10e045c02224a09299f04e404a9656e85c81'),
    slot: 42,
    epoch_mark: {
      entropy: hexStringToUint8Array('0xae85d6635e9ae539d0846b911ec86a27fe000f619b78bcac8a74b77e36f6dbcf'),
      tickets_entropy: hexStringToUint8Array('0x333a7e328f0c4183f4b947e1d8f68aa4034f762e5ecdb5a7f6fbf0afea2fd8cd'),
      validators: [
        hexStringToUint8Array('0x5e465beb01dbafe160ce8216047f2155dd0569f058afd52dcea601025a8d161d'),
        hexStringToUint8Array('0x3d5e5a51aab2b048f8686ecd79712a80e3265a114cc73f14bdb2a59233fb66d0'),
        hexStringToUint8Array('0xaa2b95f7572875b0d0f186552ae745ba8222fc0b5bd456554bfe51c68938f8bc'),
        hexStringToUint8Array('0x7f6190116d118d643a98878e294ccf62b509e214299931aad8ff9764181a4e33'),
        hexStringToUint8Array('0x48e5fcdce10e0b64ec4eebd0d9211c7bac2f27ce54bca6f7776ff6fee86ab3e3'),
        hexStringToUint8Array('0xf16e5352840afb47e206b5c89f560f2611835855cf2e6ebad1acc9520a72591d'),
      ],
    },
    tickets_mark: null, // Tickets mark is null
    offenders_mark: [
      hexStringToUint8Array('0x3b6a27bcceb6a42d62a3a8d02a6f0d73653215771de243a63ac048a18b59da29'),
    ],
    author_index: 3,
    entropy_source: hexStringToUint8Array(
      '0xae85d6635e9ae539d0846b911ec86a27fe000f619b78bcac8a74b77e36f6dbcf49a52360f74a0233cea0775356ab0512fafff0683df08fae3cb848122e296cbc50fed22418ea55f19e55b3c75eb8b0ec71dcae0d79823d39920bf8d6a2256c5f'
    ),
    seal: hexStringToUint8Array(
      '0x31dc5b1e9423eccff9bccd6549eae8034162158000d5be9339919cc03d14046e6431c14cbb172b3aed702b9e9869904b1f39a6fe1f3e904b0fd536f13e8cac496682e1c81898e88e604904fa7c3e496f9a8771ef1102cc29d567c4aad283f7b0'
    ),
  };

  // serialize Header
  const serializedHeader = serializeHeader(header);

  // log the serialized data
  console.log('Serialized Header with null tickets_mark:', u8aToHex(serializedHeader));

  // Deserialize the serialized data
  const deserializedHeader = deserializeHeader(serializedHeader);

  // Check deserialized object matches original
  expect(deserializedHeader).toEqual(header);
});

test('Header serialization and deserialization with both epoch_mark and tickets_mark null', () => {
  // Construct Header object where both epoch_mark and tickets_mark are null
  const header: Header = {
    parent: hexStringToUint8Array('0x5c743dbc514284b2ea57798787c5a155ef9d7ac1e9499ec65910a7a3d65897b7'),
    parent_state_root: hexStringToUint8Array('0x2591ebd047489f1006361a4254731466a946174af02fe1d86681d254cfd4a00b'),
    extrinsic_hash: hexStringToUint8Array('0x74a9e79d2618e0ce8720ff61811b10e045c02224a09299f04e404a9656e85c81'),
    slot: 42,
    epoch_mark: null,
    tickets_mark: null,
    offenders_mark: [],
    author_index: 3,
    entropy_source: hexStringToUint8Array(
      '0xae85d6635e9ae539d0846b911ec86a27fe000f619b78bcac8a74b77e36f6dbcf49a52360f74a0233cea0775356ab0512fafff0683df08fae3cb848122e296cbc50fed22418ea55f19e55b3c75eb8b0ec71dcae0d79823d39920bf8d6a2256c5f'
    ),
    seal: hexStringToUint8Array(
      '0x31dc5b1e9423eccff9bccd6549eae8034162158000d5be9339919cc03d14046e6431c14cbb172b3aed702b9e9869904b1f39a6fe1f3e904b0fd536f13e8cac496682e1c81898e88e604904fa7c3e496f9a8771ef1102cc29d567c4aad283f7b0'
    ),
  };

  // serialize Header
  const serializedHeader = serializeHeader(header);

  // serialized log
  console.log('Serialized Header with null epoch_mark and tickets_mark:', u8aToHex(serializedHeader));

  // deserialized
  const deserializedHeader = deserializeHeader(serializedHeader);


  // Check deserialized object matches original
  expect(deserializedHeader).toEqual(header);
});
