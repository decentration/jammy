import { asU8, compareBytes } from "../utils";


export function getServiceProgramFromState(state: any, serviceId: number) {
  const accounts = state.accounts ?? state.data?.accounts ?? [];
  const svc = accounts.find((x: any) => x.id === serviceId);
  if (!svc) throw new Error("service not found");

  const codeHash =
    asU8(svc.data?.service?.code_hash ?? svc.service?.code_hash ?? svc.code_hash);

  const preimages = (svc.data?.preimage_blobs ?? svc.data?.preimages_blob ?? svc.preimage_blobs ?? svc.preimages_blob ?? []) as any[];
  const hit = preimages.find((pi) => compareBytes(asU8(pi.hash), codeHash) === 0);
  if (!hit) throw new Error("no matching preimage");

  return { codeHash, blob: asU8(hit.blob) };
}
