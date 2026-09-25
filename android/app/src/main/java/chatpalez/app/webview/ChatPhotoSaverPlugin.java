package chatpalez.app.webview;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.IOException;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Locale;
import java.util.UUID;

/** Downloads a trusted chat photo to cache, then lets the user choose a Files destination. */
@CapacitorPlugin(name = "ChatPhotoSaver")
public class ChatPhotoSaverPlugin extends Plugin {
    private static final long MAX_BYTES = 20L * 1024L * 1024L;
    private File pendingFile;
    private volatile boolean saving;

    @PluginMethod
    public void save(PluginCall call) {
        String raw = call.getString("url");
        URL source;
        try {
            source = new URL(raw);
            String host = source.getHost().toLowerCase(Locale.ROOT);
            if (!"https".equals(source.getProtocol()) || source.getUserInfo() != null
                    || (source.getPort() != -1 && source.getPort() != 443)
                    || !("chatpalez.com".equals(host) || "cloud.chatpalez.com".equals(host))
                    || !source.getPath().startsWith("/uploads/photos/")) throw new IOException("Untrusted photo URL.");
        } catch (Exception error) {
            call.reject("This photo cannot be saved from an untrusted location.");
            return;
        }
        synchronized (this) {
            if (saving) {
                call.reject("A photo is already being saved.");
                return;
            }
            saving = true;
        }
        new Thread(() -> {
            File file = new File(getContext().getCacheDir(), "chatpalez-save-" + UUID.randomUUID());
            HttpURLConnection connection = null;
            try {
                connection = (HttpURLConnection) source.openConnection();
                connection.setInstanceFollowRedirects(false);
                connection.setConnectTimeout(15000);
                connection.setReadTimeout(30000);
                if (connection.getResponseCode() != 200) throw new IOException("The photo could not be downloaded.");
                String type = connection.getContentType();
                if (type != null) type = type.split(";", 2)[0].trim().toLowerCase(Locale.ROOT);
                String extension;
                if ("image/jpeg".equals(type)) extension = "jpg";
                else if ("image/png".equals(type)) extension = "png";
                else if ("image/webp".equals(type)) extension = "webp";
                else if ("image/gif".equals(type)) extension = "gif";
                else if ("image/avif".equals(type)) extension = "avif";
                else throw new IOException("The file is not a supported photo.");
                if (connection.getContentLengthLong() > MAX_BYTES) throw new IOException("This photo is too large to save.");
                try (InputStream input = connection.getInputStream(); FileOutputStream output = new FileOutputStream(file)) {
                    byte[] buffer = new byte[8192];
                    long total = 0;
                    int count;
                    while ((count = input.read(buffer)) != -1) {
                        total += count;
                        if (total > MAX_BYTES) throw new IOException("This photo is too large to save.");
                        output.write(buffer, 0, count);
                    }
                    if (total == 0) throw new IOException("The photo is empty.");
                }
                final String mime = type;
                final String name = "ChatPalez-" + System.currentTimeMillis() + "." + extension;
                getActivity().runOnUiThread(() -> {
                    pendingFile = file;
                    Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                    intent.addCategory(Intent.CATEGORY_OPENABLE);
                    intent.setType(mime);
                    intent.putExtra(Intent.EXTRA_TITLE, name);
                    startActivityForResult(call, intent, "saveToDocument");
                });
            } catch (IOException | SecurityException error) {
                file.delete();
                saving = false;
                call.reject(error.getMessage() == null ? "Unable to save this photo." : error.getMessage());
            } finally {
                if (connection != null) connection.disconnect();
            }
        }).start();
    }

    @ActivityCallback
    private void saveToDocument(PluginCall call, ActivityResult result) {
        File file = pendingFile;
        pendingFile = null;
        if (call == null || file == null) { saving = false; return; }
        Uri destination = result.getData() == null ? null : result.getData().getData();
        if (result.getResultCode() != Activity.RESULT_OK || destination == null) {
            file.delete();
            saving = false;
            JSObject response = new JSObject();
            response.put("cancelled", true);
            call.resolve(response);
            return;
        }
        new Thread(() -> {
            try (InputStream input = new FileInputStream(file);
                 OutputStream output = getContext().getContentResolver().openOutputStream(destination)) {
                if (output == null) throw new IOException("The selected folder is unavailable.");
                byte[] buffer = new byte[8192];
                int count;
                while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
                call.resolve();
            } catch (IOException | SecurityException error) {
                call.reject(error.getMessage() == null ? "Unable to write the photo." : error.getMessage());
            } finally {
                file.delete();
                saving = false;
            }
        }).start();
    }
}
