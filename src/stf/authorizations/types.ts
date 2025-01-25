import { Struct, Bytes, u16 } from 'scale-ts';

export interface AuthorizationsInput {
    slot: number;   // 4 bytes LE
    auths: CoreAuthorizer[];
}
  
export interface CoreAuthorizer {
    core: number;
    auth_hash: Uint8Array; 
}

export const CoreAuthorizerCodec = Struct({
    core: u16,          // => 2 bytes LE
    auth_hash: Bytes(32)
  });
  
export interface AuthorizationsState {
    auth_pools: Uint8Array[][]; 
    auth_queues: Uint8Array[][];
}
  
export type AuthorizationsOutput = null;
  

export interface Authorizations {
    input: AuthorizationsInput;
    pre_state: AuthorizationsState;
    output: AuthorizationsOutput;
    post_state: AuthorizationsState;
}

export type AuthorizerHash = Uint8Array;

export const AuthorizerHashCodec = Bytes(32);