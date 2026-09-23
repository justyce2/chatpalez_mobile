import UIKit
import WebKit
import Capacitor

@objc(WebContentSurfacePlugin)
public class WebContentSurfacePlugin: CAPPlugin, CAPBridgedPlugin, WKNavigationDelegate, WKScriptMessageHandler {
    public let identifier = "WebContentSurfacePlugin"
    public let jsName = "WebContentSurface"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "open", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "show", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "hide", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setFrame", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "canGoBack", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "goBack", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "reload", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "postMessage", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "showCreateActions", returnType: CAPPluginReturnPromise)
    ]

    private var contentWebView: WKWebView?
    private var allowedOrigin: URL?

    private func ensureWebView() -> WKWebView? {
        if let contentWebView { return contentWebView }
        guard let host = bridge?.viewController?.view else { return nil }

        let configuration = WKWebViewConfiguration()
        configuration.userContentController.add(self, name: "ChatPalezNativeSurface")
        configuration.websiteDataStore = .default()
        configuration.allowsInlineMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = []

        let webView = WKWebView(frame: .zero, configuration: configuration)
        // The dedicated WKWebView is outside Capacitor's primary web view, so
        // explicitly mirror the app UA marker required by mobile-session.php.
        webView.customUserAgent = "Mozilla/5.0 ChatPalezMobile/1.0"
        webView.backgroundColor = .white
        webView.isOpaque = true
        webView.isHidden = true
        webView.autoresizingMask = []
        webView.navigationDelegate = self
        host.addSubview(webView)
        host.bringSubviewToFront(webView)
        contentWebView = webView
        return webView
    }

    @objc func open(_ call: CAPPluginCall) {
        guard let action = call.getString("action"),
              let token = call.getString("token"),
              let path = call.getString("path"),
              let requestedOrigin = call.getString("allowedOrigin"),
              let url = URL(string: action),
              let origin = URL(string: requestedOrigin),
              url.scheme?.lowercased() == "https",
              origin.scheme?.lowercased() == "https",
              url.host?.lowercased() == origin.host?.lowercased() else {
            call.reject("Missing or invalid authenticated web transition.")
            return
        }

        DispatchQueue.main.async {
            guard let webView = self.ensureWebView() else {
                call.reject("Unable to create ChatPalez web content surface.")
                return
            }

            self.allowedOrigin = origin
            self.applyFrame(call, to: webView)
            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.setValue("application/x-www-form-urlencoded; charset=utf-8", forHTTPHeaderField: "Content-Type")
            request.httpBody = "token=\(self.formEncode(token))&path=\(self.formEncode(path))".data(using: .utf8)
            webView.isHidden = false
            webView.superview?.bringSubviewToFront(webView)
            webView.load(request)
            call.resolve()
        }
    }

    @objc func show(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            if let webView = self.ensureWebView() {
                webView.isHidden = false
                webView.superview?.bringSubviewToFront(webView)
            }
            call.resolve()
        }
    }

    @objc func hide(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.contentWebView?.isHidden = true
            call.resolve()
        }
    }

    @objc func setFrame(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let webView = self.ensureWebView() else {
                call.reject("Unable to create ChatPalez web content surface.")
                return
            }
            self.applyFrame(call, to: webView)
            call.resolve()
        }
    }

    @objc func canGoBack(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            call.resolve(["value": self.contentWebView?.canGoBack ?? false])
        }
    }

    @objc func goBack(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            if self.contentWebView?.canGoBack == true {
                self.contentWebView?.goBack()
            }
            call.resolve()
        }
    }

    @objc func showCreateActions(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let presenter = self.bridge?.viewController else {
                call.reject("Unable to present ChatPalez create actions.")
                return
            }

            let sheet = UIAlertController(
                title: "Create",
                message: "What would you like to share?",
                preferredStyle: .actionSheet
            )
            let actions: [(String, String)] = [
                ("Create Post", "post"),
                ("Upload Photos", "photos"),
                ("Create Story", "story"),
                ("Create Reel", "reel")
            ]
            for (title, value) in actions {
                sheet.addAction(UIAlertAction(title: title, style: .default) { _ in
                    call.resolve(["action": value])
                })
            }
            sheet.addAction(UIAlertAction(title: "Cancel", style: .cancel) { _ in
                call.resolve(["action": NSNull()])
            })

            // Keep the native iPhone action-sheet idiom while matching the
            // ChatPalez accent and supporting iPad's required popover anchor.
            sheet.view.tintColor = UIColor(red: 0, green: 102.0 / 255.0, blue: 178.0 / 255.0, alpha: 1)
            if let popover = sheet.popoverPresentationController {
                popover.sourceView = presenter.view
                popover.sourceRect = CGRect(
                    x: presenter.view.bounds.midX,
                    y: presenter.view.bounds.maxY - 1,
                    width: 1,
                    height: 1
                )
                popover.permittedArrowDirections = []
            }
            presenter.present(sheet, animated: true)
        }
    }

    @objc func postMessage(_ call: CAPPluginCall) {
        guard let message = call.getObject("message"),
              JSONSerialization.isValidJSONObject(message),
              let data = try? JSONSerialization.data(withJSONObject: message),
              let json = String(data: data, encoding: .utf8) else {
            call.reject("Missing or invalid web surface message.")
            return
        }
        DispatchQueue.main.async {
            guard let webView = self.contentWebView else {
                call.reject("ChatPalez web content surface is not open.")
                return
            }
            webView.evaluateJavaScript("window.dispatchEvent(new CustomEvent('chatpalez:native-surface-message',{detail:\(json)}));") { _, error in
                if let error {
                    call.reject("Unable to deliver web surface message.", nil, error)
                } else {
                    call.resolve()
                }
            }
        }
    }

    @objc func resetSession(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.contentWebView?.stopLoading()
            self.contentWebView?.loadHTMLString("", baseURL: nil)
            self.contentWebView?.isHidden = true
            self.allowedOrigin = nil
            let store = WKWebsiteDataStore.default()
            let types = WKWebsiteDataStore.allWebsiteDataTypes()
            store.fetchDataRecords(ofTypes: types) { records in
                store.removeData(ofTypes: types, for: records) {
                    call.resolve()
                }
            }
        }
    }

    @objc func reload(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.contentWebView?.reload()
            call.resolve()
        }
    }



    public func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "ChatPalezNativeSurface",
              let body = message.body as? [String: Any],
              let type = body["type"] as? String,
              ["share", "pick-media", "open-native", "open-external"].contains(type) else { return }
        notifyListeners("command", data: body)
    }

    public func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else {
            decisionHandler(.cancel)
            return
        }
        if isAllowed(url) {
            decisionHandler(.allow)
            return
        }
        if url.scheme?.lowercased() == "http" || url.scheme?.lowercased() == "https" {
            UIApplication.shared.open(url)
        }
        decisionHandler(.cancel)
    }

    public func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        notifyListeners("loadStarted", data: ["url": webView.url?.absoluteString ?? ""])
    }

    public func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        guard let url = webView.url, isAllowed(url) else { return }
        notifyListeners("routeChanged", data: ["url": url.absoluteString])
        notifyListeners("loadFinished", data: ["url": url.absoluteString])
    }

    private func isAllowed(_ url: URL) -> Bool {
        guard let trusted = allowedOrigin else { return false }
        return url.scheme?.lowercased() == "https" && url.host?.lowercased() == trusted.host?.lowercased()
    }

    private func applyFrame(_ call: CAPPluginCall, to webView: WKWebView) {
        let x = CGFloat(call.getDouble("x") ?? 0)
        let y = CGFloat(call.getDouble("y") ?? 0)
        let width = max(1, CGFloat(call.getDouble("width") ?? 1))
        let height = max(1, CGFloat(call.getDouble("height") ?? 1))
        webView.frame = CGRect(x: x, y: y, width: width, height: height)
    }

    private func formEncode(_ value: String) -> String {
        var allowed = CharacterSet.alphanumerics
        allowed.insert(charactersIn: "-._*")
        return value.addingPercentEncoding(withAllowedCharacters: allowed) ?? ""
    }
}
