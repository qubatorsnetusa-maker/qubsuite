import React, { useState, useRef } from 'react';
import {
  Image as ImageIcon,
  Upload,
  Link2,
  Sparkles,
  X,
  Check,
  RefreshCw,
  Eye,
  Sliders,
  Maximize2,
  AlertCircle,
} from 'lucide-react';
import {
  BACKGROUND_PRESETS,
  HEADER_PRESETS,
} from '../data/imagePresets';
import type { ImagePreset } from '../data/imagePresets';

interface ImagePickerControlProps {
  label: string;
  description?: string;
  currentImageUrl?: string;
  presetType?: 'background' | 'header';
  onSelectImage: (url: string, alt?: string) => void;
  onRemoveImage: () => void;
  // Optional background tuning controls
  showTuningControls?: boolean;
  opacity?: number;
  onOpacityChange?: (opacity: number) => void;
  blur?: 'none' | 'sm' | 'md' | 'lg';
  onBlurChange?: (blur: 'none' | 'sm' | 'md' | 'lg') => void;
}

export const ImagePickerControl: React.FC<ImagePickerControlProps> = ({
  label,
  description,
  currentImageUrl,
  presetType = 'header',
  onSelectImage,
  onRemoveImage,
  showTuningControls = false,
  opacity = 0.25,
  onOpacityChange,
  blur = 'none',
  onBlurChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'presets' | 'url' | 'upload'>('presets');
  const [customUrlInput, setCustomUrlInput] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isDragOver, setIsDragOver] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const presets: ImagePreset[] = presetType === 'background' ? BACKGROUND_PRESETS : HEADER_PRESETS;

  const categories = ['all', 'minimal', 'nature', 'architecture', 'gradient', 'workspace'];

  const filteredPresets =
    selectedCategory === 'all'
      ? presets
      : presets.filter((p) => p.category === selectedCategory);

  const handleApplyCustomUrl = () => {
    if (!customUrlInput.trim()) return;
    onSelectImage(customUrlInput.trim(), 'Custom Image');
    setIsOpen(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
  };

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setUploadError('Please upload an image file (PNG, JPG, WebP, SVG).');
      return;
    }
    setUploadError(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        onSelectImage(result, file.name);
        setIsOpen(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  return (
    <div className="space-y-3 p-3.5 rounded-xl border border-zinc-200 bg-zinc-50/70">
      <div className="flex items-center justify-between">
        <div>
          <label className="text-xs font-semibold text-zinc-800 flex items-center gap-1.5">
            <ImageIcon className="w-3.5 h-3.5 text-zinc-500" />
            <span>{label}</span>
          </label>
          {description && <p className="text-[11px] text-zinc-500 mt-0.5">{description}</p>}
        </div>

        {currentImageUrl ? (
          <button
            type="button"
            id={`btn-remove-${label.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
            onClick={onRemoveImage}
            className="text-[11px] text-rose-600 hover:text-rose-700 font-medium px-2 py-1 rounded hover:bg-rose-50 transition cursor-pointer flex items-center gap-1"
          >
            <X className="w-3 h-3" />
            <span>Remove</span>
          </button>
        ) : (
          <button
            type="button"
            id={`btn-choose-${label.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
            onClick={() => setIsOpen(!isOpen)}
            className="text-xs font-medium px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
          >
            <Sparkles className="w-3 h-3" />
            <span>Choose Image</span>
          </button>
        )}
      </div>

      {/* Current Image Active Preview */}
      {currentImageUrl && (
        <div className="relative group rounded-lg overflow-hidden border border-zinc-300/80 bg-zinc-100 max-h-36">
          <img
            src={currentImageUrl}
            alt={label}
            className="w-full h-28 object-cover transition duration-300 group-hover:scale-105"
            onError={() => setImageError(true)}
          />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setIsOpen(true)}
              className="px-2.5 py-1 rounded-md bg-white text-zinc-900 text-xs font-medium shadow-sm hover:bg-zinc-100 flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Change</span>
            </button>
            <button
              type="button"
              onClick={onRemoveImage}
              className="px-2.5 py-1 rounded-md bg-rose-600 text-white text-xs font-medium shadow-sm hover:bg-rose-700 flex items-center gap-1"
            >
              <X className="w-3 h-3" />
              <span>Remove</span>
            </button>
          </div>
          <div className="absolute bottom-1.5 left-2 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded font-mono-code backdrop-blur-xs">
            Active Image
          </div>
        </div>
      )}

      {/* Tuning Controls (for background opacity and blur) */}
      {currentImageUrl && showTuningControls && (
        <div className="pt-2 border-t border-zinc-200/80 space-y-2.5 text-xs">
          {onOpacityChange && (
            <div>
              <div className="flex items-center justify-between text-[11px] text-zinc-600 mb-1">
                <span>Overlay Visibility (Opacity)</span>
                <span className="font-mono-code font-bold text-zinc-800">
                  {Math.round(opacity * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0.05"
                max="0.9"
                step="0.05"
                value={opacity}
                onChange={(e) => onOpacityChange(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-zinc-900"
              />
            </div>
          )}

          {onBlurChange && (
            <div>
              <div className="flex items-center justify-between text-[11px] text-zinc-600 mb-1">
                <span>Backdrop Softness (Blur)</span>
                <span className="font-mono-code font-bold text-zinc-800 uppercase text-[10px]">
                  {blur}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1.5 text-[11px]">
                {(['none', 'sm', 'md', 'lg'] as const).map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => onBlurChange(b)}
                    className={`py-1 rounded border text-center font-medium capitalize transition cursor-pointer ${
                      blur === b
                        ? 'bg-zinc-900 text-white border-zinc-900 shadow-2xs'
                        : 'bg-white text-zinc-700 border-zinc-200 hover:border-zinc-300'
                    }`}
                  >
                    {b === 'none' ? 'Crisp' : b}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Expanded Selection Modal / Drawer */}
      {isOpen && (
        <div className="pt-3 border-t border-zinc-200 space-y-3">
          {/* Sub-tabs */}
          <div className="flex items-center gap-1 p-1 rounded-lg bg-zinc-200/70 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('presets')}
              className={`flex-1 py-1 rounded-md text-center font-medium transition cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'presets'
                  ? 'bg-white text-zinc-900 shadow-2xs'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <Sparkles className="w-3 h-3 text-amber-500" />
              <span>Curated Presets</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('upload')}
              className={`flex-1 py-1 rounded-md text-center font-medium transition cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'upload'
                  ? 'bg-white text-zinc-900 shadow-2xs'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <Upload className="w-3 h-3 text-indigo-500" />
              <span>Upload File</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('url')}
              className={`flex-1 py-1 rounded-md text-center font-medium transition cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'url'
                  ? 'bg-white text-zinc-900 shadow-2xs'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <Link2 className="w-3 h-3 text-emerald-500" />
              <span>Custom URL</span>
            </button>
          </div>

          {/* TAB 1: CURATED PRESETS */}
          {activeTab === 'presets' && (
            <div className="space-y-2.5">
              {/* Category Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-[10px]">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-2 py-0.5 rounded-full font-medium capitalize whitespace-nowrap transition cursor-pointer ${
                      selectedCategory === cat
                        ? 'bg-zinc-900 text-white'
                        : 'bg-zinc-200/80 hover:bg-zinc-200 text-zinc-700'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Presets Grid */}
              <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                {filteredPresets.map((preset) => {
                  const isSelected = currentImageUrl === preset.url;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        onSelectImage(preset.url, preset.alt);
                        setIsOpen(false);
                      }}
                      className={`relative group rounded-lg overflow-hidden border text-left transition cursor-pointer ${
                        isSelected
                          ? 'ring-2 ring-zinc-900 border-transparent shadow-xs'
                          : 'border-zinc-200 hover:border-zinc-400'
                      }`}
                    >
                      <img
                        src={preset.thumbnailUrl}
                        alt={preset.alt}
                        className="w-full h-16 object-cover transition group-hover:scale-105"
                        loading="lazy"
                      />
                      <div className="p-1.5 bg-white">
                        <div className="text-[10px] font-medium text-zinc-800 truncate">
                          {preset.title}
                        </div>
                      </div>
                      {isSelected && (
                        <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-zinc-900 text-white flex items-center justify-center">
                          <Check className="w-2.5 h-2.5" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: UPLOAD IMAGE */}
          {activeTab === 'upload' && (
            <div className="space-y-2">
              {uploadError && (
                <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-600 text-[11px] font-medium flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`p-6 border-2 border-dashed rounded-xl text-center cursor-pointer transition flex flex-col items-center justify-center gap-2 ${
                  isDragOver
                    ? 'border-indigo-500 bg-indigo-50/50'
                    : 'border-zinc-300 hover:border-zinc-400 bg-white'
                }`}
              >
                <div className="w-9 h-9 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-500">
                  <Upload className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-semibold text-zinc-800 block">
                    Click to browse or drop an image
                  </span>
                  <span className="text-[10px] text-zinc-400 block mt-0.5">
                    Supports PNG, JPG, WebP, SVG (drag & drop supported)
                  </span>
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          )}

          {/* TAB 3: CUSTOM URL */}
          {activeTab === 'url' && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="url"
                  placeholder="https://images.unsplash.com/..."
                  value={customUrlInput}
                  onChange={(e) => setCustomUrlInput(e.target.value)}
                  className="flex-1 text-xs border border-zinc-200 rounded-lg p-2 focus:border-zinc-900 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleApplyCustomUrl}
                  disabled={!customUrlInput.trim()}
                  className="px-3 py-1.5 rounded-lg bg-zinc-900 text-white text-xs font-medium hover:bg-zinc-800 disabled:opacity-50 transition cursor-pointer"
                >
                  Apply
                </button>
              </div>
              <span className="text-[10px] text-zinc-400 block">
                Paste any direct image URL (Unsplash, Imgur, Cloudinary, AWS S3, etc.)
              </span>
            </div>
          )}

          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-xs text-zinc-500 hover:text-zinc-800 px-2 py-1"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
