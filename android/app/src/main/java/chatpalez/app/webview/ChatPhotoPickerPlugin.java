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
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.IOException;
import java.util.UUID;

/** Reads picker grants through ContentResolver instead of reopening a gallery filesystem path. */
@CapacitorPlugin(name = "ChatPhotoPicker")
public class ChatPhotoPickerPlugin extends Plugin {
    private static final long MAX_BYTES = 8L * 1024L * 1024L;

    @PluginMethod
    public void pick(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("image/*");
        startActivityForResult(call, intent, "receivePhoto");
    }

    @ActivityCallback
    private void receivePhoto(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) {
            call.resolve(new JSObject());
            return;
        }

        Uri source = result.getData().getData();
        String type = getContext().getContentResolver().getType(source);
        String extension;
        if ("image/jpeg".equals(type)) extension = "jpg";
        else if ("image/png".equals(type)) extension = "png";
        else if ("image/webp".equals(type)) extension = "webp";
        else if ("image/gif".equals(type)) extension = "gif";
        else if ("image/heic".equals(type)) extension = "heic";
        else if ("image/heif".equals(type)) extension = "heif";
        else {
            call.reject("This image format is not supported for chat.");
            return;
        }

        File destination = new File(getContext().getCacheDir(), "chat-photo-" + UUID.randomUUID() + "." + extension);
        try (InputStream input = getContext().getContentResolver().openInputStream(source);
             FileOutputStream output = new FileOutputStream(destination)) {
            if (input == null) throw new IOException("The selected photo could not be opened.");
            byte[] buffer = new byte[8192];
            long total = 0;
            int count;
            while ((count = input.read(buffer)) != -1) {
                total += count;
                if (total > MAX_BYTES) throw new IOException("This photo is too large. Choose a smaller image.");
                output.write(buffer, 0, count);
            }
            if (total == 0) throw new IOException("The selected photo is empty.");
        } catch (IOException | SecurityException error) {
            destination.delete();
            call.reject(error.getMessage() == null ? "The selected photo could not be opened." : error.getMessage());
            return;
        }
        JSObject response = new JSObject();
        response.put("uri", Uri.fromFile(destination).toString());
        response.put("type", type);
        call.resolve(response);
    }
}
