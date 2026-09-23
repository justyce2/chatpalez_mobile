package chatpalez.app.webview;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

/**
 * Android bootstrap only.
 *
 * Product behavior, navigation and shell UI remain in the shared
 * Capacitor/TypeScript layer. This activity only registers native surfaces
 * required by the shared cross-platform contract.
 */
public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(WebContentSurfacePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
