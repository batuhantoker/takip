# Adds the TAKIPWidget extension (ios/App/TAKIPWidget) to the Xcode project and embeds it in the app. Run once,
# or again after `cap add ios` recreates the project: /opt/homebrew/opt/ruby/bin/ruby tools/add-widget.rb
# (needs `gem install xcodeproj`). Does nothing when the target is already there.
require 'xcodeproj'

project = Xcodeproj::Project.open(File.join(__dir__, '../ios/App/App.xcodeproj'))
exit 0 if project.targets.any? { |t| t.name == 'TAKIPWidget' }

app = project.targets.find { |t| t.name == 'App' }
widget = project.new_target(:app_extension, 'TAKIPWidget', :ios, '17.0', nil, :swift)

group = project.main_group.new_group('TAKIPWidget', 'TAKIPWidget')
sources = Dir[File.join(__dir__, '../ios/App/TAKIPWidget/*.swift')].sort.map { |f| group.new_reference(File.basename(f)) }
group.new_reference('Info.plist')
widget.add_file_references(sources)

widget.build_configurations.each do |config|
  s = config.build_settings
  s['PRODUCT_BUNDLE_IDENTIFIER'] = 'dev.takip.app.widget'
  s['PRODUCT_NAME'] = '$(TARGET_NAME)'
  s['INFOPLIST_FILE'] = 'TAKIPWidget/Info.plist'
  s['GENERATE_INFOPLIST_FILE'] = 'NO'
  s['SWIFT_VERSION'] = '5.0'
  s['TARGETED_DEVICE_FAMILY'] = '1,2'
  s['IPHONEOS_DEPLOYMENT_TARGET'] = '17.0'
  s['CODE_SIGN_STYLE'] = 'Automatic'
  s['SKIP_INSTALL'] = 'YES'
  s['LD_RUNPATH_SEARCH_PATHS'] = ['$(inherited)', '@executable_path/Frameworks', '@executable_path/../../Frameworks']
  # Kept equal to the app's by tools/sync-native.mjs; the App Store refuses an extension whose version differs.
  s['MARKETING_VERSION'] = '1.0.0'
  s['CURRENT_PROJECT_VERSION'] = '10000'
end

app.add_dependency(widget)
embed = app.copy_files_build_phases.find { |p| p.name == 'Embed Foundation Extensions' } ||
        app.new_copy_files_build_phase('Embed Foundation Extensions')
embed.symbol_dst_subfolder_spec = :plug_ins
embed.add_file_reference(widget.product_reference, true).settings = { 'ATTRIBUTES' => ['RemoveHeadersOnCopy'] }

project.save
puts 'TAKIPWidget added'
