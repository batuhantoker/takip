import SwiftUI
import WidgetKit

struct NearEntry: TimelineEntry {
    let date: Date
    let near: NearNow?
    /// True when `near` is the last good answer rather than a fresh one.
    let stale: Bool
}

enum NearStyle {
    static let background = Color(red: 10 / 255, green: 12 / 255, blue: 15 / 255)

    static func icon(_ kind: String) -> String {
        switch kind {
        case "warning": "exclamationmark.triangle.fill"
        case "earthquake": "waveform.path.ecg"
        case "fire": "flame.fill"
        case "lightning": "bolt.fill"
        case "rain": "cloud.rain.fill"
        default: "circle.fill"
        }
    }

    static func tint(_ kind: String) -> Color {
        switch kind {
        case "warning": Color(red: 1, green: 0.35, blue: 0.31)
        case "earthquake": Color(red: 1, green: 0.62, blue: 0.26)
        case "fire": Color(red: 1, green: 0.42, blue: 0.17)
        case "lightning": Color(red: 1, green: 0.83, blue: 0.23)
        case "rain": Color(red: 0.3, green: 0.64, blue: 1)
        default: .secondary
        }
    }
}

/// The widget's face, by size: two lines when small (as CarPlay shows it), four when medium, one on the Lock Screen.
struct NearCard: View {
    let entry: NearEntry
    let family: WidgetFamily

    private var limit: Int { family == .systemMedium ? 4 : family == .accessoryRectangular ? 1 : 2 }

    var body: some View {
        if family == .accessoryRectangular { lockScreen } else { card }
    }

    private var heading: String {
        guard let near = entry.near else { return "TAKIP" }
        return [near.title, near.place?.name].compactMap { $0 }.joined(separator: " · ")
    }

    private var card: some View {
        VStack(alignment: .leading, spacing: 7) {
            HStack(spacing: 4) {
                Text(heading).font(.caption2.weight(.semibold)).foregroundStyle(.secondary).lineLimit(1)
                Spacer(minLength: 0)
                if entry.stale && entry.near != nil { Image(systemName: "wifi.slash").font(.caption2).foregroundStyle(.secondary) }
            }
            if let near = entry.near {
                if near.items.isEmpty {
                    Spacer(minLength: 0)
                    Label(near.empty, systemImage: "checkmark.circle.fill")
                        .font(.caption.weight(.medium)).foregroundStyle(.white).lineLimit(3)
                        .symbolRenderingMode(.hierarchical)
                } else if family == .systemMedium {
                    // Two columns, read across: four rows would not fit the height.
                    let items = Array(near.items.prefix(limit))
                    HStack(alignment: .top, spacing: 12) {
                        ForEach(0..<2, id: \.self) { column in
                            VStack(alignment: .leading, spacing: 7) {
                                ForEach(Array(stride(from: column, to: items.count, by: 2)), id: \.self) { i in
                                    Link(destination: NearClient.open(items[i].path)) { row(items[i]) }
                                }
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                        }
                    }
                } else {
                    ForEach(near.items.prefix(limit), id: \.self) { row($0) }
                }
                Spacer(minLength: 0)
                Text(near.updated, style: .time).font(.caption2).foregroundStyle(.tertiary)
            } else {
                Spacer()
                Image(systemName: "wifi.slash").font(.title3).foregroundStyle(.secondary).frame(maxWidth: .infinity)
                Spacer()
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .widgetURL(NearClient.open(entry.near?.items.first?.path ?? entry.near?.place?.path ?? "/"))
    }

    private func row(_ item: NearItem) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 6) {
            Image(systemName: NearStyle.icon(item.kind)).font(.caption).foregroundStyle(NearStyle.tint(item.kind)).frame(width: 14)
            VStack(alignment: .leading, spacing: 1) {
                Text(item.title).font(.caption.weight(.semibold)).foregroundStyle(.white).lineLimit(1)
                Text(item.detail).font(.caption2).foregroundStyle(.secondary).lineLimit(1)
            }
        }
    }

    private var lockScreen: some View {
        VStack(alignment: .leading, spacing: 1) {
            if let near = entry.near, let item = near.items.first {
                Label(item.title, systemImage: NearStyle.icon(item.kind)).font(.headline).lineLimit(1)
                Text(item.detail).font(.caption).lineLimit(1)
            } else {
                Label(entry.near?.empty ?? "TAKIP", systemImage: "checkmark.circle").font(.caption).lineLimit(2)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .widgetURL(NearClient.open(entry.near?.items.first?.path ?? "/"))
    }
}
