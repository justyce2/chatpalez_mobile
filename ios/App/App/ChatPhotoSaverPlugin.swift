import UIKit
import Capacitor

@objc(ChatPhotoSaverPlugin)
public class ChatPhotoSaverPlugin: CAPPlugin, CAPBridgedPlugin, UIDocumentPickerDelegate {
    public let identifier = "ChatPhotoSaverPlugin"
    public let jsName = "ChatPhotoSaver"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "save", returnType: CAPPluginReturnPromise)
    ]

    private var pendingCall: CAPPluginCall?
    private var pendingFile: URL?
    private var saving = false
    private let maxBytes = 20 * 1024 * 1024

    @objc func save(_ call: CAPPluginCall) {
        guard let raw = call.getString("url"), let source = URL(string: raw),
              source.scheme == "https", source.user == nil, source.password == nil,
              source.port == nil || source.port == 443,
              ["chatpalez.com", "cloud.chatpalez.com"].contains(source.host?.lowercased() ?? ""),
              source.path.hasPrefix("/uploads/photos/") else {
            call.reject("This photo cannot be saved from an untrusted location.")
            return
        }
        guard !saving else {
            call.reject("A photo is already being saved.")
            return
        }
        saving = true

        URLSession.shared.downloadTask(with: source) { [weak self] location, response, error in
            guard let self else { return }
            guard error == nil, let location, let http = response as? HTTPURLResponse,
                  http.statusCode == 200, let finalURL = http.url,
                  finalURL.scheme == "https", finalURL.user == nil, finalURL.password == nil,
                  finalURL.port == nil || finalURL.port == 443,
                  ["chatpalez.com", "cloud.chatpalez.com"].contains(finalURL.host?.lowercased() ?? ""),
                  finalURL.path.hasPrefix("/uploads/photos/") else {
                self.fail(call, "The photo could not be downloaded.")
                return
            }
            let types = ["image/jpeg": "jpg", "image/png": "png", "image/webp": "webp",
                         "image/gif": "gif", "image/avif": "avif"]
            guard let type = http.mimeType?.lowercased(), let ext = types[type],
                  let attributes = try? FileManager.default.attributesOfItem(atPath: location.path),
                  let size = attributes[.size] as? NSNumber,
                  size.intValue > 0 && size.intValue <= self.maxBytes else {
                self.fail(call, "The file is not a supported photo or is too large to save.")
                return
            }
            let file = FileManager.default.temporaryDirectory
                .appendingPathComponent("ChatPalez-\(UUID().uuidString).\(ext)")
            do {
                try FileManager.default.copyItem(at: location, to: file)
            } catch {
                self.fail(call, "Unable to prepare the photo for saving.")
                return
            }
            DispatchQueue.main.async {
                guard self.pendingCall == nil, let controller = self.bridge?.viewController else {
                    try? FileManager.default.removeItem(at: file)
                    self.saving = false
                    call.reject("The file picker is unavailable.")
                    return
                }
                self.pendingCall = call
                self.pendingFile = file
                let picker = UIDocumentPickerViewController(forExporting: [file], asCopy: true)
                picker.delegate = self
                controller.present(picker, animated: true)
            }
        }.resume()
    }

    public func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        pendingCall?.resolve()
        finish()
    }

    public func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
        pendingCall?.resolve(["cancelled": true])
        finish()
    }

    private func finish() {
        if let pendingFile { try? FileManager.default.removeItem(at: pendingFile) }
        pendingFile = nil
        pendingCall = nil
        saving = false
    }

    private func fail(_ call: CAPPluginCall, _ message: String) {
        DispatchQueue.main.async {
            self.saving = false
            call.reject(message)
        }
    }
}
