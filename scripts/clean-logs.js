const fs = require('fs');
const path = require('path');

const targetDir = path.join(__dirname, '..', 'tmp');

if (!fs.existsSync(targetDir)) {
  console.log('tmp folder belum ada, tidak ada log yang perlu dihapus');
  process.exit(0);
}

const entries = fs.readdirSync(targetDir, { withFileTypes: true });
const logFiles = entries.filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.log'));
let deletedCount = 0;
let skippedCount = 0;

for (const file of logFiles) {
  try {
    fs.unlinkSync(path.join(targetDir, file.name));
    deletedCount += 1;
  } catch (error) {
    if (error && (error.code === 'EBUSY' || error.code === 'EPERM')) {
      skippedCount += 1;
      continue;
    }

    throw error;
  }
}

console.log(`log dihapus: ${deletedCount}`);
if (skippedCount > 0) {
  console.log(`log dilewati karena sedang dipakai: ${skippedCount}`);
}
