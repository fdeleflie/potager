import fs from 'fs';
const file = 'src/views/GardenPlan.tsx';
let d = fs.readFileSync(file, 'utf8');
d = d.replace(/const otherVegConfig = config\?\.find[^\n]+\n[^\n]+VEGETABLE_SPACING\[otherSeedling\.vegetable\][^\n]+;/g, 'const otherSpacing = getPlantSpacing(otherSeedling.vegetable);');
d = d.replace(/const ghostSpacing = selectedSeedling \? \(selectedSeedlingConfig\?\.attributes\?\.spacing \|\| VEGETABLE_SPACING\[selectedSeedling\.vegetable\] \|\| 30\) : 30;/g, 'const ghostSpacing = selectedSeedling ? getPlantSpacing(selectedSeedling.vegetable) : 30;');
fs.writeFileSync(file, d);
