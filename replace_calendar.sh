cat << 'INNER_EOF' > /tmp/calendar_script.js
const fs = require('fs');
let content = fs.readFileSync('src/views/HarvestCalendar.tsx', 'utf8');

// Replace renderTimeline
content = content.replace(
  /const renderTimeline = \(tree: Tree\) => \{[\s\S]*?return \([\s\S]*?\}\);\s*\};/,
  `const renderTimeline = (tree: Tree) => {
    const rawMonths = tree.harvestMonths || [];
    const months = rawMonths.flatMap(m => Number.isInteger(m) ? [m, m + 0.5] : [m]);
    return (
      <div className="flex flex-1 h-8 rounded-lg overflow-hidden bg-stone-100 border border-stone-200">
        {MONTHS.map((_, idx) => {
          const earlyVal = idx + 1;
          const lateVal = idx + 1.5;
          const isEarlyHarvest = months.includes(earlyVal);
          const isLateHarvest = months.includes(lateVal);
          
          return (
            <div key={idx} className="flex-1 flex border-r border-stone-200/50 last:border-r-0">
              <div 
                className={\`flex-1 transition-colors \${
                  isEarlyHarvest 
                    ? tree.status === 'planned' ? 'bg-amber-400/80' : 'bg-emerald-500'
                    : 'bg-transparent'
                }\`}
                title={isEarlyHarvest ? 'Période de récolte (Début du mois)' : ''}
              />
              <div 
                className={\`flex-1 transition-colors border-l border-stone-200/20 \${
                  isLateHarvest 
                    ? tree.status === 'planned' ? 'bg-amber-400/80' : 'bg-emerald-500'
                    : 'bg-transparent'
                }\`}
                title={isLateHarvest ? 'Période de récolte (Fin du mois)' : ''}
              />
            </div>
          );
        })}
      </div>
    );
  };`
);

// Replace modal fields
const oldModalPeriod = /<div>\s*<label className="block text-sm font-medium text-stone-700 mb-2">Période de récolte<\/label>[\s\S]*?<\/div>\s*<\/div>\s*<div className="p-6 border-t border-stone-100 flex justify-end gap-3 bg-stone-50">/;

const newModalPeriod = `<div>
                <label className="block text-sm font-medium text-stone-700 mb-2">Période de récolte</label>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {MONTHS.map((m, idx) => {
                    const earlyVal = idx + 1;
                    const lateVal = idx + 1.5;
                    const isEarly = harvestMonths.includes(earlyVal);
                    const isLate = harvestMonths.includes(lateVal);
                    return (
                      <div key={idx} className="flex flex-col gap-1">
                        <span className="text-xs font-bold text-stone-500 uppercase">{m}</span>
                        <div className="flex bg-stone-100 rounded-lg p-0.5">
                          <button
                            onClick={() => toggleMonth(earlyVal)}
                            className={\`flex-1 py-1 text-[10px] font-medium rounded-md transition-colors \${isEarly ? 'bg-amber-500 text-white shadow-sm' : 'text-stone-600 hover:bg-stone-200'}\`}
                          >
                            1-15
                          </button>
                          <button
                            onClick={() => toggleMonth(lateVal)}
                            className={\`flex-1 py-1 text-[10px] font-medium rounded-md transition-colors \${isLate ? 'bg-amber-500 text-white shadow-sm' : 'text-stone-600 hover:bg-stone-200'}\`}
                          >
                            16-31
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-stone-100 flex justify-end gap-3 bg-stone-50">`;

content = content.replace(oldModalPeriod, newModalPeriod);

// Replace setHarvestMonths in handleOpenModal
content = content.replace(
  /setHarvestMonths\(tree\.harvestMonths \|\| \[\]\);/,
  `setHarvestMonths(tree.harvestMonths?.flatMap(m => Number.isInteger(m) ? [m, m + 0.5] : [m]) || []);`
);

// Replace setHarvestMonths in handleSpeciesChange
content = content.replace(
  /setHarvestMonths\(entry\.harvestMonths\);/,
  `setHarvestMonths(entry.harvestMonths.flatMap(m => Number.isInteger(m) ? [m, m + 0.5] : [m]));`
);

fs.writeFileSync('src/views/HarvestCalendar.tsx', content);
INNER_EOF
node /tmp/calendar_script.js
npx tsc --noEmit
