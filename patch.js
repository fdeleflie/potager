import fs from 'fs';
const file = 'src/views/GardenPlan.tsx';
let d = fs.readFileSync(file, 'utf8');
d = d.replace(/const spacing = vegConfig\?\.attributes\?\.spacing \|\| VEGETABLE_SPACING\[([^\]]+)\] \|\| 30;/g, 'const spacing = getPlantSpacing($1);');
d = d.replace(/const vegConfig = config\?\.find\(c => c\.type === 'vegetable' \&\& c\.value === (seedling(?:\??\.vegetable)?\|\|'');/g, '');
d = d.replace(/return \(\(vegConfig\?\.attributes\?\.spacing \|\| VEGETABLE_SPACING\[([^\]]+)\] \|\| 30\) \/ 2\) \* zoom;/g, 'return (getPlantSpacing($1) / 2) * zoom;');
d = d.replace(/return \(vegConfig\?\.attributes\?\.spacing \|\| VEGETABLE_SPACING\[([^\]]+)\] \|\| 30\) \/ 2;/g, 'return getPlantSpacing($1) / 2;');
fs.writeFileSync(file, d);
