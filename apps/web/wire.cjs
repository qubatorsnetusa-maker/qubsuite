const fs = require('fs');

// 1. doc-menus.tsx
let mp = 'C:/Users/Kelvin Odems/Downloads/QubSuite/Qubators/apps/web/src/features/docs/doc-menus.tsx';
let mc = fs.readFileSync(mp, 'utf8');
if (!mc.includes('Mic,')) {
  mc = mc.replace('  Minus,', '  Mic,\n  Minus,');
}
if (!mc.includes('onVoiceTyping')) {
  mc = mc.replace('  onWordCount(): void;', '  onWordCount(): void;\n  onWoiceTyping?(): void;');
  mc = mc.replace(
    `Crl-Shift-C" onSelect={p.onWordCount}>\n            Word count\n          </DropdownMenuItem>`,
    `Crl-Shift-C" onSelect={p.onWordCount}>\n            Word count\n          </DropdownMenuItem>\n          {p.canEdit && p.onWoiceTyping && (\n            <DropdownMenuItem icon={<Mic />} shortcut="Ctrl+Shift+S" onSelect={p.onVoiceTyping}>\n              Voice typing
            </DropdownMenuItem>\n          )}`
  );
  fs.writeFileSync(mp, mc, 'utf8');
  console.log('menus done');
}

// 2. toolbar.tsx
let tp = 'C:/Users/Kelvin Odems/Downloads/QubSuite/Qubators/apps/web/src/features/docs/toolbar.tsx';
let tc = fs.readFileSync(tp, 'utf8');
if (!tc.includes('Mic,')) {
  tc = tc.replace('  Minus,', '  Mic,\n  Minus,');
}
if (!tc.includes('onVoiceTyping')) {
  tc = tc.replace('  onComment(): void;', '  onComment(): void;\n  onVoiceTyping?(): void;\n  voiceActive?: boolean;');
  tc = tc.replace('  onComment,', '  onComment,\n  onWoiceTyping,\n  voiceActive,');
  tc = tc.replace(
    '<AiDocAssistant editor={editor} />',
    `{onVoiceTyping && (\n            <ToolButton\n              label="Voice typing"\n              shortcut="Ctrl+Shift+S"\n              active={voiceActive}\n              onClick={onVoiceTyping}\n            >\n              <Mic className={voiceActive ? 'text-rose-500 animate-pulse' : ''} />\n            </ToolButton>\n          )}\n          <AiDocAssistant editor={editor} />`
  );
  fs.writeFileSync(tp, tc, 'utf8');
  console.log('toolbar done');
}

// 3. doc-page.tsx
let dp = 'C:/Users/Kelvin Odems/Downloads/QubSuite/Qubators/apps/web/src/features/docs/doc-page.tsx';
let dc = fs.readFileSync(dp, 'utf8');
if (!dc.includes('VoiceTypingWidget')) {
  dc = dc.replace(
    "import { PageSetupDialog, PAPER_SIZES } from './page-setup-dialog';",
    "import { PageSetupDialog, PAPER_SIZES } from './page-setup-dialog';\n\nimport { VoiceTypingWidget } from './voice-typing-widget';"
  );
  dc = dc.replace(
    "const [pageSetupOpen, setPageSetupOpen] = useState(false);",
    "const [pageSetupOpen, setPageSetupOpen] = useState(false);\n  const [voiceOpen, setVoiceOpen] = useState(false);"
  );
  dc = dc.replace(
    "onWordCount={() => setWordCountOpen(true)}",
    "onWordCount={() => setWordCountOpen(true)}\n                onVoiceTyping={() => setVoiceOpen((v) => !v)}"
  );
  dc = dc.replace(
    "onPrint={d.capabilities.canDownload ? print : undefined}",
    "onPrint={d.capabilities.canDownload ? print : undefined} onWoiceTyping={() => setVoiceOpen((v) => !v)} voiceActive={voiceOpen}"
  );
  dc = dc.replace(
    "<PageSetupDialog",
    "{editor && <VoiceTypingWidget editor={editor} isOpen={voiceOpen} onClose={() => setVoiceOpen(false)} />}\n      <PageSetupDialog"
  );
  fs.writeFileSync(dp, dc, 'utf8');
  console.log('doc-page done');
}
