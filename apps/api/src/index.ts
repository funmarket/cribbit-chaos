import { createApiApp } from './app.ts';

const app = await createApiApp();
const port = Number(process.env.PORT || 3000);
await app.listen({ host:'0.0.0.0', port });
