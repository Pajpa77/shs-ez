const fs = require('fs');
const glob = require('glob');

const files = glob.sync('src/components/**/*.tsx');

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  // Add flex-col and max-h-[90vh] to main modal wrappers
  const wrapperRegex = /className="bg-\[#1E293B\] border border-slate-[0-9]+ rounded-2xl shadow-2xl w-full max-w-[a-z0-9]+ overflow-hidden([^"]*)"/g;
  content = content.replace(wrapperRegex, (match, p1) => {
    if (!match.includes('flex flex-col')) {
      changed = true;
      return match.replace('overflow-hidden', 'overflow-hidden flex flex-col max-h-[90vh]');
    }
    return match;
  });

  // Remove max-h from inner elements and add flex-1 if they are the scroll containers
  const innerScrollRegex = /max-h-\[[^\]]+\] overflow-y-auto/g;
  content = content.replace(innerScrollRegex, (match) => {
    changed = true;
    return 'overflow-y-auto flex-1';
  });
  
  const innerScrollRegex2 = /max-h-[a-z0-9]+ overflow-y-auto/g;
  content = content.replace(innerScrollRegex2, (match) => {
    changed = true;
    return 'overflow-y-auto flex-1';
  });

  if (changed) {
    fs.writeFileSync(file, content, 'utf8');
    console.log('Fixed', file);
  }
});
