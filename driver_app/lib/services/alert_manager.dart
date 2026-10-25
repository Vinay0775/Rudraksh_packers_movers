import 'dart:async';
import 'dart:convert';
import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_foreground_task/flutter_foreground_task.dart'
    hide NotificationVisibility;
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:vibration/vibration.dart';
import '../models/order_model.dart';

@pragma('vm:entry-point')
void notificationTapBackground(NotificationResponse details) async {
  debugPrint('[AlertManager Background] Action: ${details.actionId}, payload: ${details.payload}');
  final parcelId = details.payload;
  final action = details.actionId;

  if (action == 'silence_order') {
    await AlertManager().muteSound(parcelId: parcelId);
  } else if (action == 'decline_order') {
    await AlertManager().stopAlert(notifId: parcelId?.hashCode, parcelId: parcelId);
    if (parcelId != null) {
      try {
        final prefs = await SharedPreferences.getInstance();
        final token = prefs.getString('rudraksha_driver_token');
        final baseUrl = prefs.getString('rudraksha_api_base_url') ??
            'https://rudraksha-packers-movers.onrender.com/api';
        await http.post(
          Uri.parse('$baseUrl/rider/jobs/$parcelId/decline'),
          headers: {
            'Content-Type': 'application/json',
            if (token != null) 'Authorization': 'Bearer $token',
          },
          body: jsonEncode({'reason': 'Driver declined via lockscreen notification'}),
        );
        final list = prefs.getStringList('rudraksha_driver_declined_parcels') ?? [];
        if (!list.contains(parcelId)) {
          list.add(parcelId);
          await prefs.setStringList('rudraksha_driver_declined_parcels', list);
        }
      } catch (e) {
        debugPrint('Background decline error: $e');
      }
    }
  } else if (action == 'accept_order') {
    await AlertManager().stopAlert(notifId: parcelId?.hashCode, parcelId: parcelId);
    if (parcelId != null) {
      try {
        final prefs = await SharedPreferences.getInstance();
        final token = prefs.getString('rudraksha_driver_token');
        final baseUrl = prefs.getString('rudraksha_api_base_url') ??
            'https://rudraksha-packers-movers.onrender.com/api';
        await http.post(
          Uri.parse('$baseUrl/rider/jobs/$parcelId/accept'),
          headers: {
            'Content-Type': 'application/json',
            if (token != null) 'Authorization': 'Bearer $token',
          },
        );
      } catch (e) {
        debugPrint('Background accept error: $e');
      }
    }
    FlutterForegroundTask.launchApp();
  } else {
    // Tapping notification body
    await AlertManager().muteSound(parcelId: parcelId);
    FlutterForegroundTask.launchApp();
  }
}

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

  // v7 Channel with native chime sound from res/raw/siren.wav and Max Importance
  static const String channelId = 'rudraksha_rider_dispatch_v7';
  static const String channelName = 'Direct Order Dispatch & Chime Alerts';
  static const String channelDesc =
      'High-priority sound alerts and lock screen popups for assigned jobs';

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
        onDidReceiveBackgroundNotificationResponse: notificationTapBackground,
      );

      // Create Android Notification Channel with native chime sound and max importance
      const soundResource = RawResourceAndroidNotificationSound('siren');
      final androidChannel = AndroidNotificationChannel(
        channelId,
        channelName,
        description: channelDesc,
        importance: Importance.max,
        enableVibration: true,
        playSound: true,
        sound: soundResource,
        showBadge: true,
      );

      await _notificationsPlugin
          .resolvePlatformSpecificImplementation<
              AndroidFlutterLocalNotificationsPlugin>()
          ?.createNotificationChannel(androidChannel);

      // Configure Audio Player for in-app backup playback
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

    // 1. Play Soft Melodic Chime on loop in background/foreground
    try {
      await _audioPlayer.setReleaseMode(ReleaseMode.loop);
      await _audioPlayer.setVolume(0.85);
      await _audioPlayer.play(AssetSource('siren.wav'));
    } catch (e) {
      debugPrint('Audio play error: $e');
    }

    // 2. Start Rhythmic, Gentle Vibration (500ms pulse, 1500ms pause)
    _startContinuousVibration();

    // 3. Fire Native Android Lock Screen Heads-Up Pop-up Notification with FullScreenIntent
    try {
      final isDirect = order.isDirectAssignment;
      final title = isDirect
          ? '🔔 NAYA ORDER ASSIGN HUA! (₹${order.totalAmount.toInt()})'
          : '⚡ NAYA PARCEL ORDER AVAILABLE! (₹${order.totalAmount.toInt()})';
      final body =
          '📍 Pickup: ${order.pickupAddress}\n🏁 Drop: ${order.dropAddress}\nTap ACCEPT ya DECLINE karein!';

      const soundResource = RawResourceAndroidNotificationSound('siren');
      final androidDetails = AndroidNotificationDetails(
        channelId,
        channelName,
        channelDescription: channelDesc,
        importance: Importance.max,
        priority: Priority.max,
        fullScreenIntent: true,
        enableVibration: true,
        playSound: true,
        sound: soundResource,
        vibrationPattern: Int64List.fromList([0, 500, 1000, 500, 1000]),
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
          pattern: [0, 500, 1000, 500, 1000],
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
    } catch (_) {}
    try {
      await Vibration.cancel();
    } catch (_) {}

    // Re-issue silent notification so sound immediately stops while keeping order visible
    if (targetId != null) {
      try {
        final silentDetails = AndroidNotificationDetails(
          'rudraksha_rider_silent_v1',
          'Muted Orders',
          channelDescription: 'Notifications for muted orders',
          importance: Importance.high,
          priority: Priority.high,
          playSound: false,
          enableVibration: false,
          ongoing: true,
          autoCancel: false,
          actions: const [
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
        await _notificationsPlugin.show(
          targetId.hashCode,
          '🔔 Order Assigned (Sound Muted)',
          'Tap ACCEPT to start trip or DECLINE to skip',
          NotificationDetails(android: silentDetails),
          payload: targetId,
        );
      } catch (_) {}
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
