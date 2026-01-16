# BYOK Secure Storage Integration Guide

This guide provides comprehensive instructions for integrating the BYOK Secure Storage component into your React applications. Whether you're building a game, web app, or any application that needs "Bring Your Own Key" functionality for LLM APIs, this guide will help you get started.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Installation](#installation)
3. [Basic Integration](#basic-integration)
4. [Component Reference](#component-reference)
5. [Hooks Reference](#hooks-reference)
6. [Storage Class Reference](#storage-class-reference)
7. [Theming](#theming)
8. [Platform Considerations](#platform-considerations)
9. [Security Best Practices](#security-best-practices)
10. [Advanced Patterns](#advanced-patterns)
11. [Troubleshooting](#troubleshooting)

---

## Quick Start

Get up and running in under 5 minutes:

```jsx
import { BYOKSecureStorage, useBYOK, AISettingsPanel } from './BYOKSecureStorage';

function App() {
  return (
    <BYOKSecureStorage 
      appName="MyApp" 
      providers={['openai', 'anthropic']}
    >
      <YourApp />
    </BYOKSecureStorage>
  );
}

function YourApp() {
  const { tryEnableFeature, hasKey } = useBYOK();
  
  const handleAIClick = async () => {
    const apiKey = await tryEnableFeature('openai');
    if (apiKey) {
      // Use the API key
      initializeOpenAI(apiKey);
    }
  };
  
  return (
    <div>
      <button onClick={handleAIClick}>
        {hasKey.openai ? '✓ AI Ready' : 'Enable AI'}
      </button>
      <AISettingsPanel />
    </div>
  );
}
```

---

## Installation

### Option 1: Direct Import (Recommended)

Copy `BYOKSecureStorage.jsx` into your project's components directory:

```
src/
  components/
    BYOKSecureStorage.jsx
```

Then import where needed:

```jsx
import { 
  BYOKSecureStorage, 
  BYOKProvider,
  useBYOK, 
  APIKeySetupDialog,
  AISettingsPanel,
  AIFeatureButton,
  SecureKeyStorage 
} from './components/BYOKSecureStorage';
```

### Option 2: npm Package (Coming Soon)

```bash
npm install byok-secure-storage
# or
yarn add byok-secure-storage
```

### Dependencies

The component requires React 18+ and uses the Web Crypto API (available in all modern browsers):

```json
{
  "peerDependencies": {
    "react": ">=18.0.0",
    "react-dom": ">=18.0.0"
  }
}
```

---

## Basic Integration

### Step 1: Wrap Your App

Wrap your application (or the portion that needs API key access) with the `BYOKSecureStorage` provider:

```jsx
import { BYOKSecureStorage } from './BYOKSecureStorage';

function App() {
  return (
    <BYOKSecureStorage 
      appName="MyAwesomeApp"
      providers={['openai', 'anthropic']}
      theme="auto"
      onKeyChange={(event) => console.log('Key event:', event)}
    >
      <Router>
        <Routes>
          {/* Your routes */}
        </Routes>
      </Router>
    </BYOKSecureStorage>
  );
}
```

### Step 2: Use the Hook

Access key management functions via the `useBYOK` hook:

```jsx
import { useBYOK } from './BYOKSecureStorage';

function AIFeature() {
  const { 
    tryEnableFeature, 
    hasKey, 
    isLoading,
    getKeySilent 
  } = useBYOK();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  const handleEnableAI = async () => {
    // This will show the setup dialog if no key exists
    const key = await tryEnableFeature('openai');
    
    if (key) {
      // Key available - initialize your AI service
      const ai = new OpenAI({ apiKey: key });
      // ...
    }
  };

  return (
    <button onClick={handleEnableAI}>
      {hasKey.openai ? 'AI Companion (Active)' : 'Enable AI Companion'}
    </button>
  );
}
```

### Step 3: Add Settings Panel (Optional)

Allow users to manage their keys from a settings page:

```jsx
import { AISettingsPanel } from './BYOKSecureStorage';

function SettingsPage() {
  return (
    <div className="settings-container">
      <h1>Settings</h1>
      
      <section>
        <h2>AI Features</h2>
        <AISettingsPanel />
      </section>
    </div>
  );
}
```

---

## Component Reference

### `<BYOKSecureStorage>`

The main provider component that wraps your application.

```jsx
<BYOKSecureStorage
  appName="string"           // Required: Unique app identifier
  providers={['openai']}     // Optional: Array of provider names
  theme="auto"               // Optional: 'light' | 'dark' | 'auto'
  onKeyChange={(event) => {}}// Optional: Callback for key events
>
  {children}
</BYOKSecureStorage>
```

**Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `appName` | `string` | Required | Unique identifier for your application. Used as encryption salt. |
| `providers` | `string[]` | `['openai', 'anthropic']` | List of supported API providers |
| `theme` | `'light' \| 'dark' \| 'auto'` | `'auto'` | Theme for dialogs and panels |
| `onKeyChange` | `function` | `undefined` | Callback when keys are stored/deleted |

### `<APIKeySetupDialog>`

The setup dialog component. Automatically rendered by `BYOKSecureStorage`, but can be used standalone:

```jsx
import { BYOKProvider, APIKeySetupDialog } from './BYOKSecureStorage';

function App() {
  return (
    <BYOKProvider appName="MyApp" providers={['openai']}>
      <YourApp />
      <APIKeySetupDialog />
    </BYOKProvider>
  );
}
```

### `<AISettingsPanel>`

A complete settings panel for key management:

```jsx
<AISettingsPanel 
  onClose={() => {}}  // Optional: Close callback
/>
```

### `<AIFeatureButton>`

A pre-built button component for enabling AI features:

```jsx
<AIFeatureButton
  provider="openai"              // Optional: Specific provider
  onEnabled={(key) => {}}        // Called when key is available
  onDisabled={() => {}}          // Called when no key
  className="my-button-class"    // Optional: Custom classes
>
  Enable AI
</AIFeatureButton>
```

---

## Hooks Reference

### `useBYOK()`

The main hook for accessing BYOK functionality:

```jsx
const {
  // State
  hasKey,           // { openai: boolean, anthropic: boolean, ... }
  isLoading,        // boolean - Initial loading state
  showSetup,        // boolean - Setup dialog visibility
  showSettings,     // boolean - Settings panel visibility
  activeProvider,   // string - Currently selected provider
  providers,        // string[] - Available providers
  theme,            // 'light' | 'dark' - Resolved theme
  
  // Storage instance
  storage,          // SecureKeyStorage instance
  
  // Actions
  tryEnableFeature, // async (provider?) => key | null
  getKeySilent,     // async (provider?) => key | null
  handleKeySaved,   // () => void
  handleSetupSkipped, // () => void
  deleteKey,        // async (provider?) => boolean
  checkKeys,        // async () => void
  
  // UI Controls
  setShowSetup,     // (boolean) => void
  setShowSettings,  // (boolean) => void
  setActiveProvider // (string) => void
} = useBYOK();
```

**Key Methods:**

#### `tryEnableFeature(provider?)`

Attempts to get an API key. Shows setup dialog if needed.

```jsx
const key = await tryEnableFeature('openai');
if (key) {
  // Use the key
} else {
  // No key available (user skipped or dialog showing)
}
```

#### `getKeySilent(provider?)`

Gets a key without showing any UI. Returns `null` if no key configured.

```jsx
const key = await getKeySilent('openai');
// Silent check - no dialogs
```

#### `deleteKey(provider?)`

Removes a stored key:

```jsx
const success = await deleteKey('openai');
```

---

## Storage Class Reference

### `SecureKeyStorage`

The underlying storage class can be used directly for advanced use cases:

```jsx
import { SecureKeyStorage } from './BYOKSecureStorage';

const storage = new SecureKeyStorage('MyApp', {
  providers: ['openai', 'anthropic'],
  encryptionPassword: 'optional-custom-password',
  onKeyChange: (event) => console.log(event)
});

// Store a key
await storage.storeKey('sk-abc123...', 'openai');

// Retrieve a key
const key = await storage.retrieveKey('openai');

// Check if key exists
const exists = await storage.hasKey('openai');

// Delete a key
await storage.deleteKey('openai');

// Clear all data
storage.clearAll();

// Validate key format
const isValid = storage.validateKeyFormat('sk-abc123...');

// Detect provider from key
const provider = storage.detectProvider('sk-ant-abc...'); // 'anthropic'

// Mask key for display
const masked = storage.maskKey('sk-abc123456789xyz'); // 'sk-abc•••••••9xyz'
```

---

## Theming

### Automatic Theme Detection

Use `theme="auto"` to match system preferences:

```jsx
<BYOKSecureStorage appName="MyApp" theme="auto">
```

### Manual Theme Control

```jsx
const [theme, setTheme] = useState('dark');

<BYOKSecureStorage appName="MyApp" theme={theme}>
  <button onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}>
    Toggle Theme
  </button>
</BYOKSecureStorage>
```

### CSS Custom Properties

Override the default theme variables:

```css
.byok-root {
  --byok-accent: #8b5cf6;        /* Primary accent color */
  --byok-accent-hover: #7c3aed;  /* Accent hover state */
  --byok-bg-primary: #1a1a2e;    /* Main background */
  --byok-bg-secondary: #16213e;  /* Secondary background */
  --byok-text-primary: #ffffff;  /* Primary text */
  --byok-border: #334155;        /* Border color */
  --byok-radius-lg: 20px;        /* Border radius */
}
```

---

## Platform Considerations

### Web Browsers

The component uses the Web Crypto API for encryption and localStorage for persistence. Works in all modern browsers.

**Browser Support:**
- Chrome 37+
- Firefox 34+
- Safari 11+
- Edge 12+

### Electron Applications

For Electron apps, you can enhance security by using the native `keytar` library:

```jsx
// In your Electron main process
const keytar = require('keytar');

// Create a bridge for renderer process
ipcMain.handle('store-key', async (event, service, account, password) => {
  await keytar.setPassword(service, account, password);
});

ipcMain.handle('get-key', async (event, service, account) => {
  return await keytar.getPassword(service, account);
});
```

Then create a custom storage adapter:

```jsx
class ElectronKeyStorage extends SecureKeyStorage {
  async storeKey(key, provider = 'default') {
    return await window.electron.storeKey(this.appName, provider, key);
  }
  
  async retrieveKey(provider = 'default') {
    return await window.electron.getKey(this.appName, provider);
  }
}
```

### Tauri Applications

For Tauri apps, use `tauri-plugin-secure-storage`:

```rust
// In your Tauri config
[dependencies]
tauri-plugin-secure-storage = "1.0"
```

```jsx
import { invoke } from '@tauri-apps/api/tauri';

class TauriKeyStorage extends SecureKeyStorage {
  async storeKey(key, provider = 'default') {
    return await invoke('plugin:secure-storage|set', {
      key: `${this.appName}_${provider}`,
      value: key
    });
  }
}
```

### React Native

For React Native, use `react-native-keychain`:

```bash
npm install react-native-keychain
```

```jsx
import * as Keychain from 'react-native-keychain';

class RNKeyStorage {
  constructor(appName) {
    this.appName = appName;
  }
  
  async storeKey(key, provider = 'default') {
    await Keychain.setGenericPassword(
      `${this.appName}_${provider}`,
      key
    );
    return true;
  }
  
  async retrieveKey(provider = 'default') {
    const credentials = await Keychain.getGenericPassword({
      service: `${this.appName}_${provider}`
    });
    return credentials ? credentials.password : null;
  }
}
```

---

## Security Best Practices

### 1. Use Unique App Names

Always use a unique, descriptive app name to prevent collisions:

```jsx
// Good
<BYOKSecureStorage appName="MyCompany_GameName_v2">

// Bad
<BYOKSecureStorage appName="app">
```

### 2. Never Log API Keys

```jsx
// Bad
console.log('Got key:', apiKey);

// Good
console.log('Got key:', apiKey ? '[REDACTED]' : 'none');
```

### 3. Clear Keys on Logout

```jsx
function handleLogout() {
  const { storage } = useBYOK();
  storage.clearAll();
  // ... rest of logout logic
}
```

### 4. Use HTTPS

Always serve your application over HTTPS in production to protect keys in transit.

### 5. Implement Key Rotation

Remind users to rotate keys periodically:

```jsx
function KeyRotationReminder() {
  const { storage } = useBYOK();
  const metadata = storage.getMetadata('openai');
  
  if (metadata?.timestamp) {
    const daysSince = (Date.now() - new Date(metadata.timestamp)) / (1000 * 60 * 60 * 24);
    if (daysSince > 90) {
      return <Alert>Consider rotating your API key for security.</Alert>;
    }
  }
  return null;
}
```

---

## Advanced Patterns

### Custom Validation

Add provider-specific validation:

```jsx
const customValidation = {
  openai: (key) => key.startsWith('sk-') && key.length > 40,
  anthropic: (key) => key.startsWith('sk-ant-') && key.length > 50,
  custom: (key) => key.length >= 20
};

function validateKey(key, provider) {
  const validator = customValidation[provider] || customValidation.custom;
  return validator(key);
}
```

### Automatic Provider Detection

The component auto-detects providers, but you can extend it:

```jsx
function detectProvider(key) {
  if (key.startsWith('sk-ant-')) return 'anthropic';
  if (key.startsWith('sk-')) return 'openai';
  if (key.startsWith('co-')) return 'cohere';
  if (/^[a-f0-9]{32}$/.test(key)) return 'huggingface';
  return 'custom';
}
```

### Lazy Loading

Load the component only when needed:

```jsx
const BYOKSecureStorage = React.lazy(() => 
  import('./BYOKSecureStorage').then(m => ({ default: m.BYOKSecureStorage }))
);

function App() {
  return (
    <Suspense fallback={<Loading />}>
      <BYOKSecureStorage appName="MyApp">
        <YourApp />
      </BYOKSecureStorage>
    </Suspense>
  );
}
```

### Integration with State Management

#### Redux

```jsx
// actions.js
export const setApiKeyStatus = (provider, hasKey) => ({
  type: 'SET_API_KEY_STATUS',
  payload: { provider, hasKey }
});

// In your component
<BYOKSecureStorage
  appName="MyApp"
  onKeyChange={(event) => {
    dispatch(setApiKeyStatus(event.provider, event.action === 'stored'));
  }}
>
```

#### Zustand

```jsx
const useAIStore = create((set) => ({
  hasApiKey: {},
  setKeyStatus: (provider, status) => 
    set((state) => ({ 
      hasApiKey: { ...state.hasApiKey, [provider]: status } 
    }))
}));

// Usage
<BYOKSecureStorage
  onKeyChange={(e) => useAIStore.getState().setKeyStatus(e.provider, e.action === 'stored')}
>
```

---

## Troubleshooting

### Common Issues

#### "useBYOK must be used within a BYOKProvider"

Ensure your component is wrapped in `BYOKSecureStorage` or `BYOKProvider`:

```jsx
// Wrong
function App() {
  const { hasKey } = useBYOK(); // Error!
  return <div>...</div>;
}

// Correct
function App() {
  return (
    <BYOKSecureStorage appName="MyApp">
      <MyComponent />
    </BYOKSecureStorage>
  );
}

function MyComponent() {
  const { hasKey } = useBYOK(); // Works!
  return <div>...</div>;
}
```

#### Keys Not Persisting

Check if localStorage is available and not blocked:

```jsx
try {
  localStorage.setItem('test', 'test');
  localStorage.removeItem('test');
  console.log('localStorage available');
} catch (e) {
  console.error('localStorage blocked or unavailable');
}
```

#### Decryption Failing

This usually happens if the encryption key changes. The default uses a device fingerprint. If you need cross-device support, use a user-specific password:

```jsx
const storage = new SecureKeyStorage('MyApp', {
  encryptionPassword: `${userId}-${userSecret}`
});
```

### Debug Mode

Enable verbose logging:

```jsx
const storage = new SecureKeyStorage('MyApp', {
  onKeyChange: (event) => {
    console.log('[BYOK Debug]', event);
  }
});
```

---

## Migration Guide

### From Local Storage (Unencrypted)

```jsx
// Migration helper
async function migrateFromLocalStorage() {
  const oldKey = localStorage.getItem('api_key');
  if (oldKey) {
    const storage = new SecureKeyStorage('MyApp');
    await storage.storeKey(oldKey, 'openai');
    localStorage.removeItem('api_key'); // Clean up old storage
    console.log('Migrated API key to secure storage');
  }
}

// Run once on app start
useEffect(() => {
  migrateFromLocalStorage();
}, []);
```

---

## Support

- **GitHub Issues**: [Report bugs or request features](https://github.com/MushroomFleet/BYOK-secure-storage/issues)
- **Documentation**: This guide and inline code comments
- **Demo**: Open `demo.html` in your browser

---

*Last updated: January 2025*
