'use client';

import * as React from 'react';

// Simplified Dropdown for urgency
// In a real app we'd use @radix-ui/react-dropdown-menu

// Since the TaskCard expects specifically named exports used in a composition pattern:
// I'll rewrite TaskCard to use the SimpleDropdown I just designed or I'll implement the composition pattern here.

const DropdownContext = React.createContext<{ open: boolean; setOpen: (o: boolean) => void }>({ open: false, setOpen: () => { } });

export const DropdownMenuRoot = ({ children }: { children: React.ReactNode }) => {
    const [open, setOpen] = React.useState(false);
    const ref = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <DropdownContext.Provider value={{ open, setOpen }}>
            <div className="relative inline-block text-left" ref={ref}>{children}</div>
        </DropdownContext.Provider>
    );
};

export const DropdownMenuTriggerComponent = ({ asChild, children }: any) => {
    const { open, setOpen } = React.useContext(DropdownContext);
    return (
        <div onClick={(e) => { e.stopPropagation(); setOpen(!open); }}>
            {children}
        </div>
    );
};

export const DropdownMenuContentComponent = ({ align, children }: any) => {
    const { open } = React.useContext(DropdownContext);
    if (!open) return null;
    return (
        <div className={`absolute ${align === 'end' ? 'right-0' : 'left-0'} mt-2 w-48 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50 animate-in fade-in zoom-in-95 duration-100`}>
            <div className="py-1">{children}</div>
        </div>
    );
};

export const DropdownMenuItemComponent = ({ onClick, children }: any) => {
    return (
        <div
            className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer flex items-center"
            onClick={(e) => { e.stopPropagation(); onClick && onClick(); }}
        >
            {children}
        </div>
    );
};

export const DropdownMenuLabelComponent = ({ children }: any) => (
    <div className="px-4 py-2 text-xs font-bold text-gray-500 uppercase tracking-wider">{children}</div>
);

export const DropdownMenuSeparatorComponent = () => (
    <div className="border-t border-gray-100 my-1"></div>
);

// Exports matching import alias
export {
    DropdownMenuRoot as DropdownMenu,
    DropdownMenuTriggerComponent as DropdownMenuTrigger,
    DropdownMenuContentComponent as DropdownMenuContent,
    DropdownMenuItemComponent as DropdownMenuItem,
    DropdownMenuLabelComponent as DropdownMenuLabel,
    DropdownMenuSeparatorComponent as DropdownMenuSeparator
};
