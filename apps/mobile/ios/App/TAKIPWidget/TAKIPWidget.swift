import SwiftUI
import WidgetKit

struct NearProvider: TimelineProvider {
    func placeholder(in context: Context) -> NearEntry {
        NearEntry(date: .now, near: NearNow.sample, stale: false)
    }

    func getSnapshot(in context: Context, completion: @escaping (NearEntry) -> Void) {
        if context.isPreview { return completion(placeholder(in: context)) }
        Task { completion(await entry()) }
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<NearEntry>) -> Void) {
        Task {
            let entry = await entry()
            // Sooner after a failure; WidgetKit's daily budget allows a few dozen refreshes.
            let next = Date.now.addingTimeInterval(entry.stale || entry.near == nil ? 5 * 60 : 15 * 60)
            completion(Timeline(entries: [entry], policy: .after(next)))
        }
    }

    private func entry() async -> NearEntry {
        if let near = try? await NearClient.fetch() { return NearEntry(date: .now, near: near, stale: false) }
        return NearEntry(date: .now, near: NearClient.last(), stale: true)
    }
}

struct NearWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "dev.takip.near", provider: NearProvider()) { entry in
            NearEntryView(entry: entry)
        }
        .configurationDisplayName("TAKIP")
        .description("Warnings, earthquakes, fires, lightning and rain near you.")
        // The small size is the one CarPlay shows on its dashboard.
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular])
    }
}

struct NearEntryView: View {
    @Environment(\.widgetFamily) private var family
    let entry: NearEntry

    var body: some View {
        NearCard(entry: entry, family: family)
            .containerBackground(for: .widget) { NearStyle.background }
    }
}

extension NearNow {
    static let sample = NearNow(
        title: "Near you",
        place: NearPlace(name: "Istanbul", path: "/city/istanbul/weather"),
        items: [
            NearItem(kind: "earthquake", title: "M4.6 earthquake", detail: "38 km · 2 hr. ago", path: "/"),
            NearItem(kind: "lightning", title: "Lightning", detail: "12 km · 5 min. ago", path: "/"),
        ],
        empty: "Nothing near you right now",
        at: Date.now.timeIntervalSince1970 * 1000
    )
}

@main
struct TAKIPWidgets: WidgetBundle {
    var body: some Widget {
        NearWidget()
    }
}
