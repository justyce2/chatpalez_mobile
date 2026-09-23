import UIKit
import WebKit
import Capacitor

@objc(WebContentSurfacePlugin)
public class WebContentSurfacePlugin: CAPPlugin, CAPBridgedPlugin, WKNavigationDelegate {
    public let identifier = "WebContentSurfacePlugin"
    public let jsName = "WebContentSurface"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "open", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "show", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "hide", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setFrame", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "canGoBack", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "goBack", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "reload", returnType: CAPPluginReturnPromise)
    ]

    private var contentWebView: WKWebView?
    private var allowedOrigin: URL?

    private func ensureWebView() -> WKWebView? {
        if let contentWebView { return contentWebView }
        guard let host = bridge?.viewController?.view else { return nil }

        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.allowsInlineMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = []

        let webView = WKWebView(frame: .zero, configuration: configuration)
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

    @objc func reload(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.contentWebView?.reload()
            call.resolve()
        }
    }


    public func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else {
            decisionHandler(.cancel)
            return
        }
        decisionHandler(isAllowed(url) ? .allow : .cancel)
    }

    public func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        guard let url = webView.url, isAllowed(url) else { return }
        notifyListeners("routeChanged", data: ["url": url.absoluteString])
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
