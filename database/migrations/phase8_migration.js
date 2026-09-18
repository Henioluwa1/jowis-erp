import { runPhase8Migration } from '../../backend/src/scripts/migrate_phase8.js';

runPhase8Migration()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
