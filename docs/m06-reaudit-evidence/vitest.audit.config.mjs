import { fileURLToPath } from 'node:url';
export default {
  root: fileURLToPath(new URL('../..', import.meta.url)),
  test: { environment: 'jsdom', include: ['docs/m06-reaudit-evidence/cache-probe.test.mjs'] },
};
