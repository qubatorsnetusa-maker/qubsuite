import React from 'react';
import {
  Search,
  X,
  Plus,
  Star,
  LayoutGrid,
  List,
  SlidersHorizontal,
  FolderPlus,
} from 'lucide-react';

export type WorkspaceSortOption =
  | 'updated_desc'
  | 'title_asc'
  | 'responses_desc'
  | 'completion_desc'
  | 'steps_desc';

export type WorkspaceStatusFilter = 'all' | 'published' | 'draft' | 'closed';

interface WorkspaceFilterBarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedFolder: string;
  onSelectFolder: (folder: string) => void;
  folders: string[];
  onAddNewFolder: () => void;
  statusFilter: WorkspaceStatusFilter;
  onStatusFilterChange: (s: WorkspaceStatusFilter) => void;
  sortOption: WorkspaceSortOption;
  onSortChange: (sort: WorkspaceSortOption) => void;
  viewMode: 'grid' | 'table';
  onViewModeChange: (mode: 'grid' | 'table') => void;
  totalMatchingCount: number;
}

export const WorkspaceFilterBar: React.FC<WorkspaceFilterBarProps> = ({
  searchQuery,
  onSearchChange,
  selectedFolder,
  onSelectFolder,
  folders,
  onAddNewFolder,
  statusFilter,
  onStatusFilterChange,
  sortOption,
  onSortChange,
  viewMode,
  onViewModeChange,
  totalMatchingCount,
}) => {
  return (
    <div className="space-y-4">
      {/* Top Filter Controls Row */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Search Bar */}
        <div className="relative flex-1 max-w-lg">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            id="input-workspace-search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search forms by title, question, or tag..."
            className="w-full pl-9 pr-14 py-2 bg-white text-xs rounded-xl border border-slate-200/90 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-600/15 focus:border-indigo-600 transition placeholder:text-slate-400 shadow-2xs"
          />
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center">
            {searchQuery ? (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-md transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : (
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono-code font-semibold text-slate-400 bg-slate-100 rounded border border-slate-200/80 select-none">
                /
              </kbd>
            )}
          </div>
        </div>

        {/* Status Filter, Sort Dropdown, and View Switcher */}
        <div className="flex items-center flex-wrap gap-2.5">
          {/* Status Filter Segmented Control */}
          <div className="flex items-center gap-1 bg-white border border-slate-200/90 p-1 rounded-xl shadow-2xs">
            {(
              [
                { id: 'all', label: 'All Status' },
                { id: 'published', label: 'Live', dot: 'bg-emerald-500' },
                { id: 'draft', label: 'Draft', dot: 'bg-amber-500' },
                { id: 'closed', label: 'Closed', dot: 'bg-slate-400' },
              ] as const
            ).map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => onStatusFilterChange(st.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-lg capitalize transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1 ${
                  statusFilter === st.id
                    ? 'bg-indigo-50 text-indigo-700 font-semibold border border-indigo-600 shadow-[0_0_0_1px_rgba(79,70,229,1)]'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 border border-transparent'
                }`}
              >
                {'dot' in st && (
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      statusFilter === st.id ? 'bg-indigo-600' : st.dot
                    }`}
                  />
                )}
                <span>{st.label}</span>
              </button>
            ))}
          </div>

          {/* Sort Selector */}
          <div className="relative flex items-center bg-white border border-slate-200/90 hover:border-slate-300 px-3 py-1.5 rounded-xl text-xs text-slate-700 shadow-2xs transition focus-within:ring-2 focus-within:ring-indigo-600/15 focus-within:border-indigo-600">
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400 shrink-0 mr-1.5" />
            <select
              id="select-workspace-sort"
              value={sortOption}
              onChange={(e) => onSortChange(e.target.value as WorkspaceSortOption)}
              className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer pr-2 appearance-none"
            >
              <option value="updated_desc">Recently Updated</option>
              <option value="title_asc">Name (A-Z)</option>
              <option value="responses_desc">Most Responses</option>
              <option value="completion_desc">Highest Conversion %</option>
              <option value="steps_desc">Most Steps</option>
            </select>
          </div>

          {/* Grid vs Table View Mode */}
          <div className="flex items-center bg-white border border-slate-200/90 p-1 rounded-xl shadow-2xs">
            <button
              type="button"
              id="btn-workspace-view-grid"
              onClick={() => onViewModeChange('grid')}
              className={`p-1.5 rounded-lg transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1 ${
                viewMode === 'grid'
                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-600 shadow-[0_0_0_1px_rgba(79,70,229,1)]'
                  : 'text-slate-500 hover:text-slate-950 hover:bg-slate-100/80 border border-transparent'
              }`}
              title="Grid View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              id="btn-workspace-view-table"
              onClick={() => onViewModeChange('table')}
              className={`p-1.5 rounded-lg transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1 ${
                viewMode === 'table'
                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-600 shadow-[0_0_0_1px_rgba(79,70,229,1)]'
                  : 'text-slate-500 hover:text-slate-950 hover:bg-slate-100/80 border border-transparent'
              }`}
              title="Table View"
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Folders & Categories Navigation Ribbon */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 pt-0.5 scrollbar-none text-xs border-b border-slate-200/60">
        <button
          type="button"
          onClick={() => onSelectFolder('all')}
          className={`px-3.5 py-1.5 rounded-xl font-medium shrink-0 transition cursor-pointer border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1 ${
            selectedFolder === 'all'
              ? 'bg-indigo-50 text-indigo-700 border-indigo-600 shadow-[0_0_0_1px_rgba(79,70,229,1)]'
              : 'bg-white text-slate-600 hover:text-slate-950 border-slate-200/90 hover:bg-slate-50/80 shadow-2xs'
          }`}
        >
          All Forms
        </button>

        <button
          type="button"
          onClick={() => onSelectFolder('favorites')}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-medium shrink-0 transition cursor-pointer border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1 ${
            selectedFolder === 'favorites'
              ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
              : 'bg-white text-slate-600 hover:text-slate-950 border-slate-200/90 hover:bg-slate-50/80 shadow-2xs'
          }`}
        >
          <Star className={`w-3.5 h-3.5 ${selectedFolder === 'favorites' ? 'fill-white text-white' : 'text-amber-500 fill-amber-500/20'}`} />
          <span>Starred</span>
        </button>

        {folders.map((folder) => (
          <button
            key={folder}
            type="button"
            onClick={() => onSelectFolder(folder)}
            className={`px-3.5 py-1.5 rounded-xl font-medium shrink-0 transition cursor-pointer border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1 ${
              selectedFolder === folder
                ? 'bg-indigo-50 text-indigo-700 border-indigo-600 shadow-[0_0_0_1px_rgba(79,70,229,1)]'
                : 'bg-white text-slate-600 hover:text-slate-950 border-slate-200/90 hover:bg-slate-50/80 shadow-2xs'
            }`}
          >
            {folder}
          </button>
        ))}

        <button
          type="button"
          onClick={onAddNewFolder}
          className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-slate-500 hover:text-slate-950 bg-slate-100/80 hover:bg-slate-200/70 shrink-0 font-medium transition cursor-pointer border border-transparent hover:border-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1"
          title="Create New Folder"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Folder</span>
        </button>

        <div className="ml-auto shrink-0 pl-3 text-[11px] font-mono-code text-slate-400 font-medium">
          Showing <span className="font-bold text-slate-700">{totalMatchingCount}</span> form{totalMatchingCount === 1 ? '' : 's'}
        </div>
      </div>
    </div>
  );
};
