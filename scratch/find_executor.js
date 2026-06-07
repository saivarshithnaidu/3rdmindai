const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../services/orchestrator.service.ts');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('dispatchExecutor')) {
    console.log(`Found dispatchExecutor at L${idx + 1}: ${line.trim()}`);
  }
});
