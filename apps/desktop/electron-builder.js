// Signing and notarisation turn on from the environment (CSC_LINK, APPLE_ID…, WIN_CSC_LINK); without them builds are unsigned.
// package.json's empty "workspaces" stops the builder walking up to the repo root's package.json, whose dependencies a CI job here never installs.
const signed = Boolean(process.env.CSC_LINK || process.env.CSC_NAME);

const config = {
  appId: 'dev.takip.desktop',
  productName: 'TAKIP',
  copyright: 'Copyright © 2026 TAKIP',
  directories: { output: 'dist', buildResources: 'build' },
  // No runtime dependencies; without the exclusion the builder walks up and packs the repo root's node_modules.
  files: ['main.mjs', 'links.mjs', 'menu.mjs', 'window-state.mjs', 'smoke.mjs', 'offline/**', 'package.json', '!**/node_modules/**'],
  npmRebuild: false,
  protocols: [{ name: 'TAKIP', schemes: ['dev.takip.app'] }],
  publish: null,

  mac: {
    // One build per chip: a universal one carries both and is twice the download.
    target: [{ target: 'dmg', arch: ['arm64', 'x64'] }],
    category: 'public.app-category.news',
    icon: 'build/icon.icns',
    artifactName: 'TAKIP-${version}-mac-${arch}.${ext}',
    // Ad hoc when there is no certificate: Apple silicon calls an unsigned download "damaged".
    identity: signed ? undefined : '-',
    hardenedRuntime: true,
    entitlements: 'resources/entitlements.mac.plist',
    entitlementsInherit: 'resources/entitlements.mac.plist',
    darkModeSupport: true,
    extendInfo: {
      NSMicrophoneUsageDescription: 'TI listens when you talk to it.',
      NSLocationUsageDescription: 'TAKIP opens the map where you are when you ask it to.',
      NSLocationWhenInUseUsageDescription: 'TAKIP opens the map where you are when you ask it to.',
    },
  },
  dmg: { artifactName: 'TAKIP-${version}-mac-${arch}.${ext}' },

  win: {
    target: [{ target: 'nsis', arch: ['x64'] }],
    icon: 'build/icon.ico',
    artifactName: 'TAKIP-${version}-win-${arch}.${ext}',
  },
  nsis: {
    oneClick: true,
    perMachine: false,
    shortcutName: 'TAKIP',
    artifactName: 'TAKIP-${version}-win-${arch}.${ext}',
  },

  linux: {
    target: [{ target: 'AppImage', arch: ['x64'] }, { target: 'deb', arch: ['x64'] }],
    icon: 'build/icons',
    category: 'Network;News',
    synopsis: 'A live map of public data',
    description: 'Flights, ships, cameras, hazards, weather, news and space on one live map.',
    maintainer: 'TAKIP <hello@takip.dev>',
    vendor: 'TAKIP',
    executableName: 'takip',
    artifactName: 'TAKIP-${version}-linux-${arch}.${ext}',
    syncDesktopName: true,
  },
};

export default config;
