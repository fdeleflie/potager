import fs from 'fs';
const file = 'src/views/SeedlingsList.tsx';
let d = fs.readFileSync(file, 'utf8');

d = d.replace(
  "const [filterState, setFilterState] = useState(() => sessionStorage.getItem('seedlings_filter_state') || 'all');",
  `const [filterStates, setFilterStates] = useState<string[]>(() => {
    const saved = sessionStorage.getItem('seedlings_filter_states');
    return saved ? JSON.parse(saved) : [];
  });
  const [showStateDropdown, setShowStateDropdown] = useState(false);`
);

d = d.replace(
  "sessionStorage.setItem('seedlings_filter_state', filterState);",
  "sessionStorage.setItem('seedlings_filter_states', JSON.stringify(filterStates));"
);

d = d.replace(
  "const matchesState = filterState === 'all' || s.state === filterState;",
  "const matchesState = filterStates.length === 0 || filterStates.includes(s.state);"
);

d = d.replace(/, filterState,/g, ", filterStates,");
d = d.replace(/\[filterState\]/g, "[filterStates]");

fs.writeFileSync(file, d);
