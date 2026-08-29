import { createApiApp } from './app.ts';

async function main(): Promise<void> {
  const app = await createApiApp();
  const port = Number(process.env.PORT || 3000);
  await app.listen({ host:'0.0.0.0', port });
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
