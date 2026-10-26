import CoreLocation
import Foundation

// What /api/near-now answers (src/lib/feeds/hazards/near-now.ts); the words come translated from the site.
struct NearItem: Codable, Hashable {
    let kind: String
    let title: String
    let detail: String
    let path: String
}

struct NearPlace: Codable, Hashable {
    let name: String
    let path: String
}

struct NearNow: Codable {
    let title: String
    let place: NearPlace?
    let items: [NearItem]
    let empty: String
    let at: Double

    var updated: Date { Date(timeIntervalSince1970: at / 1000) }
}

enum NearClient {
    /// TAKIPSiteURL in Info.plist, which `npm run sync` writes; takip.dev unless a dev build points elsewhere.
    static let site: URL = {
        let raw = Bundle.main.object(forInfoDictionaryKey: "TAKIPSiteURL") as? String
        return raw.flatMap(URL.init(string:)) ?? URL(string: "https://takip.dev")!
    }()

    private static let lastKey = "near.last"
    private static let shared = UserDefaults.standard

    static func fetch() async throws -> NearNow {
        let point = try await whereabouts()
        var url = URLComponents(url: site.appending(path: "api/near-now"), resolvingAgainstBaseURL: false)!
        url.queryItems = [
            URLQueryItem(name: "lat", value: String(format: "%.3f", point.latitude)),
            URLQueryItem(name: "lon", value: String(format: "%.3f", point.longitude)),
            URLQueryItem(name: "lang", value: Locale.current.language.languageCode?.identifier ?? "en"),
            URLQueryItem(name: "unit", value: Locale.current.measurementSystem == .us ? "mi" : "km"),
        ]
        let (data, response) = try await URLSession.shared.data(from: url.url!)
        guard (response as? HTTPURLResponse)?.statusCode == 200 else { throw URLError(.badServerResponse) }
        let near = try JSONDecoder().decode(NearNow.self, from: data)
        shared.set(data, forKey: lastKey)
        return near
    }

    /// The last answer that came through, shown with its time when the network fails.
    static func last() -> NearNow? {
        shared.data(forKey: lastKey).flatMap { try? JSONDecoder().decode(NearNow.self, from: $0) }
    }

    /// The device's last fix when the person lets widgets use it, else where the connection places the phone, as the site does.
    private static func whereabouts() async throws -> CLLocationCoordinate2D {
        let manager = CLLocationManager()
        if manager.isAuthorizedForWidgetUpdates, let fix = manager.location { return fix.coordinate }
        var url = URLComponents(url: site.appending(path: "api/geo"), resolvingAgainstBaseURL: false)!
        url.queryItems = [URLQueryItem(name: "tz", value: TimeZone.current.identifier)]
        let (data, _) = try await URLSession.shared.data(from: url.url!)
        struct Geo: Decodable { let status: String?; let lat: Double?; let lon: Double? }
        let geo = try JSONDecoder().decode(Geo.self, from: data)
        guard geo.status == "success", let lat = geo.lat, let lon = geo.lon else { throw URLError(.cannotFindHost) }
        return CLLocationCoordinate2D(latitude: lat, longitude: lon)
    }

    /// A tap opens this page in the app (src/lib/platform/native/handoff.ts, appLinkPath).
    static func open(_ path: String) -> URL {
        var url = URLComponents()
        url.scheme = "dev.takip.app"
        url.host = "open"
        url.queryItems = [URLQueryItem(name: "path", value: path)]
        return url.url!
    }
}
