'use client';

import { useEffect } from 'react';
import { useChatStore } from '../store/useChatStore';

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
    const theme = useChatStore((state) => state.theme);

    useEffect(() => {
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [theme]);

    return <>{children}</>;
}
