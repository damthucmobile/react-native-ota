module.exports = {
  dependency: {
    platforms: {
      android: {
        packageImportPath: 'import com.customota.OTAUpdaterPackage;',
        packageInstance: 'new OTAUpdaterPackage()'
      },
      ios: {}
    }
  }
};
