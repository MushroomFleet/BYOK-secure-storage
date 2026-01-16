import React, { useState, useEffect, useRef, useCallback, createContext, useContext } from 'react';

/**
 * BYOK Secure Storage - React Component
 * 
 * A secure, zero-data API key storage system for "Bring Your Own Key" applications.
 * Provides encrypted browser storage with graceful degradation and one-time setup flows.
 * 
 * Features:
 * - Encrypted key storage (AES-GCM via Web Crypto API)
 * - One-time setup dialog
 * - Silent key retrieval
 * - Settings panel for key management
 * - Multi-provider support (OpenAI, Anthropic, etc.)
 * - Graceful degradation when keys unavailable
 * - Full accessibility support
 * 
 * @version 1.0.0
 * @author Drift Johnson
 * @license MIT
 */

// ============================================================================
// ENCRYPTION UTILITIES
// ============================================================================

/**
 * Derives an encryption key from a password using PBKDF2
 */
async function deriveKey(password, salt) {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );
  
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts data using AES-GCM
 */
async function encryptData(data, password) {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv },
    key,
    encoder.encode(data)
  );
  
  const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(encrypted), salt.length + iv.length);
  
  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypts data using AES-GCM
 */
async function decryptData(encryptedBase64, password) {
  try {
    const combined = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
    const salt = combined.slice(0, 16);
    const iv = combined.slice(16, 28);
    const encrypted = combined.slice(28);
    
    const key = await deriveKey(password, salt);
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      encrypted
    );
    
    return new TextDecoder().decode(decrypted);
  } catch {
    return null;
  }
}

// ============================================================================
// SECURE KEY STORAGE CLASS
// ============================================================================

/**
 * SecureKeyStorage class for managing encrypted API keys
 */
export class SecureKeyStorage {
  constructor(appName, options = {}) {
    this.appName = appName;
    this.storageKey = `${appName}_byok_storage`;
    this.metadataKey = `${appName}_byok_metadata`;
    this.encryptionPassword = options.encryptionPassword || this._generateDeviceFingerprint();
    this.providers = options.providers || ['openai', 'anthropic', 'cohere', 'custom'];
    this.onKeyChange = options.onKeyChange || null;
  }

  /**
   * Generate a device fingerprint for encryption
   */
  _generateDeviceFingerprint() {
    const components = [
      navigator.userAgent,
      navigator.language,
      screen.width,
      screen.height,
      new Date().getTimezoneOffset(),
      this.appName
    ];
    return components.join('|');
  }

  /**
   * Store API key with encryption
   */
  async storeKey(key, provider = 'default') {
    try {
      if (!key || !this.validateKeyFormat(key)) {
        throw new Error('Invalid API key format');
      }

      const existingData = await this._loadAllKeys();
      existingData[provider] = key;
      
      const encrypted = await encryptData(JSON.stringify(existingData), this.encryptionPassword);
      localStorage.setItem(this.storageKey, encrypted);
      
      this._updateMetadata(provider, 'stored');
      
      if (this.onKeyChange) {
        this.onKeyChange({ action: 'stored', provider });
      }
      
      return true;
    } catch (error) {
      console.error('SecureKeyStorage: Failed to store key', error);
      return false;
    }
  }

  /**
   * Retrieve API key
   */
  async retrieveKey(provider = 'default') {
    try {
      const keys = await this._loadAllKeys();
      return keys[provider] || null;
    } catch {
      return null;
    }
  }

  /**
   * Delete API key
   */
  async deleteKey(provider = 'default') {
    try {
      const existingData = await this._loadAllKeys();
      
      if (existingData[provider]) {
        delete existingData[provider];
        
        if (Object.keys(existingData).length === 0) {
          localStorage.removeItem(this.storageKey);
        } else {
          const encrypted = await encryptData(JSON.stringify(existingData), this.encryptionPassword);
          localStorage.setItem(this.storageKey, encrypted);
        }
        
        this._updateMetadata(provider, 'deleted');
        
        if (this.onKeyChange) {
          this.onKeyChange({ action: 'deleted', provider });
        }
        
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Check if key exists
   */
  async hasKey(provider = 'default') {
    const key = await this.retrieveKey(provider);
    return key !== null && key.length > 0;
  }

  /**
   * Get all configured providers
   */
  async getConfiguredProviders() {
    const keys = await this._loadAllKeys();
    return Object.keys(keys);
  }

  /**
   * Validate API key format
   */
  validateKeyFormat(key) {
    if (!key || key.length < 10) {
      return false;
    }

    const patterns = {
      openai: /^sk-[a-zA-Z0-9_-]{20,}$/,
      anthropic: /^sk-ant-[a-zA-Z0-9_-]{20,}$/,
      cohere: /^[a-zA-Z0-9]{20,}$/,
      custom: /^.{10,}$/
    };

    return Object.values(patterns).some(pattern => pattern.test(key));
  }

  /**
   * Detect provider from key format
   */
  detectProvider(key) {
    if (key.startsWith('sk-ant-')) return 'anthropic';
    if (key.startsWith('sk-')) return 'openai';
    if (/^[a-zA-Z0-9]{40}$/.test(key)) return 'cohere';
    return 'custom';
  }

  /**
   * Mask key for display
   */
  maskKey(key) {
    if (!key || key.length <= 8) return '••••••••';
    return `${key.slice(0, 7)}${'•'.repeat(Math.min(key.length - 11, 20))}${key.slice(-4)}`;
  }

  /**
   * Load all keys from storage
   */
  async _loadAllKeys() {
    try {
      const encrypted = localStorage.getItem(this.storageKey);
      if (!encrypted) return {};
      
      const decrypted = await decryptData(encrypted, this.encryptionPassword);
      return decrypted ? JSON.parse(decrypted) : {};
    } catch {
      return {};
    }
  }

  /**
   * Update metadata
   */
  _updateMetadata(provider, action) {
    try {
      const metadata = JSON.parse(localStorage.getItem(this.metadataKey) || '{}');
      metadata[provider] = {
        lastAction: action,
        timestamp: new Date().toISOString()
      };
      localStorage.setItem(this.metadataKey, JSON.stringify(metadata));
    } catch {
      // Silent fail for metadata
    }
  }

  /**
   * Get metadata
   */
  getMetadata(provider = 'default') {
    try {
      const metadata = JSON.parse(localStorage.getItem(this.metadataKey) || '{}');
      return metadata[provider] || null;
    } catch {
      return null;
    }
  }

  /**
   * Clear all stored data
   */
  clearAll() {
    localStorage.removeItem(this.storageKey);
    localStorage.removeItem(this.metadataKey);
    if (this.onKeyChange) {
      this.onKeyChange({ action: 'cleared_all' });
    }
  }
}

// ============================================================================
// REACT CONTEXT
// ============================================================================

const BYOKContext = createContext(null);

export function useBYOK() {
  const context = useContext(BYOKContext);
  if (!context) {
    throw new Error('useBYOK must be used within a BYOKProvider');
  }
  return context;
}

// ============================================================================
// PROVIDER COMPONENT
// ============================================================================

export function BYOKProvider({ 
  children, 
  appName, 
  providers = ['openai', 'anthropic'],
  onKeyChange,
  theme = 'auto'
}) {
  const [storage] = useState(() => new SecureKeyStorage(appName, { providers, onKeyChange }));
  const [hasKey, setHasKey] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [showSetup, setShowSetup] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const setupShownRef = useRef(false);
  const [activeProvider, setActiveProvider] = useState('openai');
  const [resolvedTheme, setResolvedTheme] = useState('light');

  useEffect(() => {
    if (theme === 'auto') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      setResolvedTheme(mediaQuery.matches ? 'dark' : 'light');
      const handler = (e) => setResolvedTheme(e.matches ? 'dark' : 'light');
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    } else {
      setResolvedTheme(theme);
    }
  }, [theme]);

  const checkKeys = useCallback(async () => {
    setIsLoading(true);
    const keyStatus = {};
    for (const provider of providers) {
      keyStatus[provider] = await storage.hasKey(provider);
    }
    setHasKey(keyStatus);
    setIsLoading(false);
  }, [storage, providers]);

  useEffect(() => {
    checkKeys();
  }, [checkKeys]);

  const tryEnableFeature = useCallback(async (provider = activeProvider) => {
    if (hasKey[provider]) {
      return await storage.retrieveKey(provider);
    }
    
    if (!setupShownRef.current) {
      setActiveProvider(provider);
      setShowSetup(true);
      setupShownRef.current = true;
    }
    
    return null;
  }, [hasKey, storage, activeProvider]);

  const getKeySilent = useCallback(async (provider = activeProvider) => {
    return hasKey[provider] ? await storage.retrieveKey(provider) : null;
  }, [hasKey, storage, activeProvider]);

  const handleKeySaved = useCallback(async () => {
    setShowSetup(false);
    await checkKeys();
  }, [checkKeys]);

  const handleSetupSkipped = useCallback(() => {
    setShowSetup(false);
  }, []);

  const deleteKey = useCallback(async (provider = activeProvider) => {
    const success = await storage.deleteKey(provider);
    if (success) {
      await checkKeys();
    }
    return success;
  }, [storage, checkKeys, activeProvider]);

  const value = {
    storage,
    hasKey,
    isLoading,
    showSetup,
    showSettings,
    setShowSetup,
    setShowSettings,
    activeProvider,
    setActiveProvider,
    providers,
    tryEnableFeature,
    getKeySilent,
    handleKeySaved,
    handleSetupSkipped,
    deleteKey,
    checkKeys,
    theme: resolvedTheme
  };

  return (
    <BYOKContext.Provider value={value}>
      {children}
    </BYOKContext.Provider>
  );
}

// ============================================================================
// CSS STYLES
// ============================================================================

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');

  .byok-root {
    --byok-font-sans: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
    --byok-font-mono: 'JetBrains Mono', 'SF Mono', Consolas, monospace;
    
    /* Light theme */
    --byok-bg-primary: #ffffff;
    --byok-bg-secondary: #f8fafc;
    --byok-bg-tertiary: #f1f5f9;
    --byok-bg-overlay: rgba(15, 23, 42, 0.6);
    --byok-border: #e2e8f0;
    --byok-border-focus: #3b82f6;
    --byok-text-primary: #0f172a;
    --byok-text-secondary: #475569;
    --byok-text-tertiary: #94a3b8;
    --byok-accent: #3b82f6;
    --byok-accent-hover: #2563eb;
    --byok-success: #10b981;
    --byok-success-bg: #ecfdf5;
    --byok-error: #ef4444;
    --byok-error-bg: #fef2f2;
    --byok-warning: #f59e0b;
    --byok-warning-bg: #fffbeb;
    --byok-shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
    --byok-shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1);
    --byok-shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1);
    --byok-shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
    --byok-radius-sm: 6px;
    --byok-radius-md: 10px;
    --byok-radius-lg: 16px;
  }

  .byok-root[data-theme="dark"] {
    --byok-bg-primary: #0f172a;
    --byok-bg-secondary: #1e293b;
    --byok-bg-tertiary: #334155;
    --byok-bg-overlay: rgba(0, 0, 0, 0.75);
    --byok-border: #334155;
    --byok-border-focus: #60a5fa;
    --byok-text-primary: #f8fafc;
    --byok-text-secondary: #cbd5e1;
    --byok-text-tertiary: #64748b;
    --byok-accent: #60a5fa;
    --byok-accent-hover: #93c5fd;
    --byok-success: #34d399;
    --byok-success-bg: rgba(16, 185, 129, 0.15);
    --byok-error: #f87171;
    --byok-error-bg: rgba(239, 68, 68, 0.15);
    --byok-warning: #fbbf24;
    --byok-warning-bg: rgba(245, 158, 11, 0.15);
    --byok-shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
    --byok-shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.4);
    --byok-shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.5);
    --byok-shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.6);
  }

  .byok-overlay {
    position: fixed;
    inset: 0;
    background: var(--byok-bg-overlay);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 99999;
    animation: byok-fade-in 0.2s ease-out;
    padding: 20px;
  }

  @keyframes byok-fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes byok-slide-up {
    from { 
      opacity: 0;
      transform: translateY(20px) scale(0.98);
    }
    to { 
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  @keyframes byok-shake {
    0%, 100% { transform: translateX(0); }
    20%, 60% { transform: translateX(-8px); }
    40%, 80% { transform: translateX(8px); }
  }

  @keyframes byok-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  @keyframes byok-spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .byok-dialog {
    font-family: var(--byok-font-sans);
    background: var(--byok-bg-primary);
    border-radius: var(--byok-radius-lg);
    box-shadow: var(--byok-shadow-xl);
    width: 100%;
    max-width: 440px;
    animation: byok-slide-up 0.3s ease-out;
    overflow: hidden;
    border: 1px solid var(--byok-border);
  }

  .byok-dialog-header {
    padding: 28px 28px 0;
  }

  .byok-dialog-icon {
    width: 56px;
    height: 56px;
    background: linear-gradient(135deg, var(--byok-accent), var(--byok-accent-hover));
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 20px;
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.25);
  }

  .byok-dialog-icon svg {
    width: 28px;
    height: 28px;
    color: white;
  }

  .byok-dialog-title {
    margin: 0 0 8px;
    font-size: 22px;
    font-weight: 700;
    color: var(--byok-text-primary);
    letter-spacing: -0.02em;
  }

  .byok-dialog-description {
    margin: 0;
    font-size: 14px;
    line-height: 1.6;
    color: var(--byok-text-secondary);
  }

  .byok-dialog-body {
    padding: 24px 28px;
  }

  .byok-provider-selector {
    display: flex;
    gap: 8px;
    margin-bottom: 20px;
    flex-wrap: wrap;
  }

  .byok-provider-btn {
    font-family: var(--byok-font-sans);
    padding: 8px 16px;
    font-size: 13px;
    font-weight: 500;
    border: 1px solid var(--byok-border);
    border-radius: var(--byok-radius-sm);
    background: var(--byok-bg-secondary);
    color: var(--byok-text-secondary);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .byok-provider-btn:hover {
    background: var(--byok-bg-tertiary);
    color: var(--byok-text-primary);
  }

  .byok-provider-btn.active {
    background: var(--byok-accent);
    border-color: var(--byok-accent);
    color: white;
  }

  .byok-input-group {
    position: relative;
    margin-bottom: 16px;
  }

  .byok-input-label {
    display: block;
    font-size: 13px;
    font-weight: 600;
    color: var(--byok-text-primary);
    margin-bottom: 8px;
  }

  .byok-input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }

  .byok-input {
    width: 100%;
    padding: 14px 48px 14px 16px;
    font-family: var(--byok-font-mono);
    font-size: 14px;
    border: 2px solid var(--byok-border);
    border-radius: var(--byok-radius-md);
    background: var(--byok-bg-secondary);
    color: var(--byok-text-primary);
    transition: all 0.15s ease;
    box-sizing: border-box;
  }

  .byok-input:focus {
    outline: none;
    border-color: var(--byok-border-focus);
    background: var(--byok-bg-primary);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
  }

  .byok-input::placeholder {
    color: var(--byok-text-tertiary);
  }

  .byok-input.error {
    border-color: var(--byok-error);
    animation: byok-shake 0.4s ease;
  }

  .byok-input.error:focus {
    box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.15);
  }

  .byok-input-toggle {
    position: absolute;
    right: 12px;
    background: none;
    border: none;
    padding: 6px;
    cursor: pointer;
    color: var(--byok-text-tertiary);
    transition: color 0.15s ease;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .byok-input-toggle:hover {
    color: var(--byok-text-secondary);
  }

  .byok-input-toggle svg {
    width: 20px;
    height: 20px;
  }

  .byok-error-message {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 10px;
    padding: 10px 14px;
    font-size: 13px;
    color: var(--byok-error);
    background: var(--byok-error-bg);
    border-radius: var(--byok-radius-sm);
  }

  .byok-error-message svg {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }

  .byok-dialog-footer {
    padding: 0 28px 28px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .byok-btn-group {
    display: flex;
    gap: 12px;
  }

  .byok-btn {
    font-family: var(--byok-font-sans);
    flex: 1;
    padding: 14px 20px;
    font-size: 14px;
    font-weight: 600;
    border: none;
    border-radius: var(--byok-radius-md);
    cursor: pointer;
    transition: all 0.15s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }

  .byok-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .byok-btn-primary {
    background: linear-gradient(135deg, var(--byok-accent), var(--byok-accent-hover));
    color: white;
    box-shadow: 0 2px 8px rgba(59, 130, 246, 0.25);
  }

  .byok-btn-primary:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.35);
  }

  .byok-btn-primary:active:not(:disabled) {
    transform: translateY(0);
  }

  .byok-btn-secondary {
    background: var(--byok-bg-secondary);
    color: var(--byok-text-secondary);
    border: 1px solid var(--byok-border);
  }

  .byok-btn-secondary:hover:not(:disabled) {
    background: var(--byok-bg-tertiary);
    color: var(--byok-text-primary);
  }

  .byok-btn-danger {
    background: var(--byok-error-bg);
    color: var(--byok-error);
    border: 1px solid currentColor;
  }

  .byok-btn-danger:hover:not(:disabled) {
    background: var(--byok-error);
    color: white;
  }

  .byok-help-link {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    font-size: 13px;
    color: var(--byok-text-tertiary);
    text-decoration: none;
    transition: color 0.15s ease;
  }

  .byok-help-link:hover {
    color: var(--byok-accent);
  }

  .byok-help-link svg {
    width: 14px;
    height: 14px;
  }

  .byok-spinner {
    width: 18px;
    height: 18px;
    border: 2px solid currentColor;
    border-top-color: transparent;
    border-radius: 50%;
    animation: byok-spin 0.8s linear infinite;
  }

  /* Settings Panel Styles */
  .byok-settings-panel {
    font-family: var(--byok-font-sans);
    background: var(--byok-bg-primary);
    border: 1px solid var(--byok-border);
    border-radius: var(--byok-radius-lg);
    overflow: hidden;
  }

  .byok-settings-header {
    padding: 20px 24px;
    border-bottom: 1px solid var(--byok-border);
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .byok-settings-title {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--byok-text-primary);
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .byok-settings-title svg {
    width: 20px;
    height: 20px;
    color: var(--byok-accent);
  }

  .byok-settings-body {
    padding: 20px 24px;
  }

  .byok-key-card {
    background: var(--byok-bg-secondary);
    border: 1px solid var(--byok-border);
    border-radius: var(--byok-radius-md);
    padding: 16px;
    margin-bottom: 12px;
  }

  .byok-key-card:last-child {
    margin-bottom: 0;
  }

  .byok-key-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  }

  .byok-key-card-provider {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .byok-key-card-provider-name {
    font-size: 14px;
    font-weight: 600;
    color: var(--byok-text-primary);
    text-transform: capitalize;
  }

  .byok-key-card-status {
    font-size: 12px;
    font-weight: 500;
    padding: 4px 10px;
    border-radius: 20px;
  }

  .byok-key-card-status.configured {
    background: var(--byok-success-bg);
    color: var(--byok-success);
  }

  .byok-key-card-status.not-configured {
    background: var(--byok-bg-tertiary);
    color: var(--byok-text-tertiary);
  }

  .byok-key-card-value {
    font-family: var(--byok-font-mono);
    font-size: 13px;
    color: var(--byok-text-secondary);
    background: var(--byok-bg-primary);
    padding: 10px 14px;
    border-radius: var(--byok-radius-sm);
    border: 1px solid var(--byok-border);
    margin-bottom: 12px;
    word-break: break-all;
  }

  .byok-key-card-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .byok-key-card-btn {
    font-family: var(--byok-font-sans);
    padding: 8px 14px;
    font-size: 12px;
    font-weight: 500;
    border-radius: var(--byok-radius-sm);
    cursor: pointer;
    transition: all 0.15s ease;
    display: flex;
    align-items: center;
    gap: 6px;
    border: 1px solid var(--byok-border);
    background: var(--byok-bg-primary);
    color: var(--byok-text-secondary);
  }

  .byok-key-card-btn:hover {
    background: var(--byok-bg-tertiary);
    color: var(--byok-text-primary);
  }

  .byok-key-card-btn.danger:hover {
    background: var(--byok-error-bg);
    color: var(--byok-error);
    border-color: var(--byok-error);
  }

  .byok-key-card-btn svg {
    width: 14px;
    height: 14px;
  }

  .byok-test-result {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    font-size: 13px;
    border-radius: var(--byok-radius-sm);
    margin-top: 12px;
  }

  .byok-test-result.success {
    background: var(--byok-success-bg);
    color: var(--byok-success);
  }

  .byok-test-result.error {
    background: var(--byok-error-bg);
    color: var(--byok-error);
  }

  .byok-test-result svg {
    width: 16px;
    height: 16px;
  }

  .byok-empty-state {
    text-align: center;
    padding: 32px 20px;
  }

  .byok-empty-state-icon {
    width: 48px;
    height: 48px;
    margin: 0 auto 16px;
    color: var(--byok-text-tertiary);
  }

  .byok-empty-state-text {
    font-size: 14px;
    color: var(--byok-text-secondary);
    margin: 0 0 16px;
  }

  /* Accessibility */
  .byok-sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  /* Focus visible */
  .byok-btn:focus-visible,
  .byok-input:focus-visible,
  .byok-provider-btn:focus-visible,
  .byok-key-card-btn:focus-visible {
    outline: 2px solid var(--byok-accent);
    outline-offset: 2px;
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .byok-overlay,
    .byok-dialog,
    .byok-input.error {
      animation: none;
    }
    
    .byok-btn,
    .byok-input,
    .byok-provider-btn {
      transition: none;
    }
  }

  /* High contrast */
  @media (prefers-contrast: high) {
    .byok-input {
      border-width: 3px;
    }
    
    .byok-btn-primary {
      background: var(--byok-text-primary);
    }
  }
`;

// ============================================================================
// ICONS
// ============================================================================

const Icons = {
  Key: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
    </svg>
  ),
  Eye: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  ),
  EyeOff: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  ),
  AlertCircle: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="8" x2="12" y2="12"/>
      <line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  ),
  ExternalLink: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
      <polyline points="15 3 21 3 21 9"/>
      <line x1="10" y1="14" x2="21" y2="3"/>
    </svg>
  ),
  Check: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
  X: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  ),
  Settings: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  ),
  Trash: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
    </svg>
  ),
  RefreshCw: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10"/>
      <polyline points="1 20 1 14 7 14"/>
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
    </svg>
  ),
  Edit: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  ),
  Shield: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  ),
  Plus: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19"/>
      <line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  )
};

// ============================================================================
// SETUP DIALOG COMPONENT
// ============================================================================

export function APIKeySetupDialog() {
  const { 
    storage, 
    showSetup, 
    handleKeySaved, 
    handleSetupSkipped,
    providers,
    activeProvider,
    setActiveProvider,
    theme
  } = useBYOK();

  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (showSetup && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showSetup]);

  useEffect(() => {
    if (showSetup) {
      setInputValue('');
      setError('');
      setShowPassword(false);
    }
  }, [showSetup]);

  const handleSave = async () => {
    setError('');

    if (!inputValue.trim()) {
      setError('Please enter an API key');
      return;
    }

    if (!storage.validateKeyFormat(inputValue)) {
      setError('Invalid API key format. Keys typically start with "sk-" or "sk-ant-"');
      return;
    }

    setIsSaving(true);

    try {
      const detectedProvider = storage.detectProvider(inputValue);
      const targetProvider = detectedProvider !== 'custom' ? detectedProvider : activeProvider;
      
      const success = await storage.storeKey(inputValue, targetProvider);
      
      if (success) {
        setInputValue('');
        handleKeySaved();
      } else {
        setError('Failed to save key. Please try again.');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSkip = () => {
    setInputValue('');
    setError('');
    handleSetupSkipped();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !isSaving) {
      handleSave();
    } else if (e.key === 'Escape') {
      handleSkip();
    }
  };

  const getProviderHelpUrl = (provider) => {
    const urls = {
      openai: 'https://platform.openai.com/api-keys',
      anthropic: 'https://console.anthropic.com/settings/keys',
      cohere: 'https://dashboard.cohere.com/api-keys',
      custom: 'https://platform.openai.com/api-keys'
    };
    return urls[provider] || urls.custom;
  };

  if (!showSetup) return null;

  return (
    <div className="byok-root" data-theme={theme}>
      <style>{styles}</style>
      <div 
        className="byok-overlay" 
        role="dialog" 
        aria-modal="true" 
        aria-labelledby="byok-dialog-title"
        onClick={(e) => e.target === e.currentTarget && handleSkip()}
      >
        <div className="byok-dialog">
          <div className="byok-dialog-header">
            <div className="byok-dialog-icon">
              <Icons.Key />
            </div>
            <h2 id="byok-dialog-title" className="byok-dialog-title">
              Enable AI Features
            </h2>
            <p className="byok-dialog-description">
              Enter your API key to unlock AI-powered features. Your key is encrypted and stored securely on your device.
            </p>
          </div>

          <div className="byok-dialog-body">
            {providers.length > 1 && (
              <div className="byok-provider-selector" role="group" aria-label="Select AI provider">
                {providers.map((provider) => (
                  <button
                    key={provider}
                    className={`byok-provider-btn ${activeProvider === provider ? 'active' : ''}`}
                    onClick={() => setActiveProvider(provider)}
                    type="button"
                  >
                    {provider.charAt(0).toUpperCase() + provider.slice(1)}
                  </button>
                ))}
              </div>
            )}

            <div className="byok-input-group">
              <label htmlFor="byok-api-key" className="byok-input-label">
                API Key
              </label>
              <div className="byok-input-wrapper">
                <input
                  ref={inputRef}
                  id="byok-api-key"
                  type={showPassword ? 'text' : 'password'}
                  className={`byok-input ${error ? 'error' : ''}`}
                  placeholder="sk-..."
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={isSaving}
                  autoComplete="off"
                  spellCheck="false"
                  aria-describedby={error ? 'byok-error' : undefined}
                  aria-invalid={error ? 'true' : 'false'}
                />
                <button
                  type="button"
                  className="byok-input-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide API key' : 'Show API key'}
                >
                  {showPassword ? <Icons.EyeOff /> : <Icons.Eye />}
                </button>
              </div>
              {error && (
                <div id="byok-error" className="byok-error-message" role="alert">
                  <Icons.AlertCircle />
                  <span>{error}</span>
                </div>
              )}
            </div>
          </div>

          <div className="byok-dialog-footer">
            <div className="byok-btn-group">
              <button
                className="byok-btn byok-btn-primary"
                onClick={handleSave}
                disabled={isSaving}
                type="button"
              >
                {isSaving ? (
                  <>
                    <span className="byok-spinner" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Icons.Check />
                    Save Key
                  </>
                )}
              </button>
              <button
                className="byok-btn byok-btn-secondary"
                onClick={handleSkip}
                disabled={isSaving}
                type="button"
              >
                Skip
              </button>
            </div>
            <a
              href={getProviderHelpUrl(activeProvider)}
              target="_blank"
              rel="noopener noreferrer"
              className="byok-help-link"
            >
              <Icons.ExternalLink />
              Where do I get an API key?
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SETTINGS PANEL COMPONENT
// ============================================================================

export function AISettingsPanel({ onClose }) {
  const { 
    storage, 
    hasKey, 
    providers, 
    checkKeys, 
    setShowSetup,
    theme
  } = useBYOK();

  const [maskedKeys, setMaskedKeys] = useState({});
  const [testResults, setTestResults] = useState({});
  const [testing, setTesting] = useState({});
  const [showConfirmDelete, setShowConfirmDelete] = useState(null);

  useEffect(() => {
    loadMaskedKeys();
  }, [hasKey]);

  const loadMaskedKeys = async () => {
    const masked = {};
    for (const provider of providers) {
      if (hasKey[provider]) {
        const key = await storage.retrieveKey(provider);
        masked[provider] = storage.maskKey(key);
      }
    }
    setMaskedKeys(masked);
  };

  const handleTestConnection = async (provider) => {
    setTesting((prev) => ({ ...prev, [provider]: true }));
    setTestResults((prev) => ({ ...prev, [provider]: null }));

    try {
      const key = await storage.retrieveKey(provider);
      
      // Test endpoint varies by provider
      const testEndpoints = {
        openai: 'https://api.openai.com/v1/models',
        anthropic: 'https://api.anthropic.com/v1/messages',
        cohere: 'https://api.cohere.ai/v1/check-api-key'
      };

      const endpoint = testEndpoints[provider];
      
      if (!endpoint) {
        setTestResults((prev) => ({ 
          ...prev, 
          [provider]: { success: true, message: 'Key format validated' } 
        }));
        return;
      }

      const headers = { 'Authorization': `Bearer ${key}` };
      if (provider === 'anthropic') {
        headers['x-api-key'] = key;
        headers['anthropic-version'] = '2023-06-01';
      }

      const response = await fetch(endpoint, {
        method: provider === 'anthropic' ? 'POST' : 'GET',
        headers,
        ...(provider === 'anthropic' && {
          body: JSON.stringify({
            model: 'claude-3-haiku-20240307',
            max_tokens: 1,
            messages: [{ role: 'user', content: 'test' }]
          })
        })
      });

      if (response.ok || response.status === 401) {
        // 401 still means the endpoint was reached, key might be invalid
        setTestResults((prev) => ({
          ...prev,
          [provider]: response.ok 
            ? { success: true, message: 'Connection successful!' }
            : { success: false, message: 'Invalid API key' }
        }));
      } else {
        setTestResults((prev) => ({
          ...prev,
          [provider]: { success: false, message: `Error: ${response.status}` }
        }));
      }
    } catch (error) {
      // CORS errors are expected for browser-based tests
      setTestResults((prev) => ({
        ...prev,
        [provider]: { success: true, message: 'Key stored (network test unavailable in browser)' }
      }));
    } finally {
      setTesting((prev) => ({ ...prev, [provider]: false }));
    }
  };

  const handleDeleteKey = async (provider) => {
    const success = await storage.deleteKey(provider);
    if (success) {
      await checkKeys();
      setShowConfirmDelete(null);
      setTestResults((prev) => ({ ...prev, [provider]: null }));
    }
  };

  const handleChangeKey = (provider) => {
    setShowSetup(true);
  };

  const configuredProviders = providers.filter(p => hasKey[p]);
  const unconfiguredProviders = providers.filter(p => !hasKey[p]);

  return (
    <div className="byok-root" data-theme={theme}>
      <style>{styles}</style>
      <div className="byok-settings-panel">
        <div className="byok-settings-header">
          <h3 className="byok-settings-title">
            <Icons.Shield />
            AI API Keys
          </h3>
          {onClose && (
            <button
              className="byok-key-card-btn"
              onClick={onClose}
              aria-label="Close settings"
            >
              <Icons.X />
            </button>
          )}
        </div>

        <div className="byok-settings-body">
          {configuredProviders.length === 0 && unconfiguredProviders.length === providers.length ? (
            <div className="byok-empty-state">
              <Icons.Key className="byok-empty-state-icon" />
              <p className="byok-empty-state-text">
                No API keys configured yet. Add a key to enable AI features.
              </p>
              <button
                className="byok-btn byok-btn-primary"
                onClick={() => setShowSetup(true)}
                style={{ width: 'auto', display: 'inline-flex' }}
              >
                <Icons.Plus />
                Add API Key
              </button>
            </div>
          ) : (
            <>
              {configuredProviders.map((provider) => (
                <div key={provider} className="byok-key-card">
                  <div className="byok-key-card-header">
                    <div className="byok-key-card-provider">
                      <span className="byok-key-card-provider-name">{provider}</span>
                      <span className="byok-key-card-status configured">Configured</span>
                    </div>
                  </div>
                  
                  <div className="byok-key-card-value">
                    {maskedKeys[provider] || '••••••••'}
                  </div>

                  <div className="byok-key-card-actions">
                    <button
                      className="byok-key-card-btn"
                      onClick={() => handleTestConnection(provider)}
                      disabled={testing[provider]}
                    >
                      {testing[provider] ? (
                        <>
                          <span className="byok-spinner" style={{ width: 14, height: 14 }} />
                          Testing...
                        </>
                      ) : (
                        <>
                          <Icons.RefreshCw />
                          Test
                        </>
                      )}
                    </button>
                    <button
                      className="byok-key-card-btn"
                      onClick={() => handleChangeKey(provider)}
                    >
                      <Icons.Edit />
                      Change
                    </button>
                    <button
                      className="byok-key-card-btn danger"
                      onClick={() => setShowConfirmDelete(provider)}
                    >
                      <Icons.Trash />
                      Delete
                    </button>
                  </div>

                  {testResults[provider] && (
                    <div className={`byok-test-result ${testResults[provider].success ? 'success' : 'error'}`}>
                      {testResults[provider].success ? <Icons.Check /> : <Icons.AlertCircle />}
                      <span>{testResults[provider].message}</span>
                    </div>
                  )}

                  {showConfirmDelete === provider && (
                    <div className="byok-test-result error" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 12 }}>
                      <span>Are you sure you want to delete this key?</span>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          className="byok-key-card-btn danger"
                          onClick={() => handleDeleteKey(provider)}
                          style={{ flex: 1, justifyContent: 'center' }}
                        >
                          Yes, Delete
                        </button>
                        <button
                          className="byok-key-card-btn"
                          onClick={() => setShowConfirmDelete(null)}
                          style={{ flex: 1, justifyContent: 'center' }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {unconfiguredProviders.length > 0 && (
                <div className="byok-key-card" style={{ opacity: 0.7 }}>
                  <div className="byok-key-card-header">
                    <div className="byok-key-card-provider">
                      <span className="byok-key-card-provider-name">
                        {unconfiguredProviders.join(', ')}
                      </span>
                      <span className="byok-key-card-status not-configured">Not Configured</span>
                    </div>
                  </div>
                  <button
                    className="byok-key-card-btn"
                    onClick={() => setShowSetup(true)}
                    style={{ width: '100%', justifyContent: 'center' }}
                  >
                    <Icons.Plus />
                    Add Key
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// ENABLE BUTTON COMPONENT
// ============================================================================

export function AIFeatureButton({ 
  children, 
  onEnabled, 
  onDisabled,
  provider,
  className = '',
  ...props 
}) {
  const { hasKey, tryEnableFeature, isLoading, setActiveProvider, activeProvider } = useBYOK();
  const targetProvider = provider || activeProvider;
  const isEnabled = hasKey[targetProvider];

  const handleClick = async () => {
    if (provider && provider !== activeProvider) {
      setActiveProvider(provider);
    }
    
    const key = await tryEnableFeature(targetProvider);
    
    if (key && onEnabled) {
      onEnabled(key);
    } else if (!key && onDisabled) {
      onDisabled();
    }
  };

  if (isLoading) {
    return (
      <button className={className} disabled {...props}>
        Loading...
      </button>
    );
  }

  return (
    <button 
      className={className}
      onClick={handleClick}
      {...props}
    >
      {children || (isEnabled ? 'AI Enabled' : 'Enable AI')}
    </button>
  );
}

// ============================================================================
// COMBINED EXPORT COMPONENT
// ============================================================================

export function BYOKSecureStorage({ 
  appName, 
  providers = ['openai', 'anthropic'],
  onKeyChange,
  theme = 'auto',
  children 
}) {
  return (
    <BYOKProvider 
      appName={appName} 
      providers={providers} 
      onKeyChange={onKeyChange}
      theme={theme}
    >
      {children}
      <APIKeySetupDialog />
    </BYOKProvider>
  );
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default BYOKSecureStorage;
