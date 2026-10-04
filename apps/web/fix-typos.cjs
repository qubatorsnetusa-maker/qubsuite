const fs = require('fs');

// 1. doc-menus.tsx
let mp = 'C:/Users/Kelvin Odems/Downloads/QubSuite/Qubators/apps/web/src/features/docs/doc-menus.tsx';
let mc = fs.readFileSync(mp, 'utf8');
mc = mc.replaceAll('onWoiceTyping', 'onVoiceTyping');
fs.writeFileSync(mp, mc, 'utf8');

// 2. toolbar.tsx
let tp = 'C/:/Users/Kelvin Odems/Downloads/QubSuite/Qubators/apps/web/src/features/docs/toolbar.tsx';
let tc = fs.readFileSync(tp, 'utf8');
tc = tc.replaceAll('onWoiceTyping', 'onVoiceTyping');
fs.writeFileSync(tp, tc, 'utf8');

// 3. doc-page.tsx
let dp = 'C:/Users/Kelvin Odems/Downloads/QubSuite/Qubators/apps/web/src/features/docs/doc-page.tsx';
let dc = fs.readFileSync(dp, 'utf8');
dc = dc.replaceAll('onWoiceTyping', 'onVoiceTyping');
if (!dc.includes('voice-typing-widget')) {
  dc = dc.replace(
    'from \'./page-setup-dialog\';',
    'from \'./page-setup-dialog\';\nimport { VoiceTypingWidget } from \'./voice-typing-widget\';'
  );
}
fs.writeFileSync(dp, dc, 'utf8');

console.log('Fixed all');
