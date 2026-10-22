package expo.modules.routlyassist

import android.app.KeyguardManager
import android.content.Context
import expo.modules.kotlin.Promise
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/** JS side of close mode: reveal /assist, leave lock-screen mode, unlock before opening the app. */
class RoutlyAssistModule : Module() {
  private val keyguard: KeyguardManager?
    get() = appContext.reactContext?.getSystemService(Context.KEYGUARD_SERVICE) as? KeyguardManager

  override fun definition() = ModuleDefinition {
    Name("RoutlyAssist")

    Function("isLocked") { keyguard?.isKeyguardLocked ?: false }

    Function("revealAssist") { AssistLaunch.reveal() }

    Function("leaveAssist") { AssistLaunch.leave() }

    /** Close the overlay: back to whatever was behind it. */
    Function("dismissAssist") { AssistLaunch.dismiss() }

    /** True when /assist is shown as a translucent overlay (else draw an opaque screen). */
    Function("isOverlay") { AssistLaunch.isOverlay }

    /** Resolves true once unlocked (or not locked), false if the user cancelled. */
    AsyncFunction("dismissKeyguard") { promise: Promise ->
      val activity = appContext.currentActivity
      val km = keyguard
      if (activity == null || km == null || !km.isKeyguardLocked) {
        promise.resolve(km?.isKeyguardLocked != true)
        return@AsyncFunction
      }
      km.requestDismissKeyguard(
        activity,
        object : KeyguardManager.KeyguardDismissCallback() {
          override fun onDismissSucceeded() = promise.resolve(true)

          override fun onDismissCancelled() = promise.resolve(false)

          override fun onDismissError() = promise.resolve(false)
        },
      )
    }.runOnQueue(Queues.MAIN)
  }
}
