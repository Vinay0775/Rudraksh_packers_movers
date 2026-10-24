import 'dart:async';
import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_foreground_task/flutter_foreground_task.dart'
    hide NotificationVisibility;
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:vibration/vibration.dart';
import '../models/order_model.dart';

class AlertManager {
  static final AlertManager _instance = AlertManager._internal();
  factory AlertManager() => _instance;
  AlertManager._internal();

  final AudioPlayer _audioPlayer = AudioPlayer();
  final FlutterLocalNotificationsPlugin _notificationsPlugin =
      FlutterLocalNotificationsPlugin();

  bool _isPlaying = false;
  Timer? _vibrateTimer;
  String? _currentAlertParcelId;
  String? _silencedParcelId;

  static Function(String action, String? parcelId)? onActionCallback;

  // Incremented to v4 to reset Android system channel audio caching
  static const String channelId = 'rudraksha_rider_dispatch_v4';
  static const String channelName = 'Direct Order Dispatch & Audio Alerts';
  static const String channelDesc =
      'High-priority audio alerts and gentle vibration for assigned jobs';

  Future<void> init() async {
    try {
      const androidInit = AndroidInitializationSettings('@mipmap/ic_launcher');
      const initSettings = InitializationSettings(android: androidInit);

      await _notificationsPlugin.initialize(
        initSettings,
        onDidReceiveNotificationResponse: (NotificationResponse details) {
          debugPrint('Dispatch notification action: ${details.actionId}, payload: ${details.payload}');
          final pId = details.payload;
          if (details.actionId == 'silence_order') {
            muteSound(parcelId: pId);
            onActionCallback?.call('silent', pId);
          } else if (details.actionId == 'decline_order') {
            stopAlert(notifId: pId?.hashCode, parcelId: pId);
            onActionCallback?.call('decline', pId);
          } else if (details.actionId == 'accept_order') {
            stopAlert(notifId: pId?.hashCode, parcelId: pId);
            onActionCallback?.call('accept', pId);
            FlutterForegroundTask.launchApp();
          } else {
            // Tapping notification body mutes sound and brings app to foreground
            muteSound(parcelId: pId);
            FlutterForegroundTask.launchApp();
          }
        },
      );

      // Create Android Notification Channel with playSound: false
      // This prevents the Android OS from playing its default screeching siren simultaneously with our audio player!
      final androidChannel = AndroidNotificationChannel(
        channelId,
        channelName,
        description: channelDesc,
        importance: Importance.max,
        enableVibration: true,
        playSound: false,
        showBadge: true,
      );

      await _notificationsPlugin
          .resolvePlatformSpecificImplementation<
              AndroidFlutterLocalNotificationsPlugin>()
          ?.createNotificationChannel(androidChannel);

      // Configure Audio Player for clear speaker playback
      try {
        await _audioPlayer.setAudioContext(
          AudioContext(
            android: const AudioContextAndroid(
              isSpeakerphoneOn: true,
              stayAwake: true,
              contentType: AndroidContentType.music,
              usageType: AndroidUsageType.media,
              audioFocus: AndroidAudioFocus.gainTransientExclusive,
            ),
          ),
        );
      } catch (audioCtxErr) {
        debugPrint('AudioContext configuration warning: $audioCtxErr');
      }
    } catch (e) {
      debugPrint('AlertManager init error: $e');
    }
  }

  bool isParcelSilenced(String parcelId) {
    return _silencedParcelId == parcelId;
  }

  void clearSilencedParcel(String parcelId) {
    if (_silencedParcelId == parcelId) {
      _silencedParcelId = null;
    }
  }

  Future<void> triggerNewOrderAlert(OrderModel order) async {
    // If user explicitly silenced this order, do NOT re-trigger audio or vibration!
    if (_silencedParcelId == order.parcelId) return;

    if (_isPlaying) return; // Prevent duplicate overlapping alert loops
    _isPlaying = true;
    _currentAlertParcelId = order.parcelId;

    // Wake screen and display on lock screen immediately
    try {
      FlutterForegroundTask.wakeUpScreen();
      FlutterForegroundTask.setOnLockScreenVisibility(true);
    } catch (_) {}

    // 1. Play Soft Melodic Chime on loop until driver responds
    try {
      await _audioPlayer.setReleaseMode(ReleaseMode.loop);
      await _audioPlayer.setVolume(0.75);
      await _audioPlayer.play(AssetSource('siren.wav'));
    } catch (e) {
      debugPrint('Audio play error: $e');
    }

    // 2. Start Rhythmic, Gentle Vibration (500ms pulse, 1500ms pause)
    _startContinuousVibration();

    // 3. Fire Native Android Lock Screen Notification (Heads-Up Banner)
    try {
      final isDirect = order.isDirectAssignment;
      final title = isDirect
          ? '🔔 NAYA ORDER ASSIGN HUA! (₹${order.totalAmount.toInt()})'
          : '⚡ NAYA PARCEL ORDER AVAILABLE! (₹${order.totalAmount.toInt()})';
      final body =
          '📍 Pickup: ${order.pickupAddress}\n🏁 Drop: ${order.dropAddress}\nTap ACCEPT ya DECLINE karein!';

      final androidDetails = AndroidNotificationDetails(
        channelId,
        channelName,
        channelDescription: channelDesc,
        importance: Importance.max,
        priority: Priority.max,
        fullScreenIntent: true,
        enableVibration: true,
        playSound: false, // In-app AudioPlayer handles pleasant chime
        vibrationPattern: Int64List.fromList([0, 500, 1500, 500, 1500]),
        category: AndroidNotificationCategory.call,
        visibility: NotificationVisibility.public,
        ongoing: true,
        autoCancel: false,
        actions: const [
          AndroidNotificationAction(
            'silence_order',
            '🔇 SILENCE / MUTE',
            showsUserInterface: false,
            cancelNotification: false,
          ),
          AndroidNotificationAction(
            'accept_order',
            '✅ ACCEPT',
            showsUserInterface: true,
            cancelNotification: true,
          ),
          AndroidNotificationAction(
            'decline_order',
            '❌ DECLINE',
            showsUserInterface: false,
            cancelNotification: true,
          ),
        ],
      );

      final notifDetails = NotificationDetails(android: androidDetails);

      await _notificationsPlugin.show(
        order.parcelId.hashCode,
        title,
        body,
        notifDetails,
        payload: order.parcelId,
      );
    } catch (e) {
      debugPrint('Notification show error: $e');
    }
  }

  void _startContinuousVibration() {
    _vibrateTimer?.cancel();
    _triggerVibrateOnce();

    _vibrateTimer = Timer.periodic(const Duration(milliseconds: 2500), (timer) {
      if (!_isPlaying) {
        timer.cancel();
        return;
      }
      _triggerVibrateOnce();
    });
  }

  void _triggerVibrateOnce() async {
    try {
      final hasVibrator = await Vibration.hasVibrator();
      if (hasVibrator == true) {
        Vibration.vibrate(
          pattern: [0, 500, 1500, 500, 1500],
          intensities: [0, 200, 0, 200, 0],
        );
      }
    } catch (e) {
      debugPrint('Vibration error: $e');
    }
  }

  /// Instantly stops audio and vibration without dismissing the order
  Future<void> muteSound({String? parcelId}) async {
    _isPlaying = false;
    final targetId = parcelId ?? _currentAlertParcelId;
    if (targetId != null) {
      _silencedParcelId = targetId;
    }
    _vibrateTimer?.cancel();
    _vibrateTimer = null;
    try {
      await _audioPlayer.stop();
    } catch (e) {
      debugPrint('Audio stop error: $e');
    }
    try {
      await Vibration.cancel();
    } catch (e) {
      debugPrint('Vibration cancel error: $e');
    }
  }

  /// Completely stops alert and dismisses notification
  Future<void> stopAlert({int? notifId, String? parcelId}) async {
    await muteSound(parcelId: parcelId);
    if (parcelId != null) {
      clearSilencedParcel(parcelId);
    }
    try {
      if (notifId != null) {
        await _notificationsPlugin.cancel(notifId);
      } else {
        await _notificationsPlugin.cancelAll();
      }
    } catch (e) {
      debugPrint('Notification cancel error: $e');
    }
  }
}
