class OrderModel {
  final String parcelId;
  final String pickupAddress;
  final String dropAddress;
  final String senderName;
  final String senderPhone;
  final String receiverName;
  final String receiverPhone;
  final double totalAmount;
  String bookingStatus;
  final String? packageType;
  final String? weight;
  final String? paymentMethod;
  final String? createdAt;
  bool isDirectAssignment;
  bool pickupOtpVerified;
  bool deliveryOtpVerified;

  OrderModel({
    required this.parcelId,
    required this.pickupAddress,
    required this.dropAddress,
    required this.senderName,
    required this.senderPhone,
    required this.receiverName,
    required this.receiverPhone,
    required this.totalAmount,
    required this.bookingStatus,
    this.packageType,
    this.weight,
    this.paymentMethod,
    this.createdAt,
    this.isDirectAssignment = false,
    this.pickupOtpVerified = false,
    this.deliveryOtpVerified = false,
  });

  factory OrderModel.fromJson(Map<String, dynamic> json, {bool isDirect = false}) {
    final id = (json['parcel_id'] ?? json['id'] ?? '').toString();
    final rawAmount = json['total_amount'] ?? json['price'] ?? json['fare'] ?? 0;
    final amount = double.tryParse(rawAmount.toString()) ?? 0.0;

    return OrderModel(
      parcelId: id,
      pickupAddress: json['pickup_address'] ?? 'Jaipur, Rajasthan',
      dropAddress: json['drop_address'] ?? 'Jaipur, Rajasthan',
      senderName: json['sender_name'] ?? 'Sender',
      senderPhone: (json['sender_phone'] ?? '').toString(),
      receiverName: json['receiver_name'] ?? 'Receiver',
      receiverPhone: (json['receiver_phone'] ?? '').toString(),
      totalAmount: amount,
      bookingStatus: json['booking_status'] ?? json['status'] ?? 'searching_driver',
      packageType: json['package_type'],
      weight: json['weight'],
      paymentMethod: json['payment_method'] ?? 'Cash on Delivery',
      createdAt: json['created_at'],
      isDirectAssignment: isDirect,
      pickupOtpVerified: json['pickup_otp_verified'] == true,
      deliveryOtpVerified: json['delivery_otp_verified'] == true,
    );
  }
}
