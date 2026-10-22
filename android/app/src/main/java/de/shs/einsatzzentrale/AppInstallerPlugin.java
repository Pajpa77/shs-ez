package de.shs.einsatzzentrale;

import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.provider.Settings;
import android.util.Base64;
import android.widget.Toast;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

@CapacitorPlugin(name = "AppInstaller")
public class AppInstallerPlugin extends Plugin {

    @PluginMethod
    public void canInstallPackages(PluginCall call) {
        JSObject ret = new JSObject();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            ret.put("canInstall", getContext().getPackageManager().canRequestPackageInstalls());
        } else {
            ret.put("canInstall", true);
        }
        call.resolve(ret);
    }

    @PluginMethod
    public void openInstallPermissionSettings(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Intent intent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES);
            intent.setData(Uri.parse("package:" + getContext().getPackageName()));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
        }
        call.resolve();
    }

    @PluginMethod
    public void openExternalUrl(PluginCall call) {
        String url = call.getString("url");
        if (url == null || url.isEmpty()) {
            call.reject("URL is missing");
            return;
        }

        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to open URL: " + e.getMessage());
        }
    }

    @PluginMethod
    public void saveFileToDownloads(PluginCall call) {
        String base64Data = call.getString("base64Data");
        String filename = call.getString("filename");
        String mimeType = call.getString("mimeType", "application/octet-stream");

        if (base64Data == null || base64Data.isEmpty() || filename == null || filename.isEmpty()) {
            call.reject("Data or filename missing");
            return;
        }

        try {
            if (base64Data.contains(",")) {
                base64Data = base64Data.substring(base64Data.indexOf(",") + 1);
            }
            byte[] fileBytes = Base64.decode(base64Data, Base64.DEFAULT);
            Context context = getContext();

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentValues values = new ContentValues();
                values.put(MediaStore.MediaColumns.DISPLAY_NAME, filename);
                values.put(MediaStore.MediaColumns.MIME_TYPE, mimeType);
                values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);

                Uri uri = context.getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                if (uri != null) {
                    OutputStream out = context.getContentResolver().openOutputStream(uri);
                    if (out != null) {
                        out.write(fileBytes);
                        out.flush();
                        out.close();
                    }
                }
            } else {
                File downloadDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                if (!downloadDir.exists()) {
                    downloadDir.mkdirs();
                }
                File outFile = new File(downloadDir, filename);
                FileOutputStream fos = new FileOutputStream(outFile);
                fos.write(fileBytes);
                fos.flush();
                fos.close();

                MediaScannerConnection.scanFile(
                    context,
                    new String[]{outFile.getAbsolutePath()},
                    new String[]{mimeType},
                    null
                );
            }

            getActivity().runOnUiThread(() -> {
                Toast.makeText(context, "Gespeichert in Downloads: " + filename, Toast.LENGTH_LONG).show();
            });

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("filename", filename);
            call.resolve(ret);

        } catch (Exception e) {
            e.printStackTrace();
            call.reject("Fehler beim Speichern in Downloads: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void downloadAndInstall(PluginCall call) {
        String url = call.getString("url");
        if (url == null || url.isEmpty()) {
            call.reject("URL is missing");
            return;
        }

        Context context = getContext();

        // 1. Check if permission to install unknown apps is granted on Android 8+
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            if (!context.getPackageManager().canRequestPackageInstalls()) {
                Intent permissionIntent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES);
                permissionIntent.setData(Uri.parse("package:" + context.getPackageName()));
                permissionIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(permissionIntent);

                JSObject ret = new JSObject();
                ret.put("status", "permission_needed");
                ret.put("message", "Bitte erlaube 'Apps aus dieser Quelle installieren' und tippe erneut auf Herunterladen.");
                call.resolve(ret);
                return;
            }
        }

        JSObject initialRet = new JSObject();
        initialRet.put("status", "download_started");
        initialRet.put("message", "Direkter Download gestartet...");
        call.resolve(initialRet);

        // Run direct, reliable in-app download in background thread
        new Thread(() -> {
            File apkFile = new File(context.getCacheDir(), "shs-ez-update.apk");
            try {
                if (apkFile.exists()) {
                    apkFile.delete();
                }

                URL downloadUrl = new URL(url);
                HttpURLConnection conn = (HttpURLConnection) downloadUrl.openConnection();
                conn.setInstanceFollowRedirects(true);
                conn.setConnectTimeout(15000);
                conn.setReadTimeout(45000);
                conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Android; Mobile) SHS-EZ-App");
                conn.connect();

                int responseCode = conn.getResponseCode();
                int redirects = 0;
                while ((responseCode == HttpURLConnection.HTTP_MOVED_PERM 
                     || responseCode == HttpURLConnection.HTTP_MOVED_TEMP 
                     || responseCode == HttpURLConnection.HTTP_SEE_OTHER 
                     || responseCode == 307 
                     || responseCode == 308) && redirects < 5) {
                    String newUrl = conn.getHeaderField("Location");
                    conn.disconnect();
                    downloadUrl = new URL(newUrl);
                    conn = (HttpURLConnection) downloadUrl.openConnection();
                    conn.setInstanceFollowRedirects(true);
                    conn.setConnectTimeout(15000);
                    conn.setReadTimeout(45000);
                    conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Android; Mobile) SHS-EZ-App");
                    conn.connect();
                    responseCode = conn.getResponseCode();
                    redirects++;
                }

                if (responseCode != HttpURLConnection.HTTP_OK) {
                    throw new Exception("Server meldete HTTP " + responseCode);
                }

                int contentLength = conn.getContentLength();
                InputStream in = new BufferedInputStream(conn.getInputStream(), 16384);
                OutputStream out = new FileOutputStream(apkFile);

                byte[] buffer = new byte[8192];
                long totalBytes = 0;
                int count;
                int lastReportedPercent = 0;

                while ((count = in.read(buffer)) != -1) {
                    out.write(buffer, 0, count);
                    totalBytes += count;
                    if (contentLength > 0) {
                        int percent = (int) ((totalBytes * 100) / contentLength);
                        if (percent - lastReportedPercent >= 3) {
                            lastReportedPercent = percent;
                            JSObject progressData = new JSObject();
                            progressData.put("percent", percent);
                            progressData.put("totalBytes", totalBytes);
                            progressData.put("contentLength", contentLength);
                            notifyListeners("downloadProgress", progressData);
                        }
                    }
                }

                out.flush();
                out.close();
                in.close();
                conn.disconnect();

                if (apkFile.exists() && apkFile.length() > 500000) {
                    JSObject doneData = new JSObject();
                    doneData.put("percent", 100);
                    doneData.put("status", "complete");
                    notifyListeners("downloadProgress", doneData);

                    getActivity().runOnUiThread(() -> triggerInstall(context, apkFile));
                } else {
                    throw new Exception("Heruntergeladene APK-Datei ist ungültig (" + apkFile.length() + " Bytes)");
                }

            } catch (Exception e) {
                e.printStackTrace();
                JSObject errData = new JSObject();
                errData.put("status", "error");
                errData.put("message", e.getMessage());
                notifyListeners("downloadProgress", errData);

                // Automatic fallback: trigger download in system browser
                getActivity().runOnUiThread(() -> {
                    try {
                        Intent browserIntent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                        browserIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        context.startActivity(browserIntent);
                    } catch (Exception ignored) {}
                });
            }
        }).start();
    }

    private void triggerInstall(Context context, File apkFile) {
        try {
            Uri apkUri;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                apkUri = FileProvider.getUriForFile(
                    context,
                    context.getPackageName() + ".fileprovider",
                    apkFile
                );
            } else {
                apkUri = Uri.fromFile(apkFile);
            }

            Intent installIntent = new Intent(Intent.ACTION_VIEW);
            installIntent.setDataAndType(apkUri, "application/vnd.android.package-archive");
            installIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            installIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            context.startActivity(installIntent);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
