import 'dart:async';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../config/api_config.dart';
import '../models/order_model.dart';
import '../services/alert_manager.dart';
import '../services/api_service.dart';
import '../widgets/order_alert_dialog.dart';
import '../widgets/otp_dialog.dart';
import '../services/permission_service.dart';
import 'login_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _currentTab = 0;
  Timer? _pollingTimer;

  bool _isLoading = false;
  OrderModel? _activeTrip;
  List<OrderModel> _availableJobs = [];
  final Set<String> _seenJobIds = {};
  String? _lastSeenActiveTripId;
  bool _isFirstSyncDone = false;

  // Earnings Data
  Map<String, dynamic>? _earningsData;

  @override
  void initState() {
    super.initState();
    _loadInitialData();
    _startBackgroundPolling();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      PermissionService.checkAndRequestAllPermissions(context);
    });
  }

  @override
  void dispose() {
    _pollingTimer?.cancel();
    super.dispose();
  }

  void _loadInitialData() async {
    setState(() => _isLoading = true);
    await _syncFeed();
    await _loadEarnings();
    setState(() => _isLoading = false);
  }

  void _startBackgroundPolling() {
    _pollingTimer?.cancel();
    _pollingTimer = Timer.periodic(const Duration(seconds: 7), (timer) {
      final isDuty = ApiService.currentDriver?.onDuty ?? true;
      if (isDuty) {
        _syncFeed();
      }
    });
  }

  Future<void> _syncFeed() async {
    final res = await ApiService.fetchFeed();
    if (!res['success'] || !mounted) return;

    final OrderModel? active = res['activeTrip'];
    final List<OrderModel> available = res['availableJobs'] ?? [];

    // Detect New Orders & Trigger Urgent Siren Alert
    if (!_isFirstSyncDone) {
      for (var job in available) {
        _seenJobIds.add(job.parcelId);
      }
      if (active != null) {
        _lastSeenActiveTripId = active.parcelId;
      }
      _isFirstSyncDone = true;
    } else {
      // 1. Direct Admin Assignment Detection
      if (active != null) {
        final isAssigned = active.bookingStatus == 'driver_assigned' ||
            active.bookingStatus == 'received';
        if (isAssigned && (_lastSeenActiveTripId != active.parcelId)) {
          _lastSeenActiveTripId = active.parcelId;
          active.isDirectAssignment = true;
          _triggerOrderAlert(active);
        }
      } else {
        _lastSeenActiveTripId = null;
      }

      // 2. Open Available Pool Jobs Detection
      final isDuty = ApiService.currentDriver?.onDuty ?? true;
      if (isDuty && active == null) {
        final newJobs =
            available.where((j) => !_seenJobIds.contains(j.parcelId)).toList();
        if (newJobs.isNotEmpty) {
          final latest = newJobs.first;
          for (var j in newJobs) {
            _seenJobIds.add(j.parcelId);
          }
          latest.isDirectAssignment = false;
          _triggerOrderAlert(latest);
        }
      } else {
        for (var j in available) {
          _seenJobIds.add(j.parcelId);
        }
      }
    }

    setState(() {
      _activeTrip = active;
      _availableJobs = available;
    });
  }

  Future<void> _loadEarnings() async {
    final data = await ApiService.fetchEarnings();
    if (mounted) {
      setState(() => _earningsData = data);
    }
  }

  void _triggerOrderAlert(OrderModel order) {
    AlertManager().triggerNewOrderAlert(order);

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => OrderAlertDialog(
        order: order,
        onAccept: () async {
          if (order.isDirectAssignment) {
            // Already assigned by admin, simply refresh to focus active trip
            _syncFeed();
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('🚀 Trip Ready! Head to the pickup location.'),
                backgroundColor: Color(0xFF22C55E),
              ),
            );
          } else {
            final res = await ApiService.acceptJob(order.parcelId);
            if (res['success'] == true) {
              _syncFeed();
              if (mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('🎉 Order Accepted! Please start route.'),
                    backgroundColor: Color(0xFF22C55E),
                  ),
                );
              }
            } else {
              if (mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text(res['error'] ?? 'Failed to accept order'),
                    backgroundColor: Colors.red,
                  ),
                );
              }
            }
          }
        },
      ),
    );
  }

  // Google Maps Turn-by-Turn Navigation
  void _openGoogleMaps(String destinationAddress) async {
    final query = Uri.encodeComponent(destinationAddress);
    final googleMapsUrl = Uri.parse(
        'https://www.google.com/maps/dir/?api=1&destination=$query&travelmode=driving&dir_action=navigate');
    try {
      if (await canLaunchUrl(googleMapsUrl)) {
        await launchUrl(googleMapsUrl, mode: LaunchMode.externalApplication);
      } else {
        await launchUrl(googleMapsUrl);
      }
    } catch (e) {
      debugPrint('Maps launch error: $e');
    }
  }

  // Phone Call
  void _makePhoneCall(String phoneNumber) async {
    final clean = phoneNumber.replaceAll(RegExp(r'\D'), '');
    final telUri = Uri.parse('tel:$clean');
    try {
      if (await canLaunchUrl(telUri)) {
        await launchUrl(telUri);
      }
    } catch (e) {
      debugPrint('Call error: $e');
    }
  }

  void _triggerTestAlert() {
    final testOrder = OrderModel(
      parcelId: 'RDR-${(10000 + (DateTime.now().millisecond * 80)).toInt()}',
      pickupAddress: 'Vaishali Nagar (Near Amrapali Circle), Jaipur',
      dropAddress: 'Mansarovar Metro Station (Pillar 64), Jaipur',
      senderName: 'Rajesh Sharma',
      senderPhone: '9829012345',
      receiverName: 'Pooja Verma',
      receiverPhone: '9829067890',
      totalAmount: 260.0,
      bookingStatus: 'driver_assigned',
      isDirectAssignment: true,
    );
    _triggerOrderAlert(testOrder);
  }

  @override
  Widget build(BuildContext context) {
    final driver = ApiService.currentDriver;
    final isOnDuty = driver?.onDuty ?? true;

    return Scaffold(
      backgroundColor: const Color(0xFF090D16),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0F172A),
        elevation: 2,
        title: Row(
          children: [
            Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                color: const Color(0xFF1E293B),
                shape: BoxShape.circle,
                border: Border.all(
                  color: isOnDuty ? const Color(0xFF22C55E) : Colors.red,
                  width: 2,
                ),
              ),
              child: const Icon(Icons.person, color: Colors.white, size: 20),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    driver?.driverName ?? 'Rudraksha Rider',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 14,
                      fontWeight: FontWeight.bold,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                  Text(
                    '${driver?.vehicleType ?? 'Bike'} • ${driver?.vehicleNumber ?? '-'}',
                    style: const TextStyle(color: Colors.white54, fontSize: 11),
                  ),
                ],
              ),
            ),
          ],
        ),
        actions: [
          // On / Off Duty Toggle Switch
          Padding(
            padding: const EdgeInsets.only(right: 8.0),
            child: FilterChip(
              avatar: Icon(
                Icons.circle,
                size: 10,
                color: isOnDuty ? const Color(0xFF22C55E) : Colors.red,
              ),
              label: Text(
                isOnDuty ? 'ON DUTY' : 'OFF DUTY',
                style: TextStyle(
                  color: isOnDuty ? const Color(0xFF22C55E) : Colors.red,
                  fontWeight: FontWeight.bold,
                  fontSize: 11,
                ),
              ),
              backgroundColor: isOnDuty
                  ? const Color(0xFF22C55E).withValues(alpha: 0.12)
                  : Colors.red.withValues(alpha: 0.12),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(20),
                side: BorderSide(
                  color: isOnDuty
                      ? const Color(0xFF22C55E).withValues(alpha: 0.4)
                      : Colors.red.withValues(alpha: 0.4),
                ),
              ),
              onSelected: (val) async {
                await ApiService.toggleDuty(val);
                setState(() {});
                _syncFeed();
              },
            ),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          await _syncFeed();
          await _loadEarnings();
        },
        color: const Color(0xFF22C55E),
        backgroundColor: const Color(0xFF1E293B),
        child: _isLoading
            ? const Center(
                child: CircularProgressIndicator(color: Color(0xFF22C55E)),
              )
            : _currentTab == 0
                ? _buildFeedView()
                : _currentTab == 1
                    ? _buildEarningsView()
                    : _buildProfileView(),
      ),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentTab,
        onTap: (idx) => setState(() => _currentTab = idx),
        backgroundColor: const Color(0xFF0F172A),
        selectedItemColor: const Color(0xFF22C55E),
        unselectedItemColor: Colors.white54,
        selectedLabelStyle: const TextStyle(fontWeight: FontWeight.bold),
        items: const [
          BottomNavigationBarItem(
            icon: Icon(Icons.delivery_dining_rounded),
            label: 'Orders & Map',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.account_balance_wallet_rounded),
            label: 'Earnings',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.person_rounded),
            label: 'Profile',
          ),
        ],
      ),
    );
  }

  // 1. ORDERS & FEED VIEW
  Widget _buildFeedView() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // Test Alert Banner for Quick Demo
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(
            color: const Color(0xFF1E293B),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: Colors.white12),
          ),
          child: Row(
            children: [
              const Icon(Icons.notifications_active,
                  color: Color(0xFFF97316), size: 20),
              const SizedBox(width: 10),
              const Expanded(
                child: Text(
                  'Siren & Lock-screen Push Ready',
                  style: TextStyle(color: Colors.white70, fontSize: 12),
                ),
              ),
              TextButton(
                onPressed: _triggerTestAlert,
                style: TextButton.styleFrom(
                  backgroundColor: const Color(0xFFF97316).withValues(alpha: 0.15),
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  minimumSize: Size.zero,
                ),
                child: const Text('Test Alert',
                    style: TextStyle(color: Color(0xFFF97316), fontSize: 11)),
              ),
            ],
          ),
        ),

        const SizedBox(height: 16),

        // Active Trip Card (if any active trip)
        if (_activeTrip != null) ...[
          _buildActiveTripWidget(_activeTrip!),
          const SizedBox(height: 20),
        ],

        // Available Pool Jobs
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text(
              'AVAILABLE JOBS (OPEN POOL)',
              style: TextStyle(
                color: Colors.white60,
                fontSize: 12,
                fontWeight: FontWeight.bold,
                letterSpacing: 1,
              ),
            ),
            if (_availableJobs.isNotEmpty)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: const Color(0xFF22C55E).withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  '${_availableJobs.length} Live',
                  style: const TextStyle(
                      color: Color(0xFF22C55E),
                      fontSize: 11,
                      fontWeight: FontWeight.bold),
                ),
              ),
          ],
        ),

        const SizedBox(height: 10),

        if (_activeTrip != null)
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.03),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: Colors.white10),
            ),
            child: const Center(
              child: Text(
                'Complete your Active Trip above to accept new orders.',
                style: TextStyle(color: Colors.white54, fontSize: 12),
              ),
            ),
          )
        else if (_availableJobs.isEmpty)
          Container(
            padding: const EdgeInsets.symmetric(vertical: 40, horizontal: 20),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.02),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.white10),
            ),
            child: const Column(
              children: [
                Icon(Icons.radar_rounded, color: Colors.white30, size: 48),
                SizedBox(height: 12),
                Text(
                  'Scanning for Delivery Orders...',
                  style: TextStyle(
                      color: Colors.white70,
                      fontWeight: FontWeight.bold,
                      fontSize: 14),
                ),
                SizedBox(height: 4),
                Text(
                  'New orders will alert here automatically with siren.',
                  style: TextStyle(color: Colors.white38, fontSize: 11),
                ),
              ],
            ),
          )
        else
          ..._availableJobs.map((job) => _buildPoolJobCard(job)),
      ],
    );
  }

  Widget _buildActiveTripWidget(OrderModel trip) {
    final isPickedUp = trip.bookingStatus == 'picked_up' ||
        trip.bookingStatus == 'in_transit' ||
        trip.bookingStatus == 'out_for_delivery';
    final targetAddress = isPickedUp ? trip.dropAddress : trip.pickupAddress;
    final customerPhone =
        isPickedUp ? trip.receiverPhone : trip.senderPhone;
    final customerName = isPickedUp ? trip.receiverName : trip.senderName;

    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF0F172A),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFF22C55E), width: 2),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF22C55E).withValues(alpha: 0.15),
            blurRadius: 18,
          ),
        ],
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: const Color(0xFF22C55E).withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Row(
                  children: [
                    Icon(Icons.bolt, color: Color(0xFF22C55E), size: 14),
                    SizedBox(width: 4),
                    Text(
                      'ACTIVE TRIP',
                      style: TextStyle(
                          color: Color(0xFF22C55E),
                          fontWeight: FontWeight.w900,
                          fontSize: 11),
                    ),
                  ],
                ),
              ),
              Text(
                '₹${trip.totalAmount.toInt()}',
                style: const TextStyle(
                  color: Color(0xFF22C55E),
                  fontSize: 22,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ],
          ),

          const SizedBox(height: 8),

          Text(
            'Order: ${trip.parcelId}',
            style: const TextStyle(color: Colors.white54, fontSize: 11),
          ),

          const Divider(color: Colors.white12, height: 20),

          // Route Details
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(
                isPickedUp ? Icons.location_on : Icons.arrow_upward,
                color: isPickedUp ? const Color(0xFF22C55E) : const Color(0xFF38BDF8),
                size: 20,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      isPickedUp ? 'DELIVER TO (CUSTOMER)' : 'PICKUP FROM (SENDER)',
                      style: const TextStyle(
                          color: Colors.white38,
                          fontSize: 10,
                          fontWeight: FontWeight.bold),
                    ),
                    Text(
                      targetAddress,
                      style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.bold,
                          fontSize: 13),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '$customerName ($customerPhone)',
                      style: const TextStyle(color: Colors.white70, fontSize: 11),
                    ),
                  ],
                ),
              ),
            ],
          ),

          const SizedBox(height: 16),

          // Action Buttons: Call & Turn-by-Turn Google Maps
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => _makePhoneCall(customerPhone),
                  icon: const Icon(Icons.phone, size: 16, color: Color(0xFF22C55E)),
                  label: const Text('Call', style: TextStyle(color: Colors.white)),
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: Colors.white24),
                    padding: const EdgeInsets.symmetric(vertical: 10),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                flex: 2,
                child: ElevatedButton.icon(
                  onPressed: () => _openGoogleMaps(targetAddress),
                  icon: const Icon(Icons.navigation, size: 16),
                  label: Text(
                    isPickedUp ? 'Route to Drop' : 'Route to Pickup',
                    style: const TextStyle(fontWeight: FontWeight.bold),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF38BDF8),
                    foregroundColor: Colors.black,
                    padding: const EdgeInsets.symmetric(vertical: 10),
                  ),
                ),
              ),
            ],
          ),

          const SizedBox(height: 12),

          // OTP Verification Action
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: () {
                showDialog(
                  context: context,
                  builder: (ctx) => OtpDialog(
                    parcelId: trip.parcelId,
                    mode: isPickedUp ? 'delivery' : 'pickup',
                    onSuccess: () {
                      _syncFeed();
                      _loadEarnings();
                    },
                  ),
                );
              },
              icon: Icon(isPickedUp ? Icons.check_circle : Icons.key),
              label: Text(
                isPickedUp ? 'Enter Delivery PIN & Finish' : 'Enter Pickup PIN',
                style: const TextStyle(fontWeight: FontWeight.w900),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor:
                    isPickedUp ? const Color(0xFF22C55E) : const Color(0xFFF97316),
                foregroundColor: isPickedUp ? Colors.black : Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 12),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPoolJobCard(OrderModel job) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF131D2E),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                job.parcelId,
                style: const TextStyle(
                    color: Colors.white70,
                    fontWeight: FontWeight.bold,
                    fontSize: 12),
              ),
              Text(
                '₹${job.totalAmount.toInt()}',
                style: const TextStyle(
                  color: Color(0xFF22C55E),
                  fontSize: 20,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text('📍 Pickup: ${job.pickupAddress}',
              style: const TextStyle(color: Colors.white, fontSize: 12)),
          const SizedBox(height: 4),
          Text('🏁 Drop: ${job.dropAddress}',
              style: const TextStyle(color: Colors.white70, fontSize: 12)),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: () async {
                final res = await ApiService.acceptJob(job.parcelId);
                if (res['success'] == true) {
                  _syncFeed();
                }
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF22C55E),
                foregroundColor: Colors.black,
              ),
              child: const Text('ACCEPT ORDER',
                  style: TextStyle(fontWeight: FontWeight.bold)),
            ),
          ),
        ],
      ),
    );
  }

  // 2. EARNINGS VIEW
  Widget _buildEarningsView() {
    final totalEarn = _earningsData?['totalEarnings'] ?? 0;
    final totalTrips = _earningsData?['completedTrips'] ?? 0;
    final List trips = _earningsData?['trips'] ?? [];

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0xFF1E293B), Color(0xFF0F172A)],
            ),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: Colors.white12),
          ),
          child: Column(
            children: [
              const Text('Total Rider Earnings (Wallet)',
                  style: TextStyle(color: Colors.white54, fontSize: 13)),
              const SizedBox(height: 6),
              Text(
                '₹$totalEarn',
                style: const TextStyle(
                  color: Color(0xFF22C55E),
                  fontSize: 38,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 10),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                decoration: BoxDecoration(
                  color: const Color(0xFF22C55E).withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  '100% Direct Customer Payment • $totalTrips Trips Completed',
                  style: const TextStyle(
                      color: Color(0xFF22C55E),
                      fontSize: 11,
                      fontWeight: FontWeight.bold),
                ),
              ),
            ],
          ),
        ),

        const SizedBox(height: 24),

        const Text(
          'COMPLETED TRIPS HISTORY',
          style: TextStyle(
            color: Colors.white60,
            fontSize: 12,
            fontWeight: FontWeight.bold,
            letterSpacing: 1,
          ),
        ),

        const SizedBox(height: 12),

        if (trips.isEmpty)
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.02),
              borderRadius: BorderRadius.circular(14),
            ),
            child: const Center(
              child: Text('No completed trips found yet.',
                  style: TextStyle(color: Colors.white38)),
            ),
          )
        else
          ...trips.map((t) => Container(
                margin: const EdgeInsets.only(bottom: 8),
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: const Color(0xFF131D2E),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: Colors.white12),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          t['id'] ?? 'Trip',
                          style: const TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.bold,
                              fontSize: 13),
                        ),
                        Text(
                          t['payment_mode'] ?? 'Cash / Direct UPI',
                          style: const TextStyle(
                              color: Colors.white54, fontSize: 11),
                        ),
                      ],
                    ),
                    Text(
                      '+₹${t['driver_earning'] ?? t['customer_price'] ?? 0}',
                      style: const TextStyle(
                        color: Color(0xFF22C55E),
                        fontWeight: FontWeight.w900,
                        fontSize: 16,
                      ),
                    ),
                  ],
                ),
              )),
      ],
    );
  }

  // 3. PROFILE VIEW
  Widget _buildProfileView() {
    final driver = ApiService.currentDriver;

    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Center(
          child: Column(
            children: [
              Container(
                width: 70,
                height: 70,
                decoration: const BoxDecoration(
                  color: Color(0xFF1E293B),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.person, color: Colors.white, size: 40),
              ),
              const SizedBox(height: 12),
              Text(
                driver?.driverName ?? 'Rudraksha Rider',
                style: const TextStyle(
                    color: Colors.white,
                    fontSize: 18,
                    fontWeight: FontWeight.bold),
              ),
              Text(
                '+91 ${driver?.phone ?? '-'}',
                style: const TextStyle(color: Colors.white54, fontSize: 13),
              ),
            ],
          ),
        ),

        const SizedBox(height: 24),

        ListTile(
          tileColor: const Color(0xFF131D2E),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          leading: const Icon(Icons.motorcycle, color: Color(0xFF22C55E)),
          title: const Text('Vehicle Info', style: TextStyle(color: Colors.white)),
          subtitle: Text(
            '${driver?.vehicleType ?? 'Bike'} (${driver?.vehicleNumber ?? '-'})',
            style: const TextStyle(color: Colors.white60),
          ),
        ),

        const SizedBox(height: 8),

        ListTile(
          tileColor: const Color(0xFF131D2E),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          leading: const Icon(Icons.dns, color: Color(0xFF38BDF8)),
          title: const Text('Backend API Server',
              style: TextStyle(color: Colors.white)),
          subtitle: Text(ApiConfig.currentBaseUrl,
              style: const TextStyle(color: Colors.white60, fontSize: 12)),
        ),

        const SizedBox(height: 24),

        ElevatedButton.icon(
          onPressed: () async {
            await ApiService.logout();
            if (mounted) {
              Navigator.pushReplacement(
                context,
                MaterialPageRoute(builder: (_) => const LoginScreen()),
              );
            }
          },
          icon: const Icon(Icons.logout),
          label: const Text('LOGOUT FROM APP'),
          style: ElevatedButton.styleFrom(
            backgroundColor: Colors.red.withValues(alpha: 0.2),
            foregroundColor: Colors.redAccent,
            side: const BorderSide(color: Colors.redAccent),
            padding: const EdgeInsets.symmetric(vertical: 14),
          ),
        ),
      ],
    );
  }
}
