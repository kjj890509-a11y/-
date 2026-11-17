import {createRelayHandler} from './relay.mjs';
import {tokenHash} from './credential.mjs';
// Custom service authentication is mandatory inside the handler.
// Existing truck functions and their authentication remain unchanged.
Deno.serve(createRelayHandler({expectedTokenHash:tokenHash,readApiKey:()=>Deno.env.get('FORTUNE_OPENAI_API_KEY')}));
