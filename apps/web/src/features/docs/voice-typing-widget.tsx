import { useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { Mic, MicOff, Volume2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export interface VoiceTypingWidgetProps {
  editor: Editor;
  isOpen: boolean;
  onClose(): void;
}

const VOICE_LANGUAGES = [
  { code: 'en-US', label: 'English (US)' },
  { code: 'en-GB', label: 'English (UK)' },
  { code: 'fr-FR', label: 'French (Français)' },
  { code: 'es-ES', label: 'Spanish (Español)' },
  { code: 'de-DE', label: 'German (Deutsch)' },
  { code: 'pt-BR', label: 'Portuguese (Português)' },
  { code: 'ar-SA', label: 'Arabic (العربية)' },
  { code: 'zh-CN', label: 'Chinese (中文)' },
  { code: 'ja-JP', label: 'Japanese (日本語)' },
  { code: 'sw-KE', label: 'Swahili (Kiswahili)' },
  { code: 'ha-NG', label: 'Hausa' },
  { code: 'yo-NG', label: 'Yoruba' },
  { code: 'ig-NG', label: 'Igbo' },
];

export function VoiceTypingWidget({ editor, isOpen, onClose }: VoiceTypingWidgetProps) {
  const [isListening, setIsListening] = useState(false);
  const [selectedLang, setSelectedLang] = useState('en-US');
  const [interimText, setInterimText] = useState('');
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (!isOpen) {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }
      setIsListening(false);
      setInterimText('');
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      toast.error('Voice typing is not supported in this browser. Please use Chrome or Edge.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = selectedLang;

    recognition.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          editor.commands.insertContent(transcript + ' ');
        } else {
          interim += transcript;
        }
      }
      setInterimText(interim);
    };

    recognition.onerror = (event: any) => {
      console.warn('Speech recognition error:', event.error);
      if (event.error === 'not-allowed') {
        toast.error('Microphone access denied. Please allow microphone permissions.');
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      setInterimText('');
    };

    recognitionRef.current = recognition;

    return () => {
      try {
        recognition.stop();
      } catch {}
    };
  }, [isOpen, editor]);

  const toggleListening = () => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
        toast.info('Voice typing started. Speak clearly into your mic.');
      } catch (err) {
        console.error(err);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed top-28 right-6 z-50 flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/95 px-4 py-3 shadow-2xl backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95">
      <button
        type="button"
        onClick={toggleListening}
        className={`my-0 relative flex h-11 w-11 items-center justify-center rounded-full transition-all duration-200 ${isListening ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30 ring-4 ring-rose-500/20 animate-pulse' : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200'}`}
        title={isListening ? 'Click to pause voice typing' : 'Click to start speaking'}
      >
        {isListening ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
      </button>

      <div className="min-w-[140px] max-w-[260px]">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-100">
            {isListening ? (
              <span className="text-rose-500 flex items-center gap-1">
                <Volume2 className="h-3.5 w-3.5 animate-bounce" /> Listening...
              </span>
            ) : (
              <span>Voice Typing</span>
            )}
          </div>
          <select
            value={selectedLang}
            onChange={(e) => {
              setSelectedLang(e.target.value);
              if (recognitionRef.current) {
                recognitionRef.current.lang = e.target.value;
              }
            }}
            className="rounded border border-slate-200 bg-transparent px-1.5 py-0.5 text-[10px] text-slate-600 outline-none hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
          >
            {VOICE_LANGUAGES.map((l) => (
              <option key={l.code} value={l.code} className="bg-white dark:bg-slate-900">
                {l.label}
              </option>
            ))}
          </select>
        </div>
        <p className="truncate text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
          {isListening ? interimText || 'Speak now...' : 'Click microphone to speak'}
        </p>
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
        onClick={onClose}
        title="Close Voice Typing"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
