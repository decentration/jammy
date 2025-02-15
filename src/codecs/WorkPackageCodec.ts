import { Codec } from "scale-ts";
import { WorkPackage } from "../types/types";
import { decodeWithBytesUsed, VarLenBytesCodec } from "./index";
import { DiscriminatorCodec } from "./DiscriminatorCodec";
import { AuthorizerCodec } from "./WorkItem/AuthorizerCodec";
import { ContextCodec } from "./ContextCodec";
import { WorkItemCodec } from "./WorkItem/WorkItemCodec";

export const WorkPackageCodec: Codec<WorkPackage> = [
  // ENCODER
  (wp: WorkPackage): Uint8Array => {
    // 1) authorization => VarLenBytesCodec
    const encAuth = VarLenBytesCodec.enc(wp.authorization);

    // 2) auth_code_host => u32
    const authCodeBuf = new Uint8Array(4);
    new DataView(authCodeBuf.buffer).setUint32(0, wp.auth_code_host, true);

    // 3) authorizer => AuthorizerCodec
    const encAuthorizer = AuthorizerCodec.enc(wp.authorizer);

    // 4) context => ContextCodec
    const encContext = ContextCodec.enc(wp.context);

    // 5) items => DiscriminatorCodec(WorkItemCodec)
    const encItems = DiscriminatorCodec(WorkItemCodec).enc(wp.items);

    // concat
    const totalSize =
      encAuth.length +
      authCodeBuf.length +
      encAuthorizer.length +
      encContext.length +
      encItems.length;

    const out = new Uint8Array(totalSize);
    let offset = 0;
    out.set(encAuth, offset);          offset += encAuth.length;
    out.set(authCodeBuf, offset);     offset += authCodeBuf.length;
    out.set(encAuthorizer, offset);   offset += encAuthorizer.length;
    out.set(encContext, offset);      offset += encContext.length;
    out.set(encItems, offset);

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

    // 1) authorization => VarLenBytesCodec
    {
      const slice = uint8.slice(offset);
      const { value: authVal, bytesUsed } = decodeWithBytesUsed(
        VarLenBytesCodec,
        slice
      );
      offset += bytesUsed;
      var authorization = authVal;
    }

    // 2) auth_code_host => u32
    if (offset + 4 > uint8.length) {
      throw new Error("WorkPackageCodec: not enough data for auth_code_host (u32)");
    }
    const auth_code_host = new DataView(
      uint8.buffer,
      uint8.byteOffset + offset,
      4
    ).getUint32(0, true);
    offset += 4;

    // 3) authorizer => AuthorizerCodec
    {
      const slice = uint8.slice(offset);
      const { value: authzVal, bytesUsed } = decodeWithBytesUsed(
        AuthorizerCodec,
        slice
      );
      offset += bytesUsed;
      var authorizer = authzVal;
    }

    // 4) context => ContextCodec
    {
      const slice = uint8.slice(offset);
      const { value: ctxVal, bytesUsed } = decodeWithBytesUsed(
        ContextCodec,
        slice
      );
      offset += bytesUsed;
      var context = ctxVal;
    }

    // 5) items => DiscriminatorCodec(WorkItemCodec)
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
      authorization,
      auth_code_host,
      authorizer,
      context,
      items,
    };
  },
] as Codec<WorkPackage>;

WorkPackageCodec.enc = WorkPackageCodec[0];
WorkPackageCodec.dec = WorkPackageCodec[1];
