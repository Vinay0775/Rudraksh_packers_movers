import 'package:flutter/material.dart';
import '../services/api_service.dart';

class OtpDialog extends StatefulWidget {
  final String parcelId;
  final String mode; // 'pickup' or 'delivery'
  final VoidCallback onSuccess;

  const OtpDialog({
    super.key,
    required this.parcelId,
    required this.mode,
    required this.onSuccess,
  });

  @override
  State<OtpDialog> createState() => _OtpDialogState();
}

class _OtpDialogState extends State<OtpDialog> {
  final TextEditingController _otpController = TextEditingController();
  bool _isLoading = false;
  String? _error;

  Future<void> _submitOtp() async {
    final otp = _otpController.text.trim();
    if (otp.length < 4) {
      setState(() => _error = 'Kripya 4-digit OTP darj karein');
      return;
    }

    setState(() {
      _isLoading = true;
      _error = null;
    });

    final res = widget.mode == 'pickup'
        ? await ApiService.verifyPickupOtp(widget.parcelId, otp)
        : await ApiService.verifyDeliveryOtp(widget.parcelId, otp);

    setState(() => _isLoading = false);

    if (res['success'] == true) {
      if (mounted) {
        Navigator.pop(context);
        widget.onSuccess();
      }
    } else {
      setState(() {
        _error = res['error'] ?? 'Galat PIN! Customer se sahi PIN maangein.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final isPickup = widget.mode == 'pickup';

    return Dialog(
      backgroundColor: const Color(0xFF0F172A),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
        side: BorderSide(
          color: isPickup ? const Color(0xFFF97316) : const Color(0xFF22C55E),
          width: 2,
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              isPickup ? Icons.key_rounded : Icons.check_circle_rounded,
              color: isPickup ? const Color(0xFFF97316) : const Color(0xFF22C55E),
              size: 44,
            ),
            const SizedBox(height: 12),
            Text(
              isPickup ? 'Enter Customer Pickup PIN' : 'Enter Delivery PIN',
              style: const TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.bold,
                fontSize: 16,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              isPickup
                  ? 'Sender se 4-digit pickup code lekar enter karein'
                  : 'Receiver se 4-digit delivery code lekar trip complete karein',
              textAlign: TextAlign.center,
              style: const TextStyle(color: Colors.white60, fontSize: 12),
            ),
            const SizedBox(height: 18),
            TextField(
              controller: _otpController,
              keyboardType: TextInputType.number,
              maxLength: 6,
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 26,
                fontWeight: FontWeight.w900,
                letterSpacing: 8,
              ),
              decoration: InputDecoration(
                counterText: '',
                hintText: '• • • •',
                hintStyle: const TextStyle(color: Colors.white24, letterSpacing: 8),
                filled: true,
                fillColor: Colors.white.withValues(alpha: 0.06),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(14),
                  borderSide: BorderSide(color: Colors.white.withValues(alpha: 0.2)),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(14),
                  borderSide: BorderSide(
                    color: isPickup ? const Color(0xFFF97316) : const Color(0xFF22C55E),
                    width: 2,
                  ),
                ),
              ),
            ),
            if (_error != null) ...[
              const SizedBox(height: 8),
              Text(
                _error!,
                style: const TextStyle(color: Colors.redAccent, fontSize: 12),
              ),
            ],
            const SizedBox(height: 20),
            Row(
              children: [
                Expanded(
                  child: TextButton(
                    onPressed: () => Navigator.pop(context),
                    child: const Text('Cancel', style: TextStyle(color: Colors.white54)),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  flex: 2,
                  child: ElevatedButton(
                    onPressed: _isLoading ? null : _submitOtp,
                    style: ElevatedButton.styleFrom(
                      backgroundColor:
                          isPickup ? const Color(0xFFF97316) : const Color(0xFF22C55E),
                      foregroundColor: isPickup ? Colors.white : Colors.black,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    child: _isLoading
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : Text(
                            isPickup ? 'VERIFY PICKUP' : 'COMPLETE TRIP',
                            style: const TextStyle(fontWeight: FontWeight.bold),
                          ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
