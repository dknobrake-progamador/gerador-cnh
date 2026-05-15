package com.fabrica30.app;

import android.content.ContentValues;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

@CapacitorPlugin(name = "PdfSaver")
public class PdfSaverPlugin extends Plugin {
    @PluginMethod
    public void savePdf(PluginCall call) {
        String base64 = call.getString("base64");
        String fileName = call.getString("fileName", "documento.pdf");

        if (base64 == null || base64.trim().isEmpty()) {
            call.reject("base64 obrigatorio");
            return;
        }

        try {
            byte[] pdfBytes = Base64.decode(base64, Base64.DEFAULT);
            Uri savedUri = saveToDownloads(fileName, pdfBytes);

            JSObject ret = new JSObject();
            ret.put("ok", true);
            ret.put("uri", savedUri != null ? savedUri.toString() : "");
            ret.put("fileName", fileName);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Falha ao salvar PDF: " + e.getMessage());
        }
    }

    private Uri saveToDownloads(String fileName, byte[] bytes) throws Exception {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ContentValues values = new ContentValues();
            values.put(MediaStore.Downloads.DISPLAY_NAME, fileName);
            values.put(MediaStore.Downloads.MIME_TYPE, "application/pdf");
            values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
            values.put(MediaStore.Downloads.IS_PENDING, 1);

            Uri collection = MediaStore.Downloads.EXTERNAL_CONTENT_URI;
            Uri item = getContext().getContentResolver().insert(collection, values);
            if (item == null) throw new Exception("Nao foi possivel criar arquivo em Downloads");

            OutputStream out = getContext().getContentResolver().openOutputStream(item);
            if (out == null) throw new Exception("Nao foi possivel abrir arquivo em Downloads");
            out.write(bytes);
            out.flush();
            out.close();

            values.clear();
            values.put(MediaStore.Downloads.IS_PENDING, 0);
            getContext().getContentResolver().update(item, values, null, null);
            return item;
        }

        File downloads = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
        if (!downloads.exists()) downloads.mkdirs();
        File file = new File(downloads, fileName);
        FileOutputStream fos = new FileOutputStream(file);
        fos.write(bytes);
        fos.flush();
        fos.close();
        return Uri.fromFile(file);
    }
}
