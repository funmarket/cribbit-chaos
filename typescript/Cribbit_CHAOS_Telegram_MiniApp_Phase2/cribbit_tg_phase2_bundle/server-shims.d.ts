declare module 'fastify' { const value:any; export default value; }
declare module '@fastify/cors' { const value:any; export default value; }
declare module 'socket.io' { export class Server { constructor(...args:any[]); on(...args:any[]):any; } }
declare module 'node:crypto' { export const createHmac:any; export const timingSafeEqual:any; export const randomUUID:any; export const randomBytes:any; export const createHash:any; }
declare module 'node:path' { export const resolve:any; }
declare module 'vite' { export const defineConfig:any; }
declare const process: any;
declare const Buffer: any;
type Buffer = any;
declare const __dirname: string;

declare module 'pg' { const value:any; export default value; }
declare module 'socket.io-client' { export type Socket = any; export const io:any; }
