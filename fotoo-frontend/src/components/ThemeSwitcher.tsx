import { useEffect, useState } from 'react';

const PRESETS: Record<string, Record<string, string>> = {
  Default: {
    '--color-primary': '262 83% 58%',
    '--color-on-primary': '0 0% 100%',
    '--color-bg': '210 20% 98%',
    '--color-text': '220 14% 20%',
    '--color-surface': '0 0% 100%',
    '--color-border': '220 13% 91%',
    '--color-accent': '10 90% 60%',
  },
  Ocean: {
    '--color-primary': '199 89% 48%',
    '--color-on-primary': '0 0% 100%',
    '--color-bg': '210 40% 96%',
    '--color-text': '222 47% 11%',
    '--color-surface': '0 0% 100%',
    '--color-border': '210 40% 90%',
    '--color-accent': '28 95% 54%',
  },
  Rose: {
    '--color-primary': '346 77% 49%',
    '--color-on-primary': '0 0% 100%',
    '--color-bg': '0 0% 99%',
    '--color-text': '220 14% 20%',
    '--color-surface': '0 0% 100%',
    '--color-border': '220 13% 91%',
    '--color-accent': '268 89% 60%',
  },
  Pookie: {
    '--color-primary': '348 88% 66%',
    '--color-on-primary': '0 0% 100%',
    '--color-bg': '328 100% 95%',
    '--color-text': '328 100% 64.5%',
    '--color-surface': '0 0% 100%',
    '--color-border': '328 100% 64.5%',
    '--color-accent': '36 89% 68%',
  },
};

function applyVars(vars: Record<string, string>) {
  const root = document.documentElement;
  Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));
}

export function ThemeSwitcher() {
  const [theme, setTheme] = useState<string>(() => localStorage.getItem('theme') || 'Default');

  useEffect(() => {
    const vars = PRESETS[theme] || PRESETS.Default;
    applyVars(vars);
    localStorage.setItem('theme', theme);
  }, [theme]);

  return (
    <div className="flex items-center gap-2">
      <label className="text-sm text-gray-600">Theme</label>
      <select
        value={theme}
        onChange={(e) => setTheme(e.target.value)}
        className="rounded border border-border bg-surface px-2 py-1 text-sm"
      >
        {Object.keys(PRESETS).map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
    </div>
  );
}

export default ThemeSwitcher;
