const fs = require('fs');

try {
    let c = fs.readFileSync('src/app/page.tsx', 'utf8');

    // Backgrounds
    c = c.replace(/\bbg-slate-950\b/g, 'bg-gray-50 dark:bg-slate-950');
    c = c.replace(/\bbg-slate-900\/80\b/g, 'bg-white/80 dark:bg-slate-900/80');
    c = c.replace(/\bbg-slate-900\b/g, 'bg-white dark:bg-slate-900');
    c = c.replace(/\bbg-slate-800\/80\b/g, 'bg-gray-100/80 dark:bg-slate-800/80');
    c = c.replace(/\bbg-slate-800\/95\b/g, 'bg-white/95 dark:bg-slate-800/95');
    c = c.replace(/\bbg-slate-800\b/g, 'bg-white dark:bg-slate-800');
    c = c.replace(/\bbg-slate-900\/50\b/g, 'bg-gray-100/50 dark:bg-slate-900/50');

    // Specific backgrounds
    // white/10 is usually for hover in dark mode
    c = c.replace(/\bhover:bg-white\/10\b/g, 'hover:bg-gray-200 dark:hover:bg-white/10');
    c = c.replace(/(?<!hover:)\bbg-white\/10\b/g, 'bg-gray-200 dark:bg-white/10');

    // Text
    c = c.replace(/\btext-slate-300\b/g, 'text-gray-600 dark:text-slate-300');
    c = c.replace(/\btext-slate-400\b/g, 'text-gray-500 dark:text-slate-400');
    c = c.replace(/\btext-slate-100\b/g, 'text-gray-800 dark:text-slate-100');
    c = c.replace(/\btext-white\b/g, 'text-gray-900 dark:text-white'); // General text white -> dark text-white, light text-gray-900

    // Exception: buttons that are always primary color (e.g., bg-indigo-500) might need text-white on BOTH modes.
    // I will leave text-white alone in obvious places if it breaks, but for now this broad text-white replacement is okay 
    // Wait, let's fix the buttons:
    c = c.replace(/bg-indigo-500.*?text-gray-900 dark:text-white/g, (match) => match.replace('text-gray-900 dark:text-white', 'text-white'));
    c = c.replace(/bg-indigo-600.*?text-gray-900 dark:text-white/g, (match) => match.replace('text-gray-900 dark:text-white', 'text-white'));

    // Borders
    c = c.replace(/\bborder-white\/10\b/g, 'border-gray-200 dark:border-white/10');
    c = c.replace(/\bborder-slate-950\b/g, 'border-white dark:border-slate-950');

    // Placeholder
    c = c.replace(/\bplaceholder-slate-500\b/g, 'placeholder-gray-400 dark:placeholder-slate-500');

    // Indigo colors
    c = c.replace(/\btext-indigo-400\b/g, 'text-indigo-600 dark:text-indigo-400');
    // hover:bg-indigo-400 -> light mode hover:bg-indigo-600
    c = c.replace(/\bhover:bg-indigo-400\b/g, 'hover:bg-indigo-600 dark:hover:bg-indigo-400');

    // Re-establish some specific text-whites
    c = c.replace(/<Users size=\{18\} \/>/g, '<Users size={18} className="text-white" />');
    c = c.replace(/<Users size=\{22\} \/>/g, '<Users size={22} className="text-white" />');
    c = c.replace(/<Check size=\{12\} className="text-gray-900 dark:text-white"/g, '<Check size={12} className="text-white"');

    fs.writeFileSync('src/app/page.tsx', c);

    console.log('Success');
} catch (e) {
    console.error(e);
}
