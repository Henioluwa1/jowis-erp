import { runPhase5Migration } from '../../backend/src/scripts/migrate_phase5.js';

runPhase5Migration()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
