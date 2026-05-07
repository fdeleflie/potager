const fs = require('fs');
const glob = require('glob'); // Note: 'glob' might not be installed, we can just use fs.readdirSync recursively or child_process

const execSync = require('child_process').execSync;

const files = execSync('grep -rl "GARDEN_EMOJIS.includes" src/').toString().split('\n').filter(Boolean);

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/import \{([^}]*)GARDEN_EMOJIS([^}]*)\} from '(..\/)?constants';/g, (match, p1, p2, p3) => {
    // Add isEmoji to imports if not there
    if (!match.includes('isEmoji')) {
      return match.replace('GARDEN_EMOJIS', 'GARDEN_EMOJIS, isEmoji');
    }
    return match;
  });
  
  // Also check if they just imported ICON_MAP, GARDEN_EMOJIS
  // Need to ensure isEmoji is available in the file
  if (!content.includes('isEmoji')) {
      content = content.replace(/GARDEN_EMOJIS/, 'GARDEN_EMOJIS, isEmoji');
  }

  content = content.replace(/GARDEN_EMOJIS\.includes\(([^)]+)\)/g, 'isEmoji($1)');
  fs.writeFileSync(file, content, 'utf8');
  console.log('Updated ' + file);
});
