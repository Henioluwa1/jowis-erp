import { runPhase9Migration } from '../../backend/src/scripts/migrate_phase9.js';

runPhase9Migration()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
