// src/stf/authorizations/codecs/AuthPoolCodec.ts
import { DiscriminatorCodec } from "..";
import { AUTH_POOL_MAX_SIZE } from "../../consts";
import { AuthorizerHashCodec } from "../../types/types";

/**
 * Up to 8 items, each 32 bytes => but can be 0..8
 */
export const AuthPoolCodec = DiscriminatorCodec(AuthorizerHashCodec, { maxSize: AUTH_POOL_MAX_SIZE});
