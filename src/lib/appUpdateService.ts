import React, { useState, useEffect } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { db, storage } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ref, getDownloadURL } from 'firebase/storage';

export interface AppInstallerPluginInterface {
  canInstallPackages(): Promise<{ canInstall: boolean }>;
  openInstallPermissionSettings(): Promise<void>;
  downloadAndInstall(options: { url: string }): Promise<{ status: string; message?: string; downloadId?: number }>;
  openExternalUrl(options: { url: string }): Promise<void>;
}

export const AppInstaller = registerPlugin<AppInstallerPluginInterface>('AppInstaller');

/**
 * Safely opens an external URL on Android via native browser Intent (FLAG_ACTIVITY_NEW_TASK),
 * keeping the SHS-EZ app alive in the background without unloading, reloading or logging out!
 */
export const openExternalUrl = async (url: string) => {
  if (!url) return;
  if (Capacitor.isNativePlatform()) {
    try {
      await AppInstaller.openExternalUrl({ url });
      return;
    } catch (err) {
      console.warn('[App] Native openExternalUrl failed, falling back to window.open:', err);
    }
  }
  window.open(url, '_blank', 'noopener,noreferrer');
};

if (typeof window !== 'undefined') {
  (window as any).openExternalUrl = openExternalUrl;
}

export const CURRENT_APP_VERSION = '7.0.0';
export const DEFAULT_STORAGE_APK_PATH = 'apk/shs-ez-latest.apk';

export interface AppReleaseInfo {
  version: string;
  apkUrl: string;
  releaseDate?: string;
  releaseNotes?: string;
  fileSizeMb?: string;
}

/**
 * Compares two semantic version strings (e.g. "6.6.0" > "6.5.0")
 */
export const isNewerVersion = (remote: string, current: string = CURRENT_APP_VERSION): boolean => {
  if (!remote || remote === 'Neueste Version') return false;
  const cleanRemote = remote.replace(/^v/i, '').trim();
  const cleanCurrent = current.replace(/^v/i, '').trim();
  if (cleanRemote === cleanCurrent) return false;

  const rParts = cleanRemote.split('.').map((n) => parseInt(n, 10) || 0);
  const cParts = cleanCurrent.split('.').map((n) => parseInt(n, 10) || 0);

  for (let i = 0; i < Math.max(rParts.length, cParts.length); i++) {
    const r = rParts[i] || 0;
    const c = cParts[i] || 0;
    if (r > c) return true;
    if (r < c) return false;
  }
  return false;
};

/**
 * Returns whether the current environment is running as an Android APK (Capacitor Native).
 */
export const isAndroidApk = (): boolean => {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
};

/**
 * Checks whether any native Capacitor wrapper is running.
 */
export const isNativeApp = (): boolean => {
  return Capacitor.isNativePlatform();
};

/**
 * Fetches the latest APK release information from Firestore or Firebase Storage.
 */
export const getLatestReleaseInfo = async (): Promise<AppReleaseInfo> => {
  // 1. Try fetching metadata document from Firestore
  try {
    const docRef = doc(db, 'system_config', 'app_version');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      if (data && data.apkUrl) {
        return {
          version: data.version || '6.5.0',
          apkUrl: data.apkUrl,
          releaseDate: data.releaseDate || new Date().toISOString().split('T')[0],
          releaseNotes: data.releaseNotes || 'Allgemeine Fehlerbehebungen und Performance-Optimierungen.',
          fileSizeMb: data.fileSizeMb || 'ca. 15 MB',
        };
      }
    }
  } catch (err) {
    console.warn('[AppUpdate] Could not load Firestore system_config/app_version doc:', err);
  }

  // 2. Fallback to Firebase Storage bucket reference
  if (storage) {
    try {
      const apkRef = ref(storage, DEFAULT_STORAGE_APK_PATH);
      const url = await getDownloadURL(apkRef);
      return {
        version: 'Neueste Version',
        apkUrl: url,
        releaseDate: new Date().toISOString().split('T')[0],
        releaseNotes: 'Neuester Build direkt aus Firebase Storage.',
        fileSizeMb: 'ca. 15 MB',
      };
    } catch (err) {
      console.warn('[AppUpdate] Could not resolve Firebase Storage apk url:', err);
    }
  }

  // 3. Static public fallback URL format for Firebase Storage
  const publicStorageUrl = 'https://firebasestorage.googleapis.com/v0/b/shs-ea.firebasestorage.app/o/apk%2Fshs-ez-latest.apk?alt=media';
  return {
    version: 'Neueste Version',
    apkUrl: publicStorageUrl,
    releaseDate: new Date().toISOString().split('T')[0],
    releaseNotes: 'Reguläres Update aus dem SHS-EZ Cloudspeicher.',
    fileSizeMb: 'ca. 15 MB',
  };
};

/**
 * Hook to automatically check for updates on startup.
 */
export const useAppUpdateCheck = () => {
  const [hasUpdate, setHasUpdate] = useState(false);
  const [latestInfo, setLatestInfo] = useState<AppReleaseInfo | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    // Only check APK updates when running as native Android app
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    let mounted = true;
    setIsChecking(true);
    getLatestReleaseInfo()
      .then((info) => {
        if (!mounted) return;
        setLatestInfo(info);
        if (info && info.version && isNewerVersion(info.version, CURRENT_APP_VERSION)) {
          setHasUpdate(true);
        }
        setIsChecking(false);
      })
      .catch(() => {
        if (mounted) setIsChecking(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  return { hasUpdate, latestInfo, isChecking };
};

/**
 * Triggers the browser/system download of the APK.
 * On Android, the system automatically starts the download and invokes the package installer.
 */
export const triggerApkDownload = (apkUrl: string): void => {
  try {
    if (Capacitor.isNativePlatform()) {
      window.open(apkUrl, '_system');
    } else {
      const link = document.createElement('a');
      link.href = apkUrl;
      link.download = 'shs-ez-latest.apk';
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  } catch (err) {
    console.error('[AppUpdate] Failed to trigger APK download:', err);
    window.location.href = apkUrl;
  }
};

/**
 * Triggers the automatic in-app download and native Android installer prompt.
 */
export const triggerInAppUpdate = async (
  apkUrl: string
): Promise<{ success: boolean; status?: string; message?: string }> => {
  if (Capacitor.isNativePlatform()) {
    try {
      const res = await AppInstaller.downloadAndInstall({ url: apkUrl });
      return { success: true, status: res.status, message: res.message };
    } catch (err: any) {
      console.warn('[AppUpdate] Native AppInstaller failed, falling back to browser download:', err);
      triggerApkDownload(apkUrl);
      return { success: false, message: err?.message || 'Download fehlgeschlagen' };
    }
  } else {
    triggerApkDownload(apkUrl);
    return { success: true, status: 'web_download' };
  }
};

/**
 * Saves or updates release info in Firestore (Admins only).
 */
export const saveReleaseInfoToFirestore = async (info: AppReleaseInfo): Promise<void> => {
  const docRef = doc(db, 'system_config', 'app_version');
  await setDoc(docRef, {
    ...info,
    updatedAt: new Date().toISOString(),
  }, { merge: true });
};
