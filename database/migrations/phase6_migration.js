import { runPhase6Migration } from '../../backend/src/scripts/migrate_phase6.js';

runPhase6Migration()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
