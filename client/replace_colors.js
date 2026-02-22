const fs = require('fs');

try {
    let c = fs.readFileSync('src/app/page.tsx', 'utf8');

    // Perform replacements
    c = c.replace(/bg-\[#111b21\]/g, 'bg-slate-950');
    c = c.replace(/border-\[#202c33\]/g, 'border-white/10');
    c = c.replace(/bg-\[#202c33\]/g, 'bg-slate-900/80 backdrop-blur-md');
    c = c.replace(/text-\[#aebac1\]/g, 'text-slate-300');
    c = c.replace(/hover:bg-\[#2a3942\]/g, 'hover:bg-white/10');
    c = c.replace(/bg-\[#2a3942\]/g, 'bg-slate-800/80 backdrop-blur-sm');
    c = c.replace(/text-\[#8696a0\]/g, 'text-slate-400');
    c = c.replace(/text-\[#00a884\]/g, 'text-indigo-400');
    c = c.replace(/bg-\[#00a884\]/g, 'bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.4)]');
    c = c.replace(/border-\[#00a884\]/g, 'border-indigo-500');
    c = c.replace(/border-\[#111b21\]/g, 'border-slate-950');
    c = c.replace(/hover:bg-\[#02be9b\]/g, 'hover:bg-indigo-400');
    c = c.replace(/bg-\[#005c4b\]/g, 'bg-indigo-600 shadow-md border border-indigo-500/30');
    c = c.replace(/bg-\[#004c3f\]/g, 'bg-indigo-900/40 border-indigo-500/50');
    c = c.replace(/border-\[#8696a0\]\/30/g, 'border-white/10');
    c = c.replace(/text-\[#e9edef\]/g, 'text-slate-100');
    c = c.replace(/bg-\[#233138\]/g, 'bg-slate-800/95 backdrop-blur-xl border border-white/10 shadow-2xl');
    c = c.replace(/border-\[#3d4a52\]/g, 'border-white/10');
    c = c.replace(/bg-\[#3d4a52\]/g, 'bg-white/10');
    c = c.replace(/hover:bg-\[#3d4a52\]/g, 'hover:bg-white/10');
    c = c.replace(/bg-\[#182229\]/g, 'bg-slate-900/50');
    c = c.replace(/text-\[#53bdeb\]/g, 'text-sky-400');
    c = c.replace(/bg-\[#222e35\]/g, 'bg-slate-950');
    c = c.replace(/rounded-lg/g, 'rounded-2xl');
    c = c.replace(/rounded-md/g, 'rounded-xl');
    c = c.replace(/transition-colors/g, 'transition-all duration-300 ease-in-out hover:scale-[1.02]');

    fs.writeFileSync('src/app/page.tsx', c);

    let css = fs.readFileSync('src/app/globals.css', 'utf8');
    css = css.replace(/#0b141a/g, '#020617');
    css = css.replace(/%23182229/g, '%230f172a');
    css = css.replace(/#374151/g, '#334155');
    css = css.replace(/#4b5563/g, '#475569');
    css = css.replace(/#202c33/g, '#0f172a');
    css = css.replace(/#005c4b/g, '#4f46e5');
    fs.writeFileSync('src/app/globals.css', css);

    console.log('Success');
} catch (e) {
    console.error(e);
}
