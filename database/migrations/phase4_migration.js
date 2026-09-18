import { runPhase4Migration } from '../../backend/src/scripts/migrate_phase4.js';

runPhase4Migration()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
