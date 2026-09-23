import UIKit
import Capacitor

class ChatPalezBridgeViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(WebContentSurfacePlugin())
    }
}
