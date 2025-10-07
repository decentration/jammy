import { Bytes, Codec, u32 } from "scale-ts";
import { WorkPackage } from "../types/types";
import { decodeWithBytesUsed, VarLenBytesCodec } from "./index";
import { DiscriminatorCodec } from "./DiscriminatorCodec";
import { AuthorizerCodec } from "./WorkItem/AuthorizerCodec";
import { ContextCodec } from "./ContextCodec";
import { WorkItemCodec } from "./WorkItem/WorkItemCodec";

// -- Complete work package containing multiple work items
// WorkPackage ::= SEQUENCE {
//     -- Service ID hosting the authorization code
//     auth-code-host ServiceId,
//     -- Hash of the authorizer's code
//     auth-code-hash OpaqueHash,
//     -- Refinement context
//     context RefineContext,
//     -- Authorization data
//     authorization ByteSequence,
//     -- Parameters for the authorizer
//     authorizer-config ByteSequence,
//     -- Work items to process (1-16)
//     items SEQUENCE (SIZE(1..16)) OF WorkItem
// }


export const WorkPackageCodec: Codec<WorkPackage> = [
  // ENCODER
  (wp: WorkPackage): Uint8Array => {

    const encAuthCodeHost = u32.enc(wp.auth_code_host);
    const encAuthCodeHash = Bytes(32).enc(wp.authorizer_config.code_hash);
    const encContext = ContextCodec.enc(wp.context);
    const encAuthorization = VarLenBytesCodec.enc(wp.authorization);
    const encAuthorizerConfig = AuthorizerCodec.enc(wp.authorizer_config); 
    const encItems = DiscriminatorCodec(WorkItemCodec, { minSize: 1, maxSize: 16 } ).enc(wp.items);

    // concat
    const totalSize =
      encAuthCodeHost.length +
      encAuthCodeHash.length +
      encContext.length +
      encAuthorization.length +
      encAuthorizerConfig.length +
      encItems.length;

    const out = new Uint8Array(totalSize);
    let offset = 0;
    out.set(encAuthCodeHost, offset);
    offset += encAuthCodeHost.length;
    out.set(encAuthCodeHash, offset);
    offset += encAuthCodeHash.length;
    out.set(encContext, offset);
    offset += encContext.length;
    out.set(encAuthorization, offset);
    offset += encAuthorization.length;
    out.set(encAuthorizerConfig, offset);
    offset += encAuthorizerConfig.length;
    out.set(encItems, offset);
    offset += encItems.length;

    return out;
  },

  // DECODER
  (data: ArrayBuffer | Uint8Array | string): WorkPackage => {
    const uint8 =
      data instanceof Uint8Array
        ? data
        : typeof data === "string"
        ? new TextEncoder().encode(data)
        : new Uint8Array(data);
    let offset = 0;


    // 1) auth_code_host => u32
    if (offset + 4 > uint8.length) {
      throw new Error("WorkPackageCodec: not enough data for auth_code_host (u32)");
    }
    const auth_code_host = u32.dec(uint8.slice(offset, offset + 4));
    offset += 4;

    // 2) auth_code_hash => Bytes(32)
    if (offset + 32 > uint8.length) {
      throw new Error("WorkPackageCodec: not enough data for auth_code_hash (Bytes(32))");
    }
    const auth_code_hash = uint8.slice(offset, offset + 32);
    offset += 32;

    // 3) context => ContextCodec
    {
      const slice = uint8.slice(offset);
      const { value: ctxVal, bytesUsed } = decodeWithBytesUsed(
        ContextCodec,
        slice
      );
      offset += bytesUsed;
      var context = ctxVal;
    }

    // 4) authorization => VarLenBytesCodec
    {
      const slice = uint8.slice(offset);
      const { value: authVal, bytesUsed } = decodeWithBytesUsed(
        VarLenBytesCodec,
        slice
      );
      offset += bytesUsed;
      var authorization = authVal;
    }

    // 5) authorizer => AuthorizerCodec
    {
      const slice = uint8.slice(offset);
      const { value: authzVal, bytesUsed } = decodeWithBytesUsed(
        AuthorizerCodec,
        slice
      );
      offset += bytesUsed;
      var authorizer_config = authzVal;
    }

    // 6) items => DiscriminatorCodec(WorkItemCodec)
    {
      const slice = uint8.slice(offset);
      const { value: itemsVal, bytesUsed } = decodeWithBytesUsed(
        DiscriminatorCodec(WorkItemCodec),
        slice
      );
      offset += bytesUsed;
      var items = itemsVal;
    }

    return {
      auth_code_host,
      auth_code_hash,
      context,
      authorization,
      authorizer_config,
      items,
    };
  },
] as Codec<WorkPackage>;

WorkPackageCodec.enc = WorkPackageCodec[0];
WorkPackageCodec.dec = WorkPackageCodec[1];
