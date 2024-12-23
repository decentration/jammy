import { sign as ed25519Sign, verify as ed25519Verify } from '@noble/ed25519';

const message = ""; 
const privateKey = ""; 
const publicKey = "";


const signature: Uint8Array = ed25519Sign(message, privateKey);

const isValid = ed25519Verify(signature, message, publicKey);