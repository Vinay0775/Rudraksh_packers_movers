import 'package:flutter/material.dart';
import 'package:permission_handler/permission_handler.dart';

class PermissionService {
  static Future<void> checkAndRequestAllPermissions(BuildContext context) async {
    // 1. Notification Permission (Critical for Siren & Lock screen alert)
    final notifStatus = await Permission.notification.status;
    if (!notifStatus.isGranted) {
      await Permission.notification.request();
    }

    // 2. Location Permission (For GPS routing & Google Maps)
    final locStatus = await Permission.locationWhenInUse.status;
    if (!locStatus.isGranted) {
      await Permission.locationWhenInUse.request();
    }

    // 3. Phone Call Permission (For calling customer)
    final phoneStatus = await Permission.phone.status;
    if (!phoneStatus.isGranted) {
      await Permission.phone.request();
    }

    // 4. Ignore Battery Optimizations (MIUI / Redmi / Android battery saver bypass)
    final batteryStatus = await Permission.ignoreBatteryOptimizations.status;
    if (!batteryStatus.isGranted) {
      await Permission.ignoreBatteryOptimizations.request();
    }

    // 5. System Alert Window (Floating over other apps)
    final alertWindowStatus = await Permission.systemAlertWindow.status;
    if (!alertWindowStatus.isGranted) {
      // Prompt user politely if not yet granted
      if (context.mounted) {
        showDialog(
          context: context,
          builder: (ctx) => AlertDialog(
            backgroundColor: const Color(0xFF0F172A),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(18),
              side: const BorderSide(color: Color(0xFF22C55E), width: 1.5),
            ),
            title: const Row(
              children: [
                Icon(Icons.layers, color: Color(0xFF22C55E)),
                SizedBox(width: 8),
                Text('Floating Alert Permission',
                    style: TextStyle(color: Colors.white, fontSize: 16)),
              ],
            ),
            content: const Text(
              'Jab aap phone par doosra app chala rahe hon ya map dekh rahe hon, tab naya order aane par floating siren popup dikhane ke liye "Display over other apps" allow karein.',
              style: TextStyle(color: Colors.white70, fontSize: 13),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: const Text('Baad Mein', style: TextStyle(color: Colors.white38)),
              ),
              ElevatedButton(
                onPressed: () async {
                  Navigator.pop(ctx);
                  await Permission.systemAlertWindow.request();
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF22C55E),
                  foregroundColor: Colors.black,
                ),
                child: const Text('Allow Permission',
                    style: TextStyle(fontWeight: FontWeight.bold)),
              ),
            ],
          ),
        );
      }
    }
  }
}
