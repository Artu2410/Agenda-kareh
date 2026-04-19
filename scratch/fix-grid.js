const fs = require('fs');
const content = fs.readFileSync('client/src/components/agenda/WeeklyCalendarGrid.jsx', 'utf8');

const updated = content.replace(
  /<Flag size={8} fill="currentColor" \/> INGRESO\s+<\/div>\s+\)\}/,
  '<Flag size={8} fill="currentColor" /> INGRESO\n                          </div>\n                        )}\n\n                        {app.sessionNumber === 10 && (\n                          <div className="absolute -top-2 -right-1 bg-emerald-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full shadow-lg flex items-center gap-1 z-10">\n                            <CheckCircle2 size={8} fill="currentColor" /> FINALIZA\n                          </div>\n                        )}'
);

fs.writeFileSync('client/src/components/agenda/WeeklyCalendarGrid.jsx', updated);
console.log('Success');
