import { useNavigate } from '@tanstack/react-router';
import { HardDrive, LayoutGrid, Presentation } from 'lucide-react';
import { useState } from 'react';
import { FileIcon } from './file-icon';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from './ui/menu';
import { Tooltip } from './ui/misc';

export interface SuiteApp {
  id: string;
  name: string;
  desc: string;
  path: string;
  icon: React.ReactNode;
  color: string;
  badge?: string;
}

export const QUB_SUITE_APPS: SuiteApp[] = [
  {
    id: 'drive',
    name: 'Drive',
    desc: 'Files & cloud storage',
    path: '/drive',
    color: '#1a73e8',
    icon: (
      <div className="flex size-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 shadow-xs">
        <HardDrive className="size-5" />
      </div>
    ),
  },
  {
    id: 'docs',
    name: 'Docs',
    desc: 'Documents & notes',
    path: '/docs',
    color: '#4285f4',
    icon: (
      <div className="flex size-10 items-center justify-center rounded-xl bg-blue-50 text-blue-500 shadow-xs">
        <FileIcon type="DOCUMENT" size={26} />
      </div>
    ),
  },
  {
    id: 'sheets',
    name: 'Sheets',
    desc: 'Spreadsheets & analysis',
    path: '/sheets',
    color: '#0f9d58',
    icon: (
      <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 shadow-xs">
        <FileIcon type="SPREADSHEET" size={26} />
      </div>
    ),
  },
  {
    id: 'forms',
    name: 'Forms',
    desc: 'Surveys & quizzes',
    path: '/forms',
    color: '#7248b9',
    icon: (
      <div className="flex size-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600 shadow-xs">
        <FileIcon type="FORM" size={26} />
      </div>
    ),
  },
  {
    id: 'slides',
    name: 'Slides',
    desc: 'Presentations & pitches',
    path: '/slides',
    color: '#f59e0b',
    icon: (
      <div className="flex size-10 items-center justify-center rounded-xl bg-amber-50 text-amber-500 shadow-xs">
        <Presentation className="size-6" />
      </div>
    ),
  },
  {
    id: 'pdf',
    name: 'PDF Studio',
    desc: 'Sign, fill & annotate',
    path: '/pdf',
    color: '#ea4335',
    icon: (
      <div className="flex size-10 items-center justify-center rounded-xl bg-red-50 text-red-500 shadow-xs">
        <FileIcon type="PDF" size={26} />
      </div>
    ),
  },
];

export function AppLauncher() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const handleLaunch = (path: string) => {
    setOpen(false);
    void navigate({ to: path as any });
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <Tooltip content="Qub Suite Apps">
        <DropdownMenuTrigger asChild>
          <button
            className="flex size-10 items-center justify-center rounded-full text-muted transition-colors hover:bg-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Qub Suite Apps"
            aria-haspopup="menu"
            aria-expanded={open}
          >
            <LayoutGrid className="size-5" />
          </button>
        </DropdownMenuTrigger>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-[320px] p-3 shadow-pop rounded-2xl border border-border/80 bg-background/95 backdrop-blur-md">
        <div className="mb-2.5 px-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Qub Suite</p>
          <p className="text-sm font-medium text-foreground">Switch Application</p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {QUB_SUITE_APPS.map((app) => (
            <button
              key={app.id}
              onClick={() => handleLaunch(app.path)}
              className="group flex flex-col items-center justify-center gap-1.5 rounded-xl p-2.5 text-center transition-all hover:bg-hover active:scale-95"
            >
              {app.icon}
              <span className="text-xs font-medium text-foreground group-hover:text-primary">{app.name}</span>
            </button>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
