package expo.modules.routlyassist

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.os.Bundle
import expo.modules.core.interfaces.Package
import expo.modules.core.interfaces.ReactActivityLifecycleListener

/** Sees MainActivity's launches before React Native does (cold start and onNewIntent). */
class RoutlyAssistPackage : Package {
  override fun createReactActivityLifecycleListeners(
    activityContext: Context?,
  ): List<ReactActivityLifecycleListener> = listOf(AssistLifecycleListener())
}

private class AssistLifecycleListener : ReactActivityLifecycleListener {
  override fun onCreate(activity: Activity, savedInstanceState: Bundle?) {
    AssistLaunch.attach(activity)
    AssistLaunch.handle(activity, activity.intent)
  }

  override fun onNewIntent(intent: Intent?): Boolean {
    AssistLaunch.activity?.let { AssistLaunch.handle(it, intent) }
    return false
  }

  /** Home / recents: the app must not stay over the lock screen. */
  override fun onUserLeaveHint(activity: Activity) {
    AssistLaunch.leave()
  }

  override fun onDestroy(activity: Activity) {
    AssistLaunch.leave()
  }
}
