import { openDatabase, resolveDataDir } from './db.ts'
import { JobStore } from './jobs.ts'
import { SAMPLE_JOBS } from './sample-jobs.ts'

// Loads demo applications into the database; ones already present (same id) are left untouched.
const store = new JobStore(openDatabase(), resolveDataDir())
const { imported, skipped } = store.importJobs(SAMPLE_JOBS, 'dashboard', 'Added sample application')
console.log(`Seeded ${imported} sample applications into ${resolveDataDir()} (${skipped} already present).`)
