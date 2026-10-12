package com.otademoapp

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.customota.CustomOTABundleResolver

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    val otaBundle = CustomOTABundleResolver.getBundleFile(applicationContext)

    getDefaultReactHost(
      context = applicationContext,
      packageList = PackageList(this).packages,
      jsBundleFilePath = otaBundle,
      useDevSupport = otaBundle == null && BuildConfig.DEBUG
    )
  }

  override fun onCreate() {
    super.onCreate()
    loadReactNative(this)
  }
}
