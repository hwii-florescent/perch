import AVFoundation
import SwiftUI

/// First launch (or after Change computer): pair with the desktop by scanning
/// the QR in its Settings → Devices, or by typing the address and code shown
/// beside it. Either way the app opens that link and the desktop's own
/// pairing (`PairingGate.tsx`) exchanges the code for this phone's token.
struct ConnectView: View {
    let onConnect: (URL) -> Void
    @State private var mode = AVCaptureDevice.default(for: .video) == nil ? Mode.code : Mode.scan
    @State private var address = ""
    @State private var code = ""
    @State private var error: String?

    enum Mode { case scan, code }

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 16) {
                Text("On your computer, open Perch → Settings → Devices and choose “Pair a device”. The code is valid for five minutes.")
                    .font(.subheadline).foregroundStyle(.secondary)
                Picker("Pair with", selection: $mode) {
                    Text("Scan QR").tag(Mode.scan)
                    Text("Enter code").tag(Mode.code)
                }
                .pickerStyle(.segmented)
                if mode == .scan { scan } else { form }
                if let error { Text(error).font(.footnote).foregroundStyle(.red) }
                Spacer(minLength: 0)
            }
            .padding(20)
            .navigationTitle("Connect to your computer")
            .navigationBarTitleDisplayMode(.inline)
        }
    }

    @ViewBuilder private var scan: some View {
        if AVCaptureDevice.default(for: .video) == nil {
            unavailable("This device has no camera. Enter the code instead.")
        } else if [.denied, .restricted].contains(AVCaptureDevice.authorizationStatus(for: .video)) {
            unavailable("Camera access is off for Perch. Turn it on in Settings, or enter the code instead.")
        } else {
            QRScanner { text in
                if let url = PairLink.make(address: text), text.contains("pair=") {
                    onConnect(url)
                } else {
                    error = "That QR code isn’t a Perch pairing code."
                }
            }
            .aspectRatio(1, contentMode: .fit)
            .clipShape(RoundedRectangle(cornerRadius: 12))
        }
    }

    private var form: some View {
        VStack(spacing: 12) {
            TextField("Address, e.g. http://192.168.1.20:7788", text: $address)
                .accessibilityIdentifier("connect-address")
                .keyboardType(.URL).textContentType(.URL)
                .textInputAutocapitalization(.never).autocorrectionDisabled()
            TextField("Pairing code", text: $code)
                .accessibilityIdentifier("connect-code")
                .textInputAutocapitalization(.characters).autocorrectionDisabled()
                .font(.body.monospaced())
            // The relay address on screen omits its encryption key (PhoneAccess.tsx), so typing it
            // cannot reach the computer: Remote access pairs by QR only.
            Text("Same Wi-Fi or Tailscale: type the address and code. Remote access (relay): scan the QR instead.")
                .font(.footnote).foregroundStyle(.secondary)
                .frame(maxWidth: .infinity, alignment: .leading)
            Button(action: submit) {
                Text("Connect").frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
        }
        .textFieldStyle(.roundedBorder)
        .onSubmit { error = nil }
    }

    private func submit() {
        let hasCode = !code.trimmingCharacters(in: .whitespaces).isEmpty || address.contains("pair=")
        if let url = PairLink.make(address: address, code: code), hasCode {
            onConnect(url)
        } else if hasCode {
            error = "Enter the address your computer shows, starting with http:// or https://."
        } else {
            error = "Enter the pairing code your computer shows."
        }
    }

    private func unavailable(_ text: String) -> some View {
        Text(text).font(.subheadline).foregroundStyle(.secondary)
            .frame(maxWidth: .infinity, minHeight: 200)
            .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 12))
    }
}

/// The camera, reporting the first QR code it sees.
private struct QRScanner: UIViewControllerRepresentable {
    let onCode: (String) -> Void

    func makeUIViewController(context: Context) -> ScannerController {
        let controller = ScannerController()
        controller.onCode = onCode
        return controller
    }

    func updateUIViewController(_ controller: ScannerController, context: Context) {
        controller.onCode = onCode
    }
}

private final class ScannerController: UIViewController, AVCaptureMetadataOutputObjectsDelegate {
    var onCode: ((String) -> Void)?
    private let session = AVCaptureSession()
    private var preview: AVCaptureVideoPreviewLayer?
    private var last: String?

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black
        let output = AVCaptureMetadataOutput()
        guard let camera = AVCaptureDevice.default(for: .video),
              let input = try? AVCaptureDeviceInput(device: camera),
              session.canAddInput(input), session.canAddOutput(output)
        else { return }
        session.addInput(input)
        session.addOutput(output)
        output.setMetadataObjectsDelegate(self, queue: .main)
        output.metadataObjectTypes = [.qr]
        let layer = AVCaptureVideoPreviewLayer(session: session)
        layer.videoGravity = .resizeAspectFill
        view.layer.addSublayer(layer)
        preview = layer
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        preview?.frame = view.bounds
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        let session = session
        DispatchQueue.global(qos: .userInitiated).async { session.startRunning() }
    }

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        let session = session
        DispatchQueue.global(qos: .userInitiated).async { session.stopRunning() }
    }

    func metadataOutput(
        _ output: AVCaptureMetadataOutput,
        didOutput objects: [AVMetadataObject],
        from connection: AVCaptureConnection
    ) {
        // The same code stays in view for many frames; report each one once.
        let code = objects.first as? AVMetadataMachineReadableCodeObject
        guard let text = code?.stringValue, text != last else { return }
        last = text
        UINotificationFeedbackGenerator().notificationOccurred(.success)
        onCode?(text)
    }
}
