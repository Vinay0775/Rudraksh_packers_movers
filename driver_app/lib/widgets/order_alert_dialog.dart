import 'dart:async';
import 'package:flutter/material.dart';
import '../models/order_model.dart';
import '../services/alert_manager.dart';

class OrderAlertDialog extends StatefulWidget {
  final OrderModel order;
  final VoidCallback onAccept;

  const OrderAlertDialog({
    super.key,
    required this.order,
    required this.onAccept,
  });

  @override
  State<OrderAlertDialog> createState() => _OrderAlertDialogState();
}

class _OrderAlertDialogState extends State<OrderAlertDialog>
    with SingleTickerProviderStateMixin {
  int _secondsLeft = 45;
  Timer? _timer;
  late AnimationController _animController;
  late Animation<double> _pulseAnimation;

  @override
  void initState() {
    super.initState();

    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 700),
    )..repeat(reverse: true);

    _pulseAnimation = Tween<double>(begin: 0.95, end: 1.08).animate(
      CurvedAnimation(parent: _animController, curve: Curves.easeInOut),
    );

    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_secondsLeft <= 1) {
        timer.cancel();
        _dismissAlert();
      } else {
        setState(() {
          _secondsLeft--;
        });
      }
    });
  }

  void _dismissAlert() {
    AlertManager().stopAlert();
    if (mounted) {
      Navigator.of(context, rootNavigator: true).pop();
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    _animController.dispose();
    AlertManager().stopAlert();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDirect = widget.order.isDirectAssignment;
    final fare = widget.order.totalAmount.toInt();

    return Dialog(
      backgroundColor: Colors.transparent,
      insetPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
      child: Container(
        constraints: const BoxConstraints(maxWidth: 420),
        decoration: BoxDecoration(
          color: const Color(0xFF0F172A), // Dark slate
          borderRadius: BorderRadius.circular(24),
          border: Border.all(
            color: isDirect ? const Color(0xFFEF4444) : const Color(0xFFF97316),
            width: 2.5,
          ),
          boxShadow: [
            BoxShadow(
              color: (isDirect ? Colors.red : Colors.orange).withValues(alpha: 0.4),
              blurRadius: 30,
              spreadRadius: 4,
            ),
          ],
        ),
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // 1. Siren Icon & Pulse
              ScaleTransition(
                scale: _pulseAnimation,
                child: Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: isDirect
                        ? Colors.red.withValues(alpha: 0.2)
                        : Colors.orange.withValues(alpha: 0.2),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    isDirect ? Icons.warning_rounded : Icons.flash_on_rounded,
                    color: isDirect ? const Color(0xFFEF4444) : const Color(0xFFF97316),
                    size: 42,
                  ),
                ),
              ),

              const SizedBox(height: 12),

              // 2. Urgent Badge
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                decoration: BoxDecoration(
                  color: isDirect
                      ? Colors.red.withValues(alpha: 0.15)
                      : Colors.orange.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                    color: isDirect
                        ? Colors.red.withValues(alpha: 0.5)
                        : Colors.orange.withValues(alpha: 0.5),
                  ),
                ),
                child: Text(
                  isDirect
                      ? '🚨 ADMIN DISPATCH DIRECT ORDER'
                      : '⚡ NAYA PARCEL DELIVERY JOB',
                  style: TextStyle(
                    color: isDirect ? const Color(0xFFEF4444) : const Color(0xFFF97316),
                    fontWeight: FontWeight.bold,
                    fontSize: 12,
                    letterSpacing: 0.5,
                  ),
                ),
              ),

              const SizedBox(height: 8),

              Text(
                'ORDER: ${widget.order.parcelId}',
                style: const TextStyle(
                  color: Colors.white70,
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                ),
              ),

              const SizedBox(height: 14),

              // 3. Earning / Fare Highlight
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFF1E293B), Color(0xFF0F172A)],
                  ),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: Colors.white12),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Aapki Kamai (Fare)',
                          style: TextStyle(color: Colors.white54, fontSize: 11),
                        ),
                        Text(
                          '100% Cash/UPI Aapka',
                          style: TextStyle(
                            color: Color(0xFF22C55E),
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                    Text(
                      '₹$fare',
                      style: const TextStyle(
                        color: Color(0xFF22C55E),
                        fontSize: 32,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 16),

              // 4. Pickup & Drop Addresses
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.04),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Column(
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Icon(Icons.arrow_upward_rounded,
                            color: Color(0xFF38BDF8), size: 18),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text('PICKUP',
                                  style: TextStyle(
                                      color: Colors.white38,
                                      fontSize: 10,
                                      fontWeight: FontWeight.bold)),
                              Text(widget.order.pickupAddress,
                                  style: const TextStyle(
                                      color: Colors.white,
                                      fontSize: 12,
                                      fontWeight: FontWeight.w600)),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const Divider(color: Colors.white12, height: 16),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Icon(Icons.location_on_rounded,
                            color: Color(0xFF22C55E), size: 18),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text('DROP',
                                  style: TextStyle(
                                      color: Colors.white38,
                                      fontSize: 10,
                                      fontWeight: FontWeight.bold)),
                              Text(widget.order.dropAddress,
                                  style: const TextStyle(
                                      color: Colors.white,
                                      fontSize: 12,
                                      fontWeight: FontWeight.w600)),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 16),

              // 5. 45-Second Countdown Progress Bar
              Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'Auto-dismiss in:',
                        style: TextStyle(color: Colors.white54, fontSize: 11),
                      ),
                      Text(
                        '$_secondsLeft seconds',
                        style: const TextStyle(
                          color: Colors.orangeAccent,
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(6),
                    child: LinearProgressIndicator(
                      value: _secondsLeft / 45,
                      minHeight: 6,
                      backgroundColor: Colors.white10,
                      valueColor: AlwaysStoppedAnimation<Color>(
                        _secondsLeft > 15 ? Colors.orange : Colors.red,
                      ),
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 20),

              // 6. Action Buttons
              Row(
                children: [
                  Expanded(
                    flex: 1,
                    child: OutlinedButton(
                      onPressed: _dismissAlert,
                      style: OutlinedButton.styleFrom(
                        foregroundColor: Colors.white60,
                        side: const BorderSide(color: Colors.white24),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                      ),
                      child: const Text('Silence'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    flex: 2,
                    child: ElevatedButton(
                      onPressed: () {
                        AlertManager().stopAlert();
                        Navigator.of(context, rootNavigator: true).pop();
                        widget.onAccept();
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF22C55E),
                        foregroundColor: Colors.black,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        elevation: 4,
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(isDirect
                              ? Icons.navigation_rounded
                              : Icons.check_circle_rounded),
                          const SizedBox(width: 6),
                          Text(
                            isDirect ? 'START ROUTE' : 'ACCEPT ORDER',
                            style: const TextStyle(
                              fontWeight: FontWeight.w900,
                              fontSize: 14,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
