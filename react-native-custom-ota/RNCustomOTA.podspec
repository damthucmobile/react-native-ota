require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "RNCustomOTA"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = "https://github.com/custom-ota/react-native-custom-ota"
  s.license      = package["license"]
  s.authors      = package["author"]
  s.platforms    = { :ios => "13.4" }
  s.source       = { :git => "https://github.com/custom-ota/react-native-custom-ota.git", :tag => "#{s.version}" }

  s.source_files = "ios/**/*.{h,m,mm,swift}"
  s.requires_arc = true

  s.dependency "React-Core"
  s.dependency "SSZipArchive"
  s.libraries = "z"
end
