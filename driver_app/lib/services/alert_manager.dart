import 'dart:async';
import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/foundation.dart';
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

  Future<void> init() async {
    try {
      const androidInit =
          AndroidInitializationSettings('@mipmap/ic_launcher');
      const initSettings = InitializationSettings(android: androidInit);

      await _notificationsPlugin.initialize(
        initSettings,
        onDidReceiveNotificationResponse: (details) {
          // Tapped notification
          debugPrint('Notification clicked: ${details.payload}');
        },
      );

      // Create Android Notification Channel with MAX importance & sound
      const androidChannel = AndroidNotificationChannel(
        'rudraksha_rider_orders',
        'Order Dispatch Alerts',
        description: 'Piercing Siren & Vibrations for New Parcel Bookings',
        importance: Importance.max,
        enableVibration: true,
        playSound: true,
      );

      await _notificationsPlugin
          .resolvePlatformSpecificImplementation<
              AndroidFlutterLocalNotificationsPlugin>()
          ?.createNotificationChannel(androidChannel);
    } catch (e) {
      debugPrint('AlertManager init error: $e');
    }
  }

  Future<void> triggerNewOrderAlert(OrderModel order) async {
    _isPlaying = true;

    // 1. Play Siren Tone in Loop
    try {
      await _audioPlayer.setReleaseMode(ReleaseMode.loop);
      await _audioPlayer.setVolume(1.0);
      await _audioPlayer.play(AssetSource('siren.wav'));
    } catch (e) {
      debugPrint('Audio play error: $e');
    }

    // 2. Start Heavy Mobile Vibration Pattern
    _startContinuousVibration();

    // 3. Fire Native Android Lock Screen Notification
    try {
      final isDirect = order.isDirectAssignment;
      final title = isDirect
          ? '🚨 NAYA ORDER ASSIGN HUA! (Kamai ₹${order.totalAmount.toInt()})'
          : '⚡ NAYA PARCEL ORDER! (Kamai ₹${order.totalAmount.toInt()})';
      final body =
          '📍 Pickup: ${order.pickupAddress}\n🏁 Drop: ${order.dropAddress}\nTap karke app me accept karein!';

      final androidDetails = AndroidNotificationDetails(
        'rudraksha_rider_orders',
        'Order Dispatch Alerts',
        channelDescription:
            'Piercing Siren & Vibrations for New Parcel Bookings',
        importance: Importance.max,
        priority: Priority.max,
        fullScreenIntent: true,
        enableVibration: true,
        vibrationPattern: Int64List.fromList([600, 200, 600, 200, 800]),
        category: AndroidNotificationCategory.call,
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

    _vibrateTimer = Timer.periodic(const Duration(milliseconds: 2400), (timer) {
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
          pattern: [0, 600, 200, 600, 200, 800],
          intensities: [0, 255, 0, 255, 0, 255],
        );
      }
    } catch (e) {
      debugPrint('Vibration error: $e');
    }
  }

  Future<void> stopAlert() async {
    _isPlaying = false;
    _vibrateTimer?.cancel();
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
}
