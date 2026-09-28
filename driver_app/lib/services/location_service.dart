import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';
import 'api_service.dart';

class LocationService {
  static final LocationService _instance = LocationService._internal();
  factory LocationService() => _instance;
  LocationService._internal();

  Timer? _locationTimer;
  bool _isTracking = false;
  Position? _lastKnownPosition;

  Position? get lastKnownPosition => _lastKnownPosition;

  /// Start periodic GPS tracking when driver is ON DUTY
  Future<void> startTracking() async {
    if (_isTracking) return;

    try {
      bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        debugPrint('Location services are disabled.');
      }

      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied) {
          debugPrint('Location permissions are denied.');
          return;
        }
      }

      if (permission == LocationPermission.deniedForever) {
        debugPrint('Location permissions are permanently denied.');
        return;
      }

      _isTracking = true;

      // Send initial fix immediately
      _sendCurrentPosition();

      // Poll every 25 seconds while on duty
      _locationTimer?.cancel();
      _locationTimer = Timer.periodic(const Duration(seconds: 25), (timer) {
        final isDuty = ApiService.currentDriver?.onDuty ?? true;
        if (!isDuty) {
          stopTracking();
          return;
        }
        _sendCurrentPosition();
      });
    } catch (e) {
      debugPrint('LocationService start error: $e');
    }
  }

  Future<void> _sendCurrentPosition() async {
    try {
      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 10),
        ),
      );

      _lastKnownPosition = position;

      await ApiService.sendLocation(
        latitude: position.latitude,
        longitude: position.longitude,
        speed: position.speed,
        heading: position.heading,
        accuracy: position.accuracy,
      );
    } catch (e) {
      // Fallback to getLastKnownPosition if indoors
      try {
        final lastPos = await Geolocator.getLastKnownPosition();
        if (lastPos != null) {
          _lastKnownPosition = lastPos;
          await ApiService.sendLocation(
            latitude: lastPos.latitude,
            longitude: lastPos.longitude,
            speed: lastPos.speed,
            heading: lastPos.heading,
            accuracy: lastPos.accuracy,
          );
        }
      } catch (innerErr) {
        debugPrint('Location ping failed: $innerErr');
      }
    }
  }

  void stopTracking() {
    _isTracking = false;
    _locationTimer?.cancel();
    _locationTimer = null;
  }
}
