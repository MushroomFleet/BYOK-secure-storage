# 🔐 BYOK Secure Storage

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![React 18+](https://img.shields.io/badge/React-18%2B-61DAFB?logo=react)](https://reactjs.org/)
[![TypeScript Ready](https://img.shields.io/badge/TypeScript-Ready-3178C6?logo=typescript)](https://www.typescriptlang.org/)

A secure, zero-data API key storage system for "Bring Your Own Key" (BYOK) applications. Store LLM API keys (OpenAI, Anthropic, etc.) with AES-256 encryption directly in the browser—your keys never leave your device.

![BYOK Secure Storage Demo](https://raw.githubusercontent.com/MushroomFleet/BYOK-secure-storage/main/assets/demo-preview.png)

---

## ✨ Features

- **🔒 Zero-Data Architecture** — API keys are encrypted and stored locally; they never touch any server
- **🛡️ AES-256 Encryption** — Military-grade encryption using the Web Crypto API
- **🎨 Multi-Provider Support** — Built-in support for OpenAI, Anthropic, Cohere, and custom providers
- **🌓 Theme Support** — Automatic dark/light mode detection with manual override
- **♿ Accessible** — Full keyboard navigation, screen reader support, and WCAG compliance
- **🚀 Graceful Degradation** — Applications remain fully functional when keys are unavailable
- **📦 Zero Dependencies** — Pure React implementation with no external runtime dependencies
- **⚡ One-Time Setup** — Minimal friction with intelligent setup flow that remembers user preferences

---

## 🎯 Use Cases

BYOK Secure Storage is perfect for:

- **🎮 Indie Games** — Add AI companions, procedural dialogue, or intelligent NPCs without backend infrastructure
- **🛠️ Developer Tools** — Build AI-powered utilities that respect user privacy
- **📝 Writing Apps** — Integrate LLM assistance while keeping API keys secure
- **🤖 Chatbots** — Create conversational interfaces where users provide their own API access
- **🔬 Research Tools** — Enable AI features without managing API key infrastructure

---

## 📋 Table of Contents

- [Quick Start](#-quick-start)
- [Demo](#-demo)
- [Installation](#-installation)
- [Usage](#-usage)
- [API Reference](#-api-reference)
- [Security](#-security)
- [Platform Support](#-platform-support)
- [Original Specification](#-original-specification)
- [Contributing](#-contributing)
- [License](#-license)
- [Citation](#-citation)

---

## 🚀 Quick Start

```jsx
import { BYOKSecureStorage, useBYOK, AISettingsPanel } from './BYOKSecureStorage';

function App() {
  return (
    <BYOKSecureStorage 
      appName="MyApp" 
      providers={['openai', 'anthropic']}
      theme="auto"
    >
      <MyAIFeature />
      <AISettingsPanel />
    </BYOKSecureStorage>
  );
}

function MyAIFeature() {
  const { tryEnableFeature, hasKey } = useBYOK();
  
  const handleClick = async () => {
    const apiKey = await tryEnableFeature('openai');
    if (apiKey) {
      console.log('AI features enabled!');
      // Use the key with your AI provider
    }
  };
  
  return (
    <button onClick={handleClick}>
      {hasKey.openai ? '✓ AI Ready' : 'Enable AI'}
    </button>
  );
}
```

---

## 🎮 Demo

Try the interactive demo to see all features in action:

**[▶️ Open Demo](./demo.html)**

The demo showcases:
- Setup dialog with provider selection
- Key validation and error handling
- Settings panel for key management
- Theme switching (light/dark)
- Real-time event logging

To run locally:
```bash
# Clone the repository
git clone https://github.com/MushroomFleet/BYOK-secure-storage.git

# Open the demo in your browser
open demo.html
# or
start demo.html  # Windows
```

---

## 📦 Installation

### Option 1: Direct Copy (Recommended)

Copy `BYOKSecureStorage.jsx` to your project:

```
src/
  components/
    BYOKSecureStorage.jsx
```

Then import:

```jsx
import { 
  BYOKSecureStorage, 
  useBYOK, 
  APIKeySetupDialog,
  AISettingsPanel,
  SecureKeyStorage 
} from './components/BYOKSecureStorage';
```

### Option 2: Download Release

Download the latest release from the [Releases](https://github.com/MushroomFleet/BYOK-secure-storage/releases) page.

### Requirements

- React 18.0 or higher
- Modern browser with Web Crypto API support (all current browsers)

---

## 📖 Usage

### Basic Setup

Wrap your application with the `BYOKSecureStorage` provider:

```jsx
import { BYOKSecureStorage } from './BYOKSecureStorage';

function App() {
  return (
    <BYOKSecureStorage 
      appName="MyAwesomeApp"
      providers={['openai', 'anthropic']}
      theme="auto"
    >
      <YourAppContent />
    </BYOKSecureStorage>
  );
}
```

### Using the Hook

Access key management through the `useBYOK` hook:

```jsx
import { useBYOK } from './BYOKSecureStorage';

function AIButton() {
  const { 
    tryEnableFeature,  // Shows setup dialog if needed
    getKeySilent,      // Gets key without UI
    hasKey,            // { provider: boolean }
    isLoading,         // Initial load state
    deleteKey          // Remove stored key
  } = useBYOK();

  const handleAI = async () => {
    const key = await tryEnableFeature('openai');
    if (key) {
      // Initialize your AI service
    }
  };

  return (
    <button onClick={handleAI} disabled={isLoading}>
      {hasKey.openai ? 'AI Active' : 'Enable AI'}
    </button>
  );
}
```

### Settings Panel

Add user-facing key management:

```jsx
import { AISettingsPanel } from './BYOKSecureStorage';

function SettingsPage() {
  return (
    <div>
      <h2>AI Settings</h2>
      <AISettingsPanel />
    </div>
  );
}
```

For detailed integration instructions, see the **[Integration Guide](./byokss-integration.md)**.

---

## 📚 API Reference

### Components

| Component | Description |
|-----------|-------------|
| `<BYOKSecureStorage>` | Provider component that wraps your app |
| `<BYOKProvider>` | Lower-level provider (for custom setups) |
| `<APIKeySetupDialog>` | The setup dialog component |
| `<AISettingsPanel>` | Settings panel for key management |
| `<AIFeatureButton>` | Pre-built button for enabling features |

### Hooks

| Hook | Returns |
|------|---------|
| `useBYOK()` | `{ storage, hasKey, isLoading, tryEnableFeature, getKeySilent, deleteKey, ... }` |

### Props

#### `<BYOKSecureStorage>`

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `appName` | `string` | Required | Unique app identifier for encryption |
| `providers` | `string[]` | `['openai', 'anthropic']` | Supported API providers |
| `theme` | `'light' \| 'dark' \| 'auto'` | `'auto'` | UI theme |
| `onKeyChange` | `function` | `undefined` | Callback for key events |

### Classes

#### `SecureKeyStorage`

```javascript
const storage = new SecureKeyStorage('MyApp');

await storage.storeKey(key, provider);    // Store encrypted key
await storage.retrieveKey(provider);       // Get decrypted key
await storage.deleteKey(provider);         // Remove key
await storage.hasKey(provider);            // Check if exists
storage.validateKeyFormat(key);            // Validate format
storage.detectProvider(key);               // Auto-detect provider
storage.maskKey(key);                      // Get masked display
storage.clearAll();                        // Remove all data
```

---

## 🔒 Security

### How It Works

1. **Encryption**: Keys are encrypted using AES-GCM with a 256-bit key derived via PBKDF2 (100,000 iterations)
2. **Storage**: Encrypted data is stored in localStorage with a unique salt per encryption
3. **Key Derivation**: The encryption key is derived from a device fingerprint, making decryption device-specific
4. **No Transmission**: Keys never leave the browser—there's no server component

### Security Properties

| Property | Status |
|----------|--------|
| Encryption at rest | ✅ AES-256-GCM |
| Key derivation | ✅ PBKDF2 (100k iterations) |
| Per-encryption salt | ✅ Random 16-byte salt |
| Memory protection | ✅ Keys cleared after use |
| No plaintext storage | ✅ Always encrypted |
| No server transmission | ✅ Client-side only |

### Limitations

- Keys are as secure as the user's browser/device
- localStorage can be inspected (but data is encrypted)
- No protection against malicious browser extensions with full page access
- Device-specific encryption means keys don't sync across devices

---

## 🖥️ Platform Support

### Browsers

| Browser | Support |
|---------|---------|
| Chrome | ✅ 37+ |
| Firefox | ✅ 34+ |
| Safari | ✅ 11+ |
| Edge | ✅ 12+ |

### Frameworks

| Framework | Notes |
|-----------|-------|
| React | ✅ Native support |
| Next.js | ✅ Client components only |
| Vite | ✅ Full support |
| Create React App | ✅ Full support |
| Electron | ✅ Can use native keytar |
| Tauri | ✅ Can use secure-storage plugin |
| React Native | ⚠️ Requires keychain adapter |

---

## 📜 Original Specification

This component implements the **Zero-Data API Key Storage System** specification for BYOK (Bring Your Own Key) applications.

**[📄 View Full Specification](./BYOK_SECURE_STORAGE.md)**

The specification covers:
- Cross-platform credential storage architecture
- Security requirements and threat model
- User workflow definitions
- Accessibility requirements
- Platform-specific implementations (Python, React/JSX)
- Extended features and best practices

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### Development

```bash
# Clone the repo
git clone https://github.com/MushroomFleet/BYOK-secure-storage.git
cd BYOK-secure-storage

# Open demo for testing
open demo.html
```

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 📚 Citation

### Academic Citation

If you use this codebase in your research or project, please cite:

```bibtex
@software{byok_secure_storage,
  title = {BYOK Secure Storage: Zero-Data API Key Storage System for Bring Your Own Key Applications},
  author = {Drift Johnson},
  year = {2025},
  url = {https://github.com/MushroomFleet/BYOK-secure-storage},
  version = {1.0.0}
}
```

### Donate

If you find this project useful, consider supporting its development:

[![Ko-Fi](https://cdn.ko-fi.com/cdn/kofi3.png?v=3)](https://ko-fi.com/driftjohnson)

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/MushroomFleet">Drift Johnson</a>
</p>
