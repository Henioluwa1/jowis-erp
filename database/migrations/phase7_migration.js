import { runPhase7Migration } from '../../backend/src/scripts/migrate_phase7.js';

runPhase7Migration()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
