package dev.takip.app;

import android.os.Bundle;
import androidx.activity.EdgeToEdge;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Android 15 forces edge-to-edge; this gives older versions the same layout, and the page pads itself with env(safe-area-inset-*).
        EdgeToEdge.enable(this);
    }
}
