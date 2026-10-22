package expo.modules.routlyassist

import android.app.Activity
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.view.View
import android.view.ViewGroup
import java.lang.ref.WeakReference

/**
 * Close mode: the app is the default digital assistant (an ACTION_ASSIST activity), so a
 * power-button long-press starts MainActivity with ACTION_ASSIST. That launch is rewritten to
 * the routly://assist deep link, and only then may the activity show over the lock screen.
 *
 * Lock-screen mode (showWhenLocked + turnScreenOn) is on only for an ASSIST launch, behind a
 * plain cover until the /assist screen is on top (no other screen ever shows over the lock
 * screen). It goes off when JS leaves /assist, the screen turns off, the user leaves the app,
 * or /assist doesn't appear in time.
 */
object AssistLaunch {
  private const val ASSIST_URL = "routly://assist"
  /** Cold start (bundle, fonts, session restore) included. */
  private const val REVEAL_TIMEOUT_MS = 10_000L
  private const val COVER_COLOR = "#F7F9FC"

  private val main = Handler(Looper.getMainLooper())
  private var activityRef: WeakReference<Activity>? = null
  private var cover: View? = null
  private var screenOff: BroadcastReceiver? = null
  private val revealTimeout = Runnable { activityRef?.get()?.let { applyLockMode(it, false) } }

  fun attach(activity: Activity) {
    activityRef = WeakReference(activity)
  }

  val activity: Activity?
    get() = activityRef?.get()

  /** An ASSIST launch becomes routly://assist (React Native's Linking delivers it). */
  fun handle(activity: Activity, intent: Intent?) {
    if (intent?.action != Intent.ACTION_ASSIST) return
    intent.action = Intent.ACTION_VIEW
    intent.data = Uri.parse(ASSIST_URL)
    main.post { applyLockMode(activity, true) }
  }

  /** /assist is on screen: drop the cover. */
  fun reveal() {
    main.post {
      main.removeCallbacks(revealTimeout)
      removeCover()
    }
  }

  /** Leaving /assist (or any safety net): never usable over the lock screen again. */
  fun leave() {
    main.post { activity?.let { applyLockMode(it, false) } }
  }

  private fun applyLockMode(activity: Activity, on: Boolean) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      activity.setShowWhenLocked(on)
      activity.setTurnScreenOn(on)
    }
    main.removeCallbacks(revealTimeout)
    if (on) {
      addCover(activity)
      watchScreenOff(activity)
      main.postDelayed(revealTimeout, REVEAL_TIMEOUT_MS)
    } else {
      removeCover()
      stopWatchingScreenOff(activity)
    }
  }

  private fun addCover(activity: Activity) {
    if (cover != null) return
    val root = activity.window.decorView as? ViewGroup ?: return
    cover = View(activity).apply {
      setBackgroundColor(Color.parseColor(COVER_COLOR))
      isClickable = true
      elevation = 1000f
    }
    root.addView(
      cover,
      ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT),
    )
  }

  private fun removeCover() {
    cover?.let { (it.parent as? ViewGroup)?.removeView(it) }
    cover = null
  }

  private fun watchScreenOff(activity: Activity) {
    if (screenOff != null) return
    val receiver = object : BroadcastReceiver() {
      override fun onReceive(context: Context, intent: Intent) {
        AssistLaunch.activity?.let { applyLockMode(it, false) }
      }
    }
    val filter = IntentFilter(Intent.ACTION_SCREEN_OFF)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      activity.registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED)
    } else {
      activity.registerReceiver(receiver, filter)
    }
    screenOff = receiver
  }

  private fun stopWatchingScreenOff(activity: Activity) {
    screenOff?.let { runCatching { activity.unregisterReceiver(it) } }
    screenOff = null
  }
}
